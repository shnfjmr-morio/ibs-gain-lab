import { useTranslation } from 'react-i18next'
import { BottomSheet } from './ui/BottomSheet'
import { GutStatusButton } from './ui/GutStatusButton'
import type { Meal, GutFeedback } from '../types/entities'

interface Props {
  meal: Meal
  onSubmit: (feedback: GutFeedback) => void
  onSkip: () => void
}

export default function GutFeedbackModal({ meal, onSubmit, onSkip }: Props) {
  const { t } = useTranslation()

  return (
    <BottomSheet open={true} onOpenChange={(open) => { if (!open) onSkip() }}>
      <div className="space-y-4 pb-2">
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-gray-800">{t('meals.feedback_title')}</p>
          <p className="text-sm text-gray-500 line-clamp-1">{meal.description}</p>
          <p className="text-xs text-gray-400">{meal.date} {meal.time}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 py-1">
          {(['great', 'ok', 'bad'] as GutFeedback[]).map(v => (
            <GutStatusButton
              key={v}
              value={v}
              isActive={false}
              onSelect={onSubmit}
            />
          ))}
        </div>

        <button onClick={onSkip} className="w-full text-sm text-gray-400 py-2">
          {t('meals.feedback_skip')}
        </button>
      </div>
    </BottomSheet>
  )
}
