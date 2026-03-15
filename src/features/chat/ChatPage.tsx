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
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-400/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="glass-panel p-8 rounded-[2rem] shadow-sm border border-black/[0.03] flex flex-col items-center gap-4 relative z-10 w-full max-w-sm">
            <AlertCircle size={48} className="text-amber-400 drop-shadow-sm" />
            <p className="text-lg font-bold font-display text-gray-800 tracking-tight">{t('chat.no_api_key')}</p>
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

  return (
    <AppShell title={t('chat.title')}>
      <div className="flex flex-col h-[calc(100svh-7rem)] relative bg-[#FAFAF7]">
        {/* 背景のほのかな光 */}
        <div className="absolute top-20 right-[-10%] w-72 h-72 bg-emerald-300/10 blur-[100px] rounded-full pointer-events-none" />
        
        {/* 免責 */}
        <div className="px-4 py-2 bg-amber-50/80 backdrop-blur-md border-b border-amber-500/10 relative z-10">
          <p className="text-[11px] font-bold text-amber-600/80 text-center tracking-wide font-display">{t('chat.disclaimer')}</p>
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative z-10">
          {messages.length === 0 && (
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

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-[1.25rem] text-[15px] whitespace-pre-wrap leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-primary text-white rounded-br-sm shadow-emerald-900/10'
                  : 'glass-panel border border-black/[0.03] text-gray-800 rounded-bl-sm'
              }`}>
                {msg.content || (isStreaming ? <span className="animate-pulse opacity-50">...</span> : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 入力エリア */}
        <div className="border-t border-black/[0.04] bg-white/70 backdrop-blur-xl px-4 py-3 pb-safe flex gap-3 items-end relative z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
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
    </AppShell>
  )
}
