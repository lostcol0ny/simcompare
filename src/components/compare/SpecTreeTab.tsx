'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Report, TalentTreeData, TalentNode, SelectedTalent } from '@/lib/types'
import { decodeTalentString } from '@/lib/talent-string'
import { getSpecId } from '@/lib/spec-ids'
import { LABELS } from '@/lib/report-labels'
import { BUILD_COLORS } from '@/lib/report-labels'
import { buildSlotMap, mapSelections, detectHeroTree, filterInactiveHeroNodes } from '@/lib/talent-decode'
import { WowheadTooltipLoader, WowheadSpellLink, refreshWowheadLinks } from '@/components/WowheadTooltip'

interface Props {
  reports: Report[]
}

// ── Diff cell ────────────────────────────────────────────────────────────────

function DiffCell({ selected, colorIndex }: { selected: boolean; colorIndex: number }) {
  const color = BUILD_COLORS[colorIndex % BUILD_COLORS.length]
  return (
    <td className="px-1 py-1.5">
      <div
        className="w-[30px] h-[22px] rounded mx-auto"
        style={
          selected
            ? { background: color.fill, border: `1px solid ${color.border}` }
            : { border: '1px solid #334155' }
        }
      />
    </td>
  )
}

// ── Section list component ────────────────────────────────────────────────────

interface SectionProps {
  title: string
  nodes: TalentNode[]
  selections: SelectedTalent[][]
  labels: string[]
  diffsOnly: boolean
}

interface RowData {
  key: string
  name: string
  spellId: number
  iconUrl: string
  isChoice: boolean
  picked: boolean[]
}

function SectionList({ title, nodes, selections, labels, diffsOnly }: SectionProps) {
  // Deduplicate nodes by ID
  const seen = new Set<number>()
  const uniqueNodes = nodes.filter((n) => {
    if (seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })

  // Build rows — split choice nodes into separate rows per option
  const rows: RowData[] = []
  for (const node of uniqueNodes) {
    const perBuild = selections.map((sel) => sel.find((s) => s.nodeId === node.id))
    const anyPicked = perBuild.some(Boolean)
    if (!anyPicked) continue

    if (node.choiceNames && node.choiceNames.length > 1) {
      // Check if different builds chose different options
      const choiceIndices = perBuild.map((s) => s?.choiceIndex)
      const uniqueChoices = new Set(choiceIndices.filter((c) => c !== undefined))

      if (uniqueChoices.size > 1) {
        // Split: one row per choice option
        for (let ci = 0; ci < node.choiceNames.length; ci++) {
          const picked = perBuild.map((s) => s !== undefined && s.choiceIndex === ci)
          if (!picked.some(Boolean)) continue
          rows.push({
            key: `${node.id}-choice-${ci}`,
            name: node.choiceNames[ci],
            spellId: node.spellId,
            iconUrl: node.iconUrl,
            isChoice: true,
            picked,
          })
        }
        continue
      }
    }

    // Normal node or choice node where all builds picked the same option
    const displayName = node.choiceNames && perBuild.some(Boolean)
      ? (node.choiceNames[perBuild.find(Boolean)?.choiceIndex ?? 0] ?? node.name)
      : node.name

    rows.push({
      key: String(node.id),
      name: displayName,
      spellId: node.spellId,
      iconUrl: node.iconUrl,
      isChoice: false,
      picked: perBuild.map((s) => s !== undefined),
    })
  }

  const filteredRows = rows
    .filter((r) => !diffsOnly || !r.picked.every(Boolean))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (filteredRows.length === 0) {
    if (!diffsOnly) return null
    return (
      <div>
        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-text-faint bg-surface/50 border-b border-border">
          {title}
        </div>
        <div className="px-4 py-3 text-xs text-text-faint italic text-center">
          No differences in {title.toLowerCase()} talents
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-text-faint bg-surface/50 border-b border-border">
        {title}
      </div>
      <table className="text-xs border-collapse mx-auto">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-1.5 text-left font-normal text-text-faint">Talent</th>
            {labels.map((l, i) => (
              <th
                key={l}
                className="px-1 py-1.5 text-center font-normal w-[42px]"
                style={{ color: BUILD_COLORS[i % BUILD_COLORS.length].border }}
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.key} className="border-b border-border/30">
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-2 text-text-primary">
                  {row.iconUrl && (
                    <img src={row.iconUrl} alt="" className="w-[22px] h-[22px] rounded flex-shrink-0" />
                  )}
                  <WowheadSpellLink spellId={row.spellId}>
                    {row.name}
                  </WowheadSpellLink>
                  {row.isChoice && (
                    <span className="text-[9px] text-text-faint bg-surface-overlay px-1.5 py-0.5 rounded">
                      choice
                    </span>
                  )}
                </span>
              </td>
              {row.picked.map((p, i) => (
                <DiffCell key={i} selected={p} colorIndex={i} />
              ))}
            </tr>
          ))}
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
  const specs = [...new Set(reports.map((r) => r.specialization))]
  const isCrossSpec = specs.length > 1

  const rawSelections = useMemo<SelectedTalent[][]>(
    () => reports.map((r) => { try { return decodeTalentString(r.talentString) } catch { return [] } }),
    [reports]
  )

  const activeHeroName = useMemo((): string | null => {
    if (!treeData) return null
    // Prefer Blizzard's authoritative answer from the Raidbots envelope when
    // every report agrees. Falls back to decoder-based detection (which can
    // misfire if the cached slot map drifts from upstream SimC).
    const fromBlizzard = [
      ...new Set(reports.map((r) => r.selectedHeroName).filter((n): n is string => !!n)),
    ]
    if (fromBlizzard.length === 1) return fromBlizzard[0]
    return detectHeroTree(rawSelections, treeData)
  }, [treeData, rawSelections, reports])

  const selections = useMemo<SelectedTalent[][]>(() => {
    if (!treeData) return rawSelections
    return rawSelections.map((sel) => {
      const mapped = mapSelections(sel, treeData)
      return filterInactiveHeroNodes(mapped, treeData, activeHeroName)
    })
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

  // Refresh Wowhead links when selections or tree data change
  useEffect(() => {
    if (treeData) refreshWowheadLinks()
  }, [treeData, selections])

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
    <div data-no-grid-click>
      <WowheadTooltipLoader />

      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised/80 backdrop-blur border-b border-border text-xs flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {labels.map((l, i) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{
                  background: BUILD_COLORS[i % BUILD_COLORS.length].fill,
                  border: `1px solid ${BUILD_COLORS[i % BUILD_COLORS.length].border}`,
                }}
              />
              <span className="text-text-muted">{l}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-text-muted">
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
