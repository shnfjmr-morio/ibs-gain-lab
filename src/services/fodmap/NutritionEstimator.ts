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

interface MatchedEntry {
  entryId: string
  matchedKeyword: string
  matchStart: number
  matchEnd: number
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
  defaultServingG: number | undefined
  safeServingG: number | undefined
  userWeight: number | null
}

/**
 * 最長マッチ優先（Longest Match Wins）でマッチエントリを絞り込む。
 *
 * 手順:
 * 1. テキスト内の各マッチ位置について、同じ位置をカバーする他のマッチがあれば
 *    最も長いキーワードのマッチだけを残す（部分文字列になっているものを除外）
 * 2. 「キーワードAがキーワードBの部分文字列であり、かつAとBが同じ位置にマッチする」
 *    場合にAのエントリを除外する
 */
function resolveByLongestMatch(candidates: MatchedEntry[]): MatchedEntry[] {
  if (candidates.length === 0) return []

  // 各candidateについて、「自分のマッチ範囲を完全に含む、より長いマッチが存在するか」を確認
  const dominated = new Set<number>()

  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue
      const a = candidates[i]
      const b = candidates[j]

      // bのマッチ範囲がaのマッチ範囲を完全に包含し、かつbの方が長い場合、aは除外
      if (
        b.matchStart <= a.matchStart &&
        b.matchEnd >= a.matchEnd &&
        b.matchedKeyword.length > a.matchedKeyword.length
      ) {
        dominated.add(i)
        break
      }
    }
  }

  return candidates.filter((_, i) => !dominated.has(i))
}

/**
 * 食事テキストからマッチした全食品の栄養素を合算して推定する。
 * 各食品ごとに重量を抽出し、なければ defaultServingG（またはフォールバック値）を使用。
 *
 * キーワード衝突対策: 最長マッチ優先（Longest Match Wins）を適用。
 * 同一位置に複数エントリがマッチした場合、最もキーワードが長いエントリのみを採用する。
 * 例: "ゆで卵" → boiled_egg（"ゆで卵"）のみ採用、raw_egg（"卵"）は除外
 */
export function estimateNutrition(description: string): NutritionEstimate | null {
  if (!description.trim()) return null

  const text = description.toLowerCase()

  // Step 1: 全マッチ候補を収集（エントリごとに最長マッチキーワードのみ1件）
  const allCandidates: MatchedEntry[] = []

  for (const entry of FODMAP_DB) {
    let bestKw: string | null = null
    let bestStart = -1
    let bestEnd = -1

    for (const kw of (entry.keywords ?? [])) {
      const kwLower = kw.toLowerCase()
      const idx = text.indexOf(kwLower)
      if (idx === -1) continue

      // 同エントリ内では最長キーワードを採用
      if (bestKw === null || kw.length > bestKw.length) {
        bestKw = kw
        bestStart = idx
        bestEnd = idx + kwLower.length
      }
    }

    if (bestKw === null) continue

    // マッチ周辺のグラム数を探す
    const surrounding = text.slice(Math.max(0, bestStart - 5), bestEnd + 15)
    const userWeight = extractWeightG(surrounding) ?? extractWeightG(text)

    allCandidates.push({
      entryId: entry.id,
      matchedKeyword: bestKw,
      matchStart: bestStart,
      matchEnd: bestEnd,
      caloriesPer100g: entry.caloriesPer100g,
      proteinPer100g: entry.proteinPer100g,
      fatPer100g: entry.fatPer100g,
      carbsPer100g: entry.carbsPer100g,
      defaultServingG: entry.defaultServingG,
      safeServingG: entry.safeServingG,
      userWeight,
    })
  }

  // Step 2: 最長マッチ優先で絞り込み（部分文字列マッチを除外）
  const resolved = resolveByLongestMatch(allCandidates)

  // Step 3: 絞り込み後のエントリで栄養素を合算
  let totalCalories = 0
  let totalProtein = 0
  let totalFat = 0
  let totalCarbs = 0
  let matched = resolved.length
  let anyMeasured = false

  for (const m of resolved) {
    const rawDefault = m.defaultServingG ?? m.safeServingG
    const sanitizedDefault = sanitizeServingG(rawDefault, m.caloriesPer100g)
    const weightG = m.userWeight ?? sanitizedDefault

    const ratio = weightG / 100
    totalCalories += Math.round(m.caloriesPer100g * ratio)
    totalProtein  += Math.round(m.proteinPer100g  * ratio * 10) / 10
    totalFat      += Math.round(m.fatPer100g      * ratio * 10) / 10
    totalCarbs    += Math.round(m.carbsPer100g    * ratio * 10) / 10

    if (m.userWeight != null) {
      anyMeasured = true
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
