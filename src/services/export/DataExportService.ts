import { db } from '../../db/schema'

export interface ExportData {
  version: string
  exportedAt: string
  userProfile: unknown
  meals: unknown[]
  weightLogs: unknown[]
  dailyLogs: unknown[]
  chatSessions: unknown[]
  chatMessages: unknown[]
  postMealSymptomLogs: unknown[]
}

/**
 * 全データをJSONとしてエクスポートし、ダウンロードする
 * iOS ITP対策：IndexedDBのデータが消える前にユーザーが手動バックアップできる
 */
export async function exportAllDataAsJSON(): Promise<void> {
  const [
    userProfile,
    meals,
    weightLogs,
    dailyLogs,
    chatSessions,
    chatMessages,
    postMealSymptomLogs,
  ] = await Promise.all([
    db.userProfile.toArray(),
    db.meals.toArray(),
    db.weightLogs.orderBy('date').toArray(),
    db.dailyLogs.orderBy('date').toArray(),
    db.chatSessions.toArray(),
    db.chatMessages.orderBy('timestamp').toArray(),
    db.postMealSymptomLogs.toArray(),
  ])

  const data: ExportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    userProfile: userProfile[0] ?? null,
    meals,
    weightLogs,
    dailyLogs,
    chatSessions,
    chatMessages,
    postMealSymptomLogs,
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `ibs-gain-lab-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 体重ログをCSVとしてエクスポート
 * 他アプリ（Healthメモ等）への連携用
 */
export async function exportWeightLogsAsCSV(): Promise<void> {
  const logs = await db.weightLogs.orderBy('date').toArray()

  const header = 'date,weightKg,bodyFatPercent,ibsStatus,notes'
  const rows = logs.map(l =>
    [
      l.date,
      l.weightKg,
      l.bodyFatPercent ?? '',
      l.ibsStatus,
      (l.notes ?? '').replace(/,/g, '、'),
    ].join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `weight-log-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * JSONファイルからデータをインポートする
 * 既存データとのマージ戦略: 同一IDは上書き、新規IDは追加
 */
export async function importDataFromJSON(file: File): Promise<{
  success: boolean
  imported: Record<string, number>
  error?: string
}> {
  try {
    const text = await file.text()
    const data: ExportData = JSON.parse(text)

    if (!data.version || !data.meals) {
      return { success: false, imported: {}, error: 'Invalid backup file format' }
    }

    const imported: Record<string, number> = {}

    await db.transaction('rw', [
      db.meals,
      db.weightLogs,
      db.dailyLogs,
      db.chatSessions,
      db.chatMessages,
    ], async () => {
      if (Array.isArray(data.meals)) {
        await db.meals.bulkPut(data.meals as any[])
        imported.meals = data.meals.length
      }
      if (Array.isArray(data.weightLogs)) {
        await db.weightLogs.bulkPut(data.weightLogs as any[])
        imported.weightLogs = data.weightLogs.length
      }
      if (Array.isArray(data.dailyLogs)) {
        await db.dailyLogs.bulkPut(data.dailyLogs as any[])
        imported.dailyLogs = data.dailyLogs.length
      }
      if (Array.isArray(data.chatSessions)) {
        await db.chatSessions.bulkPut(data.chatSessions as any[])
        imported.chatSessions = data.chatSessions.length
      }
      if (Array.isArray(data.chatMessages)) {
        await db.chatMessages.bulkPut(data.chatMessages as any[])
        imported.chatMessages = data.chatMessages.length
      }
    })

    if (data.userProfile) {
      await db.userProfile.put(data.userProfile as any)
      imported.userProfile = 1
    }

    return { success: true, imported }
  } catch (err) {
    return {
      success: false,
      imported: {},
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * エクスポート前にデータ件数を返す（UIでの確認表示用）
 */
export async function getExportSummary(): Promise<Record<string, number>> {
  const [meals, weightLogs, chatMessages, symptomLogs] = await Promise.all([
    db.meals.count(),
    db.weightLogs.count(),
    db.chatMessages.count(),
    db.postMealSymptomLogs.count(),
  ])

  return { meals, weightLogs, chatMessages, symptomLogs }
}
