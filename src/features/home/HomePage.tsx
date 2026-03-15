import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { m } from 'motion/react'
import { Plus, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { useProfileStore } from '../../stores/useProfileStore'
import { db } from '../../db/schema'
import { toDateStr } from '../../utils/date'
import { APP_VERSION } from '../../config/version'
import { EmptyState } from '../../components/ui/EmptyState'
import type { IBSStatus, GutFeedback } from '../../types/entities'

const GUT_EMOJI: Record<GutFeedback, string> = { great: '😊', ok: '😐', bad: '😟' }

const STATUS_CONFIG: Record<IBSStatus, {
  emoji: string; barColor: string; textColor: string; bgColor: string; borderColor: string
}> = {
  stable:     { emoji: '😊', barColor: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-100' },
  mild:       { emoji: '😐', barColor: 'bg-amber-400',   textColor: 'text-amber-700',   bgColor: 'bg-amber-50',   borderColor: 'border-amber-100'   },
  active:     { emoji: '😟', barColor: 'bg-red-400',     textColor: 'text-red-700',     bgColor: 'bg-red-50',     borderColor: 'border-red-100'     },
  recovering: { emoji: '🔄', barColor: 'bg-blue-400',    textColor: 'text-blue-700',    bgColor: 'bg-blue-50',    borderColor: 'border-blue-100'    },
}

const MEAL_TYPE_STYLE: Record<string, string> = {
  breakfast: 'bg-orange-100 text-orange-600',
  lunch:     'bg-blue-100 text-blue-600',
  dinner:    'bg-purple-100 text-purple-600',
  snack:     'bg-gray-100 text-gray-500',
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useProfileStore()
  const today = toDateStr()

  const dailyLog    = useLiveQuery(() => db.dailyLogs.get(today), [today])
  const todayMeals  = useLiveQuery(() => db.meals.where('date').equals(today).reverse().sortBy('time'), [today])
  const latestWeight = useLiveQuery(() => db.weightLogs.orderBy('date').reverse().first(), [])

  const target    = profile?.targetDailyCalories ?? 2200
  const calories  = dailyLog?.totalCalories ?? 0
  const pct       = Math.min(Math.round((calories / target) * 100), 100)
  const remaining = Math.max(target - calories, 0)

  const ibsStatus  = latestWeight?.ibsStatus ?? 'stable'
  const status     = STATUS_CONFIG[ibsStatus]
  const calBarColor = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <AppShell>
      <div className="p-4 space-y-4">

        {/* アプリ名 + バージョン */}
        <div className="flex items-baseline justify-between px-1">
          <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight text-gradient-primary">FutoLab</h1>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-full shadow-sm">
            {APP_VERSION}
          </span>
        </div>

        {/* ── ヒーローカード（腸の状態 + カロリー） ───── */}
        <div className="relative rounded-3xl p-1 overflow-hidden shadow-glow">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-primary" />
          
          {/* Glass Overlay wrapper */}
          <div className="relative rounded-[1.35rem] p-5 glass-panel-dark flex flex-col gap-5">

            {/* 上段: 腸の状態 + 体重 */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest mb-1.5 font-display">
                  {t('home.ibs_status')}
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="text-4xl leading-none drop-shadow-md">{status.emoji}</span>
                  <span className={`text-xl font-bold font-display text-white drop-shadow-sm`}>
                    {t(`weight.status.${ibsStatus}`)}
                  </span>
                </div>
              </div>

              {latestWeight ? (
                <div className="text-right bg-white/10 rounded-2xl px-3.5 py-2.5 backdrop-blur-md border border-white/20 shadow-inner">
                  <p className="text-[10px] text-white/70 mb-0.5 font-display uppercase tracking-wider">{t('home.weight')}</p>
                  <p className="text-2xl font-bold font-display text-white leading-tight drop-shadow-sm">
                    {latestWeight.weightKg}
                    <span className="text-sm font-normal text-white/70 ml-0.5">kg</span>
                  </p>
                  {profile?.targetWeightKg && (
                    <p className="text-[11px] text-white/50 mt-1">
                      {t('home.goal_remaining', {
                        diff: (profile.targetWeightKg - latestWeight.weightKg).toFixed(1),
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-right bg-white/10 rounded-2xl px-3.5 py-2.5 backdrop-blur-md border border-white/20">
                  <p className="text-[10px] text-white/70 mb-0.5 font-display">{t('home.weight')}</p>
                  <p className="text-2xl font-bold font-display text-white/40">–</p>
                </div>
              )}
            </div>

            {/* 下段: カロリー進捗 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3.5 border border-white/10 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-white/80 font-display uppercase tracking-wider">{t('home.calories')}</p>
                <p className="text-xs text-white/60">
                  <span className="text-base font-bold font-display text-white">{Math.round(calories).toLocaleString()}</span>
                  <span className="text-white/40 font-display"> / {target.toLocaleString()} {t('common.kcal')}</span>
                </p>
              </div>
              <div className="h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner flex">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${calBarColor} shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-2.5 text-[11px] font-medium text-white/60 font-display">
                <span>P <span className="text-white/90">{Math.round((dailyLog?.totalProtein ?? 0) * 10) / 10}g</span></span>
                <span>F <span className="text-white/90">{Math.round((dailyLog?.totalFat ?? 0) * 10) / 10}g</span></span>
                <span>C <span className="text-white/90">{Math.round((dailyLog?.totalCarbs ?? 0) * 10) / 10}g</span></span>
                <span className="font-bold text-white/90">{pct}%</span>
              </div>

              {remaining > 0 && pct < 80 && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-200 bg-amber-900/40 px-2 py-1.5 rounded-lg border border-amber-500/30">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{t('home.calorie_alert', { remaining })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 今日の食事 ──────────────────────────── */}
        <div className="glass-panel rounded-[1.35rem] overflow-hidden mt-6 shadow-sm border border-black/[0.03]">
          <div className="flex justify-between items-center px-5 py-4 border-b border-black/[0.04] bg-white/40">
            <p className="text-[13px] font-bold text-gray-800 font-display uppercase tracking-wider">{t('home.meals_today')}</p>
            <button
              onClick={() => navigate('/meals')}
              className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/80 active:scale-95 transition-all px-3.5 py-1.5 rounded-full shadow-sm"
              data-motion
            >
              <Plus size={14} strokeWidth={2.5} />
              {t('home.add_meal')}
            </button>
          </div>

          {todayMeals && todayMeals.length > 0 ? (
            <div className="divide-y divide-black/[0.04]">
              {todayMeals.map(meal => (
                <div key={meal.id} className="px-5 py-4 hover:bg-white/60 transition-colors cursor-default">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-display uppercase tracking-wide ${MEAL_TYPE_STYLE[meal.type] ?? 'bg-gray-100 text-gray-500'}`}>
                          {t(`meals.type.${meal.type}`)}
                        </span>
                        {meal.gutFeedback && (
                          <span className="text-sm rounded-full bg-white/60 shadow-sm px-1.5">{GUT_EMOJI[meal.gutFeedback]}</span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium text-gray-700 truncate">{meal.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold font-display text-gray-900 tracking-tight">
                        {Math.round(meal.totalCalories)}
                        <span className="text-[10px] font-normal text-gray-400 ml-0.5 uppercase">kcal</span>
                      </p>
                      <p className={`text-[11px] font-bold mt-0.5 uppercase tracking-wider drop-shadow-sm ${
                        meal.ibsSafetyScore === 'safe'    ? 'text-emerald-500' :
                        meal.ibsSafetyScore === 'caution' ? 'text-amber-500'   : 'text-red-500'
                      }`}>
                        {t(`meals.safety.${meal.ibsSafetyScore}`)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/40">
              <EmptyState title={t('home.no_meals')} />
            </div>
          )}
        </div>

        {/* ── AI相談ショートカット ─────────────────── */}
        <m.button
          onClick={() => navigate('/chat')}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full flex items-center gap-4 bg-gradient-primary text-white rounded-[1.35rem] px-5 py-4 text-left shadow-glow mt-6 border border-white/20 relative overflow-hidden"
        >
          {/* Glass highlight effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none" />
          
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md shrink-0 border border-white/30 shadow-inner">
            <TrendingUp size={20} className="text-white drop-shadow-md" />
          </div>
          <div className="flex-1 relative z-10">
            <p className="text-sm font-bold font-display tracking-wide drop-shadow-sm">{t('home.ai_chat_title')}</p>
            <p className="text-[12px] opacity-80 mt-0.5 font-medium">{t('home.ai_chat_desc')}</p>
          </div>
          <ChevronRight size={18} className="opacity-80 shrink-0 relative z-10" />
        </m.button>

      </div>
    </AppShell>
  )
}
