import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Plus, Mic, MicOff, Sparkles, ChevronRight, ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { useProfileStore } from '../../stores/useProfileStore'
import { db } from '../../db/schema'
import { analyzeMeal } from '../../services/ai/ClaudeService'
import { lookupAllFodmap, type LookupResult } from '../../services/fodmap/FodmapLookup'
import { estimateNutrition } from '../../services/fodmap/NutritionEstimator'
import { recalculateDailyLog } from '../../services/dailyLog/DailyLogService'
import { scheduleGutCheck, requestNotificationPermission } from '../../services/notifications/GutCheckNotifier'
import { toDateStr, toTimeStr, nowIso, uuid } from '../../utils/date'
import { haptic } from '../../utils/haptics'
import { listItemVariants, staggerContainer } from '../../utils/motion'
import GutFeedbackModal from '../../components/GutFeedbackModal'
import { GutStatusButton } from '../../components/ui/GutStatusButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { SuccessModal } from '../../components/ui/SuccessModal'
import type { Meal, MealType, FODMAPLevel, IBSSafetyScore, GutFeedback } from '../../types/entities'

type InputMode = 'text' | 'voice'
type AddStep = 'input' | 'confirm' | 'ai_analyzing' | 'notify_prompt'

interface MealDraft {
  fodmapLevel: FODMAPLevel
  ibsSafety: IBSSafetyScore
  calories: number; protein: number; fat: number; carbs: number
  notes: string; aiEstimated: boolean; matchedFoodNames?: string[]
}

