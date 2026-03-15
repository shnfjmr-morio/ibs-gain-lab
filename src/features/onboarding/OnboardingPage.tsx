import { useState } from 'react'
import { m, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { useProfileStore } from '../../stores/useProfileStore'
import type { IBSType, Language } from '../../types/entities'

interface Props { onComplete: () => void }

const STEPS = 4

export default function OnboardingPage({ onComplete }: Props) {
  const { t, i18n } = useTranslation()
  const { save } = useProfileStore()
  const [step, setStep] = useState(1)
  const [showKey, setShowKey] = useState(false)

  const [lang, setLang] = useState<Language>('ja')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [currentWeightKg, setCurrentWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetDailyCalories, setTargetDailyCalories] = useState('2200')
  const [ibsType, setIbsType] = useState<IBSType>('IBS-D')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState<'claude' | 'openai' | 'gemini'>('claude')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')

  const handleLangChange = (l: Language) => { setLang(l); i18n.changeLanguage(l) }

  const handleFinish = async () => {
    await save({
      name: name || 'User',
      age: parseInt(age) || 0,
      heightCm: parseFloat(heightCm) || 170,
      currentWeightKg: parseFloat(currentWeightKg) || 0,
      targetWeightKg: parseFloat(targetWeightKg) || 0,
      targetDailyCalories: parseInt(targetDailyCalories) || 2200,
      ibsType,
      claudeApiKey,
      language: lang,
      knownTriggers: [],
      safeFoods: [],
      avoidFoods: [],
      aiProvider,
      openaiApiKey,
      geminiApiKey,
    })
    onComplete()
  }

  const inputCls = 'w-full border rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-base'
  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' }
  const labelCls = 'text-xs text-emerald-200/70 mb-1.5 block'

  const IBS_TYPES: IBSType[] = ['IBS-D', 'IBS-C', 'IBS-M', 'IBS-U']
  const ibsDesc: Record<IBSType, { ja: string; en: string }> = {
    'IBS-D': { ja: '下痢型', en: 'Diarrhea-predominant' },
    'IBS-C': { ja: '便秘型', en: 'Constipation-predominant' },
    'IBS-M': { ja: '混合型', en: 'Mixed' },
    'IBS-U': { ja: '未分類', en: 'Unclassified' },
  }

  return (
    <div
      className="min-h-svh flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0D3B36 0%, #0A1628 50%, #111827 100%)' }}
    >
      {/* プログレスバー */}
      <div className="h-0.5 bg-white/10">
        <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(step / STEPS) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col p-6">
        <p className="text-xs text-white/30 mb-6">{t('onboarding.step', { current: step, total: STEPS })}</p>

        <AnimatePresence mode="wait">
          <m.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 flex flex-col gap-5"
          >
            {/* Step 1: 言語 + 基本情報 */}
            {step === 1 && (
              <>
                <div className="mb-4">
                  <h1 className="text-5xl font-black text-white tracking-tight mb-2">IBS Gain Lab</h1>
                  <p className="text-emerald-400 text-lg">腸に優しく、確実に増やす。</p>
                </div>

                <div>
                  <label className={labelCls}>{t('settings.language')}</label>
                  <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                    {(['ja', 'en'] as Language[]).map(l => (
                      <button key={l} onClick={() => handleLangChange(l)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          lang === l ? 'bg-white/20 text-white shadow' : 'text-white/50'
                        }`}>
                        {l === 'ja' ? '日本語' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t('settings.name')}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'ja' ? '山田太郎' : 'John Doe'} className={inputCls} style={inputStyle} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t('settings.age')}</label>
                    <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="28" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('settings.height')}</label>
                    <input type="number" step="0.1" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170" className={inputCls} style={inputStyle} />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: IBSタイプ */}
            {step === 2 && (
              <>
                <div>
                  <h1 className="text-3xl font-bold text-white">あなたのIBSタイプは？</h1>
                  <p className="text-sm text-white/40">あとで変更できます</p>
                </div>
                <div className="space-y-2">
                  {IBS_TYPES.map(type => (
                    <button key={type} onClick={() => setIbsType(type)}
                      className={`w-full flex justify-between items-center px-5 py-4 rounded-2xl border transition-all text-left ${
                        ibsType === type
                          ? 'border-emerald-400 bg-emerald-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-white/70'
                      }`}>
                      <span className="font-bold text-lg">{type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/50">{ibsDesc[type][lang]}</span>
                        {ibsType === type && <span className="text-emerald-400 text-lg">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 3: 目標設定 */}
            {step === 3 && (
              <>
                <div>
                  <h1 className="text-3xl font-bold text-white">目標を設定しよう</h1>
                </div>

                {parseFloat(currentWeightKg) > 0 && parseFloat(targetWeightKg) > 0 && (
                  <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl px-5 py-4 text-center">
                    <p className="text-4xl font-black text-emerald-400">
                      +{(parseFloat(targetWeightKg) - parseFloat(currentWeightKg)).toFixed(1)} kg
                    </p>
                    <p className="text-white/50 text-sm mt-1">を目指す</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>{t('settings.current_weight')}</label>
                    <input type="number" step="0.1" value={currentWeightKg} onChange={e => setCurrentWeightKg(e.target.value)} placeholder="52.0" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('settings.target_weight')}</label>
                    <input type="number" step="0.1" value={targetWeightKg} onChange={e => setTargetWeightKg(e.target.value)} placeholder="57.0" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('settings.target_calories')}</label>
                    <input type="number" value={targetDailyCalories} onChange={e => setTargetDailyCalories(e.target.value)} className={inputCls} style={inputStyle} />
                    <p className="text-xs text-white/30 mt-1">{lang === 'ja' ? '増量には現在の消費カロリー+300〜500kcalが目安です' : 'Aim for +300–500kcal above your maintenance calories'}</p>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: AI設定（マルチプロバイダー対応） */}
            {step === 4 && (
              <>
                <div>
                  <h1 className="text-3xl font-bold text-white">AI分析を使う</h1>
                  <p className="text-sm text-white/40">任意 — APIキーはデバイス内にのみ保存されます</p>
                </div>

                {/* プロバイダー選択 */}
                <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                  {(['claude', 'openai', 'gemini'] as const).map(p => (
                    <button key={p} onClick={() => setAiProvider(p)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                        aiProvider === p ? 'bg-white/20 text-white' : 'text-white/40'
                      }`}>
                      {p === 'claude' ? 'Claude' : p === 'openai' ? 'OpenAI' : 'Gemini'}
                    </button>
                  ))}
                </div>

                {/* 選択中プロバイダーのAPIキー入力 */}
                {aiProvider === 'claude' && (
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} value={claudeApiKey}
                      onChange={e => setClaudeApiKey(e.target.value)}
                      placeholder="sk-ant-..." className={inputCls + ' pr-10'} style={inputStyle} />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}
                {aiProvider === 'openai' && (
                  <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..." className={inputCls} style={inputStyle} />
                )}
                {aiProvider === 'gemini' && (
                  <input type="password" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..." className={inputCls} style={inputStyle} />
                )}

                <p className="text-xs text-white/25">
                  {aiProvider === 'claude' ? 'console.anthropic.com' : aiProvider === 'openai' ? 'platform.openai.com' : 'aistudio.google.com'}
                </p>
              </>
            )}
          </m.div>
        </AnimatePresence>

        {/* ナビゲーションボタン */}
        <div className="flex gap-3 mt-6 pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 border border-white/20 rounded-xl px-4 py-3.5 text-sm text-white/60">
              <ChevronLeft size={16} />
              {t('onboarding.back')}
            </button>
          )}
          {step < STEPS ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl py-3.5 font-semibold text-base transition-colors">
              {t('onboarding.next')}
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <button onClick={handleFinish}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl py-3.5 font-semibold text-base transition-colors">
                {t('onboarding.finish')}
              </button>
              <button onClick={handleFinish} className="w-full text-sm text-white/30 py-2">
                AIなしで始める →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
