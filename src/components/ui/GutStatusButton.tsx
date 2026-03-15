import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Zap, Wind, CloudRain } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import type { GutFeedback } from '../../types/entities'

const CONFIG: Record<GutFeedback, {
  icon: typeof Zap
  activeColor: string
  activeBg: string
}> = {
  great: { icon: Zap,       activeColor: 'text-emerald-600', activeBg: 'bg-emerald-50 border-emerald-300' },
  ok:    { icon: Wind,      activeColor: 'text-amber-600',   activeBg: 'bg-amber-50 border-amber-300'   },
  bad:   { icon: CloudRain, activeColor: 'text-red-500',     activeBg: 'bg-red-50 border-red-300'       },
}

interface Props {
  value: GutFeedback
  isActive: boolean
  onSelect: (value: GutFeedback) => void
}

export function GutStatusButton({ value, isActive, onSelect }: Props) {
  const { t } = useTranslation()
  const { icon: Icon, activeColor, activeBg } = CONFIG[value]

  return (
    <m.button
      type="button"
      onClick={() => { haptic('light'); onSelect(value) }}
      whileTap={{ scale: 0.9 }}
      animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-colors ${
        isActive
          ? `${activeBg} ${activeColor}`
          : 'border-gray-100 bg-white text-gray-400'
      }`}
    >
      <Icon size={32} strokeWidth={isActive ? 2.4 : 1.8} />
      <span className={`text-xs font-medium ${isActive ? activeColor : 'text-gray-600'}`}>
        {t(`gut.${value}`)}
      </span>
    </m.button>
  )
}
