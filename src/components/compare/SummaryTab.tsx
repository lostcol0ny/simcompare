'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ErrorBar, LabelList, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'
import type { Report } from '@/lib/types'
import { getSpecIconUrl, getClassColor } from '@/lib/wow-icons'

const LABELS = ['A', 'B', 'C', 'D']
const REPORT_COLORS = ['#7c3aed', '#f87171', '#60a5fa', '#34d399']

interface Props {
  reports: Report[]
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

export function SummaryTab({ reports }: Props) {
  const maxDps = Math.max(...reports.map((r) => r.dps))
  const minDps = Math.min(...reports.map((r) => r.dps))
  const leadIdx = reports.findIndex((r) => r.dps === maxDps)
  const delta = (((maxDps - minDps) / minDps) * 100).toFixed(1)

  const chartData = reports.map((r, i) => ({
    label: LABELS[i],
    dps: Math.round(r.dps),
    stdDev: Math.round(r.dpsStdDev),
    color: REPORT_COLORS[i],
  }))

  return (
    <div>
      {/* Report identity cards */}
      <div className="flex divide-x divide-border border-b border-border">
        {reports.map((r, i) => {
          const iconUrl = getSpecIconUrl(r.specialization)
          const classColor = getClassColor(r.specialization)
          const isLeader = i === leadIdx && reports.length > 1
          return (
            <div key={r.id} className="flex-1 p-5 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                {iconUrl && (
                  <img
                    src={iconUrl}
                    alt={r.specialization}
                    className="w-10 h-10 rounded-full border-2 shrink-0"
                    style={{ borderColor: classColor }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-text-faint uppercase tracking-wide">
                    <span
                      className="inline-block w-4 h-4 rounded-full mr-1 align-middle"
                      style={{ backgroundColor: REPORT_COLORS[i] }}
                    />
                    {LABELS[i]}
                  </p>
                  <p
                    className="font-semibold text-sm truncate"
                    style={{ color: classColor }}
                  >
                    {r.characterName}
                  </p>
                  <p className="text-xs text-text-muted truncate">{r.specialization}</p>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-accent-light">
                  {(r.dps / 1000).toFixed(1)}k
                </span>
                {isLeader && reports.length > 1 && (
                  <span className="text-xs bg-positive-bg text-positive px-1.5 py-0.5 rounded border border-positive-border font-bold">
                    +{delta}%
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">DPS ±{fmt(r.dpsStdDev)}</p>

              <div className="mt-3 space-y-0.5 text-xs text-text-secondary">
                <p>{r.fightStyle} · {r.targetCount}T · {r.fightDuration}s ±{Math.round(r.varyLength * 100)}%</p>
                <p className="text-text-faint">{r.race}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* DPS comparison chart */}
      {reports.length >= 2 && (
        <div className="px-4 pt-6 pb-2 border-b border-border">
          <p className="text-xs text-text-faint uppercase tracking-wide mb-4">DPS Comparison</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 20, right: 24, bottom: 4, left: 16 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as typeof chartData[0]
                  const report = reports[LABELS.indexOf(d.label)]
                  return (
                    <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-bold text-text-primary">{d.label} — {report.characterName}</p>
                      <p className="text-accent-light">{fmt(d.dps)} DPS</p>
                      <p className="text-text-muted">±{fmt(d.stdDev)} std dev</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="dps" radius={[4, 4, 0, 0]} maxBarSize={100}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                ))}
                <LabelList
                  dataKey="dps"
                  position="top"
                  formatter={(v) => `${(Number(v) / 1000).toFixed(1)}k`}
                  style={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                />
                <ErrorBar dataKey="stdDev" width={4} strokeWidth={2} stroke="#475569" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Secondary stats comparison */}
      <div className="flex divide-x divide-border">
        {reports.map((r, i) => (
          <div key={r.id} className="flex-1 p-4">
            <p className="text-xs text-text-faint uppercase tracking-wide mb-2">
              {LABELS[i]} Stats
            </p>
            <div className="space-y-1 text-xs">
              <StatBar label="Haste" value={r.buffedStats.spellHaste} color={REPORT_COLORS[i]} />
              <StatBar label="Crit" value={r.buffedStats.spellCrit} color={REPORT_COLORS[i]} />
              <StatBar label="Mastery" value={r.buffedStats.mastery} color={REPORT_COLORS[i]} />
              <StatBar label="Vers" value={r.buffedStats.versatility} color={REPORT_COLORS[i]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// value is already a percentage (e.g. 79.5 for 79.5% haste).
// Bar width = value directly, capped at 100, so you can see the actual
// stat distribution: 79.5% haste is a long bar, 5.1% vers is a short bar.
function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-faint w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
      <span className="text-text-secondary w-12 text-right shrink-0">{value.toFixed(1)}%</span>
    </div>
  )
}
