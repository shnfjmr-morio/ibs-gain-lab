import { useState, useEffect } from 'react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { GutStatusButton } from '../../../components/ui/GutStatusButton'
import { db } from '../../../db/schema'
import { recalculateDailyLog } from '../../../services/dailyLog/DailyLogService'
import { haptic } from '../../../utils/haptics'
import { MEAL_TYPES, FODMAP_LEVELS, fodmapColor, inputCls } from '../constants'
import type { EditForm } from '../types'
import type { Meal, GutFeedback } from '../../../types/entities'

interface MealEditSheetProps {
  editingMeal: Meal | null
  onClose: () => void
}

export function MealEditSheet({ editingMeal, onClose }: MealEditSheetProps) {
  const { t } = useTranslation()
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // editingMealが切り替わったときにeditFormをリセット・初期化
  useEffect(() => {
    if (!editingMeal) {
      setEditForm(null)
      return
    }
    setEditForm({
      mealType:    editingMeal.type,
      description: editingMeal.description,
      date:        editingMeal.date,
      time:        editingMeal.time,
      calories:    editingMeal.totalCalories > 0 ? String(editingMeal.totalCalories) : '',
      protein:     editingMeal.totalProtein  > 0 ? String(editingMeal.totalProtein)  : '',
      fat:         editingMeal.totalFat      > 0 ? String(editingMeal.totalFat)      : '',
      carbs:       editingMeal.totalCarbs    > 0 ? String(editingMeal.totalCarbs)    : '',
      fodmapLevel: editingMeal.fodmapLevel,
      ibsSafety:   editingMeal.ibsSafetyScore,
      gutFeedback: editingMeal.gutFeedback ?? '',
      notes:       editingMeal.notes,
    })
  }, [editingMeal])

  const currentForm: EditForm | null = editForm

  const handleClose = () => {
    setEditForm(null)
    setDeleteConfirm(false)
    onClose()
  }

  const handleEditSave = async () => {
    if (!editingMeal || !currentForm) return
    const originalDate = editingMeal.date
    await db.meals.update(editingMeal.id, {
      type:           currentForm.mealType,
      description:    currentForm.description.trim(),
      date:           currentForm.date,
      time:           currentForm.time,
      totalCalories:  parseInt(currentForm.calories)  || 0,
      totalProtein:   parseFloat(currentForm.protein) || 0,
      totalFat:       parseFloat(currentForm.fat)     || 0,
      totalCarbs:     parseFloat(currentForm.carbs)   || 0,
      fodmapLevel:    currentForm.fodmapLevel,
      ibsSafetyScore: currentForm.ibsSafety,
      gutFeedback:    currentForm.gutFeedback || undefined,
      notes:          currentForm.notes,
    })
    // 日付が変更された場合は元の日と新しい日の両方を再計算
    if (currentForm.date !== originalDate) {
      await recalculateDailyLog(originalDate)
    }
    await recalculateDailyLog(currentForm.date)
    haptic('success')
    handleClose()
  }

  const handleDelete = async () => {
    if (!editingMeal) return
    await db.meals.delete(editingMeal.id)
    await recalculateDailyLog(editingMeal.date)
    haptic('medium')
    handleClose()
  }

  const updateForm = (patch: Partial<EditForm>) => {
    if (!currentForm) return
    const next = { ...currentForm, ...patch }
    setEditForm(next)
  }

  return (
    <BottomSheet
      open={!!editingMeal}
      onOpenChange={(open) => { if (!open) handleClose() }}
    >
      {editingMeal && currentForm && (
        <div className="space-y-4 pb-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('meals.edit_title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{editingMeal.date} {editingMeal.time}</p>
          </div>

          {/* 食事タイプ */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MEAL_TYPES.map(type => (
              <button
                key={type}
                onClick={() => updateForm({ mealType: type })}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  currentForm.mealType === type ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t(`meals.type.${type}`)}
              </button>
            ))}
          </div>

          {/* 説明テキスト */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block uppercase tracking-wider">
              {t('meals.notes')}
            </label>
            <textarea
              value={currentForm.description}
              onChange={e => updateForm({ description: e.target.value })}
              rows={3}
              className="w-full border border-black/[0.04] rounded-2xl px-4 py-3 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow leading-relaxed"
            />
          </div>

          {/* 日付・時刻 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">日付</label>
              <input
                type="date"
                value={currentForm.date}
                onChange={e => updateForm({ date: e.target.value })}
                className={inputCls}
                style={{ appearance: 'none', WebkitAppearance: 'none', colorScheme: 'light' }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">時刻</label>
              <input
                type="time"
                value={currentForm.time}
                onChange={e => updateForm({ time: e.target.value })}
                className={inputCls}
                style={{ appearance: 'none', WebkitAppearance: 'none', colorScheme: 'light' }}
              />
            </div>
          </div>

          {/* 栄養素 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { field: 'calories' as const, label: 'kcal' },
              { field: 'protein'  as const, label: `${t('meals.protein')} (g)` },
              { field: 'fat'      as const, label: `${t('meals.fat')} (g)` },
              { field: 'carbs'    as const, label: `${t('meals.carbs')} (g)` },
            ].map(({ field, label }) => (
              <div key={field}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number"
                  value={currentForm[field]}
                  onChange={e => updateForm({ [field]: e.target.value })}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          {/* FODMAP */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">FODMAP</label>
            <div className="flex gap-2">
              {FODMAP_LEVELS.map(lv => (
                <button
                  key={lv}
                  onClick={() => updateForm({ fodmapLevel: lv })}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    currentForm.fodmapLevel === lv
                      ? fodmapColor[lv] + ' ring-2 ring-current ring-offset-1'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {lv.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 腸フィードバック */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">{t('meals.edit_gut')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['great', 'ok', 'bad'] as GutFeedback[]).map(v => (
                <GutStatusButton
                  key={v}
                  value={v}
                  isActive={currentForm.gutFeedback === v}
                  onSelect={(val) => updateForm({ gutFeedback: val })}
                />
              ))}
            </div>
            <button
              onClick={() => updateForm({ gutFeedback: '' })}
              className={`mt-2 w-full py-2 rounded-xl text-center text-sm font-medium transition-colors ${
                currentForm.gutFeedback === '' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {t('gut.no_record')}
            </button>
          </div>

          {/* 保存ボタン */}
          <m.button
            data-motion
            onClick={handleEditSave}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow relative overflow-hidden tracking-wide font-display"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
            <span className="relative z-10">{t('meals.edit_save')}</span>
          </m.button>

          {/* 削除ボタン */}
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-400 hover:text-red-500 hover:bg-red-50 py-3 rounded-[1.25rem] transition-colors"
            >
              <Trash2 size={16} />{t('meals.delete')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-[1.25rem] py-3.5 text-[15px] font-bold shadow-md transition-colors font-display tracking-wide"
              >
                {t('meals.delete_confirm')}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-[1.25rem] py-3.5 text-[15px] font-bold transition-colors font-display tracking-wide"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
