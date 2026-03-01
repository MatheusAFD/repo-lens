import { Injectable, UnauthorizedException } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { db } from '../../config/database'
import { account as accountTable } from '../../config/database/schema'
import type { Result } from '@repo/shared'

export interface GithubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  description: string | null
  language: string | null
  private: boolean
  html_url: string
  updated_at: string
  stargazers_count: number
}

export interface GithubTreeItem {
  path: string
  type: 'blob' | 'tree'
  size?: number
  sha: string
}

@Injectable()
export class GithubService {
  async getToken(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ accessToken: accountTable.accessToken })
      .from(accountTable)
      .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'github')))

    return row?.accessToken ?? null
  }

  async listUserRepos(userId: string): Promise<Result<GithubRepo[]>> {
    const token = await this.getToken(userId)
    if (!token) return [new UnauthorizedException('GitHub account not connected'), null]

    const res = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!res.ok) return [new Error(`GitHub API error: ${res.status}`), null]

    const repos = (await res.json()) as GithubRepo[]
    return [null, repos]
  }

  async getRepoTree(owner: string, repo: string, token: string): Promise<Result<GithubTreeItem[]>> {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!res.ok) return [new Error(`GitHub tree error: ${res.status}`), null]

    const data = (await res.json()) as { tree: GithubTreeItem[]; truncated: boolean }
    return [null, data.tree]
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    token: string,
  ): Promise<Result<string>> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!res.ok) return [new Error(`GitHub content error: ${res.status}`), null]

    const data = (await res.json()) as { content?: string; encoding?: string }
    if (!data.content || data.encoding !== 'base64') {
      return [new Error('Unexpected response format'), null]
    }

    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    return [null, content]
  }
}
