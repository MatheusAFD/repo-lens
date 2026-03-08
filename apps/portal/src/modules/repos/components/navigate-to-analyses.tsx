import { Button } from '@repo/ui/components/button'
import { useNavigate } from '@tanstack/react-router'

interface NavigateToAnalysesProps {
  repoId: string
}

export function NavigateToAnalyses({ repoId }: NavigateToAnalysesProps) {
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
