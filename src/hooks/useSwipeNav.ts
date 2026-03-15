import { useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNavStore, TAB_ORDER } from '../stores/useNavStore'
import { haptic } from '../utils/haptics'

const TABS = [...TAB_ORDER]
const MIN_SWIPE_X = 55
const RATIO       = 1.4
const EDGE_GUARD  = 35

export function useSwipeNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const startX    = useRef(0)
  const startY    = useRef(0)
  const startTime = useRef(0)

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const attachSwipe = useCallback((el: HTMLElement) => {
    const handleTouchStart = (e: TouchEvent) => {
      // vaul の Drawer が開いている場合はスワイプナビを無効化
      if (document.querySelector('[data-vaul-drawer]')) return
      startX.current    = e.touches[0].clientX
      startY.current    = e.touches[0].clientY
      startTime.current = Date.now()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (document.querySelector('[data-vaul-drawer]')) return
      if (useNavStore.getState().isAnimating) return

      const x0 = startX.current
      const dx = e.changedTouches[0].clientX - x0
      const dy = e.changedTouches[0].clientY - startY.current
      const dt = Date.now() - startTime.current

      if (dt > 500) return

      if (
        Math.abs(dx) < MIN_SWIPE_X ||
        Math.abs(dx) < Math.abs(dy) * RATIO ||
        x0 < EDGE_GUARD ||
        x0 > window.innerWidth - EDGE_GUARD
      ) return

      const idx = TABS.findIndex(t => t === pathnameRef.current)
      if (idx === -1) return

      const { setDirection } = useNavStore.getState()

      if (dx < 0 && idx < TABS.length - 1) {
        haptic('light')
        setDirection(1)
        navigateRef.current(TABS[idx + 1])
      }
      if (dx > 0 && idx > 0) {
        haptic('light')
        setDirection(-1)
        navigateRef.current(TABS[idx - 1])
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend',   handleTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend',   handleTouchEnd)
    }
  }, [])

  return { attachSwipe }
}
