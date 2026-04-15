'use client'

import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import type { Report } from '@/lib/types'
import { LABELS, REPORT_COLORS } from '@/lib/report-labels'
import { BUILD_COLORS } from '@/lib/report-labels'

const WINDOW = 10  // rolling average window in seconds
const TOP_ABILITIES = 7
const MIN_BUFF_UPTIME = 5  // minimum uptime % to show

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

// ── DPS Breakdown helpers ────────────────────────────────────────────────────

interface AbilityRow {
  name: string
  values: { dps: number; pct: number }[]  // one per report
}

function buildAbilityBreakdown(reports: Report[]): { rows: AbilityRow[]; deltas: AbilityDelta[] } {
  // Collect all top-level abilities across reports
  const abilityMap = new Map<string, { dps: number; pct: number }[]>()

  for (let ri = 0; ri < reports.length; ri++) {
    for (const ability of reports[ri].abilities) {
      if (!abilityMap.has(ability.spellName)) {
        abilityMap.set(ability.spellName, reports.map(() => ({ dps: 0, pct: 0 })))
      }
      const entry = abilityMap.get(ability.spellName)!
      entry[ri] = { dps: ability.dps, pct: ability.percentOfTotal }
    }
  }

  // Sort by max DPS across builds, take top N
  const sorted = [...abilityMap.entries()]
    .sort((a, b) => Math.max(...b[1].map((v) => v.dps)) - Math.max(...a[1].map((v) => v.dps)))

  const top = sorted.slice(0, TOP_ABILITIES)
  const rows: AbilityRow[] = top.map(([name, values]) => ({ name, values }))

  // "Other" row
  const otherValues = reports.map((r, ri) => {
    const topDps = top.reduce((sum, [, vals]) => sum + vals[ri].dps, 0)
    const otherDps = r.dps - topDps
    const otherPct = r.dps > 0 ? (otherDps / r.dps) * 100 : 0
    return { dps: Math.max(0, otherDps), pct: Math.max(0, otherPct) }
  })
  rows.push({ name: 'Other', values: otherValues })

  // Delta calculation: top 3 by largest pct-point spread
  const deltas: AbilityDelta[] = top
    .map(([name, values]) => {
      const pcts = values.map((v) => v.pct)
      const spread = Math.max(...pcts) - Math.min(...pcts)
      return { name, values: pcts, spread }
    })
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3)

  return { rows, deltas }
}

interface AbilityDelta {
  name: string
  values: number[]  // pct per report
  spread: number
}

// ── Buff Uptime helpers ──────────────────────────────────────────────────────

interface BuffRow {
  name: string
  uptimes: number[]  // one per report, 0-100
}

