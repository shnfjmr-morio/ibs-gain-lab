import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { staggerContainer } from '../../../utils/motion'
import { EmptyState } from '../../../components/ui/EmptyState'
import { MealCard } from './MealCard'
import type { Meal } from '../../../types/entities'

interface MealListProps {
  meals: Meal[] | undefined
  onEdit: (meal: Meal) => void
}

export function MealList({ meals, onEdit }: MealListProps) {
  const { t } = useTranslation()

  if (meals && meals.length > 0) {
    return (
      <m.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {meals.map(meal => (
          <MealCard key={meal.id} meal={meal} onEdit={onEdit} />
        ))}
      </m.div>
    )
  }

  return <EmptyState title={t('home.no_meals')} />
}
