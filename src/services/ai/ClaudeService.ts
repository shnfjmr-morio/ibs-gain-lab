import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db/schema'
import type { UserProfile, WeightLog } from '../../types/entities'
import { toDateStr } from '../../utils/date'
import { callAI } from './AIProviderService'

const MODEL = import.meta.env.VITE_CLAUDE_MODEL ?? 'claude-sonnet-4-6'

function buildClient(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// ─── システムプロンプト構築 ───

function buildSystemPrompt(profile: UserProfile, context: string, lang: 'ja' | 'en'): string {
  if (lang === 'en') {
    return `You are a specialized health advisor for users managing IBS (Irritable Bowel Syndrome) while trying to gain weight safely.

## User Profile
- Name: ${profile.name}, Age: ${profile.age}, Height: ${profile.heightCm}cm
- Current weight: ${profile.currentWeightKg}kg, Target: ${profile.targetWeightKg}kg
- IBS type: ${profile.ibsType}
- Daily calorie goal: ${profile.targetDailyCalories}kcal
- Weekly gain target: ${profile.targetWeeklyGainKg}kg/week
- Known trigger foods: ${profile.knownTriggers.join(', ') || 'none'}
- Safe foods: ${profile.safeFoods.join(', ') || 'not specified'}

## Core Principles
- Gut stability FIRST. Weight gain is secondary.
- Always specify FODMAP level (Low/Moderate/High) and IBS safety (Safe/Caution/Risky) for food suggestions.
- Never say "just eat more" — suggest SAFE calorie-dense options.
- Warn immediately about: fever, rectal bleeding, nocturnal pain, watery diarrhea >3 days.
- You are NOT a doctor. Do not diagnose.

${context}

## Response Rules
- Reply in English.
- For meal logs: estimate calories, protein, fat, carbs, FODMAP level, IBS safety.
- For meal suggestions: always include calorie count and FODMAP level.
- Be concise and practical.`
  }

  return `あなたはIBS（過敏性腸症候群）を抱えながら安全に増量を目指すユーザー専属の健康管理アドバイザーです。

## ユーザープロフィール
- 名前: ${profile.name}、${profile.age}歳、身長${profile.heightCm}cm
- 現在の体重: ${profile.currentWeightKg}kg、目標: ${profile.targetWeightKg}kg
- IBSタイプ: ${profile.ibsType}
- 1日の目標カロリー: ${profile.targetDailyCalories}kcal
- 週間目標増量: ${profile.targetWeeklyGainKg}kg/週
- トリガー食品: ${profile.knownTriggers.join('、') || 'なし'}
- 安全食品: ${profile.safeFoods.join('、') || '未設定'}

## 基本姿勢
- 腸の安定を最優先。体重増加はその次。
- 食事提案には必ずFODMAPレベル（Low/Moderate/High）とIBS安全性（◎安全/○注意/△危険）を明示する。
- 「もっと食べろ」とは言わない。「安全に追加できるもの」を提案する。
- 危険サイン（発熱・血便・夜間痛・水様下痢3日以上）があれば即座に受診を勧める。
- 医療的な診断は行わない。

${context}

## 応答ルール
- 日本語で応答する。
- 食事報告時: カロリー・PFC・FODMAPレベル・IBS安全性を推定して返す。
- 食事提案時: 必ずカロリーとFODMAPレベルを含める。
- 外食・コンビニの質問には具体的なメニュー名で回答する。
- 簡潔かつ実用的に。`
}

// ─── コンテキスト構築 ───

async function buildContext(lang: 'ja' | 'en'): Promise<string> {
  const today = toDateStr()
  const dailyLog = await db.dailyLogs.get(today)
  const todayMeals = await db.meals.where('date').equals(today).toArray()
  const recentWeights = await db.weightLogs.orderBy('date').reverse().limit(7).toArray()

  if (lang === 'en') {
    return `## Today's Context (${today})
Calories logged today: ${dailyLog?.totalCalories ?? 0}kcal
Protein: ${dailyLog?.totalProtein ?? 0}g | Fat: ${dailyLog?.totalFat ?? 0}g | Carbs: ${dailyLog?.totalCarbs ?? 0}g

Today's meals:
${todayMeals.length > 0 ? todayMeals.map(m => `- ${m.type}: ${m.description} (${m.totalCalories}kcal)`).join('\n') : '- None logged yet'}

Recent weight (last 7 days):
${recentWeights.length > 0 ? recentWeights.map((w: WeightLog) => `- ${w.date}: ${w.weightKg}kg [gut: ${w.ibsStatus}]`).join('\n') : '- No data'}`
  }

  return `## 今日のコンテキスト（${today}）
今日の摂取カロリー: ${dailyLog?.totalCalories ?? 0}kcal
タンパク質: ${dailyLog?.totalProtein ?? 0}g | 脂質: ${dailyLog?.totalFat ?? 0}g | 炭水化物: ${dailyLog?.totalCarbs ?? 0}g

今日の食事:
${todayMeals.length > 0 ? todayMeals.map(m => `- ${m.type}: ${m.description}（${m.totalCalories}kcal）`).join('\n') : '- まだ記録なし'}

直近の体重（7日分）:
${recentWeights.length > 0 ? recentWeights.map((w: WeightLog) => `- ${w.date}: ${w.weightKg}kg【腸: ${w.ibsStatus}】`).join('\n') : '- データなし'}`
}

// ─── メイン送信関数 ───

export interface StreamCallbacks {
  onToken: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
}

export async function sendMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  profile: UserProfile,
  callbacks: StreamCallbacks
): Promise<void> {
  const provider = profile.aiProvider ?? 'claude'

  const context = await buildContext(profile.language)
  const systemPrompt = buildSystemPrompt(profile, context, profile.language)

  // Claude: ストリーミングを維持
  if (provider === 'claude') {
    if (!profile.claudeApiKey) {
      callbacks.onError(new Error('NO_API_KEY'))
      return
    }

    const client = buildClient(profile.claudeApiKey)

    try {
      const stream = await client.messages.stream({
        model: profile.aiModel ?? MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          callbacks.onToken(chunk.delta.text)
        }
      }
      callbacks.onDone()
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
    return
  }

  // OpenAI / Gemini: 非ストリームフォールバック
  try {
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]
    const response = await callAI(aiMessages, profile, { maxTokens: 1024 })
    callbacks.onToken(response.content)
    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}

// ─── 食事分析（1回限りのCall）───

export interface AnalyzeMealResult {
  calories: number
  protein: number
  fat: number
  carbs: number
  fodmapLevel: 'low' | 'moderate' | 'high'
  ibsSafety: 'safe' | 'caution' | 'risky'
  note: string
}

/** AIレスポンスからJSONブロックを堅牢に抽出する */
function extractJsonFromText(text: string): string {
  // Markdownコードブロックを除去
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  // すべての {...} ブロックを取得し、最長のものを選択
  const matches = [...stripped.matchAll(/\{[\s\S]*?\}/g)]
  if (matches.length === 0) {
    // フォールバック: 全体を試す
    return stripped
  }
  return matches.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]
}