function buildBuffComparison(reports: Report[]): BuffRow[] {
  const buffMap = new Map<string, number[]>()

  for (let ri = 0; ri < reports.length; ri++) {
    for (const buff of reports[ri].buffs) {
      if (!buffMap.has(buff.name)) {
        buffMap.set(buff.name, reports.map(() => 0))
      }
      buffMap.get(buff.name)![ri] = buff.uptime
    }
  }

  return [...buffMap.entries()]
    .filter(([, uptimes]) => uptimes.some((u) => u >= MIN_BUFF_UPTIME))
    .sort((a, b) => Math.max(...b[1]) - Math.max(...a[1]))
    .map(([name, uptimes]) => ({ name, uptimes }))
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
  const { rows: abilityRows, deltas } = buildAbilityBreakdown(reports)
  const buffRows = buildBuffComparison(reports)

  // Max DPS across all abilities/builds for bar scaling
  const maxAbilityDps = Math.max(...abilityRows.flatMap((r) => r.values.map((v) => v.dps)), 1)

  return (
    <div className="p-4 space-y-8">
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
        </div>
      </div>

      {/* ── DPS Breakdown ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
          DPS Breakdown — Top Abilities
        </p>
        <div className="bg-surface-raised border border-border rounded-lg p-4">
          <div className="space-y-3">
            {abilityRows.map((row, rowIdx) => {
              const isOther = row.name === 'Other'
              return (
                <div key={row.name} className="flex items-center gap-2.5">
                  <div
                    className="w-[120px] text-right text-xs flex-shrink-0 overflow-hidden whitespace-nowrap text-ellipsis"
                    style={{ color: isOther ? '#64748b' : '#94a3b8' }}
                  >
                    {row.name}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {row.values.map((val, ri) => {
                      const color = BUILD_COLORS[ri % BUILD_COLORS.length]
                      const widthPct = maxAbilityDps > 0 ? (val.dps / maxAbilityDps) * 100 : 0
                      return (
                        <div key={ri} className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 text-[9px] font-semibold flex-shrink-0"
                            style={{ color: color.border }}
                          >
                            {LABELS[ri]}
                          </span>
                          <div className="flex-1 h-3.5 rounded bg-[rgba(30,30,46,0.5)] overflow-hidden">
                            <div
                              className="h-full rounded flex items-center pl-1.5"
                              style={{
                                width: `${Math.max(widthPct, 1)}%`,
                                background: `linear-gradient(90deg, ${color.fill}, ${color.border})`,
                                opacity: isOther ? 0.5 : 1,
                              }}
                            >
                              {widthPct > 15 && (
                                <span className="text-[9px] text-white/70">
                                  {val.dps >= 1000 ? `${(val.dps / 1000).toFixed(1)}k` : Math.round(val.dps)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="w-10 text-right text-[10px] text-text-faint flex-shrink-0">
                            {val.pct.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {deltas.length > 0 && (
            <>
              <div className="border-t border-border mt-4 pt-3">
                <p className="text-[10px] text-text-faint uppercase tracking-wider mb-2">Biggest Differences</p>
                <div className="grid grid-cols-3 gap-2">
                  {deltas.map((d) => {
                    const maxPct = Math.max(...d.values)
                    return (
                      <div key={d.name} className="bg-[rgba(13,13,26,0.6)] border border-border rounded-md px-2.5 py-2 text-xs">
                        <div className="text-text-secondary mb-1">{d.name}</div>
                        <div className="flex gap-2 text-[10px]">
                          {d.values.map((pct, ri) => (
                            <span
                              key={ri}
                              style={{ color: pct === maxPct ? '#4ade80' : '#64748b' }}
                            >
                              {LABELS[ri]}: {pct.toFixed(1)}%
                              {pct === maxPct && d.spread > 0 && (
                                <span className="text-positive"> (+{d.spread.toFixed(1)})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Buff Uptime Comparison ────────────────────────────────────── */}
      {buffRows.length > 0 && (
        <div>
          <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
            Buff Uptime Comparison
          </p>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="space-y-1.5">
              {buffRows.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <div className="w-[140px] text-right text-xs text-text-secondary flex-shrink-0 overflow-hidden whitespace-nowrap text-ellipsis">
                    {row.name}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    {row.uptimes.map((uptime, ri) => {
                      const color = BUILD_COLORS[ri % BUILD_COLORS.length]
                      return (
                        <div key={ri} className="h-2.5 rounded bg-[rgba(30,30,46,0.5)] overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${uptime}%`,
                              background: `linear-gradient(90deg, ${color.fill}, ${color.border})`,
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-col gap-0.5 w-9 flex-shrink-0">
                    {row.uptimes.map((uptime, ri) => {
                      const color = BUILD_COLORS[ri % BUILD_COLORS.length]
                      return (
                        <span
                          key={ri}
                          className="text-[9px] text-right h-2.5 leading-[10px]"
                          style={{ color: color.border }}
                        >
                          {Math.round(uptime)}%
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-faint italic text-center mt-3">
              Showing buffs with &ge;5% uptime in at least one build &middot; sorted by max uptime
            </p>
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
