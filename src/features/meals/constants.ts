import type { MealType, FODMAPLevel } from '../../types/entities'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const FODMAP_LEVELS: FODMAPLevel[] = ['low', 'moderate', 'high']

export const fodmapColor: Record<FODMAPLevel, string> = {
  low:      'text-emerald-700 bg-emerald-50',
  moderate: 'text-amber-700 bg-amber-50',
  high:     'text-red-600 bg-red-50',
}

export const safetyColor = {
  safe:    'text-emerald-600',
  caution: 'text-amber-600',
  risky:   'text-red-500',
}

export const gutEmoji = {
  great: '😊',
  ok:    '😐',
  bad:   '😟',
}

export const inputCls = 'w-full border border-black/[0.04] rounded-2xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow'

export const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
}
export const stepTransition = { duration: 0.18 }

export function offsetDate(base: string, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDateLabel(
  dateStr: string,
  todayStr: string,
  t: (k: string) => string
): string {
  if (dateStr === todayStr) return t('common.today')
  if (dateStr === offsetDate(todayStr, -1)) return t('common.yesterday')
  return dateStr
}
