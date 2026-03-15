import { FODMAP_DB, type FodmapEntry } from '../../data/fodmap/db'
import { db } from '../../db/schema'
import { uuid, nowIso, toDateStr } from '../../utils/date'

export interface LookupResult {
  entry: FodmapEntry
  matchedKeyword: string
}

/**
 * 食事テキストからFODMAP情報を検索する。
 * 最初にマッチしたエントリを返す（高リスクを優先）。
 */
export function lookupFodmap(description: string): LookupResult | null {
  if (!description.trim()) return null

  const text = description.toLowerCase()

  // 最もリスクの高いものが優先されるよう、結果を集めてスコアで並び替え
  const matches: Array<{ entry: FodmapEntry; keyword: string; risk: number }> = []

  for (const entry of FODMAP_DB) {
    for (const kw of (entry.keywords ?? [])) {
      if (text.includes(kw.toLowerCase())) {
        const risk = entry.fodmapLevel === 'high' ? 3 : entry.fodmapLevel === 'moderate' ? 2 : 1
        matches.push({ entry, keyword: kw, risk })
        break // 同一エントリで複数マッチしても1回だけ
      }
    }
  }

  if (matches.length === 0) {
    // DBに未登録の食品をログ（非同期・ノンブロッキング）
    db.unmatchedFoods.add({
      id: uuid(),
      query: description.trim(),
      date: toDateStr(),
      timestamp: nowIso(),
    }).catch(() => { /* ログ失敗は無視 */ })
    return null
  }

  // リスクの高い食材を優先的に表示（ユーザーへの注意喚起）
  matches.sort((a, b) => b.risk - a.risk)
  const top = matches[0]
  return { entry: top.entry, matchedKeyword: top.keyword }
}

/**
 * 全マッチ（複数食材）を返す。
 * 長いキーワードを優先し、重複範囲を除外（最長一致・非重複）。
 * 例：「ゆで卵」が「卵」より長いため「生卵」の誤マッチを防ぐ。
 */
export function lookupAllFodmap(description: string): LookupResult[] {
  if (!description.trim()) return []

  const text = description.toLowerCase()

  // 各エントリで最長キーワードのマッチ位置を探す
  const candidates: Array<{ entry: FodmapEntry; keyword: string; start: number; end: number }> = []

  for (const entry of FODMAP_DB) {
    let best: { keyword: string; start: number; end: number } | null = null
    for (const kw of (entry.keywords ?? [])) {
      const kwLower = kw.toLowerCase()
      const idx = text.indexOf(kwLower)
      if (idx !== -1) {
        if (!best || kwLower.length > best.end - best.start) {
          best = { keyword: kw, start: idx, end: idx + kwLower.length }
        }
      }
    }
    if (best) candidates.push({ entry, ...best })
  }

  // 長いキーワード優先でソート
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start))

  // 重複範囲を除外しながら選択（greedy）
  const results: LookupResult[] = []
  const used: Array<{ start: number; end: number }> = []

  for (const c of candidates) {
    const overlaps = used.some(r => c.start < r.end && c.end > r.start)
    if (!overlaps) {
      results.push({ entry: c.entry, matchedKeyword: c.keyword })
      used.push({ start: c.start, end: c.end })
    }
  }

  return results
}
