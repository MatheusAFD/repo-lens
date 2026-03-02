import { AppHeader } from '@/common/components/app-header'
import { HealthGradeBadge } from '@/common/components/health-grade-badge'
import { SECTION_ICONS } from '@/common/components/section-icons'
import { SECTION_META, SECTION_ORDER } from '@/common/constants/analysis-sections'
import type { Repository } from '@/modules/repos/domain/repo.domain'
import type { AnalysisResult, AnalysisSectionType } from '@repo/shared'
import { Button } from '@repo/ui/components/button'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { Link } from '@tanstack/react-router'
import { Check, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAnalysis, useStartAnalysis } from '../hooks/use-analysis'
import { useAnalysisStream } from '../hooks/use-analysis-stream'
import { AnalysisProgress } from './analysis-progress'
import { ArchitectureSection } from './architecture-section'
import { DependenciesSection } from './dependencies-section'
import { ExecutiveSummarySectionView as ExecutiveSummarySection } from './executive-summary-section'
import { RecommendationsSection } from './recommendations-section'
import { SecuritySection } from './security-section'
import { TechStackSection } from './tech-stack-section'
import { UpdatePlanSection } from './update-plan-section'

interface AnalysisPageProps {
  repo: Repository
  initialAnalysisId: string
}

function SectionTabs({
  sections,
  isStreaming,
  currentStreamingSection,
}: {
  sections: Partial<AnalysisResult>
  isStreaming: boolean
  currentStreamingSection: string | null
}) {
  const availableTabs = SECTION_ORDER.filter((s) => s in sections)
  const [activeTab, setActiveTab] = useState<AnalysisSectionType>('executive_summary')
  const currentActiveTab = availableTabs.includes(activeTab)
    ? activeTab
    : (availableTabs[0] ?? 'executive_summary')
  const tabsListRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const scrollTabIntoView = useCallback((section: string) => {
    const el = triggerRefs.current[section]
    if (el)
      el.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
  }, [])

  useEffect(() => {
    scrollTabIntoView(currentActiveTab)
  }, [currentActiveTab, scrollTabIntoView])

  if (availableTabs.length === 0) return null

  const isFirstTabActive = currentActiveTab === 'executive_summary'

  return (
    <Tabs
      value={currentActiveTab}
      onValueChange={(v) => {
        const s = v as AnalysisSectionType
        setActiveTab(s)
        scrollTabIntoView(s)
      }}
    >
      <div
        ref={tabsListRef}
        className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: 'none' }}
      >
        <TabsList className="flex w-max h-auto p-1 gap-0.5 rounded-xl bg-muted">
          {SECTION_ORDER.map((section) => {
            const available = availableTabs.includes(section)
            const meta = SECTION_META[section]
            const isActiveStreaming = isStreaming && currentStreamingSection === section
            return (
              <TabsTrigger
                key={section}
                value={section}
                disabled={!available}
                ref={(el) => {
                  triggerRefs.current[section] = el
                }}
                className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg h-auto disabled:opacity-30 cursor-pointer data-[state=active]:cursor-default whitespace-nowrap"
              >
                <span className="[&_svg]:w-3.5 [&_svg]:h-3.5 shrink-0">
                  {SECTION_ICONS[section]}
                </span>
                <span>{meta.label}</span>
                {available && !isActiveStreaming && (
                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/15 shrink-0">
                    <Check className=" size-3.5 text-primary" strokeWidth={2} />
                  </span>
                )}
                {isActiveStreaming && (
                  <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      <div className="mt-4">
        <TabsContent value="executive_summary">
          {sections.executive_summary ? (
            <ExecutiveSummarySection
              data={sections.executive_summary}
              isStreaming={isStreaming && !sections.tech_stack}
            />
          ) : (
            isFirstTabActive && isStreaming && <TabSkeletonPlaceholder />
          )}
        </TabsContent>
        <TabsContent value="tech_stack">
          {sections.tech_stack && (
            <TechStackSection
              data={sections.tech_stack}
              isStreaming={isStreaming && !sections.architecture}
            />
          )}
        </TabsContent>
        <TabsContent value="architecture">
          {sections.architecture && (
            <ArchitectureSection
              data={sections.architecture}
              isStreaming={isStreaming && !sections.security}
            />
          )}
        </TabsContent>
        <TabsContent value="security">
          {sections.security && (
            <SecuritySection
              data={sections.security}
              isStreaming={isStreaming && !sections.dependencies}
            />
          )}
        </TabsContent>
        <TabsContent value="dependencies">
          {sections.dependencies && (
            <DependenciesSection
              data={sections.dependencies}
              isStreaming={isStreaming && !sections.update_plan}
            />
          )}
        </TabsContent>
        <TabsContent value="update_plan">
          {sections.update_plan && (
            <UpdatePlanSection
              data={sections.update_plan}
              isStreaming={isStreaming && !sections.recommendations}
            />
          )}
        </TabsContent>
        <TabsContent value="recommendations">
          {sections.recommendations && <RecommendationsSection data={sections.recommendations} />}
        </TabsContent>
      </div>
    </Tabs>
  )
}

function TabSkeletonPlaceholder() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  )
}

export function AnalysisPage({ repo, initialAnalysisId }: AnalysisPageProps) {
  const [streamingId, setStreamingId] = useState<string | null>(initialAnalysisId)
  const [isStarting, setIsStarting] = useState(false)
  const startedInSessionRef = useRef(false)
  const { mutateAsync: startAnalysis } = useStartAnalysis(repo.id)
  const {
    data: saved,
    isLoading: savedLoading,
    refetch: refetchSaved,
  } = useAnalysis(initialAnalysisId)

  const { sections: streamSections, currentSection, isDone, error } = useAnalysisStream(streamingId)

  const completedSections = SECTION_ORDER.filter(
    (section) => section in streamSections,
  ) as AnalysisSectionType[]
  const isStreaming = !!streamingId && !isDone && !error
  const hasStarted = !!streamingId

  const streamHasData = Object.keys(streamSections).length > 0
  const displaySections: Partial<AnalysisResult> = streamHasData
    ? streamSections
    : (saved?.result ?? {})
  const securityGrade = displaySections.security?.grade

  const allSectionsComplete = isDone && SECTION_ORDER.every((s) => s in streamSections)

  useEffect(() => {
    if (isDone && !streamHasData) {
      refetchSaved()
    }
  }, [isDone, streamHasData, refetchSaved])

  useEffect(() => {
    if (allSectionsComplete && startedInSessionRef.current) {
      toast.success('Analysis complete', {
        description: 'All sections have been analyzed successfully.',
      })
    }
  }, [allSectionsComplete])

  async function handleReanalyze() {
    setIsStarting(true)
    try {
      const { analysisId } = await startAnalysis()
      startedInSessionRef.current = true
      setStreamingId(analysisId)
    } catch (startError) {
      console.error(startError)
    } finally {
      setIsStarting(false)
    }
  }

  const hasSaved = !!saved?.result && Object.keys(saved.result).length > 0
  const showReanalyzeButton = (isDone || !!error || (!isStreaming && hasSaved)) && !isStarting
  const showLoading = savedLoading && !streamHasData
  const showSections = !savedLoading || streamHasData

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              to="/dashboard"
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Repositories
            </Link>
            <span>/</span>
            <Link
              to={'/repos/$repoId/analyses' as never}
              params={{ repoId: repo.id } as never}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              {repo.fullName}
            </Link>
            <span>/</span>
            <span>Analysis</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold truncate">{repo.name}</h1>
                {securityGrade && <HealthGradeBadge grade={securityGrade} size="sm" />}
                {isStreaming && (
                  <span className="flex items-center gap-1 shrink-0">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{repo.owner}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {showReanalyzeButton && (
                <Button
                  size="sm"
                  variant={isDone ? 'outline' : 'default'}
                  onClick={handleReanalyze}
                  disabled={isStarting || savedLoading}
                  className="h-8 text-xs cursor-pointer"
                >
                  {isStarting ? 'Starting...' : 'Re-analyze'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {hasSaved && !hasStarted && saved?.completedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
              Analyzed{' '}
              {new Intl.DateTimeFormat('en', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(saved.completedAt))}
            </span>
          </div>
        )}

        {showLoading && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}

        {isStreaming && (
          <div className="rounded-xl border border-border bg-card p-4">
            <AnalysisProgress
              completedSections={completedSections}
              currentMessage={currentSection}
            />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {showSections && (
          <SectionTabs
            sections={displaySections}
            isStreaming={isStreaming}
            currentStreamingSection={currentSection}
          />
        )}
      </main>
    </div>
  )
}
