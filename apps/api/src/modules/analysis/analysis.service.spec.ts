import { NotFoundException } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => () => {},
  Roles: () => () => {},
  Session: () => () => {},
}))

jest.mock('../../config/database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}))

jest.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = jest.fn().mockImplementation(() => ({}))
  return { default: MockAnthropic, __esModule: true }
})

import { AnalysisService } from './analysis.service'
import { GithubService } from '../github/github.service'
import { ReposService } from '../repos/repos.service'
import { ContextBuilderService } from './context-builder.service'
import { PromptBuilderService } from './prompt-builder.service'
import { db } from '../../config/database'

const mockDb = db as jest.Mocked<typeof db>

const mockGithubService = {
  getToken: jest.fn(),
  getRepoTree: jest.fn(),
  getFileContent: jest.fn(),
}

const mockReposService = {
  getRepo: jest.fn(),
}

const mockContextBuilder = {
  buildContext: jest.fn().mockResolvedValue([]),
}

const mockPromptBuilder = {
  buildSystemPrompt: jest.fn().mockReturnValue('system prompt'),
  buildUserPrompt: jest.fn().mockReturnValue('user prompt'),
}

describe('AnalysisService', () => {
  let service: AnalysisService

  beforeEach(async () => {
    jest.clearAllMocks()
    process.env.ANTHROPIC_MOCK = 'true'

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: GithubService, useValue: mockGithubService },
        { provide: ReposService, useValue: mockReposService },
        { provide: ContextBuilderService, useValue: mockContextBuilder },
        { provide: PromptBuilderService, useValue: mockPromptBuilder },
      ],
    }).compile()

    service = module.get<AnalysisService>(AnalysisService)
  })

  afterEach(() => {
    process.env.ANTHROPIC_MOCK = undefined
  })

  describe('startAnalysis', () => {
    it('throws NotFoundException when repo not found', async () => {
      mockReposService.getRepo.mockResolvedValue([
        new NotFoundException('Repository not found'),
        null,
      ])

      await expect(service.startAnalysis('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('returns { analysisId } when called with valid repoId', async () => {
      const mockRepo = {
        id: 'repo-1',
        owner: 'owner',
        name: 'repo',
        userId: 'user-1',
      }
      mockReposService.getRepo.mockResolvedValue([null, mockRepo])

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ analysisId: 'analysis-1' }]),
        }),
      })

      mockGithubService.getToken.mockResolvedValue('ghp_token')
      mockGithubService.getRepoTree.mockResolvedValue([null, []])

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })

      const result = await service.startAnalysis('repo-1', 'user-1')

      expect(result).toHaveProperty('analysisId')
      expect(typeof result.analysisId).toBe('string')
    })

    it('calls buildSystemPrompt with provided sections subset', async () => {
      const mockRepo = { id: 'repo-1', owner: 'owner', name: 'repo', userId: 'user-1' }
      mockReposService.getRepo.mockResolvedValue([null, mockRepo])
      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ analysisId: 'analysis-1' }]),
        }),
      })
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      })

      await service.startAnalysis('repo-1', 'user-1', ['executive_summary', 'security'])

      await new Promise((r) => setTimeout(r, 500))

      expect(mockPromptBuilder.buildSystemPrompt).toHaveBeenCalledWith([
        'executive_summary',
        'security',
      ])
    })

    it('passes customContext to buildUserPrompt', async () => {
      const mockRepo = { id: 'repo-1', owner: 'owner', name: 'repo', userId: 'user-1' }
      mockReposService.getRepo.mockResolvedValue([null, mockRepo])
      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ analysisId: 'analysis-1' }]),
        }),
      })
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      })

      await service.startAnalysis('repo-1', 'user-1', ['executive_summary'], 'B2B SaaS context')

      await new Promise((r) => setTimeout(r, 500))

      expect(mockPromptBuilder.buildUserPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'owner', name: 'repo' }),
        expect.any(Array),
        'B2B SaaS context',
      )
    })
  })

  describe('getAnalysis', () => {
    it('throws NotFoundException when analysis does not exist', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })

      await expect(service.getAnalysis('non-existent', 'user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns analysis with parsed result JSON', async () => {
      const resultData = { executive_summary: { summary: 'Good project' } }
      const mockRow = {
        id: 'analysis-1',
        status: 'completed',
        result: JSON.stringify(resultData),
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockRow]),
        }),
      })

      const result = await service.getAnalysis('analysis-1', 'user-1')

      expect(result.result).toEqual(resultData)
    })

    it('returns null result when result column is null', async () => {
      const mockRow = { id: 'analysis-1', status: 'running', result: null }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockRow]),
        }),
      })

      const result = await service.getAnalysis('analysis-1', 'user-1')

      expect(result.result).toBeNull()
    })
  })

  describe('getLatestAnalysis', () => {
    it('returns null when no completed analysis exists', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })

      const result = await service.getLatestAnalysis('repo-1', 'user-1')

      expect(result).toBeNull()
    })

    it('returns latest completed analysis with parsed result', async () => {
      const resultData = { security: { grade: 'A' } }
      const mockRow = {
        id: 'analysis-1',
        status: 'completed',
        result: JSON.stringify(resultData),
        completedAt: new Date(),
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockRow]),
            }),
          }),
        }),
      })

      const result = await service.getLatestAnalysis('repo-1', 'user-1')

      expect(result).not.toBeNull()
      expect(result?.result).toEqual(resultData)
    })
  })
  describe('askQuestion', () => {
    it('throws NotFoundException when analysis does not belong to user', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        service.askQuestion('non-existent', 'user-1', { question: 'What does this do?' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('returns an Observable when analysis exists', async () => {
      const mockRow = {
        id: 'analysis-1',
        repositoryId: 'repo-1',
        userId: 'user-1',
        status: 'completed',
        result: JSON.stringify({ executive_summary: { summary: 'Good project' } }),
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockRow]),
        }),
      })

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ questionId: 'question-1' }]),
        }),
      })

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })

      const result = await service.askQuestion('analysis-1', 'user-1', {
        question: 'What is the main purpose?',
      })

      expect(result).toBeDefined()
      expect(typeof result.subscribe).toBe('function')
    })
  })
})
