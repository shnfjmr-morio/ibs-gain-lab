import { db } from '../../db/schema'
import { toDateStr } from '../../utils/date'

// ─── 内部ヘルパー ─────────────────────────────────────────────

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── 公開 API ─────────────────────────────────────────────────

export type CalorieDayStatus = 'achieved' | 'partial' | 'missed'

export interface CalorieDay {
  date: string
  pct: number               // 0-100（目標に対する達成率）
  status: CalorieDayStatus
}

export interface WeeklyCalorieStats {
  days: CalorieDay[]        // 直近7日（古い順）
  achievementRate: number   // 0-100（achieved 判定の割合）
}

/**
 * 直近7日のカロリー達成状況を返す。
 * - achieved: 90%以上
 * - partial:  60〜89%
 * - missed:   60%未満
 */
export async function getWeeklyCalorieStats(
  targetDailyCalories: number | undefined
): Promise<WeeklyCalorieStats> {
  const today = toDateStr()
  const since = subtractDays(today, 6) // 今日含む7日分

  const logs = await db.dailyLogs
    .where('date').between(since, today, true, true)
    .sortBy('date')

  const logMap = new Map(logs.map(l => [l.date, l.totalCalories]))

  const days: CalorieDay[] = []
  for (let i = 6; i >= 0; i--) {
    const date     = subtractDays(today, i)
    const calories = logMap.get(date) ?? 0
    const target   = targetDailyCalories ?? 0
    const pct      = target > 0 ? Math.min(Math.round((calories / target) * 100), 100) : 0
    const status: CalorieDayStatus =
      pct >= 90 ? 'achieved' :
      pct >= 60 ? 'partial'  : 'missed'
    days.push({ date, pct, status })
  }

  const achievedCount  = days.filter(d => d.status === 'achieved').length
  const achievementRate = Math.round((achievedCount / 7) * 100)

  return { days, achievementRate }
}

/**
 * 直近7日分の体重（HomePageのSparkLine用）
 */
export async function getLast7DaysWeights(): Promise<Array<{ date: string; weightKg: number }>> {
  const today = toDateStr()
  const since = subtractDays(today, 6)
  const logs  = await db.weightLogs
    .where('date').between(since, today, true, true)
    .sortBy('date')
  return logs.map(l => ({ date: l.date, weightKg: l.weightKg }))
}
