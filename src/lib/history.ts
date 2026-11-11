import type { ScanRecord } from './types'

const storageKey = 'fraudshield.scan-history.v1'

export function readHistory(): ScanRecord[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is ScanRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.type === 'string' &&
        typeof item.level === 'string' &&
        typeof item.createdAt === 'string',
    )
  } catch (error) {
    console.error('Unable to read local scan history.', error)
    return []
  }
}

export function writeHistory(records: ScanRecord[]): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(records))
    return true
  } catch (error) {
    console.error('Unable to save local scan history.', error)
    return false
  }
}
