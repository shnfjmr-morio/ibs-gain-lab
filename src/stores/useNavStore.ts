import { create } from 'zustand'

export const TAB_ORDER = ['/', '/meals', '/chat', '/weight', '/settings'] as const
type TabPath = typeof TAB_ORDER[number]

interface NavStore {
  direction: number
  isAnimating: boolean
  /** BottomNav/useSwipeNav が手動で setDirection を呼んだ場合 true。
   *  useDirectionSync はこのフラグが true の場合は上書きをスキップし、フラグをリセットする。 */
  directionManuallySet: boolean
  setDirection: (d: number) => void
  setIsAnimating: (v: boolean) => void
  resetDirectionManualFlag: () => void
  computeDirection: (from: string, to: string) => number
}

export const useNavStore = create<NavStore>((set) => ({
  direction: 1,
  isAnimating: false,
  directionManuallySet: false,
  setDirection: (d) => set({ direction: d, directionManuallySet: true }),
  setIsAnimating: (v) => set({ isAnimating: v }),
  resetDirectionManualFlag: () => set({ directionManuallySet: false }),
  computeDirection: (from: string, to: string) => {
    const fromIdx = TAB_ORDER.indexOf(from as TabPath)
    const toIdx   = TAB_ORDER.indexOf(to   as TabPath)
    if (fromIdx === -1 || toIdx === -1) return 1
    return toIdx > fromIdx ? 1 : -1
  },
}))
