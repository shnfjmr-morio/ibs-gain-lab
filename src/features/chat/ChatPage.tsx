import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Send, AlertCircle, Plus, Clock, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { useProfileStore } from '../../stores/useProfileStore'
import { sendMessage } from '../../services/ai/ClaudeService'
import { createSession, addMessage, getMessages, getRecentSessions, deleteSession, generateTitle } from '../../services/chat/ChatService'
import type { ChatSession, ChatMessage } from '../../types/entities'

const QUICK_ACTIONS_JA = ['今日の食事を記録したい', '外食で何を食べるか相談したい', '体調が良くない', 'プロテインを選びたい']
const QUICK_ACTIONS_EN = ['Log a meal', 'What should I eat out?', 'I feel unwell', 'Help me pick a protein']

interface StreamingMsg extends ChatMessage {
  isStreaming?: boolean
}

export default function ChatPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useProfileStore()

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const quickActions = profile?.language === 'en' ? QUICK_ACTIONS_EN : QUICK_ACTIONS_JA

  // DB LiveQuery: 現在のセッションのメッセージ（型はChatMessage[]|undefined）
  const dbMessages = useLiveQuery(
    () => currentSessionId ? getMessages(currentSessionId) : Promise.resolve([] as ChatMessage[]),
    [currentSessionId]
  )

  // DB LiveQuery: セッション一覧
  const sessions = useLiveQuery(
    () => getRecentSessions(20),
    []
  )

  // 表示用メッセージリスト（ストリーミング中は末尾に仮表示）
  const safeMessages: ChatMessage[] = dbMessages ?? []
  const displayMessages: StreamingMsg[] = [
    ...safeMessages,
    ...(isStreaming && streamingContent
      ? [{ id: 'streaming', sessionId: currentSessionId ?? '', role: 'assistant' as const, content: streamingContent, timestamp: '', isStreaming: true }]
      : [])
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages.length, streamingContent])

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    const activeKey = profile?.aiProvider === 'gemini' ? profile?.geminiApiKey
      : profile?.aiProvider === 'openai' ? profile?.openaiApiKey
      : profile?.claudeApiKey
    if (!content || isStreaming || !activeKey) return

    // セッションがなければ新規作成
    let sessionId = currentSessionId
    if (!sessionId) {
      const session = await createSession(generateTitle(content))
      sessionId = session.id
      setCurrentSessionId(sessionId)
    }

    // ユーザーメッセージをDBに保存
    await addMessage(sessionId, 'user', content)
    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    // 会話履歴を構築
    const history = [...safeMessages, { id: '', sessionId, role: 'user' as const, content, timestamp: '' }]
      .map(m => ({ role: m.role, content: m.content }))

    let fullResponse = ''

    await sendMessage(history, profile!, {
      onToken: (token) => {
        fullResponse += token
        setStreamingContent(fullResponse)
      },
      onDone: async () => {
        await addMessage(sessionId!, 'assistant', fullResponse)
        setStreamingContent('')
        setIsStreaming(false)
      },
      onError: async (err) => {
        let errMsg: string
        if (err.message === 'NO_API_KEY') {
          errMsg = 'APIキーが設定されていません'
        } else {
          errMsg = `エラーが発生しました: ${err.message}`
        }
        await addMessage(sessionId!, 'assistant', errMsg)
        setStreamingContent('')
        setIsStreaming(false)
      },
    })
  }

  const handleNewChat = () => {
    setCurrentSessionId(null)
    setStreamingContent('')
    setShowHistory(false)
  }

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id)
    setShowHistory(false)
  }

  const handleDeleteSession = async (session: ChatSession) => {
    await deleteSession(session.id)
    if (currentSessionId === session.id) setCurrentSessionId(null)
    setDeleteTarget(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const formatSessionDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  // APIキー未設定画面
  const activeKey = profile?.aiProvider === 'gemini' ? profile?.geminiApiKey
    : profile?.aiProvider === 'openai' ? profile?.openaiApiKey
    : profile?.claudeApiKey
  const providerName = profile?.aiProvider === 'openai' ? 'OpenAI'
    : profile?.aiProvider === 'gemini' ? 'Gemini'
    : 'Claude'
  if (!activeKey) {
    return (
      <AppShell title={t('chat.title')}>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-400/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="glass-panel p-8 rounded-[2rem] shadow-sm border border-black/[0.03] flex flex-col items-center gap-4 relative z-10 w-full max-w-sm">
            <AlertCircle size={48} className="text-amber-400 drop-shadow-sm" />
            <p className="text-lg font-bold font-display text-gray-800 tracking-tight">{t('chat.no_api_key')}</p>
            <p className="text-[13px] text-gray-400 leading-relaxed">{providerName} APIキーが必要です</p>
            <p className="text-[13px] text-gray-500 leading-relaxed">{t('chat.no_api_key_desc')}</p>
            <button
              onClick={() => navigate('/settings')}
              className="mt-2 w-full bg-gradient-primary text-white px-6 py-3.5 rounded-[1.25rem] font-bold font-display tracking-wide shadow-glow relative overflow-hidden transition-transform active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
              <span className="relative z-10">{t('chat.go_settings')}</span>
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  const safeSessions: ChatSession[] = sessions ?? []

  return (
    <AppShell
      title={t('chat.title')}
      rightAction={
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 text-[12px] font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/80 active:scale-95 transition-all px-2.5 py-1.5 rounded-full shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            {t('chat.new_chat', { defaultValue: '新規' })}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 text-[12px] font-bold text-gray-600 bg-gray-100/70 hover:bg-gray-200/80 active:scale-95 transition-all px-2.5 py-1.5 rounded-full shadow-sm"
          >
            <Clock size={13} />
            {t('chat.history', { defaultValue: '履歴' })}
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-[calc(100svh-7rem)] relative bg-[#FAFAF7]">
        {/* 背景のほのかな光 */}
        <div className="absolute top-20 right-[-10%] w-72 h-72 bg-emerald-300/10 blur-[100px] rounded-full pointer-events-none" />

        {/* 免責 */}
        <div className="px-4 py-2 bg-amber-50/80 backdrop-blur-md border-b border-amber-500/10 relative z-10">
          <p className="text-[11px] font-bold text-amber-600/80 text-center tracking-wide font-display">{t('chat.disclaimer')}</p>
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative z-10">
          {displayMessages.length === 0 && (
            <div className="space-y-4 mt-4">
              <p className="text-sm font-medium text-gray-400 text-center">{t('chat.subtitle')}</p>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action)}
                    className="glass-panel border border-black/[0.04] rounded-2xl px-4 py-3 text-[13px] font-medium text-gray-700 text-left hover:bg-white/80 active:scale-95 transition-all shadow-sm leading-snug"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-[1.25rem] text-[15px] whitespace-pre-wrap leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-primary text-white rounded-br-sm shadow-emerald-900/10'
                  : 'glass-panel border border-black/[0.03] text-gray-800 rounded-bl-sm'
              }`}>
                {msg.content || (msg.isStreaming ? <span className="animate-pulse opacity-50">...</span> : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 入力エリア */}
        <div
          className="border-t border-black/[0.04] bg-white/70 backdrop-blur-xl px-4 pt-3 flex gap-3 items-end relative z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 resize-none border border-black/[0.04] rounded-[1.25rem] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white shadow-inner max-h-28 overflow-y-auto transition-shadow"
            style={{ lineHeight: '1.4' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="bg-gradient-primary text-white rounded-full p-3.5 disabled:opacity-40 disabled:grayscale transition-all active:scale-90 shrink-0 shadow-glow"
          >
            <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
          </button>
        </div>
      </div>

      {/* 履歴 BottomSheet */}
      <BottomSheet
        open={showHistory}
        onOpenChange={(open) => { if (!open) setShowHistory(false) }}
      >
        <div className="space-y-3 pb-2">
          <h2 className="text-base font-semibold text-gray-900">
            {t('chat.history', { defaultValue: '履歴' })}
          </h2>

          {safeSessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {t('chat.no_history', { defaultValue: 'まだ相談履歴がありません' })}
            </p>
          ) : (
            <div className="space-y-2">
              {safeSessions.map(session => (
                <div
                  key={session.id}
                  className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors cursor-pointer ${
                    currentSessionId === session.id
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{session.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatSessionDate(session.updatedAt)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(session) }}
                    className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* 削除確認 BottomSheet */}
      <BottomSheet
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        {deleteTarget && (
          <div className="space-y-4 pb-2">
            <p className="text-base font-semibold text-gray-900 text-center">
              {t('chat.delete_session', { defaultValue: 'この会話を削除' })}
            </p>
            <p className="text-sm text-gray-500 text-center">
              「{deleteTarget.title}」{t('chat.delete_confirm', { defaultValue: '削除しますか？' })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteSession(deleteTarget)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-[1.25rem] py-3.5 text-[15px] font-bold shadow-md transition-colors font-display"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-[1.25rem] py-3.5 text-[15px] font-bold transition-colors font-display"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </AppShell>
  )
}
