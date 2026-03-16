import { useState } from 'react'
import { useProfileStore } from '../../../stores/useProfileStore'
import { db } from '../../../db/schema'
import { analyzeMeal } from '../../../services/ai/ClaudeService'
import { lookupAllFodmap, type LookupResult } from '../../../services/fodmap/FodmapLookup'
import { estimateNutrition } from '../../../services/fodmap/NutritionEstimator'
import { recalculateDailyLog } from '../../../services/dailyLog/DailyLogService'
import { scheduleGutCheck, requestNotificationPermission } from '../../../services/notifications/GutCheckNotifier'
import { toDateStr, toTimeStr, nowIso, uuid } from '../../../utils/date'
import { haptic } from '../../../utils/haptics'
import { saveSymptomLog } from '../../../services/symptoms/PostMealSymptomService'
import type { Meal, MealType, FODMAPLevel, GutFeedbackScore } from '../../../types/entities'
import type { AddStep, InputMode, MealDraft } from '../types'
import { useSpeechInput, type SpeechRecognitionError } from '../../../hooks/useSpeechInput'

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
  /** PWAスタンドアロンモードか（iOSホーム画面追加後は音声API非対応） */
  isPWAStandalone: boolean
  /** 音声認識エラー情報 */
  speechError: SpeechRecognitionError | null
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
  /** 音声認識を開始（トグル方式: 実行中は stop を呼ぶこと） */
  startListening: () => void
  /** 音声認識を停止 */
  stopListening: () => void
  resetAdd: () => void
}

function detectMealType(): MealType {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 15) return 'lunch'
  if (hour >= 15 && hour < 18) return 'snack'
  return 'dinner'
}

export function useMealAddFlow(viewDate: string): MealAddFlowReturn {
  const { profile } = useProfileStore()

  const [showAdd, setShowAdd]         = useState(false)
  const [addStep, setAddStep]         = useState<AddStep>('input')
  const [inputMode, setInputMode]     = useState<InputMode>('text')
  const [mealType, setMealType]       = useState<MealType>(detectMealType())
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
  const [showSuccess, setShowSuccess] = useState(false)
  const [pendingFeedbackMeal, setPendingFeedbackMeal] = useState<Meal | null>(null)

  const hasApiKey = profile?.aiProvider === 'gemini' ? !!profile?.geminiApiKey
    : profile?.aiProvider === 'openai' ? !!profile?.openaiApiKey
    : !!profile?.claudeApiKey
  const lang = profile?.language ?? 'ja'

  // ─── 音声入力（useSpeechInput に委譲） ────────────────────────

  const speech = useSpeechInput({
    lang,
    onResult: (transcript) => {
      // 認識結果を既存テキストに追記（上書きではなく連結）
      setDescription(prev => prev ? `${prev}　${transcript}` : transcript)
    },
  })

  // 後方互換のエイリアス（Gemini側の更新まで維持）
  const startListening = speech.start
  const stopListening  = speech.stop
  const voiceSupported = speech.isSupported

  // ─── 追加フロー ───────────────────────────────────────────────

  const handleAddClick = async () => {
    const timing = profile?.gutCheckTiming ?? 'both'
    if (timing === 'next_meal' || timing === 'both') {
      const now    = Date.now()
      const minAge = 15 * 60 * 1000
      const todayMeals = await db.meals.where('date').equals(toDateStr()).toArray()
      // 最新の食事だけを対象にする（古い未回答食事は無視）
      const latestMeal = [...todayMeals].sort((a, b) => b.time.localeCompare(a.time))[0]
      if (
        latestMeal &&
        !latestMeal.gutFeedback &&
        now - new Date(`${latestMeal.date}T${latestMeal.time}:00`).getTime() >= minAge
      ) {
        setPendingFeedbackMeal(latestMeal)
        return
      }
    }
    setMealType(detectMealType())
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
      if (feedback) {
        const mealTime = new Date(`${pendingFeedbackMeal.date}T${pendingFeedbackMeal.time}:00`)
        const hoursAfterMeal = Math.round((Date.now() - mealTime.getTime()) / 360000) / 10
        await saveSymptomLog({
          mealId: pendingFeedbackMeal.id,
          gutScore: feedback as GutFeedbackScore,
          hoursAfterMeal,
        })
      }
    }
    setPendingFeedbackMeal(null)
    setMealType(detectMealType())
    setShowAdd(true)
  }

  // スキップ: フィードバック未記録のままシートを開く
  const handlePendingFeedbackSkip = () => {
    setPendingFeedbackMeal(null)
    setMealType(detectMealType())
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
    isListening: speech.isListening,
    showSuccess, pendingFeedbackMeal,
    voiceSupported, isPWAStandalone: speech.isPWAStandalone, speechError: speech.error,
    hasApiKey, lang,
    setInputMode, setMealType, setDescription, setCalories, setProtein, setFat, setCarbs,
    setAddStep, setShowSuccess,
    handleAddClick, handleNext, handleAiAnalyze, handleSave, handleAllowNotification,
    handlePendingFeedback, handlePendingFeedbackSkip, startListening, stopListening, resetAdd,
  }
}
