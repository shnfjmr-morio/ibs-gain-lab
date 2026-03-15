import { FODMAP_DB } from '../../data/fodmap/db'
import { DISH_ALIASES } from '../../data/fodmap/dishAliases'

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
 * defaultServingG の異常値を補正する。
 * DBには誤った値（うどん15g、カレーパン400g等）が含まれるため、
 * caloriesPer100g に基づいた妥当な1食分量を推定する。
 *
 * ルール:
 * - 20g未満は異常に小さい → 推定値に置換
 * - 400g超で高カロリー食品（>200kcal/100g）は異常に大きい → 推定値に置換
 * - それ以外はそのまま使用
 *
 * 推定ロジック: 1食300-500kcal程度になるよう逆算
 */
function sanitizeServingG(defaultG: number | undefined, caloriesPer100g: number): number {
  const MIN_SERVING = 20
  const FALLBACK = 150

  if (defaultG == null) return FALLBACK

  // caloriesPer100gが0以下は異常データ
  if (caloriesPer100g <= 0) return defaultG

  // 異常に小さいdefaultServingG（スパイス以外で20g未満は食事として不自然）
  // ただしcaloriesPer100gが非常に高い（>500）場合は調味料・油脂なので小さくてもOK
  if (defaultG < MIN_SERVING && caloriesPer100g <= 500) {
    // 1食あたり約400kcalになるよう逆算
    const estimated = Math.round((400 / caloriesPer100g) * 100)
    return Math.min(Math.max(estimated, 100), 400)
  }

  // 異常に大きいdefaultServingG: 高カロリー食品で400g超
  if (defaultG > 400 && caloriesPer100g > 200) {
    const estimated = Math.round((500 / caloriesPer100g) * 100)
    return Math.min(Math.max(estimated, 100), 400)
  }

  return defaultG
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
      const userWeight = extractWeightG(surrounding)
        ?? extractWeightG(text)  // 全体からも探す

      const rawDefault = entry.defaultServingG ?? entry.safeServingG
      const sanitizedDefault = sanitizeServingG(rawDefault, entry.caloriesPer100g)
      const weightG = userWeight ?? sanitizedDefault

      const ratio = weightG / 100
      totalCalories += Math.round(entry.caloriesPer100g * ratio)
      totalProtein  += Math.round(entry.proteinPer100g  * ratio * 10) / 10
      totalFat      += Math.round(entry.fatPer100g      * ratio * 10) / 10
      totalCarbs    += Math.round(entry.carbsPer100g    * ratio * 10) / 10
      matched++
      if (userWeight != null) {
        anyMeasured = true
      }
      break  // 同エントリで複数キーワードマッチしても1回だけ
    }
  }

  // DBで直接ヒットしなかった場合、dishAliasesのestimatedCalories/estimatedProteinで補完
  if (matched === 0) {
    const normalizedText = text
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[\u30A1-\u30F6]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60))
      .replace(/[\s　]+/g, ' ')
      .trim()

    for (const alias of DISH_ALIASES) {
      const normalize = (t: string) => t
        .toLowerCase()
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/[\u30A1-\u30F6]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60))
        .replace(/[\s　]+/g, ' ')
        .trim()

      const matched = alias.keywords.some(kw => normalizedText.includes(normalize(kw)))
      if (matched && alias.estimatedCalories != null) {
        return {
          calories: alias.estimatedCalories,
          protein:  alias.estimatedProtein ?? 0,
          fat:      0,
          carbs:    0,
          weightG:  0,
          source:   'default',
        }
      }
    }
    return null
  }

  return {
    calories: totalCalories,
    protein:  Math.round(totalProtein  * 10) / 10,
    fat:      Math.round(totalFat      * 10) / 10,
    carbs:    Math.round(totalCarbs    * 10) / 10,
    weightG:  0,
    source:   anyMeasured ? 'measured' : 'default',
  }
}
