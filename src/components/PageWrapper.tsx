import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { useNavStore } from '../stores/useNavStore'
import { pageVariants, PAGE_TRANSITION } from '../utils/motion'

interface PageWrapperProps {
  children: React.ReactNode
}

const PageWrapper = forwardRef<HTMLDivElement, PageWrapperProps>(
  function PageWrapper({ children }, ref) {
    const direction = useNavStore((s) => s.direction)
    const setIsAnimating = useNavStore((s) => s.setIsAnimating)

    return (
      <motion.div
        ref={ref}
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={PAGE_TRANSITION}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={() => setIsAnimating(false)}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        }}
      >
        {children}
      </motion.div>
    )
  }
)

export default PageWrapper
