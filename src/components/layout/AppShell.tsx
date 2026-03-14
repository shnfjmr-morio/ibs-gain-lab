import { type ReactNode, useEffect, useRef } from 'react'
import BottomNav from './BottomNav'
import { useSwipeNav } from '../../hooks/useSwipeNav'

interface Props {
  children: ReactNode
  title?: string
  rightAction?: ReactNode
}

export default function AppShell({ children, title, rightAction }: Props) {
  const mainRef = useRef<HTMLElement>(null)
  const { attachSwipe } = useSwipeNav()

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    return attachSwipe(el)
  }, [attachSwipe])

  return (
    <div className="flex flex-col h-full bg-[#FAFAF7]">
      {title && (
        <header className="shrink-0 sticky top-0 z-40
          bg-[#FAFAF7]/80 backdrop-blur-xl
          border-b border-white/60
          shadow-[0_1px_0_rgba(0,0,0,0.05)]
          px-4 pt-[env(safe-area-inset-top)] pb-3
          flex items-center justify-between"
        >
          <h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
          {rightAction && <div>{rightAction}</div>}
        </header>
      )}

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
