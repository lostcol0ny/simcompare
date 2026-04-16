'use client'

import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import type { Report } from '@/lib/types'
import { LABELS, REPORT_COLORS } from '@/lib/report-labels'
import { BUILD_COLORS } from '@/lib/report-labels'

import { ReferenceArea } from 'recharts'

const WINDOW = 10  // rolling average window in seconds
const BURST_ENTER = 1.3  // DPS must exceed baseline × this to start a burst
const BURST_EXIT = 1.1   // DPS must drop below baseline × this to end a burst
const BURST_MIN_SECS = 3 // minimum consecutive seconds above threshold

interface Props {
  reports: Report[]
}

/** Smooth an array with a rolling mean of `window` samples. */
function rollingAvg(data: number[], window: number): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = data.slice(start, i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

/** Build per-second chart data aligned across all reports. */
function buildDpsData(reports: Report[]): Record<string, number | string>[] {
  const maxLen = reports.length === 0 ? 0 : Math.max(...reports.map((r) => r.timelineDps.length))
  const smoothed = reports.map((r) => rollingAvg(r.timelineDps, WINDOW))
  return Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, number | string> = { t: i }
    reports.forEach((_, ri) => {
      row[LABELS[ri]] = Math.round(smoothed[ri][i] ?? 0)
    })
    return row
  })
}

/** Build resource timeline data for a given resource key. */
function buildResourceData(reports: Report[], resource: string): Record<string, number | string>[] {
  const maxLen = reports.length === 0 ? 0 : Math.max(...reports.map((r) => (r.resourceTimelines[resource]?.length ?? 0)))
  if (maxLen === 0) return []
  return Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, number | string> = { t: i }
    reports.forEach((r, ri) => {
      row[LABELS[ri]] = Math.round((r.resourceTimelines[resource]?.[i] ?? 0) * 10) / 10
    })
    return row
  })
}

/** Collect the union of resource keys across all reports. */
function allResources(reports: Report[]): string[] {
  const keys = new Set<string>()
  reports.forEach((r) => Object.keys(r.resourceTimelines).forEach((k) => keys.add(k)))
  return [...keys]
}

function formatResourceName(key: string): string {
  return key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── DPS Distribution helpers ─────────────────────────────────────────────────

/** Standard normal CDF via Abramowitz & Stegun rational approximation. */
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(x))
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2)
  return 0.5 * (1 + sign * y)
}

/** Normal PDF. */
function normalPDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return x === mean ? 1 : 0
  const z = (x - mean) / stdDev
  return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI))
}

/** Probability that build with (mean2, sd2) beats build with (mean1, sd1). */
function overlapProbability(mean1: number, sd1: number, mean2: number, sd2: number): number {
  const combinedSd = Math.sqrt(sd1 * sd1 + sd2 * sd2)
  if (combinedSd <= 0) return mean2 > mean1 ? 1 : 0
  return normalCDF((mean2 - mean1) / combinedSd)
}

