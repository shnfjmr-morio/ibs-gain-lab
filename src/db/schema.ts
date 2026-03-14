import Dexie, { type Table } from 'dexie'
import type { UserProfile, Meal, WeightLog, DailyLog, ChatSession, ChatMessage, UnmatchedFoodLog } from '../types/entities'

export class IBSDatabase extends Dexie {
  userProfile!: Table<UserProfile>
  meals!: Table<Meal>
  weightLogs!: Table<WeightLog>
  dailyLogs!: Table<DailyLog>
  chatSessions!: Table<ChatSession>
  chatMessages!: Table<ChatMessage>
  unmatchedFoods!: Table<UnmatchedFoodLog>

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
  }
}

export const db = new IBSDatabase()
