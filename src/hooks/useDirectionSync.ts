import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavStore } from '../stores/useNavStore'

/**
 * location 変更時に direction が未セットの場合（ブラウザバック、ディープリンク）、
 * TAB_ORDER から方向を自動算出する。
 */
export function useDirectionSync() {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const computeDirection = useNavStore((s) => s.computeDirection)
  const setDirection = useNavStore((s) => s.setDirection)

  useEffect(() => {
    const prev = prevPathRef.current
    const next = location.pathname
    if (prev !== next) {
      const dir = computeDirection(prev, next)
      setDirection(dir)
      prevPathRef.current = next
    }
  }, [location.pathname, computeDirection, setDirection])
}
