import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Plus, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { useProfileStore } from '../../stores/useProfileStore'
import { db } from '../../db/schema'
import { toDateStr } from '../../utils/date'
import { APP_VERSION } from '../../config/version'
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
    <AppShell title="FutoLab">
      <div className="p-4 space-y-4">

        {/* アプリ名 + バージョン */}
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">FutoLab</h1>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            {APP_VERSION}
          </span>
        </div>

        {/* ── ヒーローカード（腸の状態 + カロリー） ───── */}
        <div className={`rounded-3xl p-5 border shadow-[0_4px_24px_rgba(0,0,0,0.08)] ${status.bgColor} ${status.borderColor}`}>

          {/* 上段: 腸の状態 + 体重 */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                {t('home.ibs_status')}
              </p>
              <div className="flex items-center gap-2.5">
                <span className="text-4xl leading-none">{status.emoji}</span>
                <span className={`text-xl font-bold ${status.textColor}`}>
                  {t(`weight.status.${ibsStatus}`)}
                </span>
              </div>
            </div>

            {latestWeight ? (
              <div className="text-right bg-white/60 rounded-2xl px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] text-gray-500 mb-0.5">{t('home.weight')}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight">
                  {latestWeight.weightKg}
                  <span className="text-sm font-normal text-gray-400 ml-0.5">kg</span>
                </p>
                {profile?.targetWeightKg && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t('home.goal_remaining', {
                      diff: (profile.targetWeightKg - latestWeight.weightKg).toFixed(1),
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-right bg-white/60 rounded-2xl px-3 py-2">
                <p className="text-[10px] text-gray-500 mb-0.5">{t('home.weight')}</p>
                <p className="text-2xl font-bold text-gray-400">–</p>
              </div>
            )}
          </div>

          {/* 下段: カロリー進捗 */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600">{t('home.calories')}</p>
              <p className="text-xs text-gray-500">
                <span className="text-base font-bold text-gray-900">{calories.toLocaleString()}</span>
                <span className="text-gray-400"> / {target.toLocaleString()} {t('common.kcal')}</span>
              </p>
            </div>
            <div className="h-2.5 bg-black/[0.07] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${calBarColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-gray-500">
              <span>P {dailyLog?.totalProtein ?? 0}g</span>
              <span>F {dailyLog?.totalFat ?? 0}g</span>
              <span>C {dailyLog?.totalCarbs ?? 0}g</span>
              <span className="font-semibold">{pct}%</span>
            </div>

            {remaining > 0 && pct < 80 && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-700">
                <AlertCircle size={12} />
                <span>{t('home.calorie_alert', { remaining })}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 今日の食事 ──────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-black/[0.04] overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3.5 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-800">{t('home.meals_today')}</p>
            <button
              onClick={() => navigate('/meals')}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl"
            >
              <Plus size={12} strokeWidth={2.5} />
              {t('home.add_meal')}
            </button>
          </div>

          {todayMeals && todayMeals.length > 0 ? (
            <div className="divide-y divide-gray-50/80">
              {todayMeals.map(meal => (
                <div key={meal.id} className="px-4 py-3">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${MEAL_TYPE_STYLE[meal.type] ?? 'bg-gray-100 text-gray-500'}`}>
                          {t(`meals.type.${meal.type}`)}
                        </span>
                        {meal.gutFeedback && (
                          <span className="text-sm">{GUT_EMOJI[meal.gutFeedback]}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 truncate">{meal.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {meal.totalCalories}
                        <span className="text-[10px] font-normal text-gray-400 ml-0.5">kcal</span>
                      </p>
                      <p className={`text-[11px] font-medium ${
                        meal.ibsSafetyScore === 'safe'    ? 'text-emerald-600' :
                        meal.ibsSafetyScore === 'caution' ? 'text-amber-600'   : 'text-red-500'
                      }`}>
                        {t(`meals.safety.${meal.ibsSafetyScore}`)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              {t('home.no_meals')}
            </div>
          )}
        </div>

        {/* ── AI相談ショートカット ─────────────────── */}
        <motion.button
          onClick={() => navigate('/chat')}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full flex items-center gap-3 bg-emerald-600 text-white rounded-3xl px-5 py-4 text-left shadow-[0_6px_20px_rgba(61,143,133,0.38)]"
        >
          <TrendingUp size={20} className="shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{t('home.ai_chat_title')}</p>
            <p className="text-xs opacity-75">{t('home.ai_chat_desc')}</p>
          </div>
          <ChevronRight size={16} className="opacity-50 shrink-0" />
        </motion.button>

      </div>
    </AppShell>
  )
}
