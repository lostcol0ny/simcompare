'use client'

import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']
const REPORT_COLORS = ['#7c3aed', '#f87171', '#60a5fa', '#34d399']
const WINDOW = 10  // rolling average window in seconds

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

export function TimelineTab({ reports }: Props) {
  const dpsData = buildDpsData(reports)
  const resources = allResources(reports)

  return (
    <div className="p-4 space-y-8">
      {/* DPS over time */}
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

      {/* Resource timelines */}
      {resources.map((resource) => {
        const resData = buildResourceData(reports, resource)
        if (resData.length === 0) return null
        const maxVal = Math.max(
          ...reports.flatMap((r) => r.resourceTimelines[resource] ?? [])
        )
        return (
          <div key={resource}>
            <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
              {formatResourceName(resource)} Over Time
            </p>
            <div className="bg-surface-raised border border-border rounded-lg p-4">
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
