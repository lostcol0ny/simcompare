'use client'

import { useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend, LabelList,
} from 'recharts'
import type { Report } from '@/lib/types'
import { buildAbilityRows, type AbilityRow } from '@/lib/abilities'
import { LABELS, REPORT_COLORS } from '@/lib/report-labels'

interface Props {
  reports: Report[]
}

export function AbilitiesTab({ reports }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const rows = buildAbilityRows(reports)

  const toggleRow = useCallback((id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Top 10 non-empty abilities for the chart
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
              <Bar key={r.id} dataKey={LABELS[i]} fill={REPORT_COLORS[i]} fillOpacity={0.85} radius={[0, 3, 3, 0]}>
                <LabelList
                  dataKey={LABELS[i]}
                  position="right"
                  fill="#94a3b8"
                  fontSize={10}
                  formatter={(v) => { const n = Number(v); return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table header */}
      <div className="px-4 py-2 bg-surface-raised border-b border-border text-xs text-text-muted">
        Sorted by DPS · <span className="text-accent-light">highest first</span>
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
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          depth={0}
        />
      ))}
    </div>
  )
}

function AbilityRowComponent({
  row,
  reports,
  expandedRows,
  toggleRow,
  depth,
}: {
  row: AbilityRow
  reports: Report[]
  expandedRows: Set<number>
  toggleRow: (id: number) => void
  depth: number
}) {
  const maxDps = Math.max(...row.values.map((v) => v.dps))
  const isChild = depth > 0
  const hasChildren = row.children.length > 0
  const isExpanded = expandedRows.has(row.id)

  return (
    <>
      <div
        className={`grid items-center border-b border-border text-sm row-hover ${
          isChild
            ? 'bg-surface opacity-80'
            : depth % 2 === 0
            ? 'bg-surface'
            : 'bg-surface-raised'
        }`}
        style={{
          gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px`,
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingLeft: `${16 + depth * 16}px`,
          paddingRight: '16px',
        }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {isChild && (
            <span className="text-text-faint mr-0.5 text-xs shrink-0">└</span>
          )}

          {/* Expand/collapse arrow for rows with children */}
          {hasChildren ? (
            <button
              onClick={() => toggleRow(row.id)}
              className="shrink-0 w-4 h-4 flex items-center justify-center text-text-muted hover:text-accent-light transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                viewBox="0 0 12 12"
                width="10"
                height="10"
                fill="currentColor"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
              >
                <path d="M4 2l5 4-5 4V2z" />
              </svg>
            </button>
          ) : (
            /* placeholder to keep alignment consistent */
            !isChild && <span className="w-4 shrink-0" />
          )}

          <div className="min-w-0">
            <span className={isChild ? 'text-xs text-text-secondary' : 'font-medium text-text-primary'}>
              {row.spellName}
            </span>
            {!isChild && (row.values[0]?.castsPerFight ?? 0) > 0 && (
              <div className="text-xs text-text-faint">
                {row.school} · {row.values[0].castsPerFight.toFixed(1)}×/fight
              </div>
            )}
          </div>
        </div>

        {row.values.map((v, i) => (
          <div key={i} className="text-right">
            {v.dps > 0 ? (
              <>
                <span className="font-medium text-text-primary">{Math.round(v.dps).toLocaleString()}</span>
                {v.exclusive && (
                  <span
                    className="ml-1 text-xs px-1 rounded"
                    style={{
                      color: REPORT_COLORS[i],
                      border: `1px solid ${REPORT_COLORS[i]}33`,
                      backgroundColor: `${REPORT_COLORS[i]}11`,
                    }}
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
              const color = pct < -2 ? 'text-negative' : 'text-text-muted'
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

      {/* Children only render when expanded */}
      {isExpanded &&
        row.children.map((child) => (
          <AbilityRowComponent
            key={child.id}
            row={child}
            reports={reports}
            expandedRows={expandedRows}
            toggleRow={toggleRow}
            depth={depth + 1}
          />
        ))}
    </>
  )
}
