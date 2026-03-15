import { LazyMotion } from 'motion/react'

// 必要な features のみを動的インポート（初期バンドル ~28KB 削減）
const loadFeatures = () =>
  import('motion/react').then(mod => mod.domAnimation)

interface Props {
  children: React.ReactNode
}

export function LazyMotionProvider({ children }: Props) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
