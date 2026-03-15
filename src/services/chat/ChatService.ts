import { db } from '../../db/schema'
import { uuid, nowIso } from '../../utils/date'
import type { ChatSession, ChatMessage } from '../../types/entities'

/**
 * 新規セッションを作成する。
 */
export async function createSession(title?: string): Promise<ChatSession> {
  const session: ChatSession = {
    id:        uuid(),
    title:     title ?? '新しい相談',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.chatSessions.add(session)
  return session
}

/**
 * セッションにメッセージを追加し、セッションの updatedAt を更新する。
 */
export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id:        uuid(),
    sessionId,
    role,
    content,
    timestamp: nowIso(),
  }
  await db.chatMessages.add(msg)
  await db.chatSessions.update(sessionId, { updatedAt: nowIso() })
  return msg
}

/**
 * セッションのメッセージ一覧を時系列順で取得する。
 */
export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  return db.chatMessages
    .where('sessionId').equals(sessionId)
    .sortBy('timestamp')
}

/**
 * 直近のセッション一覧を取得する（更新日時降順）。
 */
export async function getRecentSessions(limit = 20): Promise<ChatSession[]> {
  return db.chatSessions
    .orderBy('updatedAt')
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * セッションを削除する（メッセージも含む）。
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.chatMessages.where('sessionId').equals(sessionId).delete()
  await db.chatSessions.delete(sessionId)
}

/**
 * セッションタイトルを最初のユーザーメッセージから自動生成する。
 */
export function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim()
  return trimmed.length > 20 ? trimmed.slice(0, 20) + '...' : trimmed
}
