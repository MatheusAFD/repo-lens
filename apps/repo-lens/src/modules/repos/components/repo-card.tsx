import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent } from '@repo/ui/components/card'
import { cn } from '@repo/ui/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import type { Repository } from '../domain/repo.domain'

function NavigateToAnalyses({ repoId }: { repoId: string }) {
  const navigate = useNavigate()
  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full h-8 text-xs"
      onClick={() =>
        navigate({
          to: '/repos/$repoId/analyses' as never,
          params: { repoId } as never,
        })
      }
    >
      View Analyses
    </Button>
  )
}

interface RepoCardProps {
  repo: Repository
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  JavaScript: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  Python: 'bg-green-500/15 text-green-600 dark:text-green-400',
  Go: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  Java: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  Rust: 'bg-red-500/15 text-red-600 dark:text-red-400',
  'C#': 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Ruby: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function RepoCard({ repo }: RepoCardProps) {
  const langColor = repo.language
    ? (LANGUAGE_COLORS[repo.language] ?? 'bg-muted text-muted-foreground')
    : undefined

  return (
    <Card className="group border-border/60 hover:border-border transition-all duration-200 hover:shadow-sm bg-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <RepoIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{repo.owner}</span>
              {repo.isPrivate && (
                <span className="text-[10px] px-1 py-0.5 rounded border border-border/60 text-muted-foreground">
                  private
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm text-foreground truncate">{repo.name}</h3>
          </div>
        </div>

        {repo.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {repo.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {repo.language && (
            <Badge
              variant="secondary"
              className={cn('text-[11px] px-2 py-0.5 border-0', langColor)}
            >
              {repo.language}
            </Badge>
          )}
          {repo.lastAnalyzedAt && (
            <span className="text-[11px] text-muted-foreground">
              Last analyzed {formatDate(repo.lastAnalyzedAt)}
            </span>
          )}
          {!repo.hasAnalysis && (
            <span className="text-[11px] text-muted-foreground">Never analyzed</span>
          )}
        </div>

        <NavigateToAnalyses repoId={repo.id} />
      </CardContent>
    </Card>
  )
}

function RepoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 00-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 004 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}
