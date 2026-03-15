import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { offsetDate, formatDateLabel } from '../constants'

interface MealDateNavProps {
  viewDate: string
  setViewDate: (fn: (d: string) => string) => void
  today: string
}

export function MealDateNav({ viewDate, setViewDate, today }: MealDateNavProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between glass-panel rounded-2xl px-3 py-2.5 shadow-sm border border-black/[0.03]">
      <button
        onClick={() => setViewDate(d => offsetDate(d, -1))}
        className="p-2 text-emerald-700/70 hover:bg-emerald-50 rounded-xl active:scale-90 transition-all"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="text-center">
        <span className="text-sm font-bold font-display text-gray-800 tracking-wide">
          {formatDateLabel(viewDate, today, t)}
        </span>
        {viewDate !== today && (
          <p className="text-[11px] font-medium text-gray-400 mt-0.5">{viewDate}</p>
        )}
      </div>
      <button
        onClick={() => setViewDate(d => offsetDate(d, 1))}
        disabled={viewDate >= today}
        className="p-2 text-emerald-700/70 hover:bg-emerald-50 rounded-xl disabled:opacity-20 active:scale-90 transition-all"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
