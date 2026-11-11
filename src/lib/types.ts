export type ScanType = 'message' | 'url' | 'job' | 'payment'
export type ScanLanguage = 'en' | 'hi' | 'ta'
export type RiskLevel = 'High risk' | 'Caution' | 'No obvious indicators' | 'Inconclusive'

export type AnalysisResult = {
  level: RiskLevel
  summary: string
  indicators: string[]
  nextSteps: string[]
}

export type ScanRecord = {
  id: string
  type: ScanType
  level: RiskLevel
  createdAt: string
}
