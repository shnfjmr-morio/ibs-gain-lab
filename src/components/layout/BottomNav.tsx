import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { m } from 'motion/react'
import { Home, Utensils, MessageSquare, Activity, Settings } from 'lucide-react'
import { useNavStore } from '../../stores/useNavStore'

const tabs = [
  { path: '/',         icon: Home,            key: 'home' },
  { path: '/meals',    icon: Utensils,        key: 'meals' },
  { path: '/chat',     icon: MessageSquare,   key: 'chat' },
  { path: '/weight',   icon: Activity,        key: 'weight' },
  { path: '/settings', icon: Settings,        key: 'settings' },
]

export default function BottomNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const setDirection = useNavStore((s) => s.setDirection)
  const isAnimating  = useNavStore((s) => s.isAnimating)

  const handleTabClick = (path: string) => {
    if (isAnimating) return
    if (path === pathname) return

    const currentIdx = tabs.findIndex(tab => tab.path === pathname)
    const targetIdx  = tabs.findIndex(tab => tab.path === path)
    setDirection(targetIdx > currentIdx ? 1 : -1)
    navigate(path)
  }

  return (
    <nav className="shrink-0 w-full
      bg-white/80 backdrop-blur-xl backdrop-saturate-[1.8]
      border-t border-black/[0.04]
      shadow-[0_-8px_32px_rgba(0,0,0,0.04)]
      z-50"
    >
      <div className="flex px-1 relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent pointer-events-none" />
        {tabs.map(({ path, icon: Icon, key }) => {
          const active = pathname === path
          return (
            <button
              key={path}
              onClick={() => handleTabClick(path)}
              className="flex-1 flex flex-col items-center py-2.5 gap-1 relative active:scale-95 transition-all duration-200"
            >
              {active && (
                <m.span
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-b-full bg-gradient-primary shadow-[0_2px_8px_rgba(61,143,133,0.4)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={`shrink-0 transition-colors duration-200 relative z-10 ${active ? 'text-emerald-600 drop-shadow-sm' : 'text-gray-400'}`}
              />
              <span className={`text-[10px] font-bold tracking-wide font-display transition-colors duration-200 ${
                active ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {t(`nav.${key}`)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
