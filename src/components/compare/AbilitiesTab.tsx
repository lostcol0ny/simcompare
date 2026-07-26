'use client'

import { useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend, LabelList,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import type { Report } from '@/lib/types'
import { buildAbilityRows, type AbilityRow } from '@/lib/abilities'
import { LABELS } from '@/lib/report-labels'
import { buildHue, buildFill } from '@/lib/build-colors'

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
    <div data-no-grid-click>
      {/* Ability breakdown chart — skipped entirely when there is nothing to
          plot, since the height formula would collapse to 40px. */}
      {topRows.length > 0 && (
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <p className="label mb-4">
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
              cursor={{ fill: 'rgba(203, 213, 225, 0.07)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-fig shadow-lg">
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
                return idx >= 0 && idx < reports.length ? `${v} — ${reports[idx].characterName}` : v
              }}
            />
            {reports.map((r, i) => (
              <Bar key={r.id} dataKey={LABELS[i]} fill={buildHue(i)} fillOpacity={0.85} radius={[0, 3, 3, 0]}>
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
      )}

      {/* Cast efficiency scatter */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <p className="label mb-4">
          Cast Efficiency — DPS per Cast vs Casts per Fight
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 4, left: 16 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="casts"
              type="number"
              scale="log"
              domain={['auto', 'auto']}
              name="Casts/fight"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              label={{ value: 'Casts / Fight (log)', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 10 }}
            />
            <YAxis
              dataKey="dpsPerCast"
              type="number"
              scale="log"
              domain={['auto', 'auto']}
              name="DPS/cast"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))}
              label={{ value: 'DPS / Cast (log)', angle: -90, position: 'insideLeft', offset: 4, fill: '#475569', fontSize: 10 }}
            />
            <ZAxis dataKey="totalDps" range={[30, 300]} name="Total DPS" />
            <Tooltip
              cursor={{ stroke: 'rgba(203, 213, 225, 0.25)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as { name: string; casts: number; dpsPerCast: number; totalDps: number; buildLabel: string }
                return (
                  <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 text-fig shadow-lg">
                    <p className="font-bold text-text-primary">{d.name}</p>
                    <p className="text-text-muted">{d.buildLabel}</p>
                    <p className="text-text-secondary">{d.casts.toFixed(1)} casts/fight</p>
                    <p className="text-text-secondary">{d.dpsPerCast >= 1000 ? `${(d.dpsPerCast / 1000).toFixed(1)}k` : Math.round(d.dpsPerCast)} DPS/cast</p>
                    <p className="text-text-secondary">{Math.round(d.totalDps).toLocaleString()} total DPS</p>
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#64748b' }}
              formatter={(v) => {
                const idx = LABELS.indexOf(v)
                return idx >= 0 && idx < reports.length ? `${v} — ${reports[idx].characterName}` : v
              }}
            />
            {reports.map((r, i) => {
              const scatterData = r.abilities
                .filter((a) => a.castsPerFight > 0 && a.dps > 0)
                .map((a) => ({
                  name: a.spellName,
                  casts: Math.round(a.castsPerFight * 10) / 10,
                  dpsPerCast: Math.round((a.dps / a.castsPerFight) * 10) / 10,
                  totalDps: a.dps,
                  buildLabel: `${LABELS[i]} — ${r.characterName}`,
                }))
              return (
                <Scatter
                  key={r.id}
                  name={LABELS[i]}
                  data={scatterData}
                  fill={buildHue(i)}
                  fillOpacity={0.7}
                />
              )
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="table-scroll" tabIndex={0} role="region" aria-label="Ability breakdown">
        {/* Table header */}
        <div className="px-4 py-2 bg-surface-raised border-b border-border text-fig text-text-muted">
          Sorted by DPS · <span className="text-accent-light">highest first</span>
        </div>

        <div
          className="grid px-4 py-[5px] bg-surface border-b border-hairline label"
          style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 60px 70px 80px` }}
        >
          <span className="pin-col">Ability</span>
          {reports.map((r, i) => (
            <span key={r.id} className="text-right" style={{ color: buildHue(i) }}>
              {LABELS[i]} — {r.characterName}
            </span>
          ))}
          <span className="text-right">CV%</span>
          <span className="text-right">DPS/Cast</span>
          <span className="text-right">Δ vs best</span>
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
        className={`grid items-center border-b border-hairline text-fig row-hover ${
          isChild
            ? 'bg-surface opacity-80'
            : 'bg-surface'
        }`}
        style={{
          gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 60px 70px 80px`,
          paddingTop: '5px',
          paddingBottom: '5px',
          paddingLeft: `${16 + depth * 16}px`,
          paddingRight: '16px',
        }}
      >
        <div className="pin-col flex items-center gap-1 min-w-0">
          {isChild && (
            <span className="text-text-faint mr-0.5 text-fig shrink-0">└</span>
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
            <span className={isChild ? 'text-fig text-text-secondary' : 'text-name font-medium text-text-primary'}>
              {row.spellName}
            </span>
            {!isChild && (row.values[0]?.castsPerFight ?? 0) > 0 && (
              <div className="text-fig text-text-faint">
                {row.school} · <span className="num">{row.values[0].castsPerFight.toFixed(1)}</span>×/fight
              </div>
            )}
          </div>
        </div>

        {row.values.map((v, i) => (
          <div key={i} className="text-right">
            {v.dps > 0 ? (
              <>
                <span className="num font-medium text-text-primary">{Math.round(v.dps).toLocaleString()}</span>
                {v.exclusive && (
                  <span
                    className="ml-1 text-fig px-1 rounded"
                    style={{
                      color: buildHue(i),
                      border: `1px solid ${buildFill(i, 0.2)}`,
                      backgroundColor: buildFill(i, 0.07),
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

        {/* CV% — coefficient of variation across builds */}
        <div className="text-right text-fig">
          {(() => {
            const present = row.values.filter((v) => v.dps > 0)
            if (present.length === 0) return <span className="text-text-faint">—</span>
            // Average CV across builds that have this ability
            const cvs = present.map((v) => v.dps > 0 && v.dpsStdDev > 0 ? (v.dpsStdDev / v.dps) * 100 : 0)
            const avgCv = cvs.reduce((s, c) => s + c, 0) / cvs.length
            if (avgCv === 0) return <span className="text-text-faint">—</span>
            const color = avgCv > 20 ? 'text-negative' : avgCv > 10 ? 'text-warning' : 'text-text-secondary'
            return <span className={`num ${color}`}>{avgCv.toFixed(1)}%</span>
          })()}
        </div>

        {/* DPS per cast */}
        <div className="text-right text-fig">
          {(() => {
            const present = row.values.filter((v) => v.dps > 0 && v.castsPerFight > 0)
            if (present.length === 0) return <span className="text-text-faint">—</span>
            const avgDpsPerCast = present.reduce((s, v) => s + v.dps / v.castsPerFight, 0) / present.length
            return <span className="num text-text-secondary">{avgDpsPerCast >= 1000 ? `${(avgDpsPerCast / 1000).toFixed(1)}k` : Math.round(avgDpsPerCast).toLocaleString()}</span>
          })()}
        </div>

        <div className="text-right text-fig">
          {maxDps > 0 && row.values.filter((v) => v.dps > 0).length > 1 ? (
            row.values.map((v, i) => {
              if (v.dps === 0) return null
              const pct = ((v.dps - maxDps) / maxDps) * 100
              if (pct === 0) return null
              const color = pct < -2 ? 'text-negative' : 'text-text-muted'
              return (
                <span key={i} className={`block num ${color}`}>
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
