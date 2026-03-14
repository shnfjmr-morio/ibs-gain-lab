import { useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const TABS = ['/', '/meals', '/chat', '/weight', '/settings']

const MIN_SWIPE_X = 55    // 横移動の最小px
const RATIO       = 1.4   // 縦より横が1.4倍以上でないと発火しない
const EDGE_GUARD  = 20    // 画面端のiOSジェスチャーと被らないよう除外するpx

export function useSwipeNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const startX = useRef(0)
  const startY = useRef(0)

  // pathnameをrefで保持し、attachSwipeのcallbackを安定させる
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  /**
   * main要素にpassive touchリスナーを登録する。
   * passive: true にすることでiOSがタップイベントを遅延・抑制しない。
   * 返り値はクリーンアップ関数。
   */
  const attachSwipe = useCallback((el: HTMLElement) => {
    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const x0 = startX.current
      const dx = e.changedTouches[0].clientX - x0
      const dy = e.changedTouches[0].clientY - startY.current

      // 縦スクロールと区別、かつ画面端ジェスチャーを除外
      if (
        Math.abs(dx) < MIN_SWIPE_X ||
        Math.abs(dx) < Math.abs(dy) * RATIO ||
        x0 < EDGE_GUARD ||
        x0 > window.innerWidth - EDGE_GUARD
      ) return

      const idx = TABS.indexOf(pathnameRef.current)
      if (idx === -1) return

      if (dx < 0 && idx < TABS.length - 1) {
        document.documentElement.dataset.swipeDir = 'left'
        navigateRef.current(TABS[idx + 1])  // 左スワイプ → 次
      }
      if (dx > 0 && idx > 0) {
        document.documentElement.dataset.swipeDir = 'right'
        navigateRef.current(TABS[idx - 1])  // 右スワイプ → 前
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return { attachSwipe }
}
