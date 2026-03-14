import { db } from '../../db/schema'
import { toDateStr, nowIso } from '../../utils/date'

/** MealのCRUD後に必ず呼び出してDailyLogを再集計する */
export async function recalculateDailyLog(date: string = toDateStr()): Promise<void> {
  const meals = await db.meals.where('date').equals(date).toArray()
  const totals = meals.reduce(
    (acc, m) => ({
      totalCalories: acc.totalCalories + (m.totalCalories || 0),
      totalProtein: acc.totalProtein + (m.totalProtein || 0),
      totalFat: acc.totalFat + (m.totalFat || 0),
      totalCarbs: acc.totalCarbs + (m.totalCarbs || 0),
    }),
    { totalCalories: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0 }
  )
  await db.dailyLogs.put({ date, ...totals, updatedAt: nowIso() })
}
