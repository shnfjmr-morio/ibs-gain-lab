import { type ReactNode } from 'react'
import { m } from 'motion/react'

interface Props {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <img
        src="/assets/empty-state.png"
        alt=""
        className="w-32 h-32 mb-4 opacity-80"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <p className="text-base font-semibold text-gray-600 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </m.div>
  )
}
