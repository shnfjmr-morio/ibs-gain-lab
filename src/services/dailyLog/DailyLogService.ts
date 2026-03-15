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

  const updates: Parameters<typeof db.dailyLogs.put>[0] = {
    date,
    ...totals,
    updatedAt: nowIso(),
  }

  // WeightLog の ibsStatus を DailyLog に同期
  const weightLog = await db.weightLogs
    .where('date').equals(date)
    .reverse().first()
  if (weightLog?.ibsStatus) {
    updates.ibsStatus = weightLog.ibsStatus
  }

  await db.dailyLogs.put(updates)
}
