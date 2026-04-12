'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import type { Report } from '@/lib/types'
import { buildAbilityRows, type AbilityRow } from '@/lib/abilities'

const LABELS = ['A', 'B', 'C', 'D']
const REPORT_COLORS = ['#7c3aed', '#f87171', '#60a5fa', '#34d399']

interface Props {
  reports: Report[]
}

export function AbilitiesTab({ reports }: Props) {
  const [showPets, setShowPets] = useState(false)
  const rows = buildAbilityRows(reports)

  // Top 10 non-pet abilities for the chart
  const topRows = rows.filter((r) => r.spellName !== '').slice(0, 10)
  const chartData = topRows.map((row) => {
    const entry: Record<string, string | number> = {
      name: row.spellName.length > 18 ? row.spellName.slice(0, 17) + '…' : row.spellName,
    }
    reports.forEach((_, i) => {
      entry[LABELS[i]] = Math.round(row.values[i]?.dps ?? 0)
    })
    return entry
  })

  return (
    <div>
      {/* Ability breakdown chart */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <p className="text-xs text-text-faint uppercase tracking-wide mb-4">
          Top Abilities — DPS Contribution
        </p>
        <ResponsiveContainer width="100%" height={topRows.length * 36 + 40}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 80, bottom: 0, left: 140 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid horizontal={false} stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={136}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                    <p className="font-bold text-text-primary mb-1">{label}</p>
                    {payload.map((p, i) => (
                      <p key={i} style={{ color: p.fill }}>
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
            {reports.map((r, i) => (
              <Bar key={r.id} dataKey={LABELS[i]} fill={REPORT_COLORS[i]} fillOpacity={0.85} radius={[0, 3, 3, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border text-xs">
        <span className="text-text-muted">
          Sorted by DPS · <span className="text-accent-light">highest first</span>
        </span>
        <label className="flex items-center gap-2 cursor-pointer text-text-muted">
          Show pets
          <button
            role="switch"
            aria-checked={showPets}
            onClick={() => setShowPets((v) => !v)}
            className={`w-8 h-4 rounded-full relative transition-colors ${showPets ? 'bg-accent' : 'bg-surface-overlay'}`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showPets ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
        </label>
      </div>

      <div
        className="grid px-4 py-1.5 bg-surface border-b border-border text-xs text-text-faint uppercase tracking-wide"
        style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px` }}
      >
        <span>Ability</span>
        {reports.map((r, i) => (
          <span key={r.id} className="text-right" style={{ color: REPORT_COLORS[i] }}>
            {LABELS[i]} — {r.characterName}
          </span>
        ))}
        <span className="text-center">Δ vs best</span>
      </div>

      {rows.map((row) => (
        <AbilityRowComponent
          key={row.id}
          row={row}
          reports={reports}
          showPets={showPets}
          depth={0}
        />
      ))}
    </div>
  )
}

function AbilityRowComponent({
  row,
  reports,
  showPets,
  depth,
}: {
  row: AbilityRow
  reports: Report[]
  showPets: boolean
  depth: number
}) {
  const maxDps = Math.max(...row.values.map((v) => v.dps))
  const isChild = depth > 0
  if (isChild && !showPets) return null

  return (
    <>
      <div
        className={`grid items-center border-b border-border text-sm ${
          isChild ? 'bg-surface opacity-75' : depth % 2 === 0 ? 'bg-surface' : 'bg-surface-raised'
        }`}
        style={{
          gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px`,
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingLeft: `${16 + depth * 16}px`,
          paddingRight: '16px',
        }}
      >
        <div>
          {isChild && <span className="text-text-faint mr-1 text-xs">└</span>}
          <span className={isChild ? 'text-xs text-text-secondary' : 'font-medium text-text-primary'}>
            {row.spellName}
          </span>
          {!isChild && (
            <div className="text-xs text-text-faint">
              {row.school} · {row.values[0]?.castsPerFight.toFixed(1)}×/fight
            </div>
          )}
        </div>

        {row.values.map((v, i) => (
          <div key={i} className="text-right">
            {v.dps > 0 ? (
              <>
                <span className="font-medium text-text-primary">{Math.round(v.dps).toLocaleString()}</span>
                {v.exclusive && (
                  <span
                    className="ml-1 text-xs px-1 rounded"
                    style={{ color: REPORT_COLORS[i], border: `1px solid ${REPORT_COLORS[i]}33`, backgroundColor: `${REPORT_COLORS[i]}11` }}
                  >
                    {LABELS[i]} only
                  </span>
                )}
              </>
            ) : (
              <span className="text-text-faint">—</span>
            )}
          </div>
        ))}

        <div className="text-center text-xs">
          {maxDps > 0 && row.values.filter((v) => v.dps > 0).length > 1 ? (
            row.values.map((v, i) => {
              if (v.dps === 0) return null
              const pct = ((v.dps - maxDps) / maxDps) * 100
              if (pct === 0) return null
              const color = pct < -5 ? 'text-negative' : pct < -2 ? 'text-text-muted' : 'text-positive'
              return (
                <span key={i} className={`block ${color}`}>
                  {LABELS[i]}: {pct.toFixed(1)}%
                </span>
              )
            })
          ) : (
            <span className="text-text-faint">—</span>
          )}
        </div>
      </div>

      {row.children.map((child) => (
        <AbilityRowComponent
          key={child.id}
          row={child}
          reports={reports}
          showPets={showPets}
          depth={depth + 1}
        />
      ))}
    </>
  )
}
