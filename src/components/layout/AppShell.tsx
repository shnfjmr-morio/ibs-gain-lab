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
          bg-[#FAFAF7]/70 backdrop-blur-xl backdrop-saturate-150
          border-b border-black/[0.03]
          shadow-[0_4px_24px_rgba(0,0,0,0.02)]
          px-4 pt-[env(safe-area-inset-top)] pb-3
          flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-black/[0.04] flex items-center justify-center p-1">
              <img src="/assets/logo-icon.png" alt="FutoLab" className="w-full h-full object-contain mix-blend-multiply opacity-90" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            </div>
            <h1 className="text-[17px] font-bold text-gray-900 tracking-tight font-display">{title}</h1>
          </div>
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
