'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']
const REPORT_COLORS = ['#7c3aed', '#f87171', '#60a5fa', '#34d399']

interface Props {
  reports: Report[]
}

export function StatsTab({ reports }: Props) {
  const radarData = [
    { stat: 'Haste', ...Object.fromEntries(reports.map((r, i) => [LABELS[i], parseFloat(r.buffedStats.spellHaste.toFixed(2))])) },
    { stat: 'Crit', ...Object.fromEntries(reports.map((r, i) => [LABELS[i], parseFloat(r.buffedStats.spellCrit.toFixed(2))])) },
    { stat: 'Mastery', ...Object.fromEntries(reports.map((r, i) => [LABELS[i], parseFloat(r.buffedStats.mastery.toFixed(2))])) },
    { stat: 'Vers', ...Object.fromEntries(reports.map((r, i) => [LABELS[i], parseFloat(r.buffedStats.versatility.toFixed(2))])) },
  ]

  return (
    <div className="p-4 max-w-4xl">
      {/* Secondary stats radar */}
      <div className="mb-8">
        <h3 className="text-xs text-text-faint uppercase tracking-wide mb-4">
          Secondary Stats — Buffed %
        </h3>
        <div className="bg-surface-raised border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis
                dataKey="stat"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <PolarRadiusAxis
                tick={{ fill: '#475569', fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
                angle={30}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                      {payload.map((p, i) => (
                        <p key={i} style={{ color: p.stroke }}>
                          {String(p.dataKey)}: {Number(p.value).toFixed(2)}%
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
                <Radar
                  key={i}
                  name={LABELS[i]}
                  dataKey={LABELS[i]}
                  stroke={REPORT_COLORS[i]}
                  fill={REPORT_COLORS[i]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={{ fill: REPORT_COLORS[i], r: 3 }}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Section title="Fight Conditions">
        <StatRow label="Fight Style" values={reports.map((r) => r.fightStyle)} reports={reports} />
        <StatRow label="Targets" values={reports.map((r) => String(r.targetCount))} reports={reports} />
        <StatRow
          label="Duration"
          values={reports.map((r) => `${r.fightDuration}s ±${Math.round(r.varyLength * 100)}%`)}
          reports={reports}
        />
      </Section>

      <Section title="Primary Stats (buffed)">
        <StatRow
          label="Intellect"
          values={reports.map((r) => r.buffedStats.intellect.toLocaleString())}
          rawValues={reports.map((r) => r.buffedStats.intellect)}
          reports={reports}
        />
        <StatRow
          label="Spell Power"
          values={reports.map((r) => r.buffedStats.spellPower.toLocaleString())}
          rawValues={reports.map((r) => r.buffedStats.spellPower)}
          reports={reports}
        />
      </Section>

      <Section title="Secondary Stats (buffed)">
        <StatRow
          label="Haste"
          values={reports.map((r) => `${r.buffedStats.spellHaste.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.spellHaste)}
          unit="pp"
          reports={reports}
        />
        <StatRow
          label="Crit"
          values={reports.map((r) => `${r.buffedStats.spellCrit.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.spellCrit)}
          unit="pp"
          reports={reports}
        />
        <StatRow
          label="Mastery"
          values={reports.map((r) => `${r.buffedStats.mastery.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.mastery)}
          unit="pp"
          reports={reports}
        />
        <StatRow
          label="Versatility"
          values={reports.map((r) => `${r.buffedStats.versatility.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.versatility)}
          unit="pp"
          reports={reports}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs text-text-faint uppercase tracking-wide mb-2">{title}</h3>
      <div className="border border-border rounded-lg overflow-hidden">{children}</div>
    </div>
  )
}

function StatRow({
  label,
  values,
  rawValues,
  unit,
  reports,
}: {
  label: string
  values: string[]
  rawValues?: number[]
  unit?: string
  reports: Report[]
}) {
  const maxRaw = rawValues ? Math.max(...rawValues) : null

  return (
    <div
      className="grid border-b border-border last:border-0 text-sm"
      style={{ gridTemplateColumns: `160px repeat(${reports.length}, 1fr)` }}
    >
      <span className="px-3 py-2 text-xs text-text-faint border-r border-border bg-surface">
        {label}
      </span>
      {values.map((v, i) => {
        const isMax = rawValues && rawValues[i] === maxRaw
        const delta =
          rawValues && maxRaw !== null && !isMax
            ? rawValues[i] - maxRaw
            : null

        return (
          <span
            key={i}
            className="px-3 py-2 border-r border-border last:border-0"
            style={{ color: isMax && reports.length > 1 ? REPORT_COLORS[i] : undefined }}
          >
            {v}
            {delta !== null && (
              <span className={`ml-1 text-xs ${delta > 0 ? 'text-positive' : 'text-negative'}`}>
                {delta > 0 ? '+' : ''}
                {unit === 'pp' ? `${delta.toFixed(1)}pp` : delta.toLocaleString()}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
