import { FODMAP_DB, type FodmapEntry } from '../../data/fodmap/db'
import { DISH_ALIASES } from '../../data/fodmap/dishAliases'
import { db } from '../../db/schema'
import { uuid, nowIso, toDateStr } from '../../utils/date'

export interface LookupResult {
  entry: FodmapEntry
  matchedKeyword: string
}

/**
 * テキストを正規化する。
 * - 全角英数 → 半角
 * - カタカナ → ひらがな
 * - 空白の正規化
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // 全角→半角英数
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // カタカナ→ひらがな
    .replace(/[\u30A1-\u30F6]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60))
    // スペース・記号の正規化
    .replace(/[\s　]+/g, ' ')
    .trim()
}

/**
 * 食事テキストからFODMAP情報を検索する。
 * 最初にマッチしたエントリを返す（高リスクを優先）。
 */
export function lookupFodmap(description: string): LookupResult | null {
  if (!description.trim()) return null

  const text = normalizeText(description)

  // 最もリスクの高いものが優先されるよう、結果を集めてスコアで並び替え
  const matches: Array<{ entry: FodmapEntry; keyword: string; risk: number }> = []

  for (const entry of FODMAP_DB) {
    for (const kw of (entry.keywords ?? [])) {
      if (text.includes(normalizeText(kw))) {
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
 * FODMAPDBのみを検索する内部関数（dishAliases展開なし）。
 * lookupAllFodmap からコンポーネント検索時に呼び出し、無限再帰を防ぐ。
 */
function lookupDbOnly(keyword: string): LookupResult[] {
  const text = normalizeText(keyword)
  if (!text) return []

  const candidates: Array<{ entry: FodmapEntry; keyword: string; start: number; end: number }> = []

  for (const entry of FODMAP_DB) {
    let best: { keyword: string; start: number; end: number } | null = null
    for (const kw of (entry.keywords ?? [])) {
      const kwNorm = normalizeText(kw)
      const idx = text.indexOf(kwNorm)
      if (idx !== -1) {
        if (!best || kwNorm.length > best.end - best.start) {
          best = { keyword: kw, start: idx, end: idx + kwNorm.length }
        }
      }
    }
    if (best) candidates.push({ entry, ...best })
  }

  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start))

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

/**
 * 全マッチ（複数食材）を返す。
 * 長いキーワードを優先し、重複範囲を除外（最長一致・非重複）。
 * 例：「ゆで卵」が「卵」より長いため「生卵」の誤マッチを防ぐ。
 * DBでヒットしない場合は dishAliases でフォールバックし、構成食材で再検索する。
 */
export function lookupAllFodmap(description: string): LookupResult[] {
  if (!description.trim()) return []

  const text = normalizeText(description)

  // 各エントリで最長キーワードのマッチ位置を探す
  const candidates: Array<{ entry: FodmapEntry; keyword: string; start: number; end: number }> = []

  for (const entry of FODMAP_DB) {
    let best: { keyword: string; start: number; end: number } | null = null
    for (const kw of (entry.keywords ?? [])) {
      const kwNorm = normalizeText(kw)
      const idx = text.indexOf(kwNorm)
      if (idx !== -1) {
        if (!best || kwNorm.length > best.end - best.start) {
          best = { keyword: kw, start: idx, end: idx + kwNorm.length }
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

  // dishAliasesで追加展開（直接ヒットの有無に関わらず常に実行）
  // 例: "豚丼 温泉卵" → 温泉卵が直接ヒットしても豚丼エイリアスも展開する
  // マッチした全エイリアスを展開（breakを削除し複数料理名に対応）
  const normalizedDesc = normalizeText(description)
  for (const alias of DISH_ALIASES) {
    const matched = alias.keywords.some((kw: string) => normalizedDesc.includes(normalizeText(kw)))
    if (matched) {
      // 構成食材でDBを検索（lookupDbOnlyで1段のみ・再帰しない）
      for (const component of alias.components) {
        const componentResults = lookupDbOnly(component)
        for (const r of componentResults) {
          if (!results.find(existing => existing.entry.id === r.entry.id)) {
            results.push(r)
          }
        }
      }
      // breakを削除: 複数のdishAliasがマッチする場合に全て展開する
    }
  }

  return results
}
