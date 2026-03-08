import { AppHeader } from '@/common/components/app-header'
import { HealthGradeBadge } from '@/common/components/health-grade-badge'
import { SECTION_ICONS } from '@/common/components/section-icons'
import {
  PRODUCT_SECTIONS,
  SECTION_META,
  SECTION_ORDER,
  TECHNICAL_SECTIONS,
} from '@/common/constants/analysis-sections'
import type { Repository } from '@/modules/repos/domain/repo.domain'
import type { AnalysisResult, AnalysisSectionType } from '@repo/shared'
import { Button } from '@repo/ui/components/button'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Check, Loader2 } from 'lucide-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAnalysis, useStartAnalysis } from '../hooks/use-analysis'
import { useAnalysisStream } from '../hooks/use-analysis-stream'
import { useUnreadSections } from '../hooks/use-unread-sections'
import type { ViewMode } from '../hooks/use-view-mode'
import { useViewMode } from '../hooks/use-view-mode'
import type { StartAnalysisFormRequest } from '../schemas/start-analysis.schema'
import { AnalysisProgress } from './analysis-progress'
import { AnalysisProgressSection } from './analysis-progress-section'
import { AnalysisQuestions } from './analysis-questions'
import { ArchitectureSection } from './architecture-section'
import { CodeMetricsSection } from './code-metrics-section'
import { CopyAgentPromptButton } from './copy-agent-prompt-button'
import { DependenciesSection } from './dependencies-section'
import { ExecutiveSummarySectionView as ExecutiveSummarySection } from './executive-summary-section'
import { FunFactsSection } from './fun-facts-section'
import { RecommendationsSection } from './recommendations-section'
import { SecuritySection } from './security-section'
import { StartAnalysisDialog } from './start-analysis-dialog'
import { TechStackSection } from './tech-stack-section'
import { TokenUsageCard } from './token-usage-card'
import { UpdatePlanSection } from './update-plan-section'
import { ViewModeToggle } from './view-mode-toggle'

interface AnalysisPageProps {
  repo: Repository
  initialAnalysisId?: string
}

function getFilteredSections(viewMode: ViewMode): AnalysisSectionType[] {
  if (viewMode === 'product') return PRODUCT_SECTIONS
  if (viewMode === 'technical') return TECHNICAL_SECTIONS
  return SECTION_ORDER
}

