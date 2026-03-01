import { Injectable, NotFoundException } from '@nestjs/common'
import { eq, and, desc, max } from 'drizzle-orm'
import { db } from '../../config/database'
import { repository, analysis } from '../../config/database/schema'
import type { Result } from '@repo/shared'
import { randomUUID } from 'node:crypto'

export interface UpsertRepoDto {
  githubRepoId: string
  owner: string
  name: string
  fullName: string
  description?: string | null
  language?: string | null
  isPrivate: boolean
  htmlUrl: string
}

@Injectable()
export class ReposService {
  async listRepos(userId: string) {
    const rows = await db
      .select({
        id: repository.id,
        userId: repository.userId,
        githubRepoId: repository.githubRepoId,
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        description: repository.description,
        language: repository.language,
        isPrivate: repository.isPrivate,
        htmlUrl: repository.htmlUrl,
        createdAt: repository.createdAt,
        updatedAt: repository.updatedAt,
        lastAnalyzedAt: max(analysis.createdAt),
      })
      .from(repository)
      .leftJoin(analysis, eq(analysis.repositoryId, repository.id))
      .where(eq(repository.userId, userId))
      .groupBy(repository.id)
      .orderBy(desc(repository.updatedAt))

    return rows.map((r) => ({
      ...r,
      lastAnalyzedAt: r.lastAnalyzedAt ?? null,
      hasAnalysis: r.lastAnalyzedAt !== null,
    }))
  }

  async upsertRepo(
    userId: string,
    dto: UpsertRepoDto,
  ): Promise<Result<typeof repository.$inferSelect>> {
    const existing = await db
      .select()
      .from(repository)
      .where(and(eq(repository.userId, userId), eq(repository.githubRepoId, dto.githubRepoId)))
      .limit(1)

    if (existing[0]) {
      const [updated] = await db
        .update(repository)
        .set({
          owner: dto.owner,
          name: dto.name,
          fullName: dto.fullName,
          description: dto.description ?? null,
          language: dto.language ?? null,
          isPrivate: dto.isPrivate,
          htmlUrl: dto.htmlUrl,
        })
        .where(eq(repository.id, existing[0].id))
        .returning()

      return [null, updated]
    }

    const [created] = await db
      .insert(repository)
      .values({
        id: randomUUID(),
        userId,
        githubRepoId: dto.githubRepoId,
        owner: dto.owner,
        name: dto.name,
        fullName: dto.fullName,
        description: dto.description ?? null,
        language: dto.language ?? null,
        isPrivate: dto.isPrivate,
        htmlUrl: dto.htmlUrl,
      })
      .returning()

    return [null, created]
  }

  async getRepo(repoId: string, userId: string): Promise<Result<typeof repository.$inferSelect>> {
    const [repo] = await db
      .select()
      .from(repository)
      .where(and(eq(repository.id, repoId), eq(repository.userId, userId)))

    if (!repo) return [new NotFoundException('Repository not found'), null]
    return [null, repo]
  }

  async listAnalyses(repoId: string, userId: string) {
    const rows = await db
      .select({
        id: analysis.id,
        status: analysis.status,
        createdAt: analysis.createdAt,
        completedAt: analysis.completedAt,
        inputTokens: analysis.inputTokens,
        outputTokens: analysis.outputTokens,
        result: analysis.result,
      })
      .from(analysis)
      .where(and(eq(analysis.repositoryId, repoId), eq(analysis.userId, userId)))
      .orderBy(desc(analysis.createdAt))

    return rows.map(({ result, ...rest }) => {
      let securityGrade: string | null = null
      if (result) {
        try {
          const parsed = JSON.parse(result)
          securityGrade = parsed?.security?.grade ?? null
        } catch {
          securityGrade = null
        }
      }
      return { ...rest, securityGrade }
    })
  }
}
