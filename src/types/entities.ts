// ─── 基本型 ───

export type IBSType = 'IBS-D' | 'IBS-C' | 'IBS-M' | 'IBS-U'

// ─── AI プロバイダー ───

export type AIProviderType = 'claude' | 'openai' | 'gemini'
export type IBSStatus = 'stable' | 'mild' | 'active' | 'recovering'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FODMAPLevel = 'low' | 'moderate' | 'high'
export type IBSSafetyScore = 'safe' | 'caution' | 'risky'
export type Language = 'ja' | 'en'
export type GutCheckTiming = 'notification' | 'next_meal' | 'both'

// ─── ユーザープロフィール ───

export interface UserProfile {
  id: 'default'
  name: string
  age: number
  gender: 'male' | 'female'
  heightCm: number
  currentWeightKg: number
  targetWeightKg: number
  targetWeeklyGainKg: number
  targetDailyCalories: number
  ibsType: IBSType
  knownTriggers: string[]
  safeFoods: string[]
  avoidFoods: string[]
  language: Language
  gutCheckTiming: GutCheckTiming
  claudeApiKey: string
  // AI プロバイダー設定
  aiProvider?: AIProviderType
  openaiApiKey?: string
  geminiApiKey?: string
  aiModel?: string
  createdAt: string
  updatedAt: string
}

// ─── 食事 ───

export type GutFeedback = 'great' | 'ok' | 'bad'

export interface Meal {
  id: string
  date: string           // 'YYYY-MM-DD'
  type: MealType
  time: string           // 'HH:MM'
  description: string    // 自由テキスト（AI解析前の生入力）
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  fodmapLevel: FODMAPLevel
  ibsSafetyScore: IBSSafetyScore
  aiEstimated: boolean
  notes: string
  gutFeedback?: GutFeedback   // 食後のお腹の調子（個人適応エンジン用）
  createdAt: string
}

// ─── 体重 ───

export interface WeightLog {
  id: string
  date: string
  weightKg: number
  bodyFatPercent: number | null
  ibsStatus: IBSStatus
  notes: string
  createdAt: string
}

// ─── 日次ログ（集約） ───

export interface DailyLog {
  date: string           // 主キー
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  ibsStatus?: IBSStatus  // WeightLog から同期されるIBS状態
  updatedAt: string
}

// ─── 未マッチ食品ログ（FODMAPデータベース改善用） ───

export interface UnmatchedFoodLog {
  id: string
  query: string       // ユーザーが入力した食品名
  date: string        // 'YYYY-MM-DD'
  timestamp: string   // ISO
}

// ─── チャット ───

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ─── 食後症状ログ ───────────────────────────────────────────────────

/** 食後の腸の状態（4択） */
export type GutFeedbackScore = 'great' | 'ok' | 'bad' | 'terrible'

/** 食後症状ログ（PostMealSymptomLog） */
export interface PostMealSymptomLog {
  id: string
  mealId: string          // 紐付く食事ID
  date: string            // YYYY-MM-DD
  timestamp: string       // ISO8601
  gutScore: GutFeedbackScore
  /** 詳細症状（複数選択可） */
  symptoms?: string[]     // 'bloating' | 'pain' | 'loose' | 'constipation' | 'nausea' | 'other'
  notes?: string          // 自由記述
  hoursAfterMeal?: number // 食後何時間後の記録か
}
