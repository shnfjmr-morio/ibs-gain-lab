import { db } from '../../db/schema'
import type { IBSStatus, WeightLog } from '../../types/entities'
import { toDateStr } from '../../utils/date'

export interface ChartDataPoint {
  date: string
  weightKg: number
  movingAvg7: number | null
  ibsStatus: IBSStatus
}

export interface WeightStats {
  weeklyAvg: number | null
  weeklyChange: number | null    // 前週比 (kg)
  monthlyAvg: number | null
  estimatedGoalDate: string | null
}

// ─── 内部ヘルパー ─────────────────────────────────────────────

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function computeMovingAvg(data: WeightLog[], index: number, window: number): number | null {
  const half = Math.floor(window / 2)
  const start = Math.max(0, index - half)
  const end   = Math.min(data.length - 1, index + half)
  // データ点が window の半分未満なら null
  if (end - start + 1 < Math.ceil(window / 2)) return null
  const slice = data.slice(start, end + 1)
  return slice.reduce((sum, d) => sum + d.weightKg, 0) / slice.length
}

// ─── 公開 API ─────────────────────────────────────────────────

/**
 * 指定期間の体重データを取得し、7日移動平均を付与して返す。
 */
export async function getWeightChartData(
  periodDays: 30 | 90 | 180
): Promise<ChartDataPoint[]> {
  const since = subtractDays(toDateStr(), periodDays)
  const logs  = await db.weightLogs
    .where('date').aboveOrEqual(since)
    .sortBy('date')

  return logs.map((log, i, arr) => ({
    date:       log.date,
    weightKg:   log.weightKg,
    movingAvg7: computeMovingAvg(arr, i, 7),
    ibsStatus:  log.ibsStatus,
  }))
}

/**
 * 直近7日分の体重（SparkLine用の軽量版）
 */
export async function getLast7DaysWeights(): Promise<Array<{ date: string; weightKg: number }>> {
  const since = subtractDays(toDateStr(), 7)
  const logs  = await db.weightLogs
    .where('date').aboveOrEqual(since)
    .sortBy('date')
  return logs.map(l => ({ date: l.date, weightKg: l.weightKg }))
}

/**
 * 体重統計を計算する。
 * - 今週平均・前週比
 * - 目標到達予測（線形回帰）
 */
export async function getWeightStats(
  targetWeightKg: number | undefined
): Promise<WeightStats> {
  const today     = toDateStr()
  const since14   = subtractDays(today, 14)
  const logs      = await db.weightLogs
    .where('date').aboveOrEqual(since14)
    .sortBy('date')

  if (logs.length === 0) {
    return { weeklyAvg: null, weeklyChange: null, monthlyAvg: null, estimatedGoalDate: null }
  }

  const weekStart = subtractDays(today, 7)
  const thisWeek  = logs.filter(l => l.date >= weekStart)
  const lastWeek  = logs.filter(l => l.date < weekStart)

  const avg = (arr: WeightLog[]) =>
    arr.length > 0 ? arr.reduce((s, l) => s + l.weightKg, 0) / arr.length : null

  const weeklyAvg    = avg(thisWeek)
  const lastWeekAvg  = avg(lastWeek)
  const weeklyChange = weeklyAvg != null && lastWeekAvg != null
    ? Math.round((weeklyAvg - lastWeekAvg) * 100) / 100
    : null

  // 月次平均（直近30日）
  const since30   = subtractDays(today, 30)
  const logs30    = await db.weightLogs.where('date').aboveOrEqual(since30).sortBy('date')
  const monthlyAvg = avg(logs30)

  // 目標到達予測（線形回帰）
  let estimatedGoalDate: string | null = null
  if (targetWeightKg != null && logs30.length >= 2) {
    // x = 日数（0-based）, y = 体重
    const base  = new Date(logs30[0].date).getTime()
    const xs    = logs30.map(l => (new Date(l.date).getTime() - base) / 86400000)
    const ys    = logs30.map(l => l.weightKg)
    const n     = xs.length
    const sumX  = xs.reduce((a, b) => a + b, 0)
    const sumY  = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
    const sumX2 = xs.reduce((s, x) => s + x * x, 0)
    const denom = n * sumX2 - sumX * sumX

    if (denom !== 0) {
      const slope     = (n * sumXY - sumX * sumY) / denom
      const intercept = (sumY - slope * sumX) / n

      // slope が正（増量中）かつ目標が現在より高い場合のみ予測
      const latestWeight = ys[ys.length - 1]
      if (slope > 0 && targetWeightKg > latestWeight) {
        const daysToGoal = (targetWeightKg - intercept) / slope
        const goalDate   = new Date(new Date(logs30[0].date).getTime() + daysToGoal * 86400000)
        // 現在より後かつ2年以内の場合のみ表示
        const nowMs      = Date.now()
        if (goalDate.getTime() > nowMs && goalDate.getTime() < nowMs + 730 * 86400000) {
          estimatedGoalDate = goalDate.toISOString().slice(0, 7) // 'YYYY-MM' 精度
        }
      }
    }
  }

  return { weeklyAvg, weeklyChange, monthlyAvg, estimatedGoalDate }
}
