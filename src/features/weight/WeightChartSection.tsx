import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { WeightChart } from '../../components/ui/WeightChart'
import { getWeightChartData, getWeightStats } from '../../services/weight/WeightChartService'
import type { ChartDataPoint, WeightStats } from '../../services/weight/WeightChartService'
import type { WeightLog } from '../../types/entities'

interface WeightChartSectionProps {
  logs: WeightLog[]
  targetWeightKg?: number
}

type Period = 30 | 90 | 180

export function WeightChartSection({ logs: _logs, targetWeightKg }: WeightChartSectionProps) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(30)

  const chartDataRaw = useLiveQuery(
    () => getWeightChartData(period),
    [period]
  )
  const statsRaw = useLiveQuery(
    () => getWeightStats(targetWeightKg),
    [targetWeightKg]
  )

  const chartData: ChartDataPoint[] = chartDataRaw ?? []
  const stats: WeightStats | null = statsRaw ?? null

  if (chartData.length < 2) return null

  const periods: Period[] = [30, 90, 180]

  return (
    <div className="glass-panel rounded-3xl p-4 shadow-sm border border-black/[0.03] space-y-3">
      {/* ヘッダー + 期間切替 */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-gray-700 font-display uppercase tracking-wider">
          {t('weight.chart_title', { defaultValue: '体重推移' })}
        </p>
        <div className="flex bg-gray-100/80 rounded-xl p-0.5 gap-0.5">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-[10px] text-[11px] font-bold font-display transition-all duration-200 ${
                period === p
                  ? 'bg-white shadow-sm text-emerald-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {p}{t('common.days', { defaultValue: '日' })}
            </button>
          ))}
        </div>
      </div>

      {/* グラフ本体 */}
      <div className="w-full">
        <WeightChart
          data={chartData}
          targetWeightKg={targetWeightKg}
          width={340}
          height={180}
        />
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-4 h-[2px] bg-emerald-500 inline-block rounded-full" />
          {t('weight.legend_actual', { defaultValue: '実測値' })}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-[1.5px] bg-emerald-400/50 inline-block rounded-full border-t border-dashed border-emerald-400/50" />
          {t('weight.legend_avg7', { defaultValue: '7日平均' })}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          {t('weight.legend_ibs_active', { defaultValue: 'IBS active' })}
        </span>
      </div>

      {/* 統計サマリー */}
      {stats && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-black/[0.04]">
          {stats.weeklyAvg != null && (
            <div>
              <p className="text-[10px] text-gray-400 font-display uppercase tracking-wider">
                {t('weight.stats_weekly_avg', { defaultValue: '今週平均' })}
              </p>
              <p className="text-[15px] font-bold text-gray-900 font-display">
                {stats.weeklyAvg.toFixed(1)}
                <span className="text-[10px] text-gray-400 ml-0.5">kg</span>
                {stats.weeklyChange != null && (
                  <span className={`text-[11px] font-semibold ml-1 ${stats.weeklyChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {stats.weeklyChange >= 0 ? '+' : ''}{stats.weeklyChange.toFixed(2)}
                  </span>
                )}
              </p>
            </div>
          )}
          {stats.estimatedGoalDate && (
            <div className="ml-auto text-right">
              <p className="text-[10px] text-gray-400 font-display uppercase tracking-wider">
                {t('weight.stats_goal_eta', { defaultValue: '目標予測' })}
              </p>
              <p className="text-[13px] font-bold text-emerald-700 font-display">
                {stats.estimatedGoalDate}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
