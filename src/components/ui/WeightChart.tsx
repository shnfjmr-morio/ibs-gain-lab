import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartDataPoint } from '../../services/weight/WeightChartService'

interface WeightChartProps {
  data: ChartDataPoint[]
  targetWeightKg?: number
  width?: number
  height?: number
}

interface Tooltip {
  x: number
  y: number
  date: string
  weightKg: number
}

const PADDING = { top: 16, right: 16, bottom: 36, left: 44 }

export function WeightChart({ data, targetWeightKg, width = 340, height = 200 }: WeightChartProps) {
  const { t } = useTranslation()
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (data.length < 2) return null

  const innerW = width - PADDING.left - PADDING.right
  const innerH = height - PADDING.top - PADDING.bottom

  // Y軸スケール
  const weights = data.map(d => d.weightKg)
  const movingAvgs = data.map(d => d.movingAvg7).filter((v): v is number => v !== null)
  const allValues = [...weights, ...movingAvgs]
  if (targetWeightKg) allValues.push(targetWeightKg)
  const minY = Math.min(...allValues) - 0.5
  const maxY = Math.max(...allValues) + 0.5
  const rangeY = maxY - minY

  const toX = (i: number) => PADDING.left + (i / (data.length - 1)) * innerW
  const toY = (v: number) => PADDING.top + (1 - (v - minY) / rangeY) * innerH

  // SVGパス生成
  const buildPath = (points: [number, number][]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

  // 実測値パス
  const mainPoints: [number, number][] = data.map((d, i) => [toX(i), toY(d.weightKg)])
  const mainPath = buildPath(mainPoints)

  // 7日移動平均パス（nullをスキップ）
  const avgSegments: [number, number][][] = []
  let segment: [number, number][] = []
  data.forEach((d, i) => {
    if (d.movingAvg7 !== null) {
      segment.push([toX(i), toY(d.movingAvg7)])
    } else {
      if (segment.length > 1) avgSegments.push(segment)
      segment = []
    }
  })
  if (segment.length > 1) avgSegments.push(segment)

  // X軸ラベル（5〜7個）
  const labelStep = Math.max(1, Math.floor(data.length / 6))
  const xLabels = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i === 0 || i === data.length - 1 || i % labelStep === 0)
    .map(({ d, i }) => ({
      x: toX(i),
      label: d.date.slice(5), // 'MM-DD'
    }))

  // Y軸ラベル（4本）
  const yLabels = Array.from({ length: 4 }, (_, i) => {
    const v = minY + (rangeY / 3) * i
    return { y: toY(v), label: v.toFixed(1) }
  }).reverse()

  // タッチ当たり半径12px（描画4px）
  const HIT_RADIUS = 12
  const DOT_RADIUS = 4

  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX = width / rect.width   // viewBox幅 / DOM要素の実際の幅
    const scaleY = height / rect.height // viewBox高さ / DOM要素の実際の高さ
    const tx = (e.touches[0].clientX - rect.left) * scaleX
    const ty = (e.touches[0].clientY - rect.top) * scaleY
    const hit = mainPoints.findIndex(([px, py]) => {
      return Math.hypot(px - tx, py - ty) <= HIT_RADIUS
    })
    if (hit >= 0) {
      setTooltip({ x: mainPoints[hit][0], y: mainPoints[hit][1], date: data[hit].date, weightKg: data[hit].weightKg })
    }
  }

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const tx = e.clientX - rect.left
    const ty = e.clientY - rect.top
    const hit = mainPoints.findIndex(([px, py]) => Math.hypot(px - tx, py - ty) <= HIT_RADIUS)
    if (hit >= 0) {
      setTooltip({ x: mainPoints[hit][0], y: mainPoints[hit][1], date: data[hit].date, weightKg: data[hit].weightKg })
    } else {
      setTooltip(null)
    }
  }

  return (
    <div className="relative select-none" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setTimeout(() => setTooltip(null), 1800)}
        onClick={handleClick}
        className="overflow-visible"
      >
        {/* グリッド横線 */}
        {yLabels.map(({ y, label }) => (
          <g key={label}>
            <line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y}
              stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            <text x={PADDING.left - 4} y={y + 3.5} textAnchor="end"
              fontSize={9} fill="rgba(0,0,0,0.35)" fontFamily="ui-monospace, monospace">
              {label}
            </text>
          </g>
        ))}

        {/* 目標ライン */}
        {targetWeightKg && (
          <g>
            <line
              x1={PADDING.left} y1={toY(targetWeightKg)}
              x2={width - PADDING.right} y2={toY(targetWeightKg)}
              stroke="rgba(156,163,175,0.7)" strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={width - PADDING.right + 2} y={toY(targetWeightKg) + 3.5}
              fontSize={8} fill="rgba(156,163,175,0.9)" fontFamily="ui-sans-serif, sans-serif">
              {t('weight.goal_short', { defaultValue: '目標' })}
            </text>
          </g>
        )}

        {/* 7日移動平均（半透明破線） */}
        {avgSegments.map((seg, si) => (
          <path
            key={si}
            d={buildPath(seg)}
            fill="none"
            stroke="rgba(52,211,153,0.45)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            strokeLinecap="round"
          />
        ))}

        {/* 実測値ライン */}
        <path
          d={mainPath}
          fill="none"
          stroke="rgb(16,185,129)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ドット */}
        {mainPoints.map(([px, py], i) => (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={DOT_RADIUS}
            fill={data[i].ibsStatus === 'active' ? 'rgb(239,68,68)' : 'rgb(16,185,129)'}
            stroke="white"
            strokeWidth={1.5}
          />
        ))}

        {/* X軸ラベル */}
        {xLabels.map(({ x, label }, i) => (
          <text
            key={`${label}-${i}`}
            x={x}
            y={height - 4}
            textAnchor="middle"
            fontSize={9}
            fill="rgba(0,0,0,0.35)"
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
        ))}

        {/* ツールチップ */}
        {tooltip && (() => {
          const TIPW = 80
          const TIPH = 36
          const tipX = Math.min(Math.max(tooltip.x - TIPW / 2, PADDING.left), width - PADDING.right - TIPW)
          const tipY = tooltip.y > PADDING.top + TIPH + 10 ? tooltip.y - TIPH - 8 : tooltip.y + 10
          return (
            <g>
              <rect x={tipX} y={tipY} width={TIPW} height={TIPH} rx={6}
                fill="rgba(17,24,39,0.88)" />
              <text x={tipX + TIPW / 2} y={tipY + 13} textAnchor="middle"
                fontSize={9} fill="rgba(255,255,255,0.7)" fontFamily="ui-sans-serif, sans-serif">
                {tooltip.date}
              </text>
              <text x={tipX + TIPW / 2} y={tipY + 27} textAnchor="middle"
                fontSize={12} fontWeight="bold" fill="white" fontFamily="ui-monospace, monospace">
                {tooltip.weightKg}kg
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
