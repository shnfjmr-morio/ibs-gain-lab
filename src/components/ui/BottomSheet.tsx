import { Drawer } from 'vaul'
import { cn } from '../../utils/cn'
import AnimationErrorBoundary from '../AnimationErrorBoundary'

interface BottomSheetBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  footer?: React.ReactNode
  snapPoints?: number[]
  activeSnapPoint?: number | string | null
  setActiveSnapPoint?: (snapPoint: number | string | null) => void
  dismissible?: boolean
  className?: string
  modal?: boolean
}

// fadeFromIndex は snapPoints がある場合のみ有効
interface WithFade extends BottomSheetBaseProps {
  snapPoints: number[]
  fadeFromIndex?: number
}
interface WithoutFade extends BottomSheetBaseProps {
  snapPoints?: never
  fadeFromIndex?: never
}

type BottomSheetProps = WithFade | WithoutFade

export function BottomSheet({
  open,
  onOpenChange,
  children,
  footer,
  snapPoints,
  activeSnapPoint,
  setActiveSnapPoint,
  dismissible = true,
  className,
  modal = true,
  ...rest
}: BottomSheetProps) {
  const fadeFromIndex = 'fadeFromIndex' in rest ? rest.fadeFromIndex : undefined

  const drawerProps = snapPoints != null
    ? { snapPoints, fadeFromIndex, activeSnapPoint, setActiveSnapPoint }
    : {}

  return (
    <AnimationErrorBoundary fallback={<div className="fixed bottom-0 left-0 right-0 bg-[#FAFAF7] rounded-t-[28px] p-4">{children}</div>}>
      <Drawer.Root
        open={open}
        onOpenChange={onOpenChange}
        dismissible={dismissible}
        modal={modal}
        {...drawerProps}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[90] bg-black/40" />
          <Drawer.Content
            className={cn(
              'fixed bottom-0 left-0 right-0 z-[100]',
              'max-w-[480px] mx-auto',
              'bg-[#FAFAF7] rounded-t-[28px]',
              'max-h-[85vh] outline-none',
              'flex flex-col',
              className
            )}
          >
            <Drawer.Handle className="mt-3 mb-1 flex-none" />
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4"
              style={{
                paddingBottom: footer ? '0.5rem' : 'max(1rem, env(safe-area-inset-bottom))',
                overscrollBehavior: 'contain',
              }}
            >
              {children}
            </div>
            {footer && (
              <div
                className="flex-none px-4 pt-2 border-t border-black/[0.04] bg-[#FAFAF7]"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                {footer}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </AnimationErrorBoundary>
  )
}
