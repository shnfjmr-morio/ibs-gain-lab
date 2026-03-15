import { db } from '../../db/schema'
import { uuid, nowIso, toDateStr } from '../../utils/date'
import type { PostMealSymptomLog, GutFeedbackScore } from '../../types/entities'

/**
 * 食後症状ログを保存する
 */
export async function saveSymptomLog(params: {
  mealId: string
  gutScore: GutFeedbackScore
  symptoms?: string[]
  notes?: string
  hoursAfterMeal?: number
}): Promise<PostMealSymptomLog> {
  const log: PostMealSymptomLog = {
    id: uuid(),
    mealId: params.mealId,
    date: toDateStr(),
    timestamp: nowIso(),
    gutScore: params.gutScore,
    symptoms: params.symptoms,
    notes: params.notes,
    hoursAfterMeal: params.hoursAfterMeal,
  }
  await db.postMealSymptomLogs.add(log)
  return log
}

/**
 * 指定日の症状ログを取得
 */
export async function getSymptomLogsByDate(date: string): Promise<PostMealSymptomLog[]> {
  return db.postMealSymptomLogs.where('date').equals(date).toArray()
}

/**
 * 食事IDに紐づく症状ログを取得
 */
export async function getSymptomLogByMealId(mealId: string): Promise<PostMealSymptomLog | undefined> {
  return db.postMealSymptomLogs.where('mealId').equals(mealId).first()
}

/**
 * 直近N日の症状ログを取得（学習エンジン用）
 */
export async function getRecentSymptomLogs(days: number = 30): Promise<PostMealSymptomLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]
  return db.postMealSymptomLogs
    .where('date')
    .aboveOrEqual(sinceStr)
    .toArray()
}

/**
 * 症状スコアの統計（週次サマリー用）
 */
export async function getSymptomStats(days: number = 7): Promise<{
  totalLogs: number
  avgScore: number  // great=4, ok=3, bad=2, terrible=1
  worstDay: string | null
}> {
  const logs = await getRecentSymptomLogs(days)
  if (logs.length === 0) return { totalLogs: 0, avgScore: 0, worstDay: null }

  const scoreMap: Record<GutFeedbackScore, number> = {
    great: 4, ok: 3, bad: 2, terrible: 1,
  }

  const total = logs.reduce((sum, l) => sum + scoreMap[l.gutScore], 0)
  const avgScore = total / logs.length

  // 最も症状が悪かった日
  const byDate = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.date] = Math.min(acc[l.date] ?? 4, scoreMap[l.gutScore])
    return acc
  }, {})
  const worstDay = Object.entries(byDate).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null

  return { totalLogs: logs.length, avgScore, worstDay }
}