export async function analyzeMeal(
  description: string,
  profile: UserProfile
): Promise<AnalyzeMealResult> {
  const lang = profile.language

  const systemPrompt = lang === 'en'
    ? `You are a nutrition and IBS specialist. Analyze meals and return JSON only — no markdown, no explanation.
User: IBS type ${profile.ibsType}, triggers: ${profile.knownTriggers.join(', ') || 'none'}, safe foods: ${profile.safeFoods.join(', ') || 'not specified'}.`
    : `あなたは栄養とIBSの専門家です。食事を分析してJSONのみを返してください。マークダウンや説明は不要です。
ユーザー情報: IBSタイプ ${profile.ibsType}、トリガー食品: ${profile.knownTriggers.join('、') || 'なし'}、安全食品: ${profile.safeFoods.join('、') || '未設定'}。`

  const userPrompt = lang === 'en'
    ? `Analyze this meal. Return exactly this JSON with no other text:\n{"calories": number, "protein": number, "fat": number, "carbs": number, "fodmapLevel": "low"|"moderate"|"high", "ibsSafety": "safe"|"caution"|"risky", "note": "brief IBS note"}\n\nMeal: ${description}`
    : `この食事を分析してください。以下のJSON形式のみを返してください（他のテキスト不要）:\n{"calories": number, "protein": number, "fat": number, "carbs": number, "fodmapLevel": "low"|"moderate"|"high", "ibsSafety": "safe"|"caution"|"risky", "note": "IBS向けの一言メモ"}\n\n食事: ${description}`

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    profile,
    { maxTokens: 512 }
  )

  const text = response.content

  const jsonStr = extractJsonFromText(text)
  const data = JSON.parse(jsonStr) as Partial<AnalyzeMealResult>

  // 型安全なフォールバック
  return {
    calories:    typeof data.calories === 'number' ? data.calories : 0,
    protein:     typeof data.protein  === 'number' ? data.protein  : 0,
    fat:         typeof data.fat      === 'number' ? data.fat      : 0,
    carbs:       typeof data.carbs    === 'number' ? data.carbs    : 0,
    fodmapLevel: (['low', 'moderate', 'high'] as const).includes(data.fodmapLevel as any)
      ? data.fodmapLevel as AnalyzeMealResult['fodmapLevel'] : 'moderate',
    ibsSafety:   (['safe', 'caution', 'risky'] as const).includes(data.ibsSafety as any)
      ? data.ibsSafety as AnalyzeMealResult['ibsSafety'] : 'caution',
    note:        typeof data.note === 'string' ? data.note : '',
  }
}
