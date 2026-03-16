import { useState, useEffect } from 'react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import GutFeedbackModal from '../../components/GutFeedbackModal'
import { SuccessModal } from '../../components/ui/SuccessModal'
import { db } from '../../db/schema'
import { toDateStr } from '../../utils/date'
import { formatDateLabel } from './constants'
import { useMealAddFlow } from './hooks/useMealAddFlow'
import { MealDateNav } from './components/MealDateNav'
import { MealList } from './components/MealList'
import { MealAddOverlay } from './components/MealAddOverlay'
import { MealConfirmSheet } from './components/MealConfirmSheet'
import { MealEditSheet } from './components/MealEditSheet'
import type { Meal } from '../../types/entities'

export default function MealsPage() {
  const { t } = useTranslation()
  const today = toDateStr()
  const [viewDate, setViewDate] = useState(today)

  // アプリをバックグラウンドから復帰した時に日付を同期
  useEffect(() => {
    const syncToday = () => {
      if (!document.hidden) {
        const newToday = toDateStr()
        setViewDate(prev => prev < newToday ? newToday : prev)
      }
    }
    document.addEventListener('visibilitychange', syncToday)
    return () => document.removeEventListener('visibilitychange', syncToday)
  }, [])

  const meals = useLiveQuery(
    () => db.meals.where('date').equals(viewDate).reverse().sortBy('time'),
    [viewDate]
  )

  // 追加フロー（カスタムフックに委譲）
  const addFlow = useMealAddFlow(viewDate)

  // 編集フロー
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)

  return (
    <AppShell title={`${t('meals.title')} — ${formatDateLabel(viewDate, today, t)}`}>
      <div className="p-4 space-y-3">

        {/* 日付ナビゲーション */}
        <MealDateNav viewDate={viewDate} setViewDate={setViewDate} today={today} />

        {/* 追加ボタン */}
        {viewDate === today && (
          <m.button
            data-motion
            onClick={addFlow.handleAddClick}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full flex items-center justify-center gap-2 bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow relative overflow-hidden mt-2"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
            <Plus size={20} className="relative z-10" strokeWidth={2.5} />
            <span className="relative z-10 text-[15px] tracking-wide font-display">{t('meals.add')}</span>
          </m.button>
        )}

        {/* 食事リスト */}
        <MealList meals={meals} onEdit={setEditingMeal} />

      </div>

      {/* 食事入力フルスクリーンオーバーレイ（inputステップ） */}
      {addFlow.showAdd && addFlow.addStep === 'input' && (
        <MealAddOverlay
          mealType={addFlow.mealType}
          setMealType={addFlow.setMealType}
          inputMode={addFlow.inputMode}
          setInputMode={addFlow.setInputMode}
          description={addFlow.description}
          setDescription={addFlow.setDescription}
          voiceSupported={addFlow.voiceSupported}
          isPWAStandalone={addFlow.isPWAStandalone}
          isListening={addFlow.isListening}
          startListening={addFlow.startListening}
          stopListening={addFlow.stopListening}
          handleNext={addFlow.handleNext}
          resetAdd={addFlow.resetAdd}
        />
      )}

      {/* 食事確認・AI分析・通知シート */}
      <MealConfirmSheet
        showAdd={addFlow.showAdd}
        addStep={addFlow.addStep}
        setAddStep={addFlow.setAddStep}
        description={addFlow.description}
        draft={addFlow.draft}
        matchResults={addFlow.matchResults}
        calories={addFlow.calories}
        setCalories={addFlow.setCalories}
        protein={addFlow.protein}
        setProtein={addFlow.setProtein}
        fat={addFlow.fat}
        setFat={addFlow.setFat}
        carbs={addFlow.carbs}
        setCarbs={addFlow.setCarbs}
        aiError={addFlow.aiError}
        saveError={addFlow.saveError}
        hasApiKey={addFlow.hasApiKey}
        lang={addFlow.lang}
        handleAiAnalyze={addFlow.handleAiAnalyze}
        handleSave={addFlow.handleSave}
        handleAllowNotification={addFlow.handleAllowNotification}
        resetAdd={addFlow.resetAdd}
      />

      {/* 食事編集シート */}
      <MealEditSheet
        editingMeal={editingMeal}
        onClose={() => setEditingMeal(null)}
      />

      {/* 目標達成モーダル */}
      <SuccessModal
        open={addFlow.showSuccess}
        onClose={() => addFlow.setShowSuccess(false)}
        title={t('success.calorie_goal')}
        description={t('success.calorie_goal_desc')}
      />

      {/* 次回食事モード：前の食事フィードバック */}
      {addFlow.pendingFeedbackMeal && (
        <GutFeedbackModal
          meal={addFlow.pendingFeedbackMeal}
          onSubmit={addFlow.handlePendingFeedback}
          onSkip={addFlow.handlePendingFeedbackSkip}
        />
      )}
    </AppShell>
  )
}