interface EditForm {
  mealType: MealType; description: string
  calories: string; protein: string; fat: string; carbs: string
  fodmapLevel: FODMAPLevel; ibsSafety: IBSSafetyScore
  gutFeedback: GutFeedback | ''; notes: string
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const FODMAP_LEVELS: FODMAPLevel[] = ['low', 'moderate', 'high']
const fodmapColor = { low: 'text-emerald-700 bg-emerald-50', moderate: 'text-amber-700 bg-amber-50', high: 'text-red-600 bg-red-50' }
const safetyColor  = { safe: 'text-emerald-600', caution: 'text-amber-600', risky: 'text-red-500' }
const gutEmoji     = { great: '😊', ok: '😐', bad: '😟' }

function offsetDate(base: string, days: number): string {
  const d = new Date(base); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function formatDateLabel(dateStr: string, todayStr: string, t: (k: string) => string) {
  if (dateStr === todayStr) return t('common.today')
  if (dateStr === offsetDate(todayStr, -1)) return t('common.yesterday')
  return dateStr
}

const inputCls = 'w-full border border-black/[0.04] rounded-2xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow'

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
}
const stepTransition = { duration: 0.18 }

export default function MealsPage() {
  const { t } = useTranslation()
  const { profile } = useProfileStore()
  const today = toDateStr()
  const [viewDate, setViewDate] = useState(today)

  const meals = useLiveQuery(
    () => db.meals.where('date').equals(viewDate).reverse().sortBy('time'),
    [viewDate]
  )

  // ─── 追加フロー ───────────────────────────────────────────────
  const [showAdd, setShowAdd]     = useState(false)
  const [addStep, setAddStep]     = useState<AddStep>('input')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [mealType, setMealType]   = useState<MealType>('lunch')
  const [description, setDescription] = useState('')
  const [draft, setDraft]         = useState<MealDraft | null>(null)
  const [matchResults, setMatchResults] = useState<LookupResult[]>([])
  const [savedMealId, setSavedMealId] = useState<string | null>(null)
  const [calories, setCalories]   = useState('')
  const [protein, setProtein]     = useState('')
  const [fat, setFat]             = useState('')
  const [carbs, setCarbs]         = useState('')
  const [aiError, setAiError]     = useState('')
  const [saveError, setSaveError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recogRef = useRef<any>(null)

  // ─── 目標達成モーダル ────────────────────────────────────────────
  const [showSuccess, setShowSuccess] = useState(false)

  // ─── 次回食事モード ────────────────────────────────────────────
  const [pendingFeedbackMeal, setPendingFeedbackMeal] = useState<Meal | null>(null)

  // ─── 編集フロー ───────────────────────────────────────────────
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [editForm, setEditForm]       = useState<EditForm | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const voiceSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  const hasApiKey = !!profile?.claudeApiKey
  const lang = profile?.language ?? 'ja'

  // ─── 音声入力 ─────────────────────────────────────────────────
  const startListening = () => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recog = new SR()
    recog.lang = lang === 'en' ? 'en-US' : 'ja-JP'
    recog.interimResults = false
    recog.onresult = (e: any) => { setDescription(e.results[0][0].transcript); setIsListening(false) }
    recog.onerror = () => setIsListening(false)
    recog.onend   = () => setIsListening(false)
    recogRef.current = recog; recog.start(); setIsListening(true)
  }
  const stopListening = () => { recogRef.current?.stop(); setIsListening(false) }

  // ─── 追加フロー ───────────────────────────────────────────────
  const handleNext = () => {
    if (!description.trim()) return
    try {
      const matches   = lookupAllFodmap(description)
      setMatchResults(matches)
      const nutrition = estimateNutrition(description)
      const riskScore = (l: FODMAPLevel) => l === 'high' ? 3 : l === 'moderate' ? 2 : 1
      const newDraft: MealDraft = matches.length > 0
        ? {
            fodmapLevel: matches.reduce<FODMAPLevel>((worst, m) =>
              riskScore(m.entry.fodmapLevel) > riskScore(worst) ? m.entry.fodmapLevel : worst, 'low'),
            ibsSafety: matches.some(m => m.entry.ibsSafety === 'risky') ? 'risky'
              : matches.some(m => m.entry.ibsSafety === 'caution') ? 'caution' : 'safe',
            calories: nutrition?.calories ?? 0,
            protein:  nutrition?.protein  ?? 0,
            fat:      nutrition?.fat      ?? 0,
            carbs:    nutrition?.carbs    ?? 0,
            notes: matches
              .map(m => (lang === 'en' ? m.entry.noteEn : m.entry.noteJa) ?? '')
              .filter(Boolean)
              .join(' / '),
            aiEstimated: false,
            matchedFoodNames: matches.map(m => m.entry.nameJa),
          }
        : {
            fodmapLevel: 'moderate', ibsSafety: 'caution',
            calories: 0, protein: 0, fat: 0, carbs: 0,
            notes: lang === 'en' ? 'Not in local DB. Use AI or enter manually.' : 'DBに未登録。AI分析か手動入力をおすすめします。',
            aiEstimated: false,
          }
      setDraft(newDraft)
      setCalories(newDraft.calories > 0 ? String(newDraft.calories) : '')
      setProtein(newDraft.protein   > 0 ? String(newDraft.protein)  : '')
      setFat(newDraft.fat           > 0 ? String(newDraft.fat)      : '')
      setCarbs(newDraft.carbs       > 0 ? String(newDraft.carbs)    : '')
      setAiError(''); setAddStep('confirm')
    } catch (err) {
      console.error('handleNext error:', err)
      setDraft({ fodmapLevel: 'moderate', ibsSafety: 'caution', calories: 0, protein: 0, fat: 0, carbs: 0,
        notes: lang === 'en' ? 'Could not analyze. Please enter manually.' : '解析エラー。手動で入力してください。', aiEstimated: false })
      setCalories(''); setProtein(''); setFat(''); setCarbs('')
      setAiError(''); setAddStep('confirm')
    }
  }

  const handleAiAnalyze = async () => {
    if (!profile?.claudeApiKey || !draft) return
    setAddStep('ai_analyzing'); setAiError('')
    try {
      const data = await analyzeMeal(description, profile)
      setDraft({ ...draft, fodmapLevel: data.fodmapLevel, ibsSafety: data.ibsSafety,
        calories: data.calories, protein: data.protein, fat: data.fat, carbs: data.carbs,
        notes: data.note, aiEstimated: true })
      setCalories(String(data.calories)); setProtein(String(data.protein))
      setFat(String(data.fat)); setCarbs(String(data.carbs))
      setAddStep('confirm')
    } catch {
      setAiError(t('meals.ai_error')); setAddStep('confirm')
    }
  }

  const handleAddClick = async () => {
    const timing = profile?.gutCheckTiming ?? 'both'
    if (timing === 'next_meal' || timing === 'both') {
      const now = Date.now()
      const minAge = 15 * 60 * 1000
      const todayMeals = await db.meals.where('date').equals(toDateStr()).toArray()
      const unanswered = todayMeals
        .filter(m => !m.gutFeedback)
        .filter(m => now - new Date(`${m.date}T${m.time}:00`).getTime() >= minAge)
        .sort((a, b) => b.time.localeCompare(a.time))
      if (unanswered.length > 0) {
        setPendingFeedbackMeal(unanswered[0])
        return
      }
    }
    setShowAdd(true)
  }

  const handlePendingFeedback = async (feedback: GutFeedback) => {
    if (pendingFeedbackMeal) {
      await db.meals.update(pendingFeedbackMeal.id, { gutFeedback: feedback })
    }
    setPendingFeedbackMeal(null)
    setShowAdd(true)
  }

  const handleSave = async () => {
    if (!draft) return
    setSaveError('')
    try {
      const meal: Meal = {
        id: uuid(), date: viewDate, type: mealType,
        time: toTimeStr(), description: description.trim(),
        totalCalories: parseInt(calories) || draft.calories,
        totalProtein:  parseFloat(protein) || draft.protein,
        totalFat:      parseFloat(fat)     || draft.fat,
        totalCarbs:    parseFloat(carbs)   || draft.carbs,
        fodmapLevel:   draft.fodmapLevel,
        ibsSafetyScore: draft.ibsSafety,
        aiEstimated:   draft.aiEstimated,
        notes:         draft.notes,
        createdAt:     nowIso(),
      }
      await db.meals.add(meal)
      await recalculateDailyLog(viewDate)
      setSavedMealId(meal.id)

      // Check calorie goal achievement
      const log = await db.dailyLogs.where('date').equals(viewDate).first()
      if (log && profile?.targetDailyCalories && log.totalCalories >= profile.targetDailyCalories) {
        const prevCalories = log.totalCalories - meal.totalCalories
        if (prevCalories < profile.targetDailyCalories) {
          setShowSuccess(true)
        }
      }

      haptic('success')
      const timing = profile?.gutCheckTiming ?? 'both'
      if (timing === 'notification' || timing === 'both') {
        if (!('Notification' in window)) { resetAdd(); return }
        if (Notification.permission === 'granted') {
          scheduleGutCheck(meal.id, meal.description, lang)
          resetAdd()
        } else if (Notification.permission === 'default') {
          setAddStep('notify_prompt')
        } else {
          resetAdd()
        }
      } else {
        resetAdd()
      }
    } catch (err) {
      console.error('handleSave error:', err)
      haptic('error')
      setSaveError(lang === 'en'
        ? `Save failed: ${err instanceof Error ? err.message : 'unknown error'}`
        : `保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`
      )
    }
  }

  const handleAllowNotification = async () => {
    const granted = await requestNotificationPermission()
    if (granted && savedMealId) {
      scheduleGutCheck(savedMealId, description.trim(), lang)
    }
    resetAdd()
  }

  const resetAdd = () => {
    setShowAdd(false); setDescription(''); setDraft(null); setMatchResults([])
    setSavedMealId(null); setAddStep('input'); setAiError('')
    setCalories(''); setProtein(''); setFat(''); setCarbs(''); setSaveError('')
  }

  const handleEditOpen = (meal: Meal) => {
    setEditingMeal(meal)
    setEditForm({
      mealType:    meal.type,
      description: meal.description,
      calories:    meal.totalCalories > 0 ? String(meal.totalCalories) : '',
      protein:     meal.totalProtein  > 0 ? String(meal.totalProtein)  : '',
      fat:         meal.totalFat      > 0 ? String(meal.totalFat)      : '',
      carbs:       meal.totalCarbs    > 0 ? String(meal.totalCarbs)    : '',
      fodmapLevel: meal.fodmapLevel,
      ibsSafety:   meal.ibsSafetyScore,
      gutFeedback: meal.gutFeedback ?? '',
      notes:       meal.notes,
    })
    setDeleteConfirm(false)
  }

  const handleEditSave = async () => {
    if (!editingMeal || !editForm) return
    await db.meals.update(editingMeal.id, {
      type:           editForm.mealType,
      description:    editForm.description.trim(),
      totalCalories:  parseInt(editForm.calories)  || 0,
      totalProtein:   parseFloat(editForm.protein) || 0,
      totalFat:       parseFloat(editForm.fat)     || 0,
      totalCarbs:     parseFloat(editForm.carbs)   || 0,
      fodmapLevel:    editForm.fodmapLevel,
      ibsSafetyScore: editForm.ibsSafety,
      gutFeedback:    editForm.gutFeedback || undefined,
      notes:          editForm.notes,
    })
    await recalculateDailyLog(editingMeal.date)
    haptic('success')
    setEditingMeal(null); setEditForm(null)
  }

  const handleDelete = async () => {
    if (!editingMeal) return
    await db.meals.delete(editingMeal.id)
    await recalculateDailyLog(editingMeal.date)
    haptic('medium')
    setEditingMeal(null); setEditForm(null); setDeleteConfirm(false)
  }

  return (
    <AppShell title={`${t('meals.title')} — ${formatDateLabel(viewDate, today, t)}`}>
      <div className="p-4 space-y-3">

        {/* 日付ナビゲーション */}
        <div className="flex items-center justify-between glass-panel rounded-2xl px-3 py-2.5 shadow-sm border border-black/[0.03]">
          <button onClick={() => setViewDate(d => offsetDate(d, -1))}
            className="p-2 text-emerald-700/70 hover:bg-emerald-50 rounded-xl active:scale-90 transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <span className="text-sm font-bold font-display text-gray-800 tracking-wide">{formatDateLabel(viewDate, today, t)}</span>
            {viewDate !== today && <p className="text-[11px] font-medium text-gray-400 mt-0.5">{viewDate}</p>}
          </div>
          <button onClick={() => setViewDate(d => offsetDate(d, 1))} disabled={viewDate >= today}
            className="p-2 text-emerald-700/70 hover:bg-emerald-50 rounded-xl disabled:opacity-20 active:scale-90 transition-all">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 追加ボタン */}
        {viewDate === today && (
          <motion.button data-motion
            onClick={handleAddClick}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full flex items-center justify-center gap-2 bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow relative overflow-hidden mt-2"
          >
            {/* Glass highlight effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
            <Plus size={20} className="relative z-10" strokeWidth={2.5} />
            <span className="relative z-10 text-[15px] tracking-wide font-display">{t('meals.add')}</span>
          </motion.button>
        )}

        {/* 食事リスト */}
        {meals && meals.length > 0 ? (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
            {meals.map(meal => (
              <motion.div key={meal.id} variants={listItemVariants}
                className="glass-panel rounded-3xl p-5 shadow-sm border border-black/[0.03]">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400 font-display tracking-wider uppercase">{meal.date} {meal.time}</span>
                      <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-display uppercase tracking-wider">{t(`meals.type.${meal.type}`)}</span>
                      {meal.gutFeedback && <span className="text-sm bg-white/60 shadow-sm px-1.5 rounded-full">{gutEmoji[meal.gutFeedback]}</span>}
                    </div>
                    <p className="text-[14px] font-medium text-gray-800 line-clamp-2 leading-relaxed">{meal.description}</p>
                    {meal.notes && <p className="text-[11px] text-gray-500 mt-1.5">{meal.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {meal.totalCalories > 0
                        ? <p className="text-xl font-bold font-display text-gray-900 tracking-tight leading-none">{meal.totalCalories}<span className="text-[10px] font-medium text-gray-400 ml-0.5 uppercase tracking-wider">kcal</span></p>
                        : <p className="text-[11px] text-gray-400 font-display uppercase tracking-widest">–kcal</p>
                      }
                      <motion.button data-motion
                        onClick={() => handleEditOpen(meal)}
                        whileTap={{ scale: 0.85 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="p-1.5 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                      >
                        <Pencil size={14} />
                      </motion.button>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-display tracking-widest shadow-sm border border-white/40 ${fodmapColor[meal.fodmapLevel]}`}>
                      {meal.fodmapLevel.toUpperCase()}
                    </span>
                  </div>
                </div>
                {meal.totalCalories > 0 && (
                  <div className="flex items-center gap-3 mt-4 text-[11px] font-medium text-gray-500 font-display border-t border-black/[0.04] pt-3">
                    <span>P <span className="text-gray-800 font-bold">{Math.round(meal.totalProtein * 10) / 10}g</span></span>
                    <span>F <span className="text-gray-800 font-bold">{Math.round(meal.totalFat * 10) / 10}g</span></span>
                    <span>C <span className="text-gray-800 font-bold">{Math.round(meal.totalCarbs * 10) / 10}g</span></span>
                    <span className={`ml-auto font-bold uppercase tracking-wider drop-shadow-sm ${safetyColor[meal.ibsSafetyScore]}`}>
                      {t(`meals.safety.${meal.ibsSafetyScore}`)}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState title={t('home.no_meals')} />
        )}
      </div>

      {/* ══════════════ 食事入力フルスクリーンオーバーレイ ══════════════ */}
      {showAdd && addStep === 'input' && createPortal(
        <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col overflow-hidden"
             style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Subtle background glow */}
          <div className="absolute top-[-5%] right-[-5%] w-72 h-72 bg-emerald-400/10 blur-[80px] rounded-full pointer-events-none" />
          
          {/* ヘッダー */}
          <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-black/[0.04] bg-white/50 backdrop-blur-md">
            <h2 className="text-lg font-bold font-display text-gray-900 tracking-tight">{t('meals.add')}</h2>
            <button onClick={resetAdd} className="text-sm text-gray-400 px-2 py-1">{t('common.cancel')}</button>
          </div>
          {/* スクロール可能コンテンツ */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {MEAL_TYPES.map(type => (
                <button key={type} onClick={() => setMealType(type)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${mealType === type ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t(`meals.type.${type}`)}
                </button>
              ))}
            </div>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {(['text','voice'] as InputMode[]).map(m => (
                <button key={m} onClick={() => setInputMode(m)} disabled={m === 'voice' && !voiceSupported}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {t(`meals.${m}_input`)}
                </button>
              ))}
            </div>
            {inputMode === 'text' && (
              <div className="relative">
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder={t('meals.text_placeholder')} rows={4}
                  className="w-full border border-black/[0.04] rounded-3xl px-5 py-4 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow leading-relaxed" />
              </div>
            )}
            {inputMode === 'voice' && (
              <div className="text-center space-y-3">
                <motion.button
                  onPointerDown={startListening} onPointerUp={stopListening}
                  animate={isListening ? { scale: 1.1 } : { scale: 1 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg ${isListening ? 'bg-red-500' : 'bg-emerald-600'}`}
                >
                  {isListening ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-white" />}
                </motion.button>
                <p className="text-sm text-gray-400">{isListening ? t('meals.voice_listening') : t('meals.voice_prompt')}</p>
                {description && <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 text-left">{description}</div>}
              </div>
            )}
          </div>
          {/* 固定フッター */}
          <div className="relative z-10 px-5 py-4 border-t border-black/[0.04] bg-white/50 backdrop-blur-md">
            <motion.button data-motion onClick={handleNext} disabled={!description.trim()}
              whileTap={description.trim() ? { scale: 0.97 } : undefined}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold disabled:opacity-40 disabled:grayscale-[0.5] shadow-glow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
              <span className="relative z-10 font-display tracking-wide">{t('meals.next')}</span>
              <ChevronRight size={18} className="relative z-10" />
            </motion.button>
          </div>
        </div>,
        document.getElementById('root')!
      )}

      {/* ══════════════ 食事確認・分析・通知シート ══════════════ */}
      <BottomSheet
        open={showAdd && addStep !== 'input'}
        onOpenChange={(open) => { if (!open) resetAdd() }}
        dismissible={false}
        className="min-h-[65dvh]"
        footer={
          addStep === 'confirm' ? (
            <div className="space-y-2">
              {saveError && <p className="text-xs text-red-500 text-center bg-red-50 rounded-xl px-3 py-2">{saveError}</p>}
              <motion.button data-motion onClick={handleSave}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow tracking-wide font-display relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
                <span className="relative z-10">{t('meals.save')}</span>
              </motion.button>
              <button onClick={() => setAddStep('input')} className="w-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 rounded-[1.25rem] py-3.5 text-[15px] font-bold font-display">{t('common.cancel')}</button>
            </div>
          ) : addStep === 'notify_prompt' ? (
            <div className="space-y-2">
              <motion.button data-motion onClick={handleAllowNotification}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow tracking-wide font-display relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
                <span className="relative z-10">{t('meals.notification_allow')}</span>
              </motion.button>
              <button onClick={resetAdd} className="w-full text-sm font-medium text-gray-400 py-2 hover:text-gray-600 transition-colors">{t('meals.notification_deny')}</button>
            </div>
          ) : undefined
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={addStep}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={stepTransition}
            className="space-y-3 pb-2"
          >
            {addStep === 'confirm' && draft && (<>
              <h2 className="text-base font-semibold text-gray-900">{t('meals.confirm_title')}</h2>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700">{description}</div>
              {matchResults.length > 0 ? (
                <div className="space-y-2">
                  {matchResults.map((m) => (
                    <div key={m.entry.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-gray-800">{m.entry.nameJa}</p>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${fodmapColor[m.entry.fodmapLevel]}`}>
                          {t(`meals.fodmap_level.${m.entry.fodmapLevel}`)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{t('meals.ibs_safety')}</span>
                        <span className={`text-xs font-medium ${safetyColor[m.entry.ibsSafety]}`}>
                          {t(`meals.safety.${m.entry.ibsSafety}`)}
                        </span>
                      </div>
                      {(lang === 'en' ? m.entry.noteEn : m.entry.noteJa) && (
                        <p className="text-xs text-gray-400">{lang === 'en' ? m.entry.noteEn : m.entry.noteJa}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{draft.notes}</p>
                </div>
              )}
              {draft.aiEstimated && <p className="text-xs text-emerald-600 flex items-center gap-1"><Sparkles size={10} />{t('meals.ai_estimated')}</p>}
              <div>
                <p className="text-xs text-gray-400 mb-2">{t('meals.nutrition_optional')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'calories', label: `kcal`, val: calories, set: setCalories },
                    { key: 'protein',  label: `${t('meals.protein')} (g)`, val: protein, set: setProtein },
                    { key: 'fat',      label: `${t('meals.fat')} (g)`,     val: fat,     set: setFat },
                    { key: 'carbs',    label: `${t('meals.carbs')} (g)`,   val: carbs,   set: setCarbs },
                  ].map(({ key, label, val, set }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                      <input type="number" value={val} onChange={e => set(e.target.value)} placeholder="0" className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>
              {hasApiKey && (
                <motion.button data-motion onClick={handleAiAnalyze}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="w-full flex items-center justify-center gap-2 border border-emerald-300 text-emerald-700 rounded-xl py-2.5 text-sm font-medium bg-emerald-50">
                  <Sparkles size={14} />{t('meals.ai_fill')}
                </motion.button>
              )}
              {aiError && <p className="text-xs text-red-500 text-center">{aiError}</p>}
            </>)}

            {addStep === 'ai_analyzing' && (
              <div className="py-12 text-center space-y-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full mx-auto"
                />
                <p className="text-sm text-gray-500">{t('meals.analyzing')}</p>
              </div>
            )}

            {addStep === 'notify_prompt' && (
              <div className="py-6 text-center space-y-4">
                <p className="text-2xl">🔔</p>
                <p className="text-base font-semibold text-gray-800">{t('meals.notification_prompt')}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </BottomSheet>

      {/* ══════════════ 食事編集シート ══════════════ */}
      <BottomSheet
        open={!!editingMeal && !!editForm}
        onOpenChange={(open) => { if (!open) { setEditingMeal(null); setEditForm(null); setDeleteConfirm(false) } }}
      >
        {editingMeal && editForm && (
          <div className="space-y-4 pb-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('meals.edit_title')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{editingMeal.date} {editingMeal.time}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {MEAL_TYPES.map(type => (
                <button key={type} onClick={() => setEditForm(f => f ? { ...f, mealType: type } : f)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${editForm.mealType === type ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t(`meals.type.${type}`)}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block uppercase tracking-wider">{t('meals.notes')}</label>
              <textarea value={editForm.description} onChange={e => setEditForm(f => f ? { ...f, description: e.target.value } : f)}
                rows={3} className="w-full border border-black/[0.04] rounded-2xl px-4 py-3 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow leading-relaxed" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { field: 'calories' as const, label: 'kcal' },
                { field: 'protein'  as const, label: `${t('meals.protein')} (g)` },
                { field: 'fat'      as const, label: `${t('meals.fat')} (g)` },
                { field: 'carbs'    as const, label: `${t('meals.carbs')} (g)` },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input type="number" value={editForm[field]}
                    onChange={e => setEditForm(f => f ? { ...f, [field]: e.target.value } : f)}
                    className={inputCls} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">FODMAP</label>
              <div className="flex gap-2">
                {FODMAP_LEVELS.map(lv => (
                  <button key={lv} onClick={() => setEditForm(f => f ? { ...f, fodmapLevel: lv } : f)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${editForm.fodmapLevel === lv ? fodmapColor[lv] + ' ring-2 ring-current ring-offset-1' : 'bg-gray-100 text-gray-500'}`}>
                    {lv.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">{t('meals.edit_gut')}</label>
              <div className="grid grid-cols-3 gap-2">
                {(['great', 'ok', 'bad'] as GutFeedback[]).map(v => (
                  <GutStatusButton
                    key={v}
                    value={v}
                    isActive={editForm.gutFeedback === v}
                    onSelect={(val) => setEditForm(f => f ? { ...f, gutFeedback: val } : f)}
                  />
                ))}
              </div>
              <button
                onClick={() => setEditForm(f => f ? { ...f, gutFeedback: '' } : f)}
                className={`mt-2 w-full py-2 rounded-xl text-center text-sm font-medium transition-colors ${
                  editForm.gutFeedback === '' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {t('gut.no_record')}
              </button>
            </div>
            <motion.button data-motion onClick={handleEditSave}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow relative overflow-hidden tracking-wide font-display">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
              <span className="relative z-10">{t('meals.edit_save')}</span>
            </motion.button>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-400 hover:text-red-500 hover:bg-red-50 py-3 rounded-[1.25rem] transition-colors">
                <Trash2 size={16} />{t('meals.delete')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-[1.25rem] py-3.5 text-[15px] font-bold shadow-md transition-colors font-display tracking-wide">{t('meals.delete_confirm')}</button>
                <button onClick={() => setDeleteConfirm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-[1.25rem] py-3.5 text-[15px] font-bold transition-colors font-display tracking-wide">{t('common.cancel')}</button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* 目標達成モーダル */}
      <SuccessModal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        title={t('success.calorie_goal')}
        description={t('success.calorie_goal_desc')}
      />

      {/* 次回食事モード：前の食事フィードバック */}
      {pendingFeedbackMeal && (
        <GutFeedbackModal
          meal={pendingFeedbackMeal}
          onSubmit={handlePendingFeedback}
          onSkip={() => { setPendingFeedbackMeal(null); setShowAdd(true) }}
        />
      )}
    </AppShell>
  )
}
