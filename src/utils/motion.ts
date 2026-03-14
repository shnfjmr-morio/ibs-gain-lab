import type { Variants, Transition } from 'motion/react'

export const PAGE_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

// custom 経由で direction を受け取る形式
// direction > 0: 右方向(次タブへ), direction < 0: 左方向(前タブへ)
export const pageVariants: Variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? '30%' : '-30%',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-30%' : '30%',
    opacity: 0,
  }),
}

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.06 } },
}
