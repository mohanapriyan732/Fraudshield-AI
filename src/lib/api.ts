import type { AnalysisResult, RiskLevel, ScanLanguage, ScanType } from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

const riskLevels: RiskLevel[] = [
  'High risk',
  'Caution',
  'No obvious indicators',
  'Inconclusive',
]

type ApiAnalysisResult = Omit<AnalysisResult, 'nextSteps'> & { next_steps: string[] }

function isAnalysisResult(value: unknown): value is ApiAnalysisResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (
    typeof result.level === 'string' &&
    riskLevels.includes(result.level as RiskLevel) &&
    typeof result.summary === 'string' &&
    Array.isArray(result.indicators) &&
    result.indicators.every((item: unknown) => typeof item === 'string') &&
    Array.isArray(result.next_steps) &&
    result.next_steps.every((item: unknown) => typeof item === 'string')
  )
}

export async function analyzeWithApi(
  content: string,
  scanType: ScanType,
  language: ScanLanguage,
): Promise<AnalysisResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, scan_type: scanType, language }),
    })
  } catch (error) {
    throw new Error('The analysis service could not be reached. Start the FraudShield API and try again.', {
      cause: error,
    })
  }

  if (!response.ok) {
    if (response.status === 422) {
      throw new Error('The analysis service rejected this input. Use a message or URL up to 5,000 characters.')
    }
    if (response.status === 413) {
      throw new Error('This request is too large. Shorten the message and try again.')
    }
    throw new Error(`The analysis service returned an error (${response.status}). Please try again.`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    throw new Error('The analysis service returned an unreadable response. Please try again.', {
      cause: error,
    })
  }

  if (!isAnalysisResult(data)) {
    throw new Error('The analysis service returned an invalid result. Please try again.')
  }

  const { level, summary, indicators, next_steps: nextSteps } = data
  return { level, summary, indicators, nextSteps }
}
