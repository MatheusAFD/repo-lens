import { Test, type TestingModule } from '@nestjs/testing'

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => () => {},
}))

import { PromptBuilderService } from './prompt-builder.service'

describe('PromptBuilderService', () => {
  let service: PromptBuilderService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilderService],
    }).compile()
    service = module.get<PromptBuilderService>(PromptBuilderService)
  })

  describe('buildSystemPrompt', () => {
    it('contains all 7 section names', () => {
      const prompt = service.buildSystemPrompt()

      expect(prompt).toContain('executive_summary')
      expect(prompt).toContain('tech_stack')
      expect(prompt).toContain('architecture')
      expect(prompt).toContain('security')
      expect(prompt).toContain('dependencies')
      expect(prompt).toContain('update_plan')
      expect(prompt).toContain('recommendations')
    })

    it('contains BEGIN_SECTION and END_SECTION marker patterns', () => {
      const prompt = service.buildSystemPrompt()

      expect(prompt).toContain('##BEGIN_SECTION:')
      expect(prompt).toContain('##END_SECTION:')
    })

    it('mentions the 7-section count', () => {
      const prompt = service.buildSystemPrompt()

      expect(prompt).toContain('7')
    })
  })

  describe('buildUserPrompt', () => {
    const files = [
      { path: 'src/index.ts', content: 'export const app = 1' },
      { path: 'package.json', content: '{"name":"test"}' },
    ]

    it('includes repository owner/name header', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: 'TypeScript', description: null },
        files,
      )

      expect(prompt).toContain('Repository: acme/my-app')
    })

    it('includes primary language', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: 'TypeScript', description: null },
        files,
      )

      expect(prompt).toContain('Primary Language: TypeScript')
    })

    it('uses "Unknown" when language is null', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: null, description: null },
        files,
      )

      expect(prompt).toContain('Primary Language: Unknown')
    })

    it('uses "No description provided" when description is null', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: 'TypeScript', description: null },
        files,
      )

      expect(prompt).toContain('Description: No description provided')
    })

    it('includes file path headers with === delimiters', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: 'TypeScript', description: null },
        files,
      )

      expect(prompt).toContain('=== src/index.ts ===')
      expect(prompt).toContain('=== package.json ===')
    })

    it('includes file contents', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: 'TypeScript', description: null },
        files,
      )

      expect(prompt).toContain('export const app = 1')
      expect(prompt).toContain('{"name":"test"}')
    })

    it('includes description when provided', () => {
      const prompt = service.buildUserPrompt(
        { owner: 'acme', name: 'my-app', language: 'TypeScript', description: 'A cool app' },
        files,
      )

      expect(prompt).toContain('Description: A cool app')
    })
  })
})
