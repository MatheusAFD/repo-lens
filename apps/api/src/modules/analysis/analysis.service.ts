import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Subject, type Observable } from 'rxjs'
import Anthropic from '@anthropic-ai/sdk'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../../config/database'
import { analysis, type repository } from '../../config/database/schema'
import type { GithubService } from '../github/github.service'
import type { ReposService } from '../repos/repos.service'
import type { ContextBuilderService } from './context-builder.service'
import type { PromptBuilderService } from './prompt-builder.service'
import type { AnalysisResult, AnalysisSectionType, SseEvent } from '@repo/shared'

const MAX_ANALYSES_PER_HOUR = 3
const rateLimitMap = new Map<string, number[]>()

@Injectable()
export class AnalysisService {
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
  private readonly subjects = new Map<string, Subject<MessageEvent>>()
  private readonly results = new Map<string, Partial<AnalysisResult>>()

  constructor(
    private readonly githubService: GithubService,
    private readonly reposService: ReposService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async startAnalysis(repoId: string, userId: string): Promise<{ analysisId: string }> {
    this.enforceRateLimit(userId)

    const [repoError, repo] = await this.reposService.getRepo(repoId, userId)
    if (repoError) throw repoError

    const analysisId = randomUUID()
    await db.insert(analysis).values({
      id: analysisId,
      repositoryId: repo.id,
      userId,
      status: 'running',
    })

    this.runAnalysis(analysisId, repo, userId).catch(async (runError) => {
      await db
        .update(analysis)
        .set({
          status: 'failed',
          errorMessage: runError?.message ?? 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(analysis.id, analysisId))
      this.emit(analysisId, {
        type: 'error',
        message: runError?.message ?? 'Analysis failed',
      })
      this.subjects.get(analysisId)?.complete()
      this.subjects.delete(analysisId)
      this.results.delete(analysisId)
    })

    return { analysisId }
  }

  streamAnalysis(analysisId: string, _userId: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>()
    this.subjects.set(analysisId, subject)
    return subject.asObservable()
  }

  async getAnalysis(analysisId: string, userId: string) {
    const [row] = await db
      .select()
      .from(analysis)
      .where(and(eq(analysis.id, analysisId), eq(analysis.userId, userId)))

    if (!row) throw new NotFoundException('Analysis not found')
    const result = row.result ? JSON.parse(row.result) : null
    return { ...row, result }
  }

  async getLatestAnalysis(repoId: string, userId: string) {
    const [row] = await db
      .select()
      .from(analysis)
      .where(
        and(
          eq(analysis.repositoryId, repoId),
          eq(analysis.userId, userId),
          eq(analysis.status, 'completed'),
        ),
      )
      .orderBy(desc(analysis.completedAt))
      .limit(1)

    if (!row || !row.result) return null
    return { ...row, result: JSON.parse(row.result) }
  }

  private async runAnalysis(
    analysisId: string,
    repo: typeof repository.$inferSelect,
    userId: string,
  ) {
    this.results.set(analysisId, {})
    this.emit(analysisId, {
      type: 'progress',
      message: 'Fetching repository structure…',
    })

    const token = await this.githubService.getToken(userId)
    if (!token) throw new Error('GitHub account not connected')

    const [treeErr, tree] = await this.githubService.getRepoTree(repo.owner, repo.name, token)
    if (treeErr || !tree) throw treeErr ?? new Error('Could not fetch repository tree')

    this.emit(analysisId, {
      type: 'progress',
      message: 'Selecting relevant files…',
    })

    const files = await this.contextBuilder.buildContext(
      repo.owner,
      repo.name,
      tree,
      this.githubService,
      token,
    )

    this.emit(analysisId, {
      type: 'progress',
      message: 'Analyzing with Claude AI…',
    })

    const systemPrompt = this.promptBuilder.buildSystemPrompt()
    const userPrompt = this.promptBuilder.buildUserPrompt(
      {
        owner: repo.owner,
        name: repo.name,
        description: repo.description,
        language: repo.language,
      },
      files,
    )

    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    const stream = await this.anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        buffer += chunk.delta.text
        buffer = this.parseAndEmitSections(analysisId, buffer)
      }
      if (chunk.type === 'message_delta' && chunk.usage) {
        outputTokens = chunk.usage.output_tokens
      }
      if (chunk.type === 'message_start' && chunk.message.usage) {
        inputTokens = chunk.message.usage.input_tokens
      }
    }

    const resultData = this.results.get(analysisId) ?? {}
    await db
      .update(analysis)
      .set({
        status: 'completed',
        completedAt: new Date(),
        inputTokens,
        outputTokens,
        result: JSON.stringify(resultData),
      })
      .where(eq(analysis.id, analysisId))

    this.emit(analysisId, { type: 'done', analysisId })
    this.subjects.get(analysisId)?.complete()
    this.subjects.delete(analysisId)
    this.results.delete(analysisId)
  }

  private parseAndEmitSections(analysisId: string, buffer: string): string {
    const beginPattern = /##BEGIN_SECTION:(\w+)##/
    const endPattern = /##END_SECTION:(\w+)##/

    let remaining = buffer

    while (true) {
      const beginMatch = remaining.match(beginPattern)
      if (!beginMatch) break

      const sectionName = beginMatch[1] as AnalysisSectionType
      const afterBegin = remaining.slice((beginMatch.index ?? 0) + beginMatch[0].length)

      const endMatch = afterBegin.match(new RegExp(`##END_SECTION:${sectionName}##`))
      if (!endMatch) break

      const jsonStr = afterBegin.slice(0, endMatch.index).trim()

      try {
        const data = JSON.parse(jsonStr)
        const current = this.results.get(analysisId) ?? {}
        this.results.set(analysisId, { ...current, [sectionName]: data })
        this.emit(analysisId, { type: 'section', name: sectionName, data })
      } catch {}

      remaining = afterBegin.slice((endMatch.index ?? 0) + endMatch[0].length)
    }

    return remaining
  }

  private emit(analysisId: string, event: SseEvent) {
    const subject = this.subjects.get(analysisId)
    if (!subject) return
    const msg = new MessageEvent('message', { data: JSON.stringify(event) })
    subject.next(msg)
  }

  private enforceRateLimit(userId: string) {
    const now = Date.now()
    const hourAgo = now - 60 * 60 * 1000
    const timestamps = (rateLimitMap.get(userId) ?? []).filter((timestamp) => timestamp > hourAgo)

    if (timestamps.length >= MAX_ANALYSES_PER_HOUR) {
      throw new ForbiddenException(
        `Rate limit exceeded: max ${MAX_ANALYSES_PER_HOUR} analyses per hour`,
      )
    }

    timestamps.push(now)
    rateLimitMap.set(userId, timestamps)
  }
}
