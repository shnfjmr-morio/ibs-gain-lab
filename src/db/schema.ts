import Dexie, { type Table } from 'dexie'
import type { UserProfile, Meal, WeightLog, DailyLog, ChatSession, ChatMessage, UnmatchedFoodLog, PostMealSymptomLog } from '../types/entities'

export class IBSDatabase extends Dexie {
  userProfile!: Table<UserProfile>
  meals!: Table<Meal>
  weightLogs!: Table<WeightLog>
  dailyLogs!: Table<DailyLog>
  chatSessions!: Table<ChatSession>
  chatMessages!: Table<ChatMessage>
  unmatchedFoods!: Table<UnmatchedFoodLog>
  postMealSymptomLogs!: Table<PostMealSymptomLog>

  constructor() {
    super('ibs-gain-lab')

    // v1: Phase 1 MVP
    this.version(1).stores({
      userProfile: 'id',
      meals: 'id, date, type, createdAt',
      weightLogs: 'id, date, createdAt',
      dailyLogs: 'date, updatedAt',
      chatSessions: 'id, createdAt',
      chatMessages: 'id, sessionId, timestamp',
    })

    // v2: β1.0.0 — 未マッチ食品ログ追加
    this.version(2).stores({
      userProfile: 'id',
      meals: 'id, date, type, createdAt',
      weightLogs: 'id, date, createdAt',
      dailyLogs: 'date, updatedAt',
      chatSessions: 'id, createdAt',
      chatMessages: 'id, sessionId, timestamp',
      unmatchedFoods: 'id, date, timestamp',
    })

    // v3: β1.1.0 — chatSessions に updatedAt インデックス追加（getRecentSessions の orderBy 対応）
    this.version(3).stores({
      userProfile: 'id',
      meals: 'id, date, type, createdAt',
      weightLogs: 'id, date, createdAt',
      dailyLogs: 'date, updatedAt',
      chatSessions: 'id, createdAt, updatedAt',
      chatMessages: 'id, sessionId, timestamp',
      unmatchedFoods: 'id, date, timestamp',
    })

    // v4: β1.2.0 — 食後症状ログ追加
    this.version(4).stores({
      userProfile: 'id',
      meals: 'id, date, type, createdAt',
      weightLogs: 'id, date, createdAt',
      dailyLogs: 'date, updatedAt',
      chatSessions: 'id, createdAt, updatedAt',
      chatMessages: 'id, sessionId, timestamp',
      unmatchedFoods: 'id, date, timestamp',
      postMealSymptomLogs: 'id, mealId, date, timestamp',  // 追加
    })
  }
}

export const db = new IBSDatabase()
