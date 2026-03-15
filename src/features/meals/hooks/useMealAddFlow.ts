import { useState, useRef } from 'react'
import { useProfileStore } from '../../../stores/useProfileStore'
import { db } from '../../../db/schema'
import { analyzeMeal } from '../../../services/ai/ClaudeService'
import { lookupAllFodmap, type LookupResult } from '../../../services/fodmap/FodmapLookup'
import { estimateNutrition } from '../../../services/fodmap/NutritionEstimator'
import { recalculateDailyLog } from '../../../services/dailyLog/DailyLogService'
import { scheduleGutCheck, requestNotificationPermission } from '../../../services/notifications/GutCheckNotifier'
import { toDateStr, toTimeStr, nowIso, uuid } from '../../../utils/date'
import { haptic } from '../../../utils/haptics'
import type { Meal, MealType, FODMAPLevel } from '../../../types/entities'
import type { AddStep, InputMode, MealDraft } from '../types'

export interface MealAddFlowReturn {
  handlePendingFeedbackSkip: () => void
  // 表示状態
  showAdd: boolean
  addStep: AddStep
  inputMode: InputMode
  mealType: MealType
  description: string
  draft: MealDraft | null
  matchResults: LookupResult[]
  calories: string
  protein: string
  fat: string
  carbs: string
  aiError: string
  saveError: string
  isListening: boolean
  showSuccess: boolean
  pendingFeedbackMeal: Meal | null
  voiceSupported: boolean
  hasApiKey: boolean
  lang: 'ja' | 'en'
  // セッター
  setInputMode: (mode: InputMode) => void
  setMealType: (type: MealType) => void
  setDescription: (v: string) => void
  setCalories: (v: string) => void
  setProtein: (v: string) => void
  setFat: (v: string) => void
  setCarbs: (v: string) => void
  setAddStep: (step: AddStep) => void
  setShowSuccess: (v: boolean) => void
  // アクション
  handleAddClick: () => Promise<void>
  handleNext: () => void
  handleAiAnalyze: () => Promise<void>
  handleSave: () => Promise<void>
  handleAllowNotification: () => Promise<void>
  handlePendingFeedback: (feedback: Meal['gutFeedback']) => Promise<void>
  startListening: () => void
  stopListening: () => void
  resetAdd: () => void
}

