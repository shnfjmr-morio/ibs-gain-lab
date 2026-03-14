import { useState } from 'react'
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
    })
    onComplete()
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400'
  const IBS_TYPES: IBSType[] = ['IBS-D', 'IBS-C', 'IBS-M', 'IBS-U']
  const ibsDesc: Record<IBSType, { ja: string; en: string }> = {
    'IBS-D': { ja: '下痢型', en: 'Diarrhea-predominant' },
    'IBS-C': { ja: '便秘型', en: 'Constipation-predominant' },
    'IBS-M': { ja: '混合型', en: 'Mixed' },
    'IBS-U': { ja: '未分類', en: 'Unclassified' },
  }

  return (
    <div className="min-h-svh bg-gradient-to-b from-emerald-50 to-white flex flex-col">
      {/* プログレスバー */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(step / STEPS) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col p-6">
        <p className="text-xs text-gray-400 mb-6">{t('onboarding.step', { current: step, total: STEPS })}</p>

        {/* Step 1: 言語 + 基本情報 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.welcome')}</h1>
              <p className="text-gray-500 text-sm">{t('onboarding.subtitle')}</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">{t('settings.language')}</label>
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {(['ja', 'en'] as Language[]).map(l => (
                  <button key={l} onClick={() => handleLangChange(l)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${lang === l ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                    {l === 'ja' ? '日本語' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">{t('settings.name')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'ja' ? '山田太郎' : 'John Doe'} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('settings.age')}</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="28" className={inputCls} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('settings.height')}</label>
                <input type="number" step="0.1" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: IBSタイプ */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.step2_title')}</h1>
              <p className="text-sm text-gray-500">{t('onboarding.ibs_type_desc')}</p>
            </div>
            <div className="space-y-2">
              {IBS_TYPES.map(type => (
                <button key={type} onClick={() => setIbsType(type)}
                  className={`w-full flex justify-between items-center px-4 py-3.5 rounded-2xl border-2 transition-colors text-left ${
                    ibsType === type ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                  <span className="font-bold text-gray-900">{type}</span>
                  <span className="text-sm text-gray-500">{ibsDesc[type][lang]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 目標設定 */}
        {step === 3 && (
          <div className="flex-1 flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.step3_title')}</h1>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('settings.current_weight')}</label>
                <input type="number" step="0.1" value={currentWeightKg} onChange={e => setCurrentWeightKg(e.target.value)} placeholder="52.0" className={inputCls} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('settings.target_weight')}</label>
                <input type="number" step="0.1" value={targetWeightKg} onChange={e => setTargetWeightKg(e.target.value)} placeholder="57.0" className={inputCls} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('settings.target_calories')}</label>
                <input type="number" value={targetDailyCalories} onChange={e => setTargetDailyCalories(e.target.value)} className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">{lang === 'ja' ? '増量には現在の消費カロリー+300〜500kcalが目安です' : 'Aim for +300–500kcal above your maintenance calories'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: APIキー */}
        {step === 4 && (
          <div className="flex-1 flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.step4_title')}</h1>
              <p className="text-sm text-gray-500">{t('onboarding.step4_desc')}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              {lang === 'ja'
                ? 'APIキーはあなたのデバイスにのみ保存されます。外部サーバーには送信されません。'
                : 'Your API key is stored only on your device. It is never sent to our servers.'}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={claudeApiKey}
                onChange={e => setClaudeApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className={inputCls + ' pr-10'}
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t('settings.api_key_help')}: console.anthropic.com</p>
          </div>
        )}

        {/* ナビゲーションボタン */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
              <ChevronLeft size={16} />
              {t('onboarding.back')}
            </button>
          )}
          {step < STEPS ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 text-white rounded-xl py-3 font-medium">
              {t('onboarding.next')}
              <ChevronRight size={16} />
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <button onClick={handleFinish}
                className="w-full bg-emerald-600 text-white rounded-xl py-3 font-medium">
                {t('onboarding.finish')}
              </button>
              {!claudeApiKey && (
                <button onClick={handleFinish} className="w-full text-sm text-gray-400 py-1">
                  {t('onboarding.skip_api')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
