'use client'

import { useState, useEffect } from 'react'
import type { Report, TalentTreeData } from '@/lib/types'
import { getClassColor } from '@/lib/wow-icons'
import { getSpecId } from '@/lib/spec-ids'
import { decodeTalentString } from '@/lib/talent-string'
import { LABELS, REPORT_COLORS } from '@/lib/report-labels'
import { buildSlotMap, detectHeroTree } from '@/lib/talent-decode'

interface Props {
  reports: Report[]
  onRename: (index: number, name: string) => void
  onRemove: (index: number) => void
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function fmtK(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString()
}

// ── DPS Distribution helpers ─────────────────────────────────────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const t = 1 / (1 + p * Math.abs(x))
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2)
  return 0.5 * (1 + sign * y)
}

function normalPDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return x === mean ? 1 : 0
  const z = (x - mean) / stdDev
  return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI))
}

function overlapProbability(mean1: number, sd1: number, mean2: number, sd2: number): number {
  const combinedSd = Math.sqrt(sd1 * sd1 + sd2 * sd2)
  if (combinedSd <= 0) return mean2 > mean1 ? 1 : 0
  return normalCDF((mean2 - mean1) / combinedSd)
}

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

function buildDistributionFill(
  mean: number, stdDev: number, xMin: number, xMax: number,
  width: number, height: number, maxPdf: number, samples = 100
): string {
  const path = buildDistributionPath(mean, stdDev, xMin, xMax, width, height, maxPdf, samples)
  return `${path} L ${width},${height} L 0,${height} Z`
}

