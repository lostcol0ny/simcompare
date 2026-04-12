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

const NODE_RADIUS = 20
const PADDING = 40

function normalizePositions(nodes: TalentNode[]) {
  if (nodes.length === 0) return { nodes: [], width: 0, height: 0 }
  const xs = nodes.map((n) => n.col)
  const ys = nodes.map((n) => n.row)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  const scaleX = maxX === minX ? 1 : 600 / (maxX - minX)
  const scaleY = maxY === minY ? 1 : 400 / (maxY - minY)
  return {
    nodes: nodes.map((n) => ({
      ...n,
      px: PADDING + (n.col - minX) * scaleX,
      py: PADDING + (n.row - minY) * scaleY,
    })),
    width: 600 + PADDING * 2,
    height: 400 + PADDING * 2,
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
    () => normalizePositions(nodes),
    [nodes]
  )

  const posMap = useMemo(() => {
    const m = new Map<number, { px: number; py: number }>()
    for (const n of positioned) {
      const pos = n as TalentNode & { px: number; py: number }
      m.set(n.id, { px: pos.px, py: pos.py })
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
  const hoveredNodePos = hoveredNode ? (posMap.get(hoveredNode.id) ?? null) : null
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
        {/* Connection lines */}
        {positioned.map((node) =>
          node.connects.map((targetId) => {
            const target = posMap.get(targetId)
            const src = posMap.get(node.id)
            if (!target || !src) return null
            return (
              <line
                key={`${node.id}-${targetId}`}
                x1={src.px}
                y1={src.py}
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
          const pos = posMap.get(node.id)
          if (!pos) return null
          const { fill, stroke } = nodeColor(state)
          const isHovered = hovered === node.id

          return (
            <g
              key={node.id}
              transform={`translate(${pos.px},${pos.py})`}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={isHovered ? NODE_RADIUS + 3 : NODE_RADIUS}
                fill={fill}
                stroke={stroke}
                strokeWidth={state.inAll || state.inNone ? 1.5 : 2.5}
              />
              {node.iconUrl ? (
                <image
                  href={node.iconUrl}
                  x={-NODE_RADIUS + 4}
                  y={-NODE_RADIUS + 4}
                  width={(NODE_RADIUS - 4) * 2}
                  height={(NODE_RADIUS - 4) * 2}
                  style={{ opacity: state.inNone ? 0.3 : 1 }}
                />
              ) : (
                <text
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
      {hoveredNode && hoveredNodePos && hoveredState && (
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
              <p className="text-positive">
                In: {hoveredState.inSome.join(', ')}
              </p>
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
