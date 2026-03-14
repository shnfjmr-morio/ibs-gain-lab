import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db/schema'
import type { UserProfile, WeightLog } from '../../types/entities'
import { toDateStr } from '../../utils/date'

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
  if (!profile.claudeApiKey) {
    callbacks.onError(new Error('NO_API_KEY'))
    return
  }

  const client = buildClient(profile.claudeApiKey)
  const context = await buildContext(profile.language)
  const systemPrompt = buildSystemPrompt(profile, context, profile.language)

  try {
    const stream = await client.messages.stream({
      model: MODEL,
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
}

// ─── 食事分析（1回限りのCall）───

export async function analyzeMeal(
  description: string,
  profile: UserProfile
): Promise<string> {
  if (!profile.claudeApiKey) throw new Error('NO_API_KEY')

  const client = buildClient(profile.claudeApiKey)
  const prompt =
    profile.language === 'en'
      ? `Analyze this meal and return: estimated calories, protein(g), fat(g), carbs(g), FODMAP level (Low/Moderate/High), IBS safety (Safe/Caution/Risky), and a brief IBS note.\n\nMeal: ${description}\n\nFormat your response as JSON: {"calories": number, "protein": number, "fat": number, "carbs": number, "fodmapLevel": "low"|"moderate"|"high", "ibsSafety": "safe"|"caution"|"risky", "note": "string"}`
      : `この食事を分析してください。推定カロリー、タンパク質(g)、脂質(g)、炭水化物(g)、FODMAPレベル（low/moderate/high）、IBS安全性（safe/caution/risky）、IBS向けの一言メモを返してください。\n\n食事: ${description}\n\nJSON形式で返してください: {"calories": number, "protein": number, "fat": number, "carbs": number, "fodmapLevel": "low"|"moderate"|"high", "ibsSafety": "safe"|"caution"|"risky", "note": "string"}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text
}