export function SummaryTab({ reports, onRename, onRemove }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [treesBySpec, setTreesBySpec] = useState<Map<number, TalentTreeData>>(new Map())

  // Fetch talent trees for hero spec icon detection
  useEffect(() => {
    const specIds = [
      ...new Set(
        reports
          .map((r) => getSpecId(r.specialization))
          .filter((id): id is number => id !== null)
      ),
    ]
    Promise.all(
      specIds.map((specId) =>
        fetch(`/api/talent-tree/${specId}`)
          .then((r) => (r.ok ? (r.json() as Promise<TalentTreeData>) : null))
          .then((data) => (data ? ([specId, data] as [number, TalentTreeData]) : null))
          .catch(() => null)
      )
    ).then((results) => {
      const map = new Map<number, TalentTreeData>()
      results.forEach((r) => { if (r) map.set(r[0], r[1]) })
      setTreesBySpec(map)
    })
  }, [reports])

  function getHeroInfo(report: Report): { name: string; iconUrl: string } {
    const specId = getSpecId(report.specialization)
    if (!specId) return { name: '', iconUrl: '' }
    const treeData = treesBySpec.get(specId)
    if (!treeData?.heroTrees?.length) return { name: '', iconUrl: '' }

    let rawSelections
    try {
      rawSelections = decodeTalentString(report.talentString)
    } catch {
      return { name: '', iconUrl: '' }
    }

    const activeHeroName = detectHeroTree([rawSelections], treeData)
    if (!activeHeroName) return { name: '', iconUrl: '' }

    const activeTree = treeData.heroTrees.find((t) => t.name === activeHeroName)
    if (!activeTree) return { name: activeHeroName, iconUrl: '' }

    const nodeById = new Map(treeData.nodes.map((n) => [n.id, n]))
    const heroNodes = activeTree.nodeIds
      .filter((id) => nodeById.has(id))
      .map((id) => nodeById.get(id)!)

    // Primary: node whose name matches the hero tree name (the spec identity talent)
    const identityNode = heroNodes.find(
      (n) => n.name.toLowerCase() === activeHeroName.toLowerCase()
    )
    if (identityNode?.iconUrl) return { name: activeHeroName, iconUrl: identityNode.iconUrl }

    // Fallback: capstone node (highest row) of the active hero tree
    const slotIds = buildSlotMap(treeData)
    const selectedIds = new Set(
      rawSelections
        .filter((s) => s.nodeId < slotIds.length && s.rank > 0)
        .map((s) => slotIds[s.nodeId])
    )
    const capstone = heroNodes
      .filter((n) => selectedIds.has(n.id))
      .sort((a, b) => b.row - a.row || b.col - a.col)[0]
    return { name: activeHeroName, iconUrl: capstone?.iconUrl ?? '' }
  }

  function copyTalents(idx: number, str: string) {
    navigator.clipboard.writeText(str)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }
  const maxDps = Math.max(...reports.map((r) => r.dps))
  const minDps = Math.min(...reports.map((r) => r.dps))
  const leadIdx = reports.findIndex((r) => r.dps === maxDps)
  const delta = (((maxDps - minDps) / minDps) * 100).toFixed(1)

  return (
    <div>
      {/* Report identity cards */}
      <div className="flex divide-x divide-border border-b border-border">
        {reports.map((r, i) => {
          const specId = getSpecId(r.specialization)
          const iconUrl = (specId && treesBySpec.get(specId)?.specIconUrl) || ''
          const { name: heroName, iconUrl: heroIconUrl } = getHeroInfo(r)
          const classColor = getClassColor(r.specialization)
          const isLeader = i === leadIdx && reports.length > 1
          return (
            <div
              key={r.id}
              className="flex-1 p-5 min-w-0 relative"
              style={{ background: `linear-gradient(180deg, ${classColor}14 0%, transparent 72px)` }}
            >
              {/* Remove report button */}
              <button
                onClick={() => onRemove(i)}
                className="absolute top-2 right-2 text-text-faint hover:text-negative transition-colors"
                aria-label="Remove report"
                title="Remove this report"
              >
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
                </svg>
              </button>

              <div className="flex items-center gap-3 mb-3">
                {/* Spec icon with hero spec overlay */}
                <div className="relative shrink-0">
                  {iconUrl && (
                    <img
                      src={iconUrl}
                      alt={r.specialization}
                      className="w-14 h-14 rounded-full border-2"
                      style={{ borderColor: classColor }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  {heroIconUrl && (
                    <img
                      src={heroIconUrl}
                      alt="hero spec"
                      className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full border-2"
                      style={{ borderColor: 'var(--color-surface)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-text-faint uppercase tracking-wide">
                    <span
                      className="inline-block w-4 h-4 rounded-full mr-1 align-middle"
                      style={{ backgroundColor: REPORT_COLORS[i] }}
                    />
                    {LABELS[i]}
                  </p>
                  {editingIndex === i ? (
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        onRename(i, editValue.trim())
                        setEditingIndex(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { onRename(i, editValue.trim()); setEditingIndex(null) }
                        if (e.key === 'Escape') setEditingIndex(null)
                      }}
                      className="font-semibold text-sm w-full rounded border border-accent bg-surface px-1 focus:outline-none"
                      style={{ color: classColor }}
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingIndex(i); setEditValue(r.characterName) }}
                      className="group flex items-center gap-1 text-left"
                      title="Click to rename"
                    >
                      <span className="font-semibold text-sm truncate" style={{ color: classColor }}>
                        {r.characterName}
                      </span>
                      <span className="text-text-faint opacity-0 group-hover:opacity-100 text-xs transition-opacity">✎</span>
                    </button>
                  )}
                  <p className="text-xs text-text-muted truncate">
                    {heroName ? `${heroName} ${r.specialization}` : r.specialization}
                  </p>
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

              <button
                onClick={() => copyTalents(i, r.talentString)}
                className="mt-2 text-xs px-2 py-0.5 rounded border border-border text-text-muted hover:text-accent-light hover:border-accent transition-colors"
              >
                {copiedIdx === i ? '✓ Copied' : 'Copy talents'}
              </button>

              <div className="mt-3 space-y-0.5 text-xs text-text-secondary">
                <p>{r.fightStyle} · {r.targetCount} {r.targetCount === 1 ? 'target' : 'targets'} · {r.fightDuration}s ±{Math.round(r.varyLength * 100)}%</p>
                <p className="text-text-faint">{r.race}</p>
                {r.setBonus && (
                  <p className="text-xs mt-0.5">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        color: REPORT_COLORS[i],
                        backgroundColor: `${REPORT_COLORS[i]}18`,
                        border: `1px solid ${REPORT_COLORS[i]}40`,
                      }}
                    >
                      {r.setBonus.pieces}pc {r.setBonus.setName}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* DPS Distribution */}
      {reports.length >= 2 && reports.every((r) => r.dpsRawStdDev > 0) && (() => {
        const leaderIdx = reports.reduce((best, r, i) => r.dps > reports[best].dps ? i : best, 0)
        const DIST_W = 600, DIST_H = 180
        const xMin = Math.min(...reports.map((r) => r.dps - 3.5 * r.dpsRawStdDev))
        const xMax = Math.max(...reports.map((r) => r.dps + 3.5 * r.dpsRawStdDev))
        const maxPdf = Math.max(...reports.map((r) => normalPDF(r.dps, r.dps, r.dpsRawStdDev)))
        return (
          <div className="px-4 pt-6 pb-4 border-b border-border">
            <p className="text-xs text-text-faint uppercase tracking-wide mb-4">DPS Distribution</p>
            <div className="bg-surface-raised border border-border rounded-lg p-4">
              <svg viewBox={`0 0 ${DIST_W} ${DIST_H + 20}`} className="w-full" style={{ maxHeight: 220 }}>
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
                {Array.from({ length: 6 }, (_, i) => {
                  const val = xMin + (xMax - xMin) * (i / 5)
                  const px = (i / 5) * DIST_W
                  return <text key={i} x={px} y={DIST_H + 14} fill="#475569" fontSize={9} textAnchor="middle">{fmtK(val)}</text>
                })}
              </svg>

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
        )
      })()}

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
    <div className="flex items-center gap-2 rounded px-1 -mx-1 py-0.5 row-hover">
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
