const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function startAnalysis(repoId: string): Promise<{ analysisId: string }> {
  const res = await fetch(`${API_URL}/analysis/${repoId}/start`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error((errorBody as { message?: string }).message ?? 'Failed to start analysis')
  }
  return res.json()
}

export function createAnalysisStream(analysisId: string): EventSource {
  return new EventSource(`${API_URL}/analysis/${analysisId}/stream`, { withCredentials: true })
}

export interface AnalysisDetail {
  id: string
  status: string
  completedAt: string | null
  result: import('@repo/shared').AnalysisResult
}

export async function getLatestAnalysis(repoId: string): Promise<AnalysisDetail | null> {
  const res = await fetch(`${API_URL}/analysis/repo/${repoId}/latest`, {
    credentials: 'include',
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json()
}

export async function getAnalysis(analysisId: string): Promise<AnalysisDetail | null> {
  const res = await fetch(`${API_URL}/analysis/${analysisId}`, {
    credentials: 'include',
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json()
}
