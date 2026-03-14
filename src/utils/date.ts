import { format } from 'date-fns'

export const toDateStr = (d: Date = new Date()): string => format(d, 'yyyy-MM-dd')
export const toTimeStr = (d: Date = new Date()): string => format(d, 'HH:mm')
export const nowIso = (): string => new Date().toISOString()
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
