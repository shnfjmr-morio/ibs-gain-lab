interface HeroWeightChartProps {
  data: { date: string; weightKg: number }[]
}

export function HeroWeightChart({ data }: HeroWeightChartProps) {
  if (data.length < 2) return null

  const W = 400  // viewBox width
  const H = 300  // viewBox height
  const PAD_Y = 40 // top/bottom padding to keep line from edges

  const weights = data.map(d => d.weightKg)
  const minW = Math.min(...weights) - 0.3
  const maxW = Math.max(...weights) + 0.3
  const rangeW = maxW - minW || 1

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: PAD_Y + (1 - (d.weightKg - minW) / rangeW) * (H - PAD_Y * 2),
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  // Area fill path (line + close at bottom)
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="absolute inset-0"
    >
      <defs>
        <linearGradient id="heroAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--state-accent)" stopOpacity="0.15" />
          <stop offset="70%" stopColor="var(--state-accent)" stopOpacity="0.03" />
          <stop offset="100%" stopColor="var(--state-accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="heroLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--state-accent)" stopOpacity="0.4" />
          <stop offset="50%" stopColor="var(--state-accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--state-accent)" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill="url(#heroAreaGrad)" />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="url(#heroLineGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
