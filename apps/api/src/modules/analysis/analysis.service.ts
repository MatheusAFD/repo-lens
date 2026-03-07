import { Injectable, NotFoundException } from '@nestjs/common'
import { Subject, type Observable } from 'rxjs'
import Anthropic from '@anthropic-ai/sdk'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../config/database'
import { analysis, analysisQuestion, type repository } from '../../config/database/schema'
// biome-ignore lint/style/useImportType: value import required for NestJS emitDecoratorMetadata
import { GithubService } from '../github/github.service'
// biome-ignore lint/style/useImportType: value import required for NestJS emitDecoratorMetadata
import { ReposService } from '../repos/repos.service'
// biome-ignore lint/style/useImportType: value import required for NestJS emitDecoratorMetadata
import { ContextBuilderService } from './context-builder.service'
// biome-ignore lint/style/useImportType: value import required for NestJS emitDecoratorMetadata
import { PromptBuilderService } from './prompt-builder.service'
import type {
  AnalysisResult,
  AnalysisSectionType,
  AskQuestionRequest,
  SseEvent,
} from '@repo/shared'

const DEFAULT_SECTIONS: AnalysisSectionType[] = [
  'executive_summary',
  'tech_stack',
  'architecture',
  'security',
  'dependencies',
  'update_plan',
  'recommendations',
  'code_metrics',
  'fun_facts',
]

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

  async startAnalysis(
    repoId: string,
    userId: string,
    sections: AnalysisSectionType[] = DEFAULT_SECTIONS,
    customContext?: string,
  ): Promise<{ analysisId: string }> {
    const [repoError, repo] = await this.reposService.getRepo(repoId, userId)
    if (repoError) throw repoError

    const [{ analysisId }] = await db
      .insert(analysis)
      .values({ repositoryId: repo.id, userId, status: 'running' })
      .returning({ analysisId: analysis.id })

    this.subjects.set(analysisId, new Subject<MessageEvent>())

    this.runAnalysis(analysisId, repo, userId, sections, customContext).catch(async (runError) => {
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

  async streamAnalysis(analysisId: string, userId: string): Promise<Observable<MessageEvent>> {
    const existing = this.subjects.get(analysisId)
    if (existing) return existing.asObservable()

    const [row] = await db
      .select()
      .from(analysis)
      .where(and(eq(analysis.id, analysisId), eq(analysis.userId, userId)))

    if (row?.status === 'completed' || row?.status === 'failed') {
      const subject = new Subject<MessageEvent>()
      setTimeout(() => {
        if (row.status === 'completed' && row.result) {
          try {
            const result = JSON.parse(row.result) as Partial<AnalysisResult>
            for (const [name, data] of Object.entries(result)) {
              const sectionEvent: SseEvent = {
                type: 'section',
                name: name as AnalysisSectionType,
                data,
              }
              subject.next(
                new MessageEvent('message', {
                  data: JSON.stringify(sectionEvent),
                }),
              )
            }
          } catch {}
        }
        const finalEvent: SseEvent =
          row.status === 'completed'
            ? { type: 'done', analysisId }
            : { type: 'error', message: row.errorMessage ?? 'Analysis failed' }
        subject.next(new MessageEvent('message', { data: JSON.stringify(finalEvent) }))
        subject.complete()
      }, 0)
      return subject.asObservable()
    }

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
    sections: AnalysisSectionType[] = DEFAULT_SECTIONS,
    customContext?: string,
  ) {
    this.results.set(analysisId, {})

    const isMockMode = process.env.ANTHROPIC_MOCK === 'true'

    let files: Awaited<ReturnType<ContextBuilderService['buildContext']>> = []

    if (!isMockMode) {
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

      files = await this.contextBuilder.buildContext(
        repo.owner,
        repo.name,
        tree,
        this.githubService,
        token,
      )
    }

    this.emit(analysisId, {
      type: 'progress',
      message: 'Analyzing with Claude AI…',
    })

    const systemPrompt = this.promptBuilder.buildSystemPrompt(sections)
    const userPrompt = this.promptBuilder.buildUserPrompt(
      {
        owner: repo.owner,
        name: repo.name,
        description: repo.description,
        language: repo.language,
      },
      files,
      customContext,
    )

    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0
    const stream = isMockMode
      ? // biome-ignore lint/suspicious/noExplicitAny: dynamic require used only in test mode
        (require('./__mocks__/anthropic-stream.fixture') as any).createMockAnthropicStream(sections)
      : this.anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
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

  async getQuestions(analysisId: string, userId: string) {
    const [row] = await db
      .select()
      .from(analysis)
      .where(and(eq(analysis.id, analysisId), eq(analysis.userId, userId)))

    if (!row) throw new NotFoundException('Analysis not found')

    return db
      .select()
      .from(analysisQuestion)
      .where(eq(analysisQuestion.analysisId, analysisId))
      .orderBy(analysisQuestion.createdAt)
  }

  async askQuestion(
    analysisId: string,
    userId: string,
    { question }: AskQuestionRequest,
  ): Promise<Observable<MessageEvent>> {
    const [row] = await db
      .select()
      .from(analysis)
      .where(and(eq(analysis.id, analysisId), eq(analysis.userId, userId)))

    if (!row) throw new NotFoundException('Analysis not found')

    const [{ questionId }] = await db
      .insert(analysisQuestion)
      .values({ analysisId, userId, question })
      .returning({ questionId: analysisQuestion.id })

    const savedResult = row.result ? (JSON.parse(row.result) as Partial<AnalysisResult>) : {}
    const contextSummary = JSON.stringify(savedResult, null, 2).slice(0, 8000)

    const systemPrompt = `You are an expert assistant for the repository ${row.repositoryId}. Answer questions concisely based on the analysis context provided.`
    const userPrompt = `Analysis context:\n${contextSummary}\n\nQuestion: ${question}`

    const subject = new Subject<MessageEvent>()

    const streamKey = `ask:${questionId}`
    this.subjects.set(streamKey, subject)

    const runStream = async () => {
      let answer = ''
      const stream = this.anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          answer += chunk.delta.text
          const event: SseEvent = { type: 'progress', message: chunk.delta.text }
          subject.next(new MessageEvent('message', { data: JSON.stringify(event) }))
        }
      }

      await db.update(analysisQuestion).set({ answer }).where(eq(analysisQuestion.id, questionId))

      const doneEvent: SseEvent = { type: 'done', analysisId: questionId }
      subject.next(new MessageEvent('message', { data: JSON.stringify(doneEvent) }))
      subject.complete()
      this.subjects.delete(streamKey)
    }

    runStream().catch((err) => {
      const errorEvent: SseEvent = { type: 'error', message: err?.message ?? 'Failed to answer' }
      subject.next(new MessageEvent('message', { data: JSON.stringify(errorEvent) }))
      subject.complete()
      this.subjects.delete(streamKey)
    })

    return subject.asObservable()
  }

  private emit(analysisId: string, event: SseEvent) {
    const subject = this.subjects.get(analysisId)
    if (!subject) return
    const msg = new MessageEvent('message', { data: JSON.stringify(event) })
    subject.next(msg)
  }
}