export function useMealAddFlow(viewDate: string): MealAddFlowReturn {
  const { profile } = useProfileStore()

  const [showAdd, setShowAdd]         = useState(false)
  const [addStep, setAddStep]         = useState<AddStep>('input')
  const [inputMode, setInputMode]     = useState<InputMode>('text')
  const [mealType, setMealType]       = useState<MealType>('lunch')
  const [description, setDescription] = useState('')
  const [draft, setDraft]             = useState<MealDraft | null>(null)
  const [matchResults, setMatchResults] = useState<LookupResult[]>([])
  const [savedMealId, setSavedMealId] = useState<string | null>(null)
  const [calories, setCalories]       = useState('')
  const [protein, setProtein]         = useState('')
  const [fat, setFat]                 = useState('')
  const [carbs, setCarbs]             = useState('')
  const [aiError, setAiError]         = useState('')
  const [saveError, setSaveError]     = useState('')
  const [isListening, setIsListening] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [pendingFeedbackMeal, setPendingFeedbackMeal] = useState<Meal | null>(null)

  const recogRef = useRef<any>(null)

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
    recogRef.current = recog
    recog.start()
    setIsListening(true)
  }

  const stopListening = () => { recogRef.current?.stop(); setIsListening(false) }

  // ─── 追加フロー ───────────────────────────────────────────────

  const handleAddClick = async () => {
    const timing = profile?.gutCheckTiming ?? 'both'
    if (timing === 'next_meal' || timing === 'both') {
      const now    = Date.now()
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
            notes: lang === 'en'
              ? 'Not in local DB. Use AI or enter manually.'
              : 'DBに未登録。AI分析か手動入力をおすすめします。',
            aiEstimated: false,
          }
      setDraft(newDraft)
      setCalories(newDraft.calories > 0 ? String(newDraft.calories) : '')
      setProtein(newDraft.protein   > 0 ? String(newDraft.protein)  : '')
      setFat(newDraft.fat           > 0 ? String(newDraft.fat)      : '')
      setCarbs(newDraft.carbs       > 0 ? String(newDraft.carbs)    : '')
      setAiError('')
      setAddStep('confirm')
    } catch (err) {
      console.error('handleNext error:', err)
      setDraft({
        fodmapLevel: 'moderate', ibsSafety: 'caution',
        calories: 0, protein: 0, fat: 0, carbs: 0,
        notes: lang === 'en'
          ? 'Could not analyze. Please enter manually.'
          : '解析エラー。手動で入力してください。',
        aiEstimated: false,
      })
      setCalories(''); setProtein(''); setFat(''); setCarbs('')
      setAiError('')
      setAddStep('confirm')
    }
  }

  const handleAiAnalyze = async () => {
    if (!profile?.claudeApiKey || !draft) return
    setAddStep('ai_analyzing')
    setAiError('')
    try {
      const data = await analyzeMeal(description, profile)
      setDraft({
        ...draft,
        fodmapLevel: data.fodmapLevel,
        ibsSafety:   data.ibsSafety,
        calories:    data.calories,
        protein:     data.protein,
        fat:         data.fat,
        carbs:       data.carbs,
        notes:       data.note,
        aiEstimated: true,
      })
      setCalories(String(data.calories))
      setProtein(String(data.protein))
      setFat(String(data.fat))
      setCarbs(String(data.carbs))
      setAddStep('confirm')
    } catch {
      setAiError(lang === 'en' ? 'AI analysis failed. Please try again.' : 'AI分析に失敗しました。再試行してください。')
      setAddStep('confirm')
    }
  }

  const handleSave = async () => {
    if (!draft) return
    setSaveError('')
    try {
      const meal: Meal = {
        id:             uuid(),
        date:           viewDate,
        type:           mealType,
        time:           toTimeStr(),
        description:    description.trim(),
        totalCalories:  parseInt(calories)  || draft.calories,
        totalProtein:   parseFloat(protein) || draft.protein,
        totalFat:       parseFloat(fat)     || draft.fat,
        totalCarbs:     parseFloat(carbs)   || draft.carbs,
        fodmapLevel:    draft.fodmapLevel,
        ibsSafetyScore: draft.ibsSafety,
        aiEstimated:    draft.aiEstimated,
        notes:          draft.notes,
        createdAt:      nowIso(),
      }
      await db.meals.add(meal)
      await recalculateDailyLog(viewDate)
      setSavedMealId(meal.id)

      // カロリー目標達成チェック
      const log = await db.dailyLogs.where('date').equals(viewDate).first()
      if (log && profile?.targetDailyCalories && log.totalCalories >= profile.targetDailyCalories) {
        const prevCalories = log.totalCalories - meal.totalCalories
        if (prevCalories < profile.targetDailyCalories) setShowSuccess(true)
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

  const handlePendingFeedback = async (feedback: Meal['gutFeedback']) => {
    if (pendingFeedbackMeal) {
      await db.meals.update(pendingFeedbackMeal.id, { gutFeedback: feedback })
    }
    setPendingFeedbackMeal(null)
    setShowAdd(true)
  }

  // スキップ: フィードバック未記録のままシートを開く
  const handlePendingFeedbackSkip = () => {
    setPendingFeedbackMeal(null)
    setShowAdd(true)
  }

  const resetAdd = () => {
    setShowAdd(false)
    setDescription('')
    setDraft(null)
    setMatchResults([])
    setSavedMealId(null)
    setAddStep('input')
    setAiError('')
    setCalories(''); setProtein(''); setFat(''); setCarbs('')
    setSaveError('')
  }

  return {
    showAdd, addStep, inputMode, mealType, description, draft, matchResults,
    calories, protein, fat, carbs, aiError, saveError,
    isListening, showSuccess, pendingFeedbackMeal, voiceSupported, hasApiKey, lang,
    setInputMode, setMealType, setDescription, setCalories, setProtein, setFat, setCarbs,
    setAddStep, setShowSuccess,
    handleAddClick, handleNext, handleAiAnalyze, handleSave, handleAllowNotification,
    handlePendingFeedback, handlePendingFeedbackSkip, startListening, stopListening, resetAdd,
  }
}
