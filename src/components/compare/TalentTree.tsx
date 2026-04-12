'use client'

import { useState, useMemo } from 'react'
import type { TalentNode, SelectedTalent } from '@/lib/types'

interface Props {
  nodes: TalentNode[]
  selections: SelectedTalent[][]  // one per report, nodeId = actual Blizzard node ID
  labels: string[]
  diffsOnly?: boolean
}

interface NodeState {
  inAll: boolean
  inNone: boolean
  inSome: string[]  // labels of reports that have this node
}

// Each display_row/col unit = this many pixels. Chosen so nodes don't overlap
// (NODE_RADIUS * 2 = 44px diameter, CELL_SIZE = 52px → 8px gap minimum)
const CELL_SIZE = 52
const NODE_RADIUS = 22
const PADDING = NODE_RADIUS + 10

interface PositionedNode extends TalentNode {
  px: number
  py: number
}

function computeLayout(nodes: TalentNode[]): {
  nodes: PositionedNode[]
  width: number
  height: number
} {
  if (nodes.length === 0) return { nodes: [], width: 0, height: 0 }

  const cols = nodes.map((n) => n.col)
  const rows = nodes.map((n) => n.row)
  const minCol = Math.min(...cols)
  const minRow = Math.min(...rows)
  const maxCol = Math.max(...cols)
  const maxRow = Math.max(...rows)

  return {
    nodes: nodes.map((n) => ({
      ...n,
      px: PADDING + (n.col - minCol) * CELL_SIZE,
      py: PADDING + (n.row - minRow) * CELL_SIZE,
    })),
    width: (maxCol - minCol) * CELL_SIZE + PADDING * 2,
    height: (maxRow - minRow) * CELL_SIZE + PADDING * 2,
  }
}

export function TalentTree({ nodes, selections, labels, diffsOnly = false }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  const nodeStates = useMemo<Map<number, NodeState>>(() => {
    const map = new Map<number, NodeState>()
    for (const node of nodes) {
      const inSome = selections
        .map((sel, i) => (sel.some((s) => s.nodeId === node.id) ? labels[i] : null))
        .filter(Boolean) as string[]
      map.set(node.id, {
        inAll: inSome.length === selections.length,
        inNone: inSome.length === 0,
        inSome,
      })
    }
    return map
  }, [nodes, selections, labels])

  const { nodes: positioned, width, height } = useMemo(
    () => computeLayout(nodes),
    [nodes]
  )

  const posMap = useMemo(() => {
    const m = new Map<number, { px: number; py: number }>()
    for (const n of positioned) {
      m.set(n.id, { px: n.px, py: n.py })
    }
    return m
  }, [positioned])

  function nodeColor(state: NodeState): { fill: string; stroke: string } {
    if (state.inAll) return { fill: '#4c1d95', stroke: '#7c3aed' }
    if (state.inNone) return { fill: '#1e1e2e', stroke: '#334155' }
    if (state.inSome.length === 1 && state.inSome[0] === labels[0])
      return { fill: '#14532d', stroke: '#4ade80' }
    if (state.inSome.length === 1 && labels[1] && state.inSome[0] === labels[1])
      return { fill: '#7f1d1d', stroke: '#f87171' }
    return { fill: '#1e3a5f', stroke: '#60a5fa' }
  }

  const hoveredNode = hovered != null ? positioned.find((n) => n.id === hovered) : null
  const hoveredState = hovered != null ? nodeStates.get(hovered) : null

  if (width === 0 || height === 0) {
    return <div className="p-4 text-text-muted text-sm">No nodes to display.</div>
  }

  return (
    <div className="relative overflow-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Clip paths for circular icon masking — one per node, in SVG root space */}
        <defs>
          {positioned.map((node) => (
            <clipPath key={`clip-${node.id}`} id={`clip-${node.id}`}>
              <circle cx={node.px} cy={node.py} r={NODE_RADIUS - 2} />
            </clipPath>
          ))}
        </defs>

        {/* Connection lines */}
        {positioned.map((node) =>
          node.connects.map((targetId) => {
            const target = posMap.get(targetId)
            if (!target) return null
            return (
              <line
                key={`${node.id}-${targetId}`}
                x1={node.px}
                y1={node.py}
                x2={target.px}
                y2={target.py}
                stroke="#334155"
                strokeWidth={1.5}
              />
            )
          })
        )}

        {/* Nodes */}
        {positioned.map((node) => {
          const state = nodeStates.get(node.id)!
          if (diffsOnly && (state.inAll || state.inNone)) return null
          const { fill, stroke } = nodeColor(state)
          const isHovered = hovered === node.id
          const r = isHovered ? NODE_RADIUS + 3 : NODE_RADIUS

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={node.px}
                cy={node.py}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={state.inAll || state.inNone ? 1.5 : 2.5}
              />
              {node.iconUrl ? (
                <image
                  href={node.iconUrl}
                  x={node.px - (NODE_RADIUS - 2)}
                  y={node.py - (NODE_RADIUS - 2)}
                  width={(NODE_RADIUS - 2) * 2}
                  height={(NODE_RADIUS - 2) * 2}
                  clipPath={`url(#clip-${node.id})`}
                  style={{ opacity: state.inNone ? 0.25 : 1 }}
                />
              ) : (
                <text
                  x={node.px}
                  y={node.py}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={7}
                  fill={state.inNone ? '#475569' : '#c4b5fd'}
                >
                  {node.name.slice(0, 8)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredNode && hoveredState && (
        <div
          className="absolute top-2 right-2 bg-surface-overlay border border-border rounded-lg p-3 max-w-xs text-xs shadow-lg"
          style={{ pointerEvents: 'none' }}
        >
          <p className="font-bold text-text-primary mb-1">{hoveredNode.name}</p>
          <p className="text-text-muted mb-2">Max rank: {hoveredNode.maxRank}</p>
          {hoveredState.inAll && (
            <p className="text-accent-light">Selected in all builds</p>
          )}
          {hoveredState.inNone && (
            <p className="text-text-faint">Not selected in any build</p>
          )}
          {!hoveredState.inAll && !hoveredState.inNone && (
            <>
              <p className="text-positive">In: {hoveredState.inSome.join(', ')}</p>
              <p className="text-negative">
                Not in: {labels.filter((l) => !hoveredState.inSome.includes(l)).join(', ')}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
