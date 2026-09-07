interface SparklineProps {
  /** Real data points only — never a fabricated or interpolated trend. */
  values: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

// Minimal inline trend line + soft area fill, in the spirit of the approved
// design canvas's KPI sparklines — but driven only by real series (e.g. a
// cumulative count over actual upload dates), never an invented ±% trend.
export function Sparkline({ values, color = '#296ef9', width = 86, height = 34, className = '' }: SparklineProps) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const pad = 2

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const areaPath = `M${points.join(' L')} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className={className}>
      <path d={areaPath} fill={color} opacity="0.08" />
      <polyline points={points.join(' ')} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
