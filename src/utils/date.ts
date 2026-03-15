import { format } from 'date-fns'

export const toDateStr = (d: Date = new Date()): string => format(d, 'yyyy-MM-dd')
export const toTimeStr = (d: Date = new Date()): string => format(d, 'HH:mm')
export const nowIso = (): string => new Date().toISOString()

export function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export const uuid = (): string => {
  // crypto.randomUUID はHTTPSのみ（iOSセキュアコンテキスト制限）→ fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
