import { create } from 'zustand'

export const TAB_ORDER = ['/', '/meals', '/chat', '/weight', '/settings'] as const
type TabPath = typeof TAB_ORDER[number]

interface NavStore {
  direction: number
  isAnimating: boolean
  setDirection: (d: number) => void
  setIsAnimating: (v: boolean) => void
  computeDirection: (from: string, to: string) => number
}

export const useNavStore = create<NavStore>((set) => ({
  direction: 1,
  isAnimating: false,
  setDirection: (d) => set({ direction: d }),
  setIsAnimating: (v) => set({ isAnimating: v }),
  computeDirection: (from: string, to: string) => {
    const fromIdx = TAB_ORDER.indexOf(from as TabPath)
    const toIdx   = TAB_ORDER.indexOf(to   as TabPath)
    if (fromIdx === -1 || toIdx === -1) return 1
    return toIdx > fromIdx ? 1 : -1
  },
}))
