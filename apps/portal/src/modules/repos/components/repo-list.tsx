import { Button } from '@repo/ui/components/button'
import { Skeleton } from '@repo/ui/components/skeleton'
import { useState } from 'react'
import { useRepositories } from '../hooks/use-repos'
import { AddRepoDialog } from './add-repo-dialog'
import { RepoCard } from './repo-card'

export function RepoList() {
  const { data: repos, isLoading, refetch } = useRepositories()
  const [dialogOpen, setDialogOpen] = useState(false)

  const repoCountText = repos
    ? `${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}`
    : 'No repositories yet'

  const hasRepos = !isLoading && !!repos && repos.length > 0
  const showEmpty = !isLoading && repos?.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Repositories</h2>
          <p className="text-sm text-muted-foreground">{repoCountText}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2 h-8 text-xs">
          <PlusIcon />
          Add repository
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((skeletonKey) => (
            <Skeleton key={skeletonKey} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {hasRepos && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <EmptyIcon />
          </div>
          <div>
            <p className="font-medium text-sm">No repositories yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first repository to get started.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2 h-8 text-xs">
            <PlusIcon />
            Add repository
          </Button>
        </div>
      )}

      <AddRepoDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdded={() => refetch()} />
    </div>
  )
}

function PlusIcon() {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-6 h-6 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 00-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 004 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    </svg>
  )
}
