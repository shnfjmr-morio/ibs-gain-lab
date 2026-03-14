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

  // Determine animation class from swipe direction
  const dir = document.documentElement.dataset.swipeDir
  const animClass = dir === 'left'
    ? 'page-enter-from-right'
    : dir === 'right'
      ? 'page-enter-from-left'
      : 'page-enter'

  return (
    <div className={`flex flex-col h-svh bg-[#FAFAF7] ${animClass}`}>
      {title && (
        <header className="shrink-0 bg-[#FAFAF7]/90 backdrop-blur-md border-b border-black/[0.05] px-4 py-3 flex items-center justify-between z-40">
          <h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
          {rightAction && <div>{rightAction}</div>}
        </header>
      )}

      {/* コンテンツ：ここだけスクロール */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </main>

      {/* BottomNavはfixedではなくflexの一部 → 常に見える */}
      <BottomNav />
    </div>
  )
}
