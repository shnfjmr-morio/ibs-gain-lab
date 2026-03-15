import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { m } from 'motion/react'
import { Plus, TrendingUp, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { useProfileStore } from '../../stores/useProfileStore'
import { db } from '../../db/schema'
import { toDateStr } from '../../utils/date'
import { EmptyState } from '../../components/ui/EmptyState'
import { HeroWeightChart } from '../../components/ui/HeroWeightChart'
import { getLast7DaysWeights } from '../../services/home/HomeStatsService'
import { updateThemeColor } from '../../utils/themeColor'
import type { IBSStatus, GutFeedback } from '../../types/entities'

const GUT_EMOJI: Record<GutFeedback, string> = { great: '😊', ok: '😐', bad: '😟' }

const STATUS_CONFIG: Record<IBSStatus, { emoji: string }> = {
  stable:     { emoji: '😊' },
  mild:       { emoji: '😐' },
  active:     { emoji: '😟' },
  recovering: { emoji: '🔄' },
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useProfileStore()
  const today = toDateStr()

  const dailyLog     = useLiveQuery(() => db.dailyLogs.get(today), [today])
  const todayMeals   = useLiveQuery(() => db.meals.where('date').equals(today).reverse().sortBy('time'), [today])
  const latestWeight = useLiveQuery(() => db.weightLogs.orderBy('date').reverse().first(), [])

  const sparkWeightsRaw = useLiveQuery(
    () => getLast7DaysWeights(),
    []
  )
  const sparkWeights: { date: string; weightKg: number }[] = sparkWeightsRaw ?? []

  const target   = profile?.targetDailyCalories ?? 2200
  const calories = dailyLog?.totalCalories ?? 0
  const pct      = Math.min(Math.round((calories / target) * 100), 100)

  const ibsStatus = (latestWeight?.ibsStatus ?? 'stable') as IBSStatus
  const status    = STATUS_CONFIG[ibsStatus]

  // IBSステータス変更検知 → glow pulse + theme-color 更新
  const [statusChanged, setStatusChanged] = useState(false)
  const prevStatus = useRef(ibsStatus)

  useEffect(() => {
    if (prevStatus.current !== ibsStatus) {
      setStatusChanged(true)
      const timer = setTimeout(() => setStatusChanged(false), 1500)
      prevStatus.current = ibsStatus
      return () => clearTimeout(timer)
    }
  }, [ibsStatus])

  useEffect(() => {
    updateThemeColor(ibsStatus)
  }, [ibsStatus])

  return (
    <AppShell>
      {/* ─────────────────────────────────────────────────────── */}
      {/* ZONE A: Immersive Hero (60svh, dark gradient)           */}
      {/* ─────────────────────────────────────────────────────── */}
      <div
        data-ibs-status={ibsStatus}
        className="relative min-h-[60svh] bg-state-gradient overflow-hidden flex flex-col justify-end p-5 pb-6"
      >
        {/* Ambient glow — IBSステータスに連動 */}
        <div
          className={`absolute top-[20%] right-[-15%] w-[280px] h-[280px] rounded-full blur-[120px] pointer-events-none
            transition-all duration-[1500ms]
            ${statusChanged ? 'opacity-70 scale-110' : 'opacity-40 scale-100'}`}
          style={{ backgroundColor: 'var(--state-accent)' }}
        />
        <div
          className="absolute bottom-[10%] left-[-10%] w-[200px] h-[200px] rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-[1500ms]"
          style={{ backgroundColor: 'var(--state-accent)' }}
        />

        {/* 背景体重グラフ — 全幅・全高 */}
        <div className="absolute inset-0 px-0">
          <HeroWeightChart data={sparkWeights} />
        </div>

        {/* Foreground content */}
        <div className="relative z-10 space-y-4">
          {/* アプリ名 + ステータスバッジ */}
          <div className="flex items-center justify-between">
            <h1 className="text-[17px] font-display font-bold text-white/60 tracking-wide">
              FutoLab
            </h1>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/15">
              <span className="text-lg leading-none">{status.emoji}</span>
              <span className="text-[11px] font-display font-bold text-white/80 uppercase tracking-[0.08em]">
                {t(`weight.status.${ibsStatus}`)}
              </span>
            </div>
          </div>

          {/* ヒーロー数値: 体重(左) + カロリー%(右) */}
          <div className="flex items-end justify-between">
            <div>
              <m.p
                key={latestWeight?.weightKg}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="text-[72px] font-display font-[800] tracking-[-0.04em] leading-none text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.3)]"
              >
                {latestWeight?.weightKg ?? '--'}
              </m.p>
              <p className="text-[11px] font-display font-semibold text-white/40 tracking-[0.15em] uppercase mt-1 ml-1">
                kg
                {profile?.targetWeightKg && latestWeight && (
                  <span className="ml-3 text-white/30">
                    {t('home.goal_remaining', { diff: (profile.targetWeightKg - latestWeight.weightKg).toFixed(1) })}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <m.p
                key={pct}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="text-[48px] font-display font-bold tracking-[-0.03em] leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
                style={{ color: 'var(--state-accent)' }}
              >
                {pct}%
              </m.p>
              <p className="text-[10px] font-display font-semibold text-white/35 tracking-[0.15em] uppercase mt-1">
                kcal
              </p>
            </div>
          </div>

          {/* カロリー進捗バー (3px thin, elegant) */}
          <div className="space-y-2.5">
            <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: 'var(--state-accent)',
                  boxShadow: '0 0 12px var(--state-accent)',
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-white/50 font-display">
                <span className="text-white/80 font-bold">{Math.round(calories).toLocaleString()}</span>
                <span className="mx-1">/</span>
                <span>{target.toLocaleString()} kcal</span>
              </p>
              <div className="flex gap-3 text-[10px] font-display font-semibold text-white/40 tracking-wide">
                <span>P <span className="text-white/70">{Math.round(dailyLog?.totalProtein ?? 0)}g</span></span>
                <span>F <span className="text-white/70">{Math.round(dailyLog?.totalFat ?? 0)}g</span></span>
                <span>C <span className="text-white/70">{Math.round(dailyLog?.totalCarbs ?? 0)}g</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone A -> Zone B トランジション */}
      <div
        data-ibs-status={ibsStatus}
        className="h-8 bg-gradient-to-b from-[var(--state-to)] to-[#FAFAF7]"
      />

      {/* ─────────────────────────────────────────────────────── */}
      {/* ZONE B: Content Cards (light, scrollable)               */}
      {/* ─────────────────────────────────────────────────────── */}
      <div className="bg-[#FAFAF7] px-4 pb-8 space-y-4">

        {/* ── 今日の食事 (横スクロールカード) ────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-display font-bold text-gray-700 tracking-[0.06em] uppercase">
              {t('home.meals_today')}
            </h2>
            <button
              onClick={() => navigate('/meals')}
              className="flex items-center gap-1 text-[11px] font-display font-bold tracking-wide uppercase"
              style={{ color: 'var(--accent-primary)' }}
            >
              <Plus size={13} strokeWidth={2.5} />
              {t('home.add_meal')}
            </button>
          </div>

          {/* 横スクロール (snap scroll) */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {todayMeals && todayMeals.length > 0 ? (
              <>
                {todayMeals.map(meal => (
                  <div
                    key={meal.id}
                    className="shrink-0 w-[200px] snap-start glass-panel rounded-2xl p-4 border border-black/[0.04] shadow-sm"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-display font-bold text-gray-400 uppercase tracking-wider">
                        {t(`meals.type.${meal.type}`)}
                      </span>
                      {meal.gutFeedback && (
                        <span className="text-sm">{GUT_EMOJI[meal.gutFeedback]}</span>
                      )}
                    </div>
                    <p className="text-[13px] font-medium text-gray-700 line-clamp-2 leading-relaxed mb-3">
                      {meal.description}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-[22px] font-display font-bold text-gray-900 tracking-tight leading-none">
                        {Math.round(meal.totalCalories)}
                        <span className="text-[9px] text-gray-400 ml-0.5 uppercase">kcal</span>
                      </p>
                      {/* FODMAP ステッカー (Capwords style) */}
                      {meal.fodmapLevel && (
                        <span
                          className={`text-[8px] font-display font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest transform rotate-[-2deg] shadow-sm
                            ${meal.fodmapLevel === 'low'      ? 'bg-emerald-100 text-emerald-600' :
                              meal.fodmapLevel === 'moderate' ? 'bg-amber-100 text-amber-600'    :
                              'bg-red-100 text-red-600'}`}
                        >
                          {meal.fodmapLevel}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="w-full py-4">
                <EmptyState title={t('home.no_meals')} />
              </div>
            )}

            {/* 食事追加カード */}
            <button
              onClick={() => navigate('/meals')}
              className="shrink-0 w-[120px] snap-start rounded-2xl border-2 border-dashed border-black/[0.06] flex flex-col items-center justify-center gap-2 text-gray-300 hover:text-gray-400 hover:border-black/[0.1] transition-colors"
            >
              <Plus size={24} />
              <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                {t('home.add_meal')}
              </span>
            </button>
          </div>
        </div>

        {/* ── AI相談ショートカット ──────────────────────── */}
        <m.button
          onClick={() => navigate('/chat')}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full flex items-center gap-4 bg-white/90 backdrop-blur-md rounded-2xl px-5 py-4 text-left border border-black/[0.04] shadow-sm"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--gradient-stable-from)' }}
          >
            <TrendingUp size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-display font-bold text-gray-800 tracking-tight">
              {t('home.ai_chat_title')}
            </p>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {t('home.ai_chat_desc')}
            </p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </m.button>

      </div>
    </AppShell>
  )
}
