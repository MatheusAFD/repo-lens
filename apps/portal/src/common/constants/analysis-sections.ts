import type { AnalysisSectionType } from '@repo/shared'

export const SECTION_META: Record<
  AnalysisSectionType,
  { label: string; description: string; icon: string }
> = {
  executive_summary: {
    label: 'Executive Summary',
    description: 'Plain-language overview of the project',
    icon: '📋',
  },
  tech_stack: {
    label: 'Tech Stack',
    description: 'Languages, frameworks, and tools detected',
    icon: '🛠️',
  },
  architecture: {
    label: 'Architecture',
    description: 'Patterns and structural observations',
    icon: '🏗️',
  },
  security: {
    label: 'Security',
    description: 'OWASP findings and overall grade',
    icon: '🔒',
  },
  dependencies: {
    label: 'Dependencies',
    description: 'Package health across ecosystems',
    icon: '📦',
  },
  update_plan: {
    label: 'Update Plan',
    description: 'Prioritized dependency updates with gains',
    icon: '⬆️',
  },
  recommendations: {
    label: 'Recommendations',
    description: 'Top actions ordered by impact',
    icon: '✅',
  },
}

export const SECTION_ORDER: AnalysisSectionType[] = [
  'executive_summary',
  'tech_stack',
  'architecture',
  'security',
  'dependencies',
  'update_plan',
  'recommendations',
]
