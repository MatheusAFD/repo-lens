import { Injectable } from '@nestjs/common'

interface RepoMeta {
  owner: string
  name: string
  description?: string | null
  language?: string | null
}

interface FileContext {
  path: string
  content: string
}

@Injectable()
export class PromptBuilderService {
  buildSystemPrompt(): string {
    return `You are a senior software architect and security engineer performing a structured code repository analysis.

Analyze the provided repository context and respond with exactly 7 JSON sections.
Each section is delimited by ##BEGIN_SECTION:{section_name}## and ##END_SECTION:{section_name}##.

Sections in order:
1. executive_summary
2. tech_stack
3. architecture
4. security
5. dependencies
6. update_plan
7. recommendations

JSON shapes per section:

executive_summary: {"summary": string, "targetAudience": string, "keyCapabilities": string[]}

tech_stack: {"languages": [{"name": string, "percentage": number}], "frameworks": string[], "databases": string[], "cloud": string[], "testing": string[]}

architecture: {"pattern": string, "description": string, "keyPatterns": string[], "observations": string[]}

security: {"grade": "A"|"B"|"C"|"D"|"F", "score": number, "findings": [{"severity": "critical"|"high"|"medium"|"low", "description": string, "owasp": string}], "positives": string[]}

dependencies: {"total": number, "ecosystems": [{"name": string, "count": number, "outdated": number, "vulnerable": number}], "highlights": [{"name": string, "version": string, "latestVersion": string, "status": "ok"|"outdated"|"vulnerable"}]}

update_plan: {"critical": [{"name": string, "current": string, "target": string, "reason": string, "gain": string}], "major": [], "minor": []}

recommendations: {"items": [{"rank": number, "title": string, "effort": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "rationale": string}]}

Rules:
- Be concise. Target 150-300 words per section.
- Use plain language for executive_summary (non-technical audience).
- Security: focus on OWASP Top 10. If no issues found, grade A.
- Recommendations: exactly 7 items ordered by impact descending.
- Output ONLY the section markers and JSON. No preamble, no postamble, no markdown fences.`
  }

  buildUserPrompt(meta: RepoMeta, files: FileContext[]): string {
    const lines: string[] = [
      `Repository: ${meta.owner}/${meta.name}`,
      `Primary Language: ${meta.language ?? 'Unknown'}`,
      `Description: ${meta.description ?? 'No description provided'}`,
      '',
    ]

    for (const file of files) {
      lines.push(`=== ${file.path} ===`)
      lines.push(file.content)
      lines.push('')
    }

    return lines.join('\n')
  }
}
