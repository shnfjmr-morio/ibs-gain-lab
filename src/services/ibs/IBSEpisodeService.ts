import { db } from '../../db/schema'
import { nowIso, toDateStr } from '../../utils/date'
import type { IBSStatus } from '../../types/entities'

/**
 * 今日のIBS状態を記録・更新する
 * WeightLog の ibsStatus と DailyLog の ibsStatus を同期するための中心サービス
 */
export async function recordIBSStatus(
  date: string,
  status: IBSStatus
): Promise<void> {
  // DailyLog の ibsStatus を更新
  const existing = await db.dailyLogs.where('date').equals(date).first()
  if (existing) {
    await db.dailyLogs.update(existing.date, { ibsStatus: status })
  } else {
    await db.dailyLogs.put({
      date,
      ibsStatus: status,
      totalCalories: 0,
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      updatedAt: nowIso(),
    })
  }
}

/**
 * 直近N日のIBSステータス履歴を取得
 */
export async function getIBSStatusHistory(days: number = 30): Promise<
  Array<{ date: string; status: IBSStatus }>
> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const logs = await db.dailyLogs
    .where('date')
    .aboveOrEqual(sinceStr)
    .toArray()

  return logs
    .filter(l => l.ibsStatus)
    .map(l => ({ date: l.date, status: l.ibsStatus as IBSStatus }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 今日のIBSステータスを取得（未記録ならnull）
 */
export async function getTodayIBSStatus(): Promise<IBSStatus | null> {
  const today = toDateStr()
  const log = await db.dailyLogs.where('date').equals(today).first()
  return (log?.ibsStatus as IBSStatus) ?? null
}

/**
 * IBS発症頻度の統計（週次・月次サマリー用）
 */
export async function getIBSStats(days: number = 30): Promise<{
  totalDays: number
  stableDays: number
  episodeDays: number  // bad + active
  recoveryRate: number // stableDays / totalDays
}> {
  const history = await getIBSStatusHistory(days)
  const totalDays = history.length
  if (totalDays === 0) return { totalDays: 0, stableDays: 0, episodeDays: 0, recoveryRate: 1 }

  const stableDays = history.filter(h => h.status === 'stable').length
  const episodeDays = history.filter(h => h.status === 'active').length

  return {
    totalDays,
    stableDays,
    episodeDays,
    recoveryRate: stableDays / totalDays,
  }
}