/** Build SVG path data for a normal distribution curve. */
function buildDistributionPath(
  mean: number, stdDev: number, xMin: number, xMax: number,
  width: number, height: number, maxPdf: number, samples = 100
): string {
  const points: string[] = []
  for (let i = 0; i <= samples; i++) {
    const x = xMin + (xMax - xMin) * (i / samples)
    const px = (i / samples) * width
    const pdf = normalPDF(x, mean, stdDev)
    const py = height - (pdf / maxPdf) * (height * 0.9)
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`)
  }
  return `M ${points[0]} ` + points.slice(1).map((p) => `L ${p}`).join(' ')
}

/** Build a closed SVG path (for fill) by adding bottom-edge return. */
function buildDistributionFill(
  mean: number, stdDev: number, xMin: number, xMax: number,
  width: number, height: number, maxPdf: number, samples = 100
): string {
  const path = buildDistributionPath(mean, stdDev, xMin, xMax, width, height, maxPdf, samples)
  return `${path} L ${width},${height} L 0,${height} Z`
}

// ── Burst detection helpers ─────────────────────────────────────────────────

interface BurstWindow {
  start: number
  end: number
  peak: number
}

function detectBursts(smoothedDps: number[], baseline: number): BurstWindow[] {
  if (smoothedDps.length < 30) return []
  const enterThreshold = baseline * BURST_ENTER
  const exitThreshold = baseline * BURST_EXIT
  const bursts: BurstWindow[] = []
  let inBurst = false
  let start = 0
  let peak = 0

  for (let i = 0; i < smoothedDps.length; i++) {
    const dps = smoothedDps[i]
    if (!inBurst && dps >= enterThreshold) {
      inBurst = true
      start = i
      peak = dps
    } else if (inBurst) {
      if (dps > peak) peak = dps
      if (dps < exitThreshold) {
        if (i - start >= BURST_MIN_SECS) {
          bursts.push({ start, end: i, peak })
        }
        inBurst = false
      }
    }
  }
  // Close any open burst at end
  if (inBurst && smoothedDps.length - start >= BURST_MIN_SECS) {
    bursts.push({ start, end: smoothedDps.length - 1, peak })
  }
  return bursts
}

// ── Resource summary helpers ─────────────────────────────────────────────────

interface ResourceSummary {
  avgLevel: number[]
  totalGenerated: number[]
  overflow: number[]
}

function buildResourceSummary(reports: Report[], resource: string): ResourceSummary {
  return {
    avgLevel: reports.map((r) => {
      const timeline = r.resourceTimelines[resource]
      if (!timeline || timeline.length === 0) return 0
      return Math.round((timeline.reduce((s, v) => s + v, 0) / timeline.length) * 10) / 10
    }),
    totalGenerated: reports.map((r) =>
      r.gains
        .filter((g) => g.resource === resource)
        .reduce((sum, g) => sum + g.actual, 0)
    ),
    overflow: reports.map((r) =>
      r.gains
        .filter((g) => g.resource === resource)
        .reduce((sum, g) => sum + g.overflow, 0)
    ),
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function TimelineTab({ reports }: Props) {
  const dpsData = buildDpsData(reports)
  const resources = allResources(reports)

  // Burst detection
  const smoothedPerBuild = reports.map((r) => rollingAvg(r.timelineDps, WINDOW))
  const baselines = reports.map((r) => r.dps)
  const burstsPerBuild = smoothedPerBuild.map((s, i) => detectBursts(s, baselines[i]))
  const hasBursts = burstsPerBuild.some((b) => b.length > 0)

  // DPS distribution
  const hasDistribution = reports.length >= 2 && reports.every((r) => r.dpsRawStdDev > 0)
  const leaderIdx = reports.reduce((best, r, i) => r.dps > reports[best].dps ? i : best, 0)

  // Distribution chart dimensions
  const DIST_W = 600, DIST_H = 180
  let xMin = 0, xMax = 1, maxPdf = 0.001
  if (hasDistribution) {
    xMin = Math.min(...reports.map((r) => r.dps - 3.5 * r.dpsRawStdDev))
    xMax = Math.max(...reports.map((r) => r.dps + 3.5 * r.dpsRawStdDev))
    maxPdf = Math.max(...reports.map((r) => normalPDF(r.dps, r.dps, r.dpsRawStdDev)))
  }

  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString()

  return (
    <div className="p-4 space-y-8" data-no-grid-click>

      {/* ── DPS over time ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
          DPS Over Time ({WINDOW}s rolling average)
        </p>
        <div className="bg-surface-raised border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dpsData} margin={{ top: 8, right: 24, bottom: 4, left: 16 }}>
              <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(v: number) => `${v}s`}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(dpsData.length / 8)}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(124, 58, 237, 0.3)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="text-text-faint mb-1">{label}s</p>
                      {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }}>
                          {String(p.dataKey)}: {Number(p.value).toLocaleString()} DPS
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#64748b' }}
                formatter={(v) => {
                  const idx = LABELS.indexOf(v)
                  return idx >= 0 ? `${v} — ${reports[idx].characterName}` : v
                }}
              />
              {/* Burst window shading */}
              {burstsPerBuild.flatMap((bursts, ri) =>
                bursts.map((b, bi) => (
                  <ReferenceArea
                    key={`burst-${ri}-${bi}`}
                    x1={b.start}
                    x2={b.end}
                    fill={REPORT_COLORS[ri]}
                    fillOpacity={0.06}
                    stroke="none"
                  />
                ))
              )}
              {reports.map((_, i) => (
                <Area
                  key={i}
                  type="monotone"
                  dataKey={LABELS[i]}
                  stroke={REPORT_COLORS[i]}
                  fill={REPORT_COLORS[i]}
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Burst summary pills */}
          {hasBursts && (
            <div className="flex gap-3 mt-3">
              <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Burst Windows</div>
                <div className="text-sm font-semibold">
                  {reports.map((_, ri) => (
                    <span key={ri}>
                      {ri > 0 && <span className="text-text-faint text-xs font-normal"> · </span>}
                      <span style={{ color: REPORT_COLORS[ri] }}>{LABELS[ri]}: {burstsPerBuild[ri].length}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Avg Burst Peak</div>
                <div className="text-sm font-semibold">
                  {reports.map((_, ri) => {
                    const bursts = burstsPerBuild[ri]
                    if (bursts.length === 0) return <span key={ri}>{ri > 0 && <span className="text-text-faint text-xs font-normal"> · </span>}<span style={{ color: REPORT_COLORS[ri] }}>{LABELS[ri]}: —</span></span>
                    const avgPeak = bursts.reduce((s, b) => s + b.peak, 0) / bursts.length
                    const pctAbove = ((avgPeak - baselines[ri]) / baselines[ri]) * 100
                    return (
                      <span key={ri}>
                        {ri > 0 && <span className="text-text-faint text-xs font-normal"> · </span>}
                        <span style={{ color: REPORT_COLORS[ri] }}>{LABELS[ri]}: {fmtK(avgPeak)} <span className="text-[9px] text-text-faint">(+{pctAbove.toFixed(0)}%)</span></span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Avg Burst Duration</div>
                <div className="text-sm font-semibold">
                  {reports.map((_, ri) => {
                    const bursts = burstsPerBuild[ri]
                    if (bursts.length === 0) return <span key={ri}>{ri > 0 && <span className="text-text-faint text-xs font-normal"> · </span>}<span style={{ color: REPORT_COLORS[ri] }}>{LABELS[ri]}: —</span></span>
                    const avgDur = bursts.reduce((s, b) => s + (b.end - b.start), 0) / bursts.length
                    return (
                      <span key={ri}>
                        {ri > 0 && <span className="text-text-faint text-xs font-normal"> · </span>}
                        <span style={{ color: REPORT_COLORS[ri] }}>{LABELS[ri]}: ~{Math.round(avgDur)}s</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DPS Distribution ─────────────────────────────────────────── */}
      {hasDistribution && (
        <div>
          <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
            DPS Distribution
          </p>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <svg viewBox={`0 0 ${DIST_W} ${DIST_H + 20}`} className="w-full" style={{ maxHeight: 220 }}>
              {/* Curves */}
              {reports.map((r, i) => (
                <g key={i}>
                  <path
                    d={buildDistributionFill(r.dps, r.dpsRawStdDev, xMin, xMax, DIST_W, DIST_H, maxPdf)}
                    fill={REPORT_COLORS[i]}
                    fillOpacity={0.12}
                  />
                  <path
                    d={buildDistributionPath(r.dps, r.dpsRawStdDev, xMin, xMax, DIST_W, DIST_H, maxPdf)}
                    fill="none"
                    stroke={REPORT_COLORS[i]}
                    strokeWidth={2}
                  />
                  {/* Mean line */}
                  {(() => {
                    const mx = ((r.dps - xMin) / (xMax - xMin)) * DIST_W
                    return (
                      <>
                        <line x1={mx} y1={0} x2={mx} y2={DIST_H} stroke={REPORT_COLORS[i]} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                        <text x={mx} y={12} fill={REPORT_COLORS[i]} fontSize={9} textAnchor="middle">{fmtK(r.dps)}</text>
                      </>
                    )
                  })()}
                </g>
              ))}
              {/* X axis labels */}
              {Array.from({ length: 6 }, (_, i) => {
                const val = xMin + (xMax - xMin) * (i / 5)
                const px = (i / 5) * DIST_W
                return <text key={i} x={px} y={DIST_H + 14} fill="#475569" fontSize={9} textAnchor="middle">{fmtK(val)}</text>
              })}
            </svg>

            {/* Stat pills */}
            <div className="flex gap-3 mt-3">
              <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Overlap</div>
                <div className="text-sm">
                  {reports.map((r, i) => {
                    if (i === leaderIdx) return null
                    const prob = overlapProbability(reports[leaderIdx].dps, reports[leaderIdx].dpsRawStdDev, r.dps, r.dpsRawStdDev)
                    return (
                      <div key={i} className="font-semibold" style={{ color: REPORT_COLORS[i] }}>
                        {(prob * 100).toFixed(1)}% <span className="text-[9px] text-text-faint font-normal">chance {LABELS[i]} beats {LABELS[leaderIdx]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">DPS Range (95% CI)</div>
                <div className="text-[13px] font-medium space-y-0.5">
                  {reports.map((r, i) => (
                    <div key={i} style={{ color: REPORT_COLORS[i] }}>
                      {LABELS[i]}: {fmtK(r.dps - 1.96 * r.dpsRawStdDev)} – {fmtK(r.dps + 1.96 * r.dpsRawStdDev)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Consistency</div>
                <div className="text-[13px] font-medium space-y-0.5">
                  {reports.map((r, i) => {
                    const cvPct = r.dps > 0 ? (r.dpsRawStdDev / r.dps) * 100 : 0
                    return (
                      <div key={i} style={{ color: REPORT_COLORS[i] }}>
                        {LABELS[i]}: ±{fmtK(r.dpsRawStdDev)} <span className="text-[9px] text-text-faint">({cvPct.toFixed(1)}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Resource timelines ────────────────────────────────────────── */}
      {resources.map((resource) => {
        const resData = buildResourceData(reports, resource)
        if (resData.length === 0) return null
        const maxVal = Math.max(
          ...reports.flatMap((r) => r.resourceTimelines[resource] ?? [])
        )
        const summary = buildResourceSummary(reports, resource)
        const hasGains = summary.totalGenerated.some((v) => v > 0)

        return (
          <div key={resource}>
            <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
              {formatResourceName(resource)} Over Time
            </p>
            <div className="bg-surface-raised border border-border rounded-lg p-4">
              {/* Resource summary stats */}
              {hasGains && (
                <div className="flex gap-3 mb-3">
                  <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                    <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Avg Level</div>
                    <div className="text-sm font-semibold">
                      {summary.avgLevel.map((v, ri) => (
                        <span key={ri}>
                          {ri > 0 && <span className="text-text-faint text-xs font-normal"> / </span>}
                          <span style={{ color: BUILD_COLORS[ri % BUILD_COLORS.length].border }}>{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                    <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Total Generated</div>
                    <div className="text-sm font-semibold">
                      {summary.totalGenerated.map((v, ri) => (
                        <span key={ri}>
                          {ri > 0 && <span className="text-text-faint text-xs font-normal"> / </span>}
                          <span style={{ color: BUILD_COLORS[ri % BUILD_COLORS.length].border }}>
                            {Math.round(v * 10) / 10}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {summary.overflow.some((v) => v > 0) && (
                    <div className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-3 py-2">
                      <div className="text-[9px] text-text-faint uppercase tracking-wider mb-0.5">Overflow (wasted)</div>
                      <div className="text-sm font-semibold">
                        {summary.overflow.map((v, ri) => (
                          <span key={ri}>
                            {ri > 0 && <span className="text-text-faint text-xs font-normal"> / </span>}
                            <span style={{ color: BUILD_COLORS[ri % BUILD_COLORS.length].border }}>
                              {Math.round(v * 10) / 10}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={resData} margin={{ top: 8, right: 24, bottom: 4, left: 16 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v: number) => `${v}s`}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.floor(resData.length / 8)}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    domain={[0, Math.ceil(maxVal)]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                          <p className="text-text-faint mb-1">{label}s</p>
                          {payload.map((p, i) => (
                            <p key={i} style={{ color: p.color }}>
                              {String(p.dataKey)}: {p.value}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: '#64748b' }}
                    formatter={(v) => {
                      const idx = LABELS.indexOf(v)
                      return idx >= 0 ? `${v} — ${reports[idx].characterName}` : v
                    }}
                  />
                  {reports.map((r, i) =>
                    r.resourceTimelines[resource] ? (
                      <Line
                        key={i}
                        type="stepAfter"
                        dataKey={LABELS[i]}
                        stroke={REPORT_COLORS[i]}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })}
    </div>
  )
}
