#!/usr/bin/env node
/**
 * FODMAPデータベース CSV → TypeScript 変換スクリプト
 *
 * Usage:
 *   node scripts/convert-fodmap-csv.mjs <input.csv> [output.ts]
 *
 * input.csv: Geminiが生成したCSVファイルのパス
 * output.ts: 省略時は src/data/fodmap/db.ts に出力
 *
 * CSV必須列: id, nameJa, nameEn, aliases, fodmapLevel, ibsSafety,
 *            caloriesPer100g, proteinPer100g, fatPer100g, carbsPer100g
 * CSV任意列: fodmapCategory, safeServingG, noteJa, noteEn
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/convert-fodmap-csv.mjs <input.csv> [output.ts]')
  process.exit(1)
}

const outputPath = process.argv[3]
  ?? resolve(__dirname, '../src/data/fodmap/db.ts')

// ─── CSV パーサー（quoted fields・改行対応）───────────────────────────────
function parseCSV(text) {
  // BOM除去
  const src = text.startsWith('\uFEFF') ? text.slice(1) : text
  const rows = []
  let cur = []
  let field = ''
  let inQ = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]

    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++ }      // escaped quote
      else if (c === '"') { inQ = false }
      else { field += c }
    } else {
      if (c === '"') { inQ = true }
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\r' && n === '\n') {
        cur.push(field); field = ''
        if (cur.some(Boolean)) rows.push(cur)
        cur = []; i++
      } else if (c === '\n') {
        cur.push(field); field = ''
        if (cur.some(Boolean)) rows.push(cur)
        cur = []
      } else { field += c }
    }
  }
  if (field || cur.length) { cur.push(field); if (cur.some(Boolean)) rows.push(cur) }
  return rows
}

// ─── メイン処理 ──────────────────────────────────────────────────────────
const text = readFileSync(inputPath, 'utf-8')
const rows = parseCSV(text)

if (rows.length < 2) {
  console.error('CSVにデータ行がありません')
  process.exit(1)
}

const headers = rows[0].map(h => h.trim())
const dataRows = rows.slice(1)

// 列インデックスを解決
const COL = Object.fromEntries(
  ['id','nameJa','nameEn','aliases','fodmapLevel','ibsSafety',
   'fodmapCategory','caloriesPer100g','proteinPer100g','fatPer100g',
   'carbsPer100g','defaultServingG','safeServingG','noteJa','noteEn']
  .map(k => [k, headers.indexOf(k)])
)

// 必須列チェック
const REQUIRED = ['id','nameJa','nameEn','aliases','fodmapLevel','ibsSafety',
                  'caloriesPer100g','proteinPer100g','fatPer100g','carbsPer100g']
const missing = REQUIRED.filter(k => COL[k] === -1)
if (missing.length) {
  console.error('必須列が見つかりません:', missing.join(', '))
  console.error('検出された列:', headers.join(', '))
  process.exit(1)
}

const VALID_FODMAP = new Set(['low', 'moderate', 'high'])
const VALID_SAFETY = new Set(['safe', 'caution', 'risky'])

const entries = []
let skipped = 0
const skipReasons = {}

for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i]
  const get = col => (COL[col] !== -1 ? row[COL[col]]?.trim() ?? '' : '')

  const id          = get('id')
  const nameJa      = get('nameJa')
  const nameEn      = get('nameEn')
  const aliasesRaw  = get('aliases')
  const fodmapLevel = get('fodmapLevel').toLowerCase()
  const ibsSafety   = get('ibsSafety').toLowerCase()

  // バリデーション
  if (!id || !nameJa) { skipped++; skipReasons['id/nameJa missing'] = (skipReasons['id/nameJa missing']||0)+1; continue }
  if (!VALID_FODMAP.has(fodmapLevel)) { skipped++; skipReasons[`invalid fodmapLevel: ${fodmapLevel}`] = (skipReasons[`invalid fodmapLevel: ${fodmapLevel}`]||0)+1; continue }
  if (!VALID_SAFETY.has(ibsSafety))  { skipped++; skipReasons[`invalid ibsSafety: ${ibsSafety}`] = (skipReasons[`invalid ibsSafety: ${ibsSafety}`]||0)+1; continue }

  // aliases → keywords（nameJa・nameEn も自動追加）
  const aliasTokens = aliasesRaw.split(';').map(s => s.trim()).filter(Boolean)
  const keywords = [...new Set([nameJa, nameEn, ...aliasTokens].filter(Boolean))]

  const entry = {
    id,
    nameJa,
    nameEn: nameEn || nameJa,
    keywords,
    fodmapLevel,
    ibsSafety,
    caloriesPer100g: parseFloat(get('caloriesPer100g')) || 0,
    proteinPer100g:  parseFloat(get('proteinPer100g'))  || 0,
    fatPer100g:      parseFloat(get('fatPer100g'))      || 0,
    carbsPer100g:    parseFloat(get('carbsPer100g'))    || 0,
  }

  // 任意フィールド（空でなければ追加）
  const fodmapCategory  = get('fodmapCategory')
  const defaultServingG = get('defaultServingG')
  const safeServingG    = get('safeServingG')
  const noteJa          = get('noteJa')
  const noteEn          = get('noteEn')

  if (fodmapCategory)  entry.fodmapCategory  = fodmapCategory
  if (defaultServingG) entry.defaultServingG = parseInt(defaultServingG) || undefined
  if (safeServingG)    entry.safeServingG    = parseInt(safeServingG) || undefined
  if (noteJa)          entry.noteJa          = noteJa
  if (noteEn)          entry.noteEn          = noteEn

  entries.push(entry)
}

// ─── TypeScript 出力 ──────────────────────────────────────────────────────
const output = `// ============================================================
// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source : ${basename(inputPath)}
// Created: ${new Date().toISOString()}
// Entries: ${entries.length}
// Run    : node scripts/convert-fodmap-csv.mjs <csv> to regenerate
// ============================================================

import type { FODMAPLevel, IBSSafetyScore } from '../../types/entities'

export interface FodmapEntry {
  id: string
  nameJa: string
  nameEn: string
  keywords: string[]          // aliases + nameJa + nameEn (for matching)
  fodmapLevel: FODMAPLevel
  ibsSafety: IBSSafetyScore
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
  fodmapCategory?: string     // fructose / lactose / fructans / GOS / polyols / multiple / none
  defaultServingG?: number    // 一般的な1食分の目安量 (g) — カロリー自動計算に使用
  safeServingG?: number       // FODMAP的に安全な1食の目安量 (g)
  noteJa?: string
  noteEn?: string
}

export const FODMAP_DB: FodmapEntry[] = ${JSON.stringify(entries, null, 2)}
`

writeFileSync(outputPath, output, 'utf-8')

// ─── サマリー ─────────────────────────────────────────────────────────────
console.log(`\n✅  ${entries.length} 件 → ${outputPath}`)
if (skipped > 0) {
  console.warn(`⚠   ${skipped} 行スキップ`)
  Object.entries(skipReasons).forEach(([r, n]) => console.warn(`    - ${r}: ${n}件`))
}

// FODMAPレベル別集計
const counts = { low: 0, moderate: 0, high: 0 }
entries.forEach(e => counts[e.fodmapLevel]++)
console.log(`\nFODMAP内訳:`)
console.log(`  Low      : ${counts.low} 件`)
console.log(`  Moderate : ${counts.moderate} 件`)
console.log(`  High     : ${counts.high} 件`)
