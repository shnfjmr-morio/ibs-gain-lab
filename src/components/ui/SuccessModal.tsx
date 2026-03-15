import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { haptic } from '../../utils/haptics'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: string
}

export function SuccessModal({ open, onClose, title, description }: Props) {
  useEffect(() => {
    if (open) {
      haptic('success')
      const timer = setTimeout(onClose, 2500)
      return () => clearTimeout(timer)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="/assets/success.png"
              alt=""
              className="w-24 h-24 mx-auto mb-4"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <p className="text-lg font-bold text-gray-900 mb-1">{title}</p>
            {description && (
              <p className="text-sm text-gray-500">{description}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
