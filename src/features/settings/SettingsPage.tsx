import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Check, Download } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { useProfileStore } from '../../stores/useProfileStore'
import { db } from '../../db/schema'
import { APP_VERSION, RELEASE_DATE } from '../../config/version'
import type { IBSType, Language, GutCheckTiming } from '../../types/entities'
import { exportAllDataAsJSON, exportWeightLogsAsCSV } from '../../services/export/DataExportService'

const IBS_TYPES: IBSType[] = ['IBS-D', 'IBS-C', 'IBS-M', 'IBS-U']
const GUT_CHECK_TIMINGS: GutCheckTiming[] = ['notification', 'next_meal', 'both']

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { profile, save } = useProfileStore()
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const unmatchedCount = useLiveQuery(() => db.unmatchedFoods.count(), []) ?? 0

  // フォーム状態
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [currentWeightKg, setCurrentWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [targetDailyCalories, setTargetDailyCalories] = useState('')
  const [ibsType, setIbsType] = useState<IBSType>('IBS-D')
  const [triggers, setTriggers] = useState('')
  const [safeFoods, setSafeFoods] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState<'claude' | 'openai' | 'gemini'>('claude')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [language, setLanguage] = useState<Language>('ja')
  const [gutCheckTiming, setGutCheckTiming] = useState<GutCheckTiming>('both')
  const [exporting, setExporting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setAge(profile.age ? String(profile.age) : '')
      setHeightCm(profile.heightCm ? String(profile.heightCm) : '')
      setCurrentWeightKg(profile.currentWeightKg ? String(profile.currentWeightKg) : '')
      setTargetWeightKg(profile.targetWeightKg ? String(profile.targetWeightKg) : '')
      setTargetDailyCalories(profile.targetDailyCalories ? String(profile.targetDailyCalories) : '')
      setIbsType(profile.ibsType)
      setTriggers(profile.knownTriggers.join(', '))
      setSafeFoods(profile.safeFoods.join(', '))
      setClaudeApiKey(profile.claudeApiKey)
      setAiProvider(profile.aiProvider ?? 'claude')
      setOpenaiApiKey(profile.openaiApiKey ?? '')
      setGeminiApiKey(profile.geminiApiKey ?? '')
      setAiModel(profile.aiModel ?? '')
      setLanguage(profile.language)
      setGutCheckTiming(profile.gutCheckTiming ?? 'both')
    }
  }, [profile])

  const handleSave = async () => {
    await save({
      name,
      age: parseInt(age) || 0,
      heightCm: parseFloat(heightCm) || 0,
      currentWeightKg: parseFloat(currentWeightKg) || 0,
      targetWeightKg: parseFloat(targetWeightKg) || 0,
      targetDailyCalories: parseInt(targetDailyCalories) || 2200,
      ibsType,
      knownTriggers: triggers.split(',').map(s => s.trim()).filter(Boolean),
      safeFoods: safeFoods.split(',').map(s => s.trim()).filter(Boolean),
      claudeApiKey,
      aiProvider,
      openaiApiKey: openaiApiKey.trim(),
      geminiApiKey: geminiApiKey.trim(),
      aiModel: aiModel.trim(),
      language,
      gutCheckTiming,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLanguageChange = async (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    await save({ language: lang })
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await db.delete()
      window.location.reload()
    } catch {
      setResetting(false)
      setShowResetConfirm(false)
    }
  }

  const handleExport = async () => {
    const allMeals = await db.meals.toArray()
    const allWeights = await db.weightLogs.toArray()
    const allChats = await db.chatMessages.toArray()
    const allUnmatched = await db.unmatchedFoods.toArray()
    // APIキーをエクスポートから除外（セキュリティ対策）
    const { claudeApiKey: _omit, ...safeProfile } = profile ?? {}
    const data = {
      appVersion: APP_VERSION,
      profile: safeProfile,
      meals: allMeals,
      weightLogs: allWeights,
      chatMessages: allChats,
      unmatchedFoods: allUnmatched,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `ibsgainlab-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const handleExportUnmatched = async () => {
    const logs = await db.unmatchedFoods.orderBy('timestamp').toArray()
    // 同じクエリを集約してカウント
    const counts: Record<string, { query: string; count: number; lastSeen: string }> = {}
    logs.forEach(l => {
      const key = l.query.toLowerCase().trim()
      if (!counts[key]) counts[key] = { query: l.query, count: 0, lastSeen: l.timestamp }
      counts[key].count++
      if (l.timestamp > counts[key].lastSeen) counts[key].lastSeen = l.timestamp
    })
    const rows = Object.values(counts).sort((a, b) => b.count - a.count)
    const csv = ['query,count,lastSeen', ...rows.map(r => `"${r.query}",${r.count},${r.lastSeen}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `ibsgainlab-unmatched-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <AppShell title={t('settings.title')}>
      <div className="p-4 space-y-5 pb-24">

        {/* 言語設定 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.language')}</h2>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['ja', 'en'] as Language[]).map(lang => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${language === lang ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              >
                {lang === 'ja' ? t('settings.lang_ja') : t('settings.lang_en')}
              </button>
            ))}
          </div>
        </section>

        {/* AI設定セクション */}
        <section className="space-y-3">
          <h2 className={sectionTitle}>{t('settings.ai_provider')}</h2>

          {/* プロバイダー選択 */}
          <div className="grid grid-cols-3 gap-2">
            {(['claude', 'openai', 'gemini'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAiProvider(p)}
                className={`py-2.5 rounded-xl text-[12px] font-display font-bold uppercase tracking-wide transition-all ${
                  aiProvider === p
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {p === 'claude' ? 'Claude' : p === 'openai' ? 'OpenAI' : 'Gemini'}
              </button>
            ))}
          </div>

          {/* APIキー入力（選択プロバイダーに応じて表示） */}
          {aiProvider === 'claude' && (
            <div className="space-y-1.5">
              <label className={labelCls}>{t('settings.claude_api_key')}</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={claudeApiKey}
                  onChange={e => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className={inputCls}
                />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {aiProvider === 'openai' && (
            <div className="space-y-1.5">
              <label className={labelCls}>{t('settings.openai_api_key')}</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className={inputCls}
                />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {aiProvider === 'gemini' && (
            <div className="space-y-1.5">
              <label className={labelCls}>{t('settings.gemini_api_key')}</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  placeholder="AIza..."
                  className={inputCls}
                />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* モデル名（任意） */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t('settings.ai_model_optional')}</label>
            <input
              type="text"
              value={aiModel}
              onChange={e => setAiModel(e.target.value)}
              placeholder={
                aiProvider === 'claude' ? 'claude-sonnet-4-6' :
                aiProvider === 'openai' ? 'gpt-4o-mini' :
                'gemini-2.0-flash'
              }
              className={inputCls}
            />
            <p className="text-[11px] text-gray-400">{t('settings.ai_model_hint')}</p>
          </div>
        </section>

        {/* プロフィール */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.profile')}</h2>
          <div className="space-y-3">
            <Field label={t('settings.name')}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.age')}>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t('settings.height')}>
                <input type="number" step="0.1" value={heightCm} onChange={e => setHeightCm(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.current_weight')}>
                <input type="number" step="0.1" value={currentWeightKg} onChange={e => setCurrentWeightKg(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t('settings.target_weight')}>
                <input type="number" step="0.1" value={targetWeightKg} onChange={e => setTargetWeightKg(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label={t('settings.target_calories')}>
              <input type="number" value={targetDailyCalories} onChange={e => setTargetDailyCalories(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </section>

        {/* IBSタイプ */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.ibs_type')}</h2>
          <div className="grid grid-cols-4 gap-2">
            {IBS_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setIbsType(type)}
                className={`py-2 rounded-xl text-sm font-medium transition-colors ${ibsType === type ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {/* 食品設定 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.triggers')}</h2>
          <textarea value={triggers} onChange={e => setTriggers(e.target.value)} rows={2} placeholder="牛乳, ニンニク, 玉ねぎ" className={`${inputCls} resize-none`} />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-3">{t('settings.safe_foods')}</h2>
          <textarea value={safeFoods} onChange={e => setSafeFoods(e.target.value)} rows={2} placeholder="白米, 鶏むね肉, うどん" className={`${inputCls} resize-none`} />
        </section>

        {/* 腸チェックタイミング */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.gut_check_timing')}</h2>
          <div className="space-y-2">
            {GUT_CHECK_TIMINGS.map(timing => (
              <button
                key={timing}
                onClick={() => setGutCheckTiming(timing)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${gutCheckTiming === timing ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400' : 'bg-gray-100 text-gray-600'}`}
              >
                <span>{t(`settings.gut_check_timing_${timing}`)}</span>
                {gutCheckTiming === timing && <Check size={16} />}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">{t('settings.gut_check_timing_help')}</p>
        </section>

        {/* データ管理セクション */}
        <section className="space-y-3">
          <h2 className={sectionTitle}>{t('settings.data_management')}</h2>

          <div className="bg-white rounded-2xl border border-black/[0.04] divide-y divide-black/[0.04]">
            {/* JSONエクスポート */}
            <button
              type="button"
              onClick={async () => {
                setExporting(true)
                try { await exportAllDataAsJSON() } finally { setExporting(false) }
              }}
              disabled={exporting}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download size={18} className="text-gray-500 shrink-0" />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-gray-800">{t('settings.export_json')}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{t('settings.export_json_desc')}</p>
              </div>
            </button>

            {/* CSV体重エクスポート */}
            <button
              type="button"
              onClick={async () => { await exportWeightLogsAsCSV() }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
            >
              <Download size={18} className="text-gray-500 shrink-0" />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-gray-800">{t('settings.export_csv')}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{t('settings.export_csv_desc')}</p>
              </div>
            </button>
          </div>
        </section>

        {/* データ管理（旧） */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.data')}</h2>
          <div className="space-y-2">
            <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
              <Download size={16} />
              {t('settings.export')}
            </button>
            <button onClick={handleExportUnmatched} className="w-full flex items-center justify-between border border-amber-200 bg-amber-50 rounded-xl px-4 py-2.5 text-sm text-amber-700">
              <span className="flex items-center gap-2">
                <Download size={16} />
                {t('settings.export_unmatched')}
              </span>
              <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {t('settings.unmatched_count', { count: unmatchedCount })}
              </span>
            </button>
          </div>
        </section>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          className={`btn-primary w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white shadow-[0_4px_14px_rgba(61,143,133,0.3)]'}`}
        >
          {saved && <Check size={16} />}
          {saved ? t('settings.saved') : t('settings.save')}
        </button>

        {/* 危険ゾーン */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {language === 'ja' ? 'リセット' : 'Reset'}
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 rounded-xl border-2 border-red-200 text-red-500 font-medium text-sm"
              >
                {language === 'ja' ? '初期設定に戻る（全データ削除）' : 'Reset all data & restart setup'}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium text-center">
                  {language === 'ja' ? '本当に全データを削除しますか？' : 'Delete all data? This cannot be undone.'}
                </p>
                <p className="text-xs text-gray-400 text-center">
                  {language === 'ja' ? '体重記録・食事記録・設定が全て消えます' : 'All weight logs, meals, and settings will be deleted.'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
                  >
                    {language === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {resetting
                      ? (language === 'ja' ? '削除中...' : 'Deleting...')
                      : (language === 'ja' ? '削除する' : 'Delete all')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 免責 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('settings.disclaimer')}</h2>
          <p className="text-xs text-gray-400 leading-relaxed">{t('disclaimer.full')}</p>
        </section>

        {/* バージョン情報 */}
        <div className="bg-gray-50 rounded-2xl p-4 text-center space-y-1">
          <p className="text-base font-bold text-gray-700">FutoLab</p>
          <span className="inline-block text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{APP_VERSION}</span>
          <p className="text-xs text-gray-400 pt-1">{RELEASE_DATE}</p>
          <p className="text-xs text-gray-300">FODMAP DB: 710食品収録</p>
        </div>
      </div>
    </AppShell>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400'
const sectionTitle = 'text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'
const labelCls = 'text-xs text-gray-500 block'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  )
}
