'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Report, TalentTreeData, TalentNode, SelectedTalent } from '@/lib/types'
import { decodeTalentString } from '@/lib/talent-string'
import { getSpecId } from '@/lib/spec-ids'
import { LABELS } from '@/lib/report-labels'
import { buildSlotMap, mapSelections, detectHeroTree } from '@/lib/talent-decode'

interface Props {
  reports: Report[]
}


// ── Section list component ────────────────────────────────────────────────────

interface SectionProps {
  title: string
  nodes: TalentNode[]
  selections: SelectedTalent[][]
  labels: string[]
  diffsOnly: boolean
}

function SectionList({ title, nodes, selections, labels, diffsOnly }: SectionProps) {
  // Deduplicate nodes by ID (same node can appear in multiple API arrays)
  const seen = new Set<number>()
  const uniqueNodes = nodes.filter((n) => {
    if (seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })

  const rows = uniqueNodes
    .map((n) => ({
      node: n,
      picked: selections.map((sel) => sel.some((s) => s.nodeId === n.id)),
      choiceIndices: selections.map((sel) => sel.find((s) => s.nodeId === n.id)?.choiceIndex),
    }))
    .filter((r) => r.picked.some(Boolean))
    .filter((r) => !diffsOnly || !r.picked.every(Boolean))
    .sort((a, b) => a.node.row - b.node.row || a.node.col - b.node.col)

  if (rows.length === 0) return null

  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-text-faint bg-surface border-b border-border">
        {title}
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-1.5 text-left font-normal text-text-faint">Talent</th>
            {labels.map((l) => (
              <th key={l} className="px-3 py-1.5 text-center font-normal text-text-faint w-16">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, picked, choiceIndices }) => {
            const inAll = picked.every(Boolean)
            const bgClass = inAll
              ? 'bg-[#1a1030]'
              : picked[0]
              ? 'bg-[#0d2010]'
              : 'bg-[#200d0d]'
            // For choice nodes, show the name chosen by the first report that picked it
            const firstPickIdx = picked.findIndex(Boolean)
            const displayChoiceIdx = firstPickIdx !== -1 ? choiceIndices[firstPickIdx] : undefined
            const displayName = node.choiceNames && displayChoiceIdx !== undefined
              ? (node.choiceNames[displayChoiceIdx] ?? node.name)
              : node.name
            return (
              <tr key={node.id} className={`border-b border-border/30 ${bgClass}`}>
                <td className="px-3 py-1.5 flex items-center gap-2 text-text-primary">
                  {node.iconUrl && (
                    <img src={node.iconUrl} alt="" className="w-5 h-5 rounded flex-shrink-0" />
                  )}
                  {displayName}
                </td>
                {picked.map((p, i) => (
                  <td key={i} className="px-3 py-1.5 text-center">
                    {p ? <span className="text-positive font-bold">✓</span> : <span className="text-text-faint">–</span>}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SpecTreeTab({ reports }: Props) {
  const [treeData, setTreeData] = useState<TalentTreeData | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [diffsOnly, setDiffsOnly] = useState(true)
  // Manual hero-spec override: null = auto-detect
  const [heroOverride, setHeroOverride] = useState<string | null>(null)

  const specs = [...new Set(reports.map((r) => r.specialization))]
  const isCrossSpec = specs.length > 1

  const rawSelections = useMemo<SelectedTalent[][]>(
    () => reports.map((r) => { try { return decodeTalentString(r.talentString) } catch { return [] } }),
    [reports]
  )

  // Detect hero tree from raw (unmapped) selections — independent of final selections
  const detectedHeroName = useMemo((): string | null => {
    if (!treeData) return null
    return detectHeroTree(rawSelections, treeData)
  }, [treeData, rawSelections])

  const activeHeroName = heroOverride ?? detectedHeroName

  const selections = useMemo<SelectedTalent[][]>(() => {
    if (!treeData) return rawSelections
    return rawSelections.map((sel) => mapSelections(sel, treeData))
  }, [rawSelections, treeData, activeHeroName])

  const { classNodes, specNodes, heroNodes } = useMemo(() => {
    if (!treeData) return { classNodes: [], specNodes: [], heroNodes: [] }
    const classIdSet = new Set(treeData.classNodeIds)
    const specIdSet = new Set(treeData.specNodeIds)
    const activeHeroTree = (treeData.heroTrees ?? []).find((t) => t.name === activeHeroName)
    const heroIdSet = new Set(activeHeroTree?.nodeIds ?? [])

    const classNodes: TalentNode[] = []
    const specNodes: TalentNode[] = []
    const heroNodes: TalentNode[] = []
    for (const node of treeData.nodes) {
      if (classIdSet.has(node.id)) classNodes.push(node)
      else if (heroIdSet.has(node.id)) heroNodes.push(node)
      else if (specIdSet.has(node.id)) specNodes.push(node)
    }
    return { classNodes, specNodes, heroNodes }
  }, [treeData, activeHeroName])

  const diffCount = useMemo(() => {
    if (!treeData) return 0
    const allIds = new Set(selections.flatMap((sel) => sel.map((s) => s.nodeId)))
    return [...allIds].filter((id) => !selections.every((sel) => sel.some((s) => s.nodeId === id))).length
  }, [selections, treeData])

  useEffect(() => {
    if (isCrossSpec) return
    const specId = getSpecId(reports[0].specialization)
    if (!specId) { setTreeError(`Unknown spec: ${reports[0].specialization}`); return }
    fetch(`/api/talent-tree/${specId}`)
      .then((r) => { if (!r.ok) throw new Error(`API error ${r.status}`); return r.json() })
      .then((data: TalentTreeData) => setTreeData(data))
      .catch((e: Error) => setTreeError(e.message))
  }, [reports, isCrossSpec])

  if (isCrossSpec) return (
    <div className="p-4 text-text-muted text-sm">
      Cross-spec comparison — talent tree requires the same specialization.
    </div>
  )

  if (treeError) return (
    <div className="p-4 text-negative text-sm">Failed to load talent tree: {treeError}</div>
  )

  if (!treeData) return (
    <div className="p-4 text-text-muted text-sm">Loading talent tree…</div>
  )

  const labels = LABELS.slice(0, reports.length)

  return (
    <div>
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border text-xs flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Legend */}
          <LegendDot color="bg-violet-950 border-violet-700" label="All builds" />
          <LegendDot color="bg-green-950 border-green-700" label={`${LABELS[0]} only`} />
          {reports.length > 1 && (
            <LegendDot color="bg-red-950 border-red-700" label={`${LABELS[1]} only`} />
          )}
        </div>
        <div className="flex items-center gap-3 text-text-muted">
          {/* Hero spec selector */}
          {(treeData.heroTrees ?? []).length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-text-faint">Hero:</span>
              <select
                value={activeHeroName ?? ''}
                onChange={(e) => setHeroOverride(e.target.value || null)}
                className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-text-primary"
              >
                {(treeData.heroTrees ?? []).map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <span>{diffCount} difference{diffCount !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setDiffsOnly((v) => !v)}
            className="text-accent-light hover:underline"
          >
            {diffsOnly ? 'Show all' : 'Differences only'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-border">
        <SectionList title="Class" nodes={classNodes} selections={selections} labels={labels} diffsOnly={diffsOnly} />
        <SectionList title={activeHeroName ?? 'Hero'} nodes={heroNodes} selections={selections} labels={labels} diffsOnly={diffsOnly} />
        <SectionList title="Spec" nodes={specNodes} selections={selections} labels={labels} diffsOnly={diffsOnly} />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm border ${color}`} />
      <span className="text-text-muted">{label}</span>
    </div>
  )
}