function SectionTabs({
  sections,
  isStreaming,
  currentStreamingSection,
  completedSections,
  isDone,
  analysisId,
  viewMode,
}: {
  sections: Partial<AnalysisResult>
  isStreaming: boolean
  currentStreamingSection: string | null
  completedSections: AnalysisSectionType[]
  isDone: boolean
  analysisId: string
  viewMode: ViewMode
}) {
  const filteredOrder = getFilteredSections(viewMode)
  const availableTabs = filteredOrder.filter((s) => s in sections)
  const showQuestionsTab = isDone

  const [activeTab, setActiveTab] = useState<AnalysisSectionType | 'questions'>('executive_summary')

  const currentActiveTab = (() => {
    if (activeTab === 'questions') return 'questions'
    if (availableTabs.includes(activeTab as AnalysisSectionType))
      return activeTab as AnalysisSectionType
    return availableTabs[0] ?? 'executive_summary'
  })()

  const tabsListRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const unread = useUnreadSections(completedSections, currentActiveTab as AnalysisSectionType)

  const updateScrollState = useCallback(() => {
    const el = tabsListRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = tabsListRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' })
  }, [])

  const scrollTabIntoView = useCallback((section: string) => {
    const container = tabsListRef.current
    const el = triggerRefs.current[section]
    if (!container || !el) return
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const elCenter = elRect.left + elRect.width / 2 - containerRect.left
    const targetScroll = container.scrollLeft + elCenter - containerRect.width / 2
    container.scrollTo({ left: targetScroll, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = tabsListRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    updateScrollState()
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [updateScrollState])

  useEffect(() => {
    scrollTabIntoView(currentActiveTab)
  }, [currentActiveTab, scrollTabIntoView])

  useEffect(() => {
    const el = tabsListRef.current
    if (!el) return
    let isDown = false
    let startX = 0
    let scrollLeft = 0
    const onMouseDown = (e: MouseEvent) => {
      isDown = true
      startX = e.pageX - el.offsetLeft
      scrollLeft = el.scrollLeft
      el.style.cursor = 'grabbing'
    }
    const onMouseUp = () => {
      isDown = false
      el.style.cursor = ''
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      el.scrollLeft = scrollLeft - (x - startX)
    }
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mousemove', onMouseMove)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  if (availableTabs.length === 0 && !showQuestionsTab) return null

  const isFirstTabActive = currentActiveTab === 'executive_summary'

  return (
    <Tabs
      value={currentActiveTab}
      onValueChange={(v) => {
        setActiveTab(v as AnalysisSectionType | 'questions')
        scrollTabIntoView(v)
      }}
    >
      <div className="relative flex items-center">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy('left')}
            className="absolute -left-4 z-10 flex items-center justify-center w-10 h-full bg-linear-to-r from-background via-background/80 to-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-5 shrink-0" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy('right')}
            className="absolute -right-4 z-10 flex items-center justify-center w-10 h-full bg-linear-to-l from-background via-background/80 to-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronRight className="size-5 shrink-0" />
          </button>
        )}
        <div
          ref={tabsListRef}
          className="overflow-x-auto overflow-y-hidden mask-[linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsList className="inline-flex! h-auto p-1 gap-0.5 rounded-xl bg-muted w-max">
            {SECTION_ORDER.map((section) => {
              const available = availableTabs.includes(section)
              const meta = SECTION_META[section]
              const isActiveStreaming = isStreaming && currentStreamingSection === section
              const isUnread = unread.has(section)
              const isHiddenByFilter = !filteredOrder.includes(section)

              if (isHiddenByFilter) return null

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
                  {available && !isActiveStreaming && !isUnread && (
                    <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/15 shrink-0">
                      <Check className="size-3.5 text-primary" strokeWidth={2} />
                    </span>
                  )}
                  {isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  )}
                  {isActiveStreaming && (
                    <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                  )}
                </TabsTrigger>
              )
            })}

            {showQuestionsTab && (
              <TabsTrigger
                value="questions"
                ref={(el) => {
                  triggerRefs.current.questions = el
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg h-auto cursor-pointer data-[state=active]:cursor-default whitespace-nowrap"
              >
                <ChatIcon />
                <span>Ask</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>
      </div>

      <div className="mt-4">
        <TabsContent value="analysis_progress">
          <motion.div
            key="analysis_progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.analysis_progress && (
              <AnalysisProgressSection
                data={sections.analysis_progress}
                isStreaming={isStreaming && !sections.executive_summary}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="executive_summary">
          <motion.div
            key="executive_summary"
            initial={{ opacity: 0, y: 8 }}
            animate={currentActiveTab === 'executive_summary' ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.18 }}
          >
            {sections.executive_summary ? (
              <ExecutiveSummarySection
                data={sections.executive_summary}
                isStreaming={isStreaming && !sections.tech_stack}
              />
            ) : (
              isFirstTabActive && isStreaming && <TabSkeletonPlaceholder />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="tech_stack">
          <motion.div
            key="tech_stack"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.tech_stack && (
              <TechStackSection
                data={sections.tech_stack}
                isStreaming={isStreaming && !sections.architecture}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="architecture">
          <motion.div
            key="architecture"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.architecture && (
              <ArchitectureSection
                data={sections.architecture}
                isStreaming={isStreaming && !sections.security}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="security">
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.security && (
              <SecuritySection
                data={sections.security}
                isStreaming={isStreaming && !sections.dependencies}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="dependencies">
          <motion.div
            key="dependencies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.dependencies && (
              <DependenciesSection
                data={sections.dependencies}
                isStreaming={isStreaming && !sections.update_plan}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="update_plan">
          <motion.div
            key="update_plan"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.update_plan && (
              <UpdatePlanSection
                data={sections.update_plan}
                isStreaming={isStreaming && !sections.recommendations}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="recommendations">
          <motion.div
            key="recommendations"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.recommendations && <RecommendationsSection data={sections.recommendations} />}
          </motion.div>
        </TabsContent>
        <TabsContent value="code_metrics">
          <motion.div
            key="code_metrics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.code_metrics && (
              <CodeMetricsSection
                data={sections.code_metrics}
                isStreaming={isStreaming && !sections.fun_facts}
              />
            )}
          </motion.div>
        </TabsContent>
        <TabsContent value="fun_facts">
          <motion.div
            key="fun_facts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {sections.fun_facts && <FunFactsSection data={sections.fun_facts} />}
          </motion.div>
        </TabsContent>
        <TabsContent value="questions">
          <AnalysisQuestions analysisId={analysisId} />
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
  const [streamingId, setStreamingId] = useState<string | null>(initialAnalysisId ?? null)
  const [isStarting, setIsStarting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const startedInSessionRef = useRef(false)
  const { mutateAsync: startAnalysis } = useStartAnalysis(repo.id)
  const {
    data: saved,
    isLoading: savedLoading,
    refetch: refetchSaved,
  } = useAnalysis(streamingId ?? initialAnalysisId ?? null)

  const { sections: streamSections, currentSection, isDone, error } = useAnalysisStream(streamingId)
  const { viewMode, setViewMode } = useViewMode()

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

  const allSectionsComplete = isDone && Object.keys(streamSections).length > 0

  useEffect(() => {
    if (isDone) {
      refetchSaved()
    }
  }, [isDone, refetchSaved])

  useEffect(() => {
    if (allSectionsComplete && startedInSessionRef.current) {
      toast.success('Analysis complete', {
        description: 'All sections have been analyzed successfully.',
      })
    }
  }, [allSectionsComplete])

  async function handleStartAnalysis(request: StartAnalysisFormRequest) {
    setDialogOpen(false)
    setIsStarting(true)
    try {
      const { analysisId } = await startAnalysis(request)
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

  const showTokenUsage = isDone && saved && saved.inputTokens != null && saved.outputTokens != null

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
                {securityGrade && (
                  <>
                    <HealthGradeBadge grade={securityGrade} size="sm" />
                    {displaySections.security?.score != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {displaySections.security.score}/100
                      </span>
                    )}
                  </>
                )}
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
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {(hasSaved || streamHasData) && !isStreaming && (
                <CopyAgentPromptButton repoFullName={repo.fullName} result={displaySections} />
              )}
              {showReanalyzeButton && (
                <Button
                  size="sm"
                  variant={isDone ? 'outline' : 'default'}
                  onClick={() => setDialogOpen(true)}
                  disabled={isStarting || savedLoading}
                  className="h-8 text-xs cursor-pointer"
                  data-testid="btn-reanalyze"
                >
                  {isStarting
                    ? 'Starting...'
                    : hasSaved || streamHasData
                      ? 'Re-analyze'
                      : 'Start Analysis'}
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

        {showTokenUsage && saved?.inputTokens != null && saved?.outputTokens != null && (
          <TokenUsageCard inputTokens={saved.inputTokens} outputTokens={saved.outputTokens} />
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
          <div className="space-y-3">
            {(hasSaved || streamHasData) && (
              <div className="flex justify-end">
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
            <SectionTabs
              sections={displaySections}
              isStreaming={isStreaming}
              currentStreamingSection={currentSection}
              completedSections={completedSections}
              isDone={isDone}
              analysisId={streamingId ?? initialAnalysisId ?? ''}
              viewMode={viewMode}
            />
          </div>
        )}
      </main>

      <StartAnalysisDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleStartAnalysis}
        isStarting={isStarting}
      />
    </div>
  )
}

function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
