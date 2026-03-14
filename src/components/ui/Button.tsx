import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../utils/cn'
import { haptic } from '../../utils/haptics'

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'whileTap' | 'transition'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles = {
  primary:   'bg-emerald-600 text-white shadow-[0_4px_14px_rgba(61,143,133,0.3)]',
  secondary: 'bg-gray-100 text-gray-700',
  ghost:     'text-gray-500',
  danger:    'bg-red-500 text-white',
}

const sizeStyles = {
  sm: 'py-2 px-3 text-sm rounded-xl',
  md: 'py-3 px-4 text-sm rounded-2xl font-semibold',
  lg: 'py-3.5 text-base rounded-2xl font-semibold',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      data-motion
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'w-full flex items-center justify-center gap-2',
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      onClick={(e) => {
        if (disabled) return
        haptic('light')
        onClick?.(e)
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  )
}
