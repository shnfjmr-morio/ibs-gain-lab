import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, UtensilsCrossed, MessageCircle, Scale, Settings } from 'lucide-react'
import { useNavStore } from '../../stores/useNavStore'

const tabs = [
  { path: '/',         icon: Home,            key: 'home' },
  { path: '/meals',    icon: UtensilsCrossed, key: 'meals' },
  { path: '/chat',     icon: MessageCircle,   key: 'chat' },
  { path: '/weight',   icon: Scale,           key: 'weight' },
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
      bg-[#FAFAF7]/80 backdrop-blur-xl
      border-t border-white/60
      shadow-[0_-1px_0_rgba(0,0,0,0.04)]
      z-50"
    >
      <div className="flex">
        {tabs.map(({ path, icon: Icon, key }) => {
          const active = pathname === path
          return (
            <button
              key={path}
              onClick={() => handleTabClick(path)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 relative active:opacity-70 transition-opacity"
            >
              <span
                className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-emerald-500 transition-all duration-300 ease-out ${
                  active ? 'w-6 opacity-100' : 'w-0 opacity-0'
                }`}
              />
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.7}
                className={`transition-all duration-200 ${active ? 'text-emerald-600' : 'text-gray-400'}`}
              />
              <span className={`text-[10px] font-medium transition-colors duration-200 ${
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
