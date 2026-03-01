export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type Result<T, E = Error> = [E, null] | [null, T]

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiErrorResponse {
  statusCode: number
  message: string | string[]
  error?: string
}

export type AnalysisStatus = 'running' | 'completed' | 'failed'

export type AnalysisSectionType =
  | 'executive_summary'
  | 'tech_stack'
  | 'architecture'
  | 'security'
  | 'dependencies'
  | 'update_plan'
  | 'recommendations'

export type SecurityGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'
export type EffortLevel = 'low' | 'medium' | 'high'

export interface ExecutiveSummarySection {
  summary: string
  targetAudience: string
  keyCapabilities: string[]
}

export interface TechStackSection {
  languages: { name: string; percentage: number }[]
  frameworks: string[]
  databases: string[]
  cloud: string[]
  testing: string[]
}

export interface ArchitectureSection {
  pattern: string
  description: string
  keyPatterns: string[]
  observations: string[]
}

export interface SecurityFinding {
  severity: SeverityLevel
  description: string
  owasp: string
}

export interface SecuritySection {
  grade: SecurityGrade
  score: number
  findings: SecurityFinding[]
  positives: string[]
}

export interface DependencyEcosystem {
  name: string
  count: number
  outdated: number
  vulnerable: number
}

export interface DependencyHighlight {
  name: string
  version: string
  latestVersion: string
  status: 'ok' | 'outdated' | 'vulnerable'
}

export interface DependenciesSection {
  total: number
  ecosystems: DependencyEcosystem[]
  highlights: DependencyHighlight[]
}

export interface UpdateItem {
  name: string
  current: string
  target: string
  reason: string
  gain: string
}

export interface UpdatePlanSection {
  critical: UpdateItem[]
  major: UpdateItem[]
  minor: UpdateItem[]
}

export interface RecommendationItem {
  rank: number
  title: string
  effort: EffortLevel
  impact: EffortLevel
  rationale: string
}

export interface RecommendationsSection {
  items: RecommendationItem[]
}

export interface AnalysisResult {
  executive_summary?: ExecutiveSummarySection
  tech_stack?: TechStackSection
  architecture?: ArchitectureSection
  security?: SecuritySection
  dependencies?: DependenciesSection
  update_plan?: UpdatePlanSection
  recommendations?: RecommendationsSection
}

export type SseEvent =
  | { type: 'section'; name: AnalysisSectionType; data: unknown }
  | { type: 'progress'; message: string }
  | { type: 'done'; analysisId: string }
  | { type: 'error'; message: string }
