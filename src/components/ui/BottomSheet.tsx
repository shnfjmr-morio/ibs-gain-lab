import { Drawer } from 'vaul'
import { cn } from '../../utils/cn'

interface BottomSheetBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
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
            'max-h-[90dvh] outline-none',
            className
          )}
        >
          <Drawer.Handle className="mt-3 mb-1" />
          <div
            className="overflow-y-auto px-4 pb-4"
            style={{
              maxHeight: 'calc(90dvh - 2.5rem)',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              overscrollBehavior: 'contain',
            }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
