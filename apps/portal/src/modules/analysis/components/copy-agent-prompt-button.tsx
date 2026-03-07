import type { AnalysisResult } from '@repo/shared'
import { Button } from '@repo/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { useState } from 'react'
import { toast } from 'sonner'

interface CopyAgentPromptButtonProps {
  repoFullName: string
  result: Partial<AnalysisResult>
}

function buildAgentPrompt(repoFullName: string, result: Partial<AnalysisResult>): string {
  const lines: string[] = [
    `You are an expert developer. Fix the following issues found in \`${repoFullName}\`:`,
    '',
  ]

  if (result.security) {
    lines.push(`## Security (Grade: ${result.security.grade}, Score: ${result.security.score})`)
    for (const finding of result.security.findings) {
      lines.push(`- [${finding.severity}] ${finding.description} (OWASP: ${finding.owasp})`)
    }
    lines.push('')
  }

  if (result.dependencies) {
    const vulnerable = result.dependencies.highlights.filter((h) => h.status === 'vulnerable')
    if (vulnerable.length > 0) {
      lines.push('## Vulnerable Dependencies')
      for (const dep of vulnerable) {
        lines.push(`- ${dep.name} ${dep.version} → upgrade to ${dep.latestVersion}`)
      }
      lines.push('')
    }
  }

  if (result.update_plan) {
    const critical = result.update_plan.critical
    if (critical.length > 0) {
      lines.push('## Critical Updates')
      for (const item of critical) {
        lines.push(`- ${item.name}: ${item.current} → ${item.target} (${item.reason})`)
      }
      lines.push('')
    }
  }

  if (result.recommendations) {
    lines.push('## Recommendations')
    for (const item of result.recommendations.items) {
      lines.push(
        `${item.rank}. **${item.title}** — ${item.rationale} (effort: ${item.effort}, impact: ${item.impact})`,
      )
    }
    lines.push('')
  }

  lines.push('Apply all fixes maintaining existing code style and conventions.')

  return lines.join('\n')
}

export function CopyAgentPromptButton({ repoFullName, result }: CopyAgentPromptButtonProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const prompt = buildAgentPrompt(repoFullName, result)
    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        setCopied(true)
        toast.success('Agent prompt copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Failed to copy'))
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-8 text-xs cursor-pointer gap-1.5"
            data-testid="btn-copy-agent-prompt"
          >
            {copied ? (
              <>
                <CheckIcon />
                Copied
              </>
            ) : (
              <>
                <BotIcon />
                Copy Agent Prompt
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copies a detailed AI agent prompt with all issues and fixes for this repo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function BotIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="10" x="3" y="11" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
