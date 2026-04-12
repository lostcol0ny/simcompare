'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Report, TalentTreeData, SelectedTalent } from '@/lib/types'
import { decodeTalentString } from '@/lib/talent-string'
import { getSpecId } from '@/lib/spec-ids'
import { TalentTree } from './TalentTree'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

/**
 * Maps slot-index-based selections (from decodeTalentString) to actual Blizzard
 * node IDs by sorting nodes by ID ascending and using the slot index to look up.
 *
 * The WoW talent string encodes selected nodes as positional slots (0-based order
 * in ascending node-ID order). The Blizzard API returns nodes with their actual
 * game IDs. To match them up:
 * 1. Sort nodes by node.id ascending
 * 2. For each selectedTalent, use nodeId as an index into the sorted array
 * 3. Return selections with the actual node IDs
 */
function mapSlotIndicesToNodeIds(
  selections: SelectedTalent[],
  treeData: TalentTreeData
): SelectedTalent[] {
  const sortedNodes = [...treeData.nodes].sort((a, b) => a.id - b.id)
  return selections
    .filter((s) => s.nodeId < sortedNodes.length)
    .map((s) => ({
      nodeId: sortedNodes[s.nodeId].id,
      rank: s.rank,
    }))
}

export function SpecTreeTab({ reports }: Props) {
  const [treeData, setTreeData] = useState<TalentTreeData | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [diffsOnly, setDiffsOnly] = useState(false)

  const specs = [...new Set(reports.map((r) => r.specialization))]
  const isCrossSpec = specs.length > 1

  // Decode talent strings to slot-index selections
  const rawSelections = useMemo<SelectedTalent[][]>(
    () =>
      reports.map((r) => {
        try {
          return decodeTalentString(r.talentString)
        } catch {
          return []
        }
      }),
    [reports]
  )

  // Map slot indices to actual node IDs once tree data is available
  const selections = useMemo<SelectedTalent[][]>(() => {
    if (!treeData) return rawSelections
    return rawSelections.map((sel) => mapSlotIndicesToNodeIds(sel, treeData))
  }, [rawSelections, treeData])

  // Count differing nodes across all builds
  const diffCount = useMemo(() => {
    if (!treeData) return 0
    const allIds = new Set(selections.flatMap((sel) => sel.map((s) => s.nodeId)))
    return [...allIds].filter((id) => !selections.every((sel) => sel.some((s) => s.nodeId === id)))
      .length
  }, [selections, treeData])

  useEffect(() => {
    if (isCrossSpec) return
    const specId = getSpecId(reports[0].specialization)
    if (!specId) {
      setTreeError(`Unknown spec: ${reports[0].specialization}`)
      return
    }

    fetch(`/api/talent-tree/${specId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then((data: TalentTreeData) => setTreeData(data))
      .catch((e: Error) => setTreeError(e.message))
  }, [reports, isCrossSpec])

  if (isCrossSpec) {
    return (
      <div className="p-4">
        <div className="bg-negative-bg border border-negative-border rounded-lg p-4 flex gap-3 mb-6">
          <span>⚠</span>
          <div>
            <p className="text-sm font-bold text-warning mb-1">Cross-spec comparison</p>
            <p className="text-xs text-text-secondary">
              These reports use different specializations ({specs.join(' vs ')}). A unified
              tree overlay is not possible. Trees are shown separately for reference.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {reports.map((r, i) => (
            <div key={r.id} className="border border-border rounded-lg p-3">
              <p className="text-xs font-bold text-accent-light mb-2">
                {LABELS[i]} — {r.specialization}
              </p>
              <p className="text-xs text-text-faint">
                Full tree rendering requires same-spec comparison.
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (treeError) {
    return (
      <div className="p-4 text-negative text-sm">
        Failed to load talent tree: {treeError}
      </div>
    )
  }

  if (!treeData) {
    return (
      <div className="p-4 text-text-muted text-sm">
        Loading talent tree…
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border text-xs flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <LegendItem color="#4c1d95" stroke="#7c3aed" label="All builds" />
          <LegendItem color="#14532d" stroke="#4ade80" label={`${LABELS[0]} only`} />
          {reports.length > 1 && (
            <LegendItem color="#7f1d1d" stroke="#f87171" label={`${LABELS[1]} only`} />
          )}
          <LegendItem color="#1e1e2e" stroke="#334155" label="Neither" />
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <span>{diffCount} differences</span>
          <span>·</span>
          <button
            onClick={() => setDiffsOnly((v) => !v)}
            className="text-accent-light hover:underline"
          >
            {diffsOnly ? 'Show all' : 'Differences only'}
          </button>
        </div>
      </div>

      <TalentTree
        nodes={treeData.nodes}
        selections={selections}
        labels={LABELS.slice(0, reports.length)}
        diffsOnly={diffsOnly}
      />
    </div>
  )
}

function LegendItem({ color, stroke, label }: { color: string; stroke: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="14" height="14">
        <circle cx="7" cy="7" r="6" fill={color} stroke={stroke} strokeWidth="1.5" />
      </svg>
      <span className="text-text-muted">{label}</span>
    </div>
  )
}
