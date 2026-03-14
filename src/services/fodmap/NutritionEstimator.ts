import { FODMAP_DB } from '../../data/fodmap/db'

export interface NutritionEstimate {
  calories: number
  protein: number
  fat: number
  carbs: number
  weightG: number
  source: 'measured' | 'default'  // 入力値 or デフォルト1食分
}

/**
 * テキストからグラム数を抽出する
 * 例: "白米200g" → 200, "鶏むね肉100グラム" → 100, "卵2個" → null（個数はdefaultServingGで対応）
 */
function extractWeightG(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:g|ｇ|グラム|gram)/i)
  return match ? parseFloat(match[1]) : null
}

/**
 * 食事テキストからマッチした全食品の栄養素を合算して推定する。
 * 各食品ごとに重量を抽出し、なければ defaultServingG（またはフォールバック値）を使用。
 */
export function estimateNutrition(description: string): NutritionEstimate | null {
  if (!description.trim()) return null

  const text = description.toLowerCase()
  let totalCalories = 0
  let totalProtein = 0
  let totalFat = 0
  let totalCarbs = 0
  let matched = 0
  let anyMeasured = false

  for (const entry of FODMAP_DB) {
    for (const kw of (entry.keywords ?? [])) {
      if (!text.includes(kw.toLowerCase())) continue

      // このキーワード周辺の重量を探す（前後30文字）
      const idx = text.indexOf(kw.toLowerCase())
      const surrounding = text.slice(Math.max(0, idx - 5), idx + kw.length + 15)
      const weightG = extractWeightG(surrounding)
        ?? extractWeightG(text)  // 全体からも探す
        ?? (entry as any).defaultServingG
        ?? (entry as any).safeServingG
        ?? 150  // どれもなければ150gをフォールバック

      const ratio = weightG / 100
      totalCalories += Math.round(entry.caloriesPer100g * ratio)
      totalProtein  += Math.round(entry.proteinPer100g  * ratio * 10) / 10
      totalFat      += Math.round(entry.fatPer100g      * ratio * 10) / 10
      totalCarbs    += Math.round(entry.carbsPer100g    * ratio * 10) / 10
      matched++
      if (weightG !== ((entry as any).defaultServingG ?? (entry as any).safeServingG ?? 150)) {
        anyMeasured = true
      }
      break  // 同エントリで複数キーワードマッチしても1回だけ
    }
  }

  if (matched === 0) return null

  return {
    calories: totalCalories,
    protein:  Math.round(totalProtein  * 10) / 10,
    fat:      Math.round(totalFat      * 10) / 10,
    carbs:    Math.round(totalCarbs    * 10) / 10,
    weightG:  0,
    source:   anyMeasured ? 'measured' : 'default',
  }
}
