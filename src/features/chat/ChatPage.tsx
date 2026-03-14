import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Send, AlertCircle } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import { useProfileStore } from '../../stores/useProfileStore'
import { sendMessage } from '../../services/ai/ClaudeService'
import { uuid } from '../../utils/date'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

const QUICK_ACTIONS_JA = ['今日の食事を記録したい', '外食で何を食べるか相談したい', '体調が良くない', 'プロテインを選びたい']
const QUICK_ACTIONS_EN = ['Log a meal', 'What should I eat out?', 'I feel unwell', 'Help me pick a protein']

export default function ChatPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useProfileStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const quickActions = profile?.language === 'en' ? QUICK_ACTIONS_EN : QUICK_ACTIONS_JA

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return
    if (!profile?.claudeApiKey) return

    const userMsg: Message = { id: uuid(), role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    const assistantId = uuid()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    await sendMessage(history, profile, {
      onToken: (token) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + token } : m
        ))
      },
      onDone: () => setIsStreaming(false),
      onError: (err) => {
        const errMsg = err.message === 'NO_API_KEY' ? 'APIキーが設定されていません' : 'エラーが発生しました'
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: errMsg } : m
        ))
        setIsStreaming(false)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!profile?.claudeApiKey) {
    return (
      <AppShell title={t('chat.title')}>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
          <AlertCircle size={48} className="text-amber-400" />
          <p className="font-semibold text-gray-800">{t('chat.no_api_key')}</p>
          <p className="text-sm text-gray-500">{t('chat.no_api_key_desc')}</p>
          <button
            onClick={() => navigate('/settings')}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-medium"
          >
            {t('chat.go_settings')}
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('chat.title')}>
      <div className="flex flex-col h-[calc(100svh-7rem)]">
        {/* 免責 */}
        <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-600 text-center">{t('chat.disclaimer')}</p>
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 text-center">{t('chat.subtitle')}</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-600 text-left hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}>
                {msg.content || (isStreaming ? <span className="animate-pulse">...</span> : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 入力エリア */}
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 max-h-28 overflow-y-auto"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="bg-emerald-600 text-white rounded-xl p-2.5 disabled:opacity-40 transition-colors active:bg-emerald-700 shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </AppShell>
  )
}
