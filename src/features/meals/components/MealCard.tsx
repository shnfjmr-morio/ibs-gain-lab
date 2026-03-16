import { useState } from 'react'
import { m, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Pencil, ChevronDown } from 'lucide-react'
import { listItemVariants } from '../../../utils/motion'
import { safetyColor, gutEmoji } from '../constants'
import type { Meal } from '../../../types/entities'

interface MealCardProps {
  meal: Meal
  onEdit: (meal: Meal) => void
}

/** descriptionを食材チップ配列に分割する */
function parseIngredients(description: string | null | undefined): string[] {
  if (!description) return []
  return description
    .split(/[、，,・/ ]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function MealCard({ meal, onEdit }: MealCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const ingredients = parseIngredients(meal.description)
  const canExpand = ingredients.length > 1

  return (
    <m.div
      key={meal.id}
      variants={listItemVariants}
      className="glass-panel rounded-3xl p-5 shadow-sm border border-black/[0.03] relative"
    >
      {/* カード右上に絶対配置のステッカー */}
      <div className="absolute -top-2 -right-2 z-10">
        <span className={`inline-block text-[9px] font-display font-bold px-2.5 py-1 rounded-xl uppercase tracking-[0.1em] transform rotate-[6deg] shadow-md border border-white/60 ${
          meal.fodmapLevel === 'low'      ? 'bg-emerald-400 text-white' :
          meal.fodmapLevel === 'moderate' ? 'bg-amber-400 text-white' :
          'bg-red-400 text-white'
        }`}>
          {meal.fodmapLevel}
        </span>
      </div>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 font-display tracking-wider uppercase">
              {meal.date} {meal.time}
            </span>
            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-display uppercase tracking-wider">
              {t(`meals.type.${meal.type}`)}
            </span>
            {meal.gutFeedback && (
              <span className="text-sm bg-white/60 shadow-sm px-1.5 rounded-full">
                {gutEmoji[meal.gutFeedback]}
              </span>
            )}
          </div>
          {/* descriptionとトグルボタン */}
          {canExpand ? (
            <button
              type="button"
              className="flex items-start gap-1 w-full text-left"
              onClick={() => setExpanded((v) => !v)}
            >
              <p className="text-[14px] font-medium text-gray-800 line-clamp-2 leading-relaxed flex-1">
                {meal.description}
              </p>
              <m.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="shrink-0 mt-0.5 text-gray-400"
              >
                <ChevronDown size={15} />
              </m.span>
            </button>
          ) : (
            <p className="text-[14px] font-medium text-gray-800 line-clamp-2 leading-relaxed">
              {meal.description}
            </p>
          )}
          {/* 食材チップ (展開時) */}
          <AnimatePresence initial={false}>
            {expanded && (
              <m.div
                key="chips"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {ingredients.map((ing, i) => (
                    <span
                      key={i}
                      className="inline-block text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full leading-tight"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </m.div>
            )}
          </AnimatePresence>
          {meal.notes && (
            <p className="text-[11px] text-gray-500 mt-1.5">{meal.notes}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {meal.totalCalories > 0 ? (
              <p className="text-xl font-bold font-display text-gray-900 tracking-tight leading-none">
                {meal.totalCalories}
                <span className="text-[10px] font-medium text-gray-400 ml-0.5 uppercase tracking-wider">kcal</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 font-display uppercase tracking-widest">–kcal</p>
            )}
            <m.button
              data-motion
              onClick={() => onEdit(meal)}
              whileTap={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="p-1.5 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
            >
              <Pencil size={14} />
            </m.button>
          </div>
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
    </m.div>
  )
}
