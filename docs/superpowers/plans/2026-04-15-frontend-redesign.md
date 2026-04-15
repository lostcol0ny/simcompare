# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the SimCompare frontend with an animated spacetime grid background, enhanced talent diff table with Wowhead tooltips, and scale+fade tab transitions.

**Architecture:** Three independent visual features layered onto the existing Next.js App Router app. The grid background is a standalone canvas component mounted in the root layout. Tab transitions are CSS-driven changes to CompareLayout. The talent diff redesign rewrites SpecTreeTab's rendering while keeping its data-fetching and decode logic intact.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Canvas API, Wowhead tooltip embed script

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/GridBackground.tsx` | Create | Full-viewport canvas: grid, motes, cursor gravity, click wells, tilt-shift |
| `src/components/WowheadTooltip.tsx` | Create | Loads Wowhead tooltip script, provides helper to build spell links |
| `src/app/layout.tsx` | Modify | Mount GridBackground behind page content |
| `src/app/globals.css` | Modify | Add tab transition CSS classes, body background to match grid |
| `src/components/compare/CompareLayout.tsx` | Modify | Wrap tab panels in transition viewport with scale+fade |
| `src/components/compare/SpecTreeTab.tsx` | Modify | Rewrite SectionList: colored cells, choice splitting, Wowhead links, icons |
| `src/lib/report-labels.ts` | Modify | Add per-build fill/border color pairs for diff cells |

---

### Task 1: Build Color Definitions

**Files:**
- Modify: `src/lib/report-labels.ts`

- [ ] **Step 1: Add BUILD_COLORS array**

Each build needs a fill color (dark) and border color (bright) for the diff cells. Add this to `src/lib/report-labels.ts`:

```typescript
export const BUILD_COLORS = [
  { fill: '#14532d', border: '#4ade80' },  // A – green
  { fill: '#1e3a5f', border: '#60a5fa' },  // B – blue
  { fill: '#3d2d00', border: '#fbbf24' },  // C – yellow
  { fill: '#4a1042', border: '#e879f9' },  // D – fuchsia
  { fill: '#4a2600', border: '#fb923c' },  // E – orange
  { fill: '#1a3a3a', border: '#2dd4bf' },  // F – teal
  { fill: '#3d1010', border: '#f87171' },  // G – red
  { fill: '#1a2a4a', border: '#38bdf8' },  // H – sky
]
```

- [ ] **Step 2: Commit**

```
git add src/lib/report-labels.ts
git commit -m "feat: add per-build fill/border color pairs for diff cells"
```

---

### Task 2: GridBackground Component

**Files:**
- Create: `src/components/GridBackground.tsx`

- [ ] **Step 1: Create the GridBackground component**

This is a `'use client'` component that renders a full-viewport `<canvas>` behind all page content. Port the proven prototype from the brainstorm session (`.superpowers/brainstorm/209573-1776292512/content/refined-grid-v2.html`).

Write to `src/components/GridBackground.tsx`:

```tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'

const SPACING = 48
const DOT_RADIUS = 1.2
const INFLUENCE_RADIUS = 220
const PULL_STRENGTH = 35
const WAVE_AMP = 4
const WAVE_SPEED = 0.8

const MOTES = [
  { x: 0.3, y: 0.4, r: 180, color: [124, 58, 237] as const, speed: 0.15, phase: 0 },
  { x: 0.7, y: 0.3, r: 140, color: [59, 130, 246] as const, speed: 0.12, phase: 2 },
  { x: 0.5, y: 0.7, r: 160, color: [74, 222, 128] as const, speed: 0.1, phase: 4 },
]

interface Well {
  x: number
  y: number
  age: number
  maxAge: number
}

function wellStrength(w: Well): number {
  if (w.age < 0.05) return w.age / 0.05
  const decay = (w.age - 0.05) / (w.maxAge - 0.05)
  return Math.max(0, 1 - decay * decay)
}

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const wellsRef = useRef<Well[]>([])
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)

  const handleClick = useCallback((e: MouseEvent) => {
    // Don't trigger on UI elements
    if ((e.target as HTMLElement).closest('[data-no-grid-click]')) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    wellsRef.current.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      age: 0,
      maxAge: 0.5,
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = canvas!.offsetWidth * devicePixelRatio
      canvas!.height = canvas!.offsetHeight * devicePixelRatio
    }

    resize()
    window.addEventListener('resize', resize)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('click', handleClick)

    lastTimeRef.current = performance.now()

    let animId: number

    function draw(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now
      timeRef.current += dt

      const time = timeRef.current
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      const mouse = mouseRef.current
      const wells = wellsRef.current

      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx!.clearRect(0, 0, w, h)

      const cols = Math.ceil(w / SPACING) + 2
      const rows = Math.ceil(h / SPACING) + 2
      const offsetX = (w % SPACING) / 2
      const offsetY = (h % SPACING) / 2

      // Update wells
      for (const well of wells) well.age += dt
      const activeWells = wells.filter((wl) => wl.age < wl.maxAge)
      wellsRef.current = activeWells

      // Mote positions
      const motePos = MOTES.map((m) => ({
        x: (m.x + Math.sin(time * m.speed + m.phase) * 0.08) * w,
        y: (m.y + Math.cos(time * m.speed * 0.7 + m.phase) * 0.06) * h,
        r: m.r,
        color: m.color,
      }))

      // Compute displaced grid points
      const points: { x: number; y: number }[][] = []
      for (let row = -1; row < rows; row++) {
        points[row] = []
        for (let col = -1; col < cols; col++) {
          let bx = offsetX + col * SPACING
          let by = offsetY + row * SPACING

          bx += Math.sin(by * 0.02 + time * WAVE_SPEED) * WAVE_AMP
          by += Math.cos(bx * 0.02 + time * WAVE_SPEED * 0.8) * WAVE_AMP

          // Cursor gravity
          const cdx = bx - mouse.x
          const cdy = by - mouse.y
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy)
          if (cdist < INFLUENCE_RADIUS && cdist > 1) {
            const f = (1 - cdist / INFLUENCE_RADIUS) ** 2
            bx -= (cdx / cdist) * f * PULL_STRENGTH
            by -= (cdy / cdist) * f * PULL_STRENGTH
          }

          // Click wells
          for (const wl of activeWells) {
            const wdx = bx - wl.x
            const wdy = by - wl.y
            const wdist = Math.sqrt(wdx * wdx + wdy * wdy)
            const wellRadius = 50
            if (wdist < wellRadius && wdist > 1) {
              const f = ((1 - wdist / wellRadius) ** 2) * wellStrength(wl)
              bx -= (wdx / wdist) * f * 12
              by -= (wdy / wdist) * f * 12
            }
          }

          points[row][col] = { x: bx, y: by }
        }
      }

      // Draw grid lines
      ctx!.strokeStyle = 'rgba(100, 116, 139, 0.06)'
      ctx!.lineWidth = 0.5

      for (let row = -1; row < rows; row++) {
        ctx!.beginPath()
        for (let col = -1; col < cols; col++) {
          const p = points[row][col]
          col === -1 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)
        }
        ctx!.stroke()
      }

      for (let col = -1; col < cols; col++) {
        ctx!.beginPath()
        for (let row = -1; row < rows; row++) {
          const p = points[row][col]
          row === -1 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)
        }
        ctx!.stroke()
      }

      // Draw dots with mote/cursor illumination
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const p = points[row][col]
          let tR = 8, tG = 10, tB = 18, tA = 0.12

          for (const mote of motePos) {
            const dx = p.x - mote.x
            const dy = p.y - mote.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < mote.r) {
              const glow = ((1 - dist / mote.r) ** 2) * 0.7
              tR += mote.color[0] * glow
              tG += mote.color[1] * glow
              tB += mote.color[2] * glow
              tA += glow * 0.8
            }
          }

          const cdx2 = p.x - mouse.x
          const cdy2 = p.y - mouse.y
          const cdist2 = Math.sqrt(cdx2 * cdx2 + cdy2 * cdy2)
          if (cdist2 < INFLUENCE_RADIUS) {
            const ci = 1 - cdist2 / INFLUENCE_RADIUS
            tR += 167 * ci * ci * 0.5
            tG += 139 * ci * ci * 0.5
            tB += 250 * ci * ci * 0.5
            tA += ci * ci * 0.6
          }

          tA = Math.min(tA, 1)
          const edgeDist = Math.min(p.y, h - p.y) / (h * 0.25)
          const tiltShift = Math.min(edgeDist, 1)
          const dotR = DOT_RADIUS * (0.4 + 0.6 * tiltShift)
          const dotA = tA * (0.3 + 0.7 * tiltShift)

          ctx!.beginPath()
          ctx!.arc(p.x, p.y, dotR, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(${Math.min(Math.round(tR), 255)}, ${Math.min(Math.round(tG), 255)}, ${Math.min(Math.round(tB), 255)}, ${dotA})`
          ctx!.fill()
        }
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('click', handleClick)
    }
  }, [handleClick])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
```

- [ ] **Step 2: Verify it renders standalone**

Temporarily import into `src/app/layout.tsx` and run the dev server to check the canvas renders:

```
npx next dev
```

Open the browser and confirm the grid is visible behind the page content.

- [ ] **Step 3: Commit**

```
git add src/components/GridBackground.tsx
git commit -m "feat: add animated spacetime grid background component"
```

---

### Task 3: Mount GridBackground in Root Layout

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css body background**

Change the body background to `#050510` to match the grid's dark base, and add a relative position so the grid canvas sits behind content:

In `src/app/globals.css`, replace:

```css
body {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
}
```

with:

```css
body {
  background-color: #050510;
  color: var(--color-text-primary);
  position: relative;
}
```

- [ ] **Step 2: Mount GridBackground in layout.tsx**

Replace the contents of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { GridBackground } from '@/components/GridBackground'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SimCompare',
  description: 'Compare Raidbots simulation reports side by side',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <GridBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Run the dev server and verify**

```
npx next dev
```

Confirm the grid animates behind page content on both `/` and `/compare` routes. Verify cursor gravity and click wells work. Verify UI elements are clickable above the canvas.

- [ ] **Step 4: Commit**

```
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: mount grid background in root layout"
```

---

### Task 4: Tab Transition CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add transition classes to globals.css**

Append to `src/app/globals.css`:

```css
/* Tab panel scale+fade transitions */
.tab-viewport {
  position: relative;
}

.tab-panel {
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.tab-panel.tab-panel-active {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
  position: relative;
}
```

- [ ] **Step 2: Commit**

```
git add src/app/globals.css
git commit -m "feat: add scale+fade tab transition CSS"
```

---

### Task 5: Wire Tab Transitions into CompareLayout

**Files:**
- Modify: `src/components/compare/CompareLayout.tsx`

- [ ] **Step 1: Wrap tab content in transition viewport**

Replace the tab content rendering section in `src/components/compare/CompareLayout.tsx`. Change:

```tsx
      <div className="flex-1">
        <div className={`mx-auto w-full ${maxWidth}`}>
          {activeTab === 'summary' && <SummaryTab reports={namedReports} onRename={handleRename} onRemove={handleRemoveReport} />}
          {activeTab === 'abilities' && <AbilitiesTab reports={namedReports} />}
          {activeTab === 'talents' && <SpecTreeTab reports={namedReports} />}
          {activeTab === 'stats' && <StatsTab reports={namedReports} />}
          {activeTab === 'timeline' && <TimelineTab reports={namedReports} />}
          {activeTab === 'buffs' && <BuffsTab reports={namedReports} />}
        </div>
      </div>
```

to:

```tsx
      <div className="flex-1">
        <div className={`mx-auto w-full ${maxWidth} tab-viewport`}>
          <div className={`tab-panel ${activeTab === 'summary' ? 'tab-panel-active' : ''}`}>
            <SummaryTab reports={namedReports} onRename={handleRename} onRemove={handleRemoveReport} />
          </div>
          <div className={`tab-panel ${activeTab === 'abilities' ? 'tab-panel-active' : ''}`}>
            <AbilitiesTab reports={namedReports} />
          </div>
          <div className={`tab-panel ${activeTab === 'talents' ? 'tab-panel-active' : ''}`}>
            <SpecTreeTab reports={namedReports} />
          </div>
          <div className={`tab-panel ${activeTab === 'stats' ? 'tab-panel-active' : ''}`}>
            <StatsTab reports={namedReports} />
          </div>
          <div className={`tab-panel ${activeTab === 'timeline' ? 'tab-panel-active' : ''}`}>
            <TimelineTab reports={namedReports} />
          </div>
          <div className={`tab-panel ${activeTab === 'buffs' ? 'tab-panel-active' : ''}`}>
            <BuffsTab reports={namedReports} />
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Run the dev server and verify transitions**

```
npx next dev
```

Navigate to `/compare` with reports loaded. Click between tabs and verify the scale+fade animation plays. Confirm that inactive tabs don't intercept clicks or show content.

- [ ] **Step 3: Commit**

```
git add src/components/compare/CompareLayout.tsx
git commit -m "feat: add scale+fade transitions to tab panels"
```

---

### Task 6: WowheadTooltip Component

**Files:**
- Create: `src/components/WowheadTooltip.tsx`

- [ ] **Step 1: Create the tooltip script loader**

Wowhead's tooltip system works by auto-detecting `<a href="https://www.wowhead.com/spell=XXXXX">` links on the page and attaching hover tooltips. We need to: (a) load their script, and (b) provide a helper component for rendering spell links.

Write to `src/components/WowheadTooltip.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    $WowheadPower?: { refreshLinks?: () => void }
    whTooltips?: { colorLinks: boolean; iconizeLinks: boolean; renameLinks: boolean }
  }
}

/**
 * Loads the Wowhead tooltip script once. Mount this component anywhere
 * in the tree that uses WowheadSpellLink — it's safe to mount multiple times.
 */
export function WowheadTooltipLoader() {
  useEffect(() => {
    // Configure before script loads
    window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false }

    if (document.getElementById('wowhead-tooltip-script')) return

    const script = document.createElement('script')
    script.id = 'wowhead-tooltip-script'
    script.src = 'https://wow.zamimg.com/js/tooltips.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  return null
}

/**
 * After dynamic content renders (e.g. talent list), call this to make
 * Wowhead re-scan the page for new spell links.
 */
export function refreshWowheadLinks() {
  window.$WowheadPower?.refreshLinks?.()
}

interface SpellLinkProps {
  spellId: number
  children: React.ReactNode
  className?: string
}

/**
 * Renders an anchor tag that Wowhead's tooltip script will auto-enhance.
 */
export function WowheadSpellLink({ spellId, children, className }: SpellLinkProps) {
  if (!spellId) return <span className={className}>{children}</span>

  return (
    <a
      href={`https://www.wowhead.com/spell=${spellId}`}
      data-wowhead={`spell=${spellId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px dotted #475569' }}
    >
      {children}
    </a>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/components/WowheadTooltip.tsx
git commit -m "feat: add Wowhead tooltip script loader and spell link component"
```

---

### Task 7: Rewrite SpecTreeTab Talent Diff Display

**Files:**
- Modify: `src/components/compare/SpecTreeTab.tsx`

This is the largest task. We rewrite the `SectionList` sub-component to use colored cells, split choice nodes into separate rows, integrate Wowhead links, and keep icons.

- [ ] **Step 1: Add imports and update SectionList**

Replace the entire `src/components/compare/SpecTreeTab.tsx` file. The data-fetching and decode logic stays the same. The rendering changes:

```tsx
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
      <table className="w-full text-xs border-collapse">
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
  const [heroOverride, setHeroOverride] = useState<string | null>(null)

  const specs = [...new Set(reports.map((r) => r.specialization))]
  const isCrossSpec = specs.length > 1

  const rawSelections = useMemo<SelectedTalent[][]>(
    () => reports.map((r) => { try { return decodeTalentString(r.talentString) } catch { return [] } }),
    [reports]
  )

  const detectedHeroName = useMemo((): string | null => {
    if (!treeData) return null
    return detectHeroTree(rawSelections, treeData)
  }, [treeData, rawSelections])

  const activeHeroName = heroOverride ?? detectedHeroName

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
```

- [ ] **Step 2: Run the dev server and verify**

```
npx next dev
```

Load two Warlock builds and verify:
1. Colored cells appear (green/blue) instead of checkmarks
2. Choice node diffs are split into separate rows with "choice" badge
3. Talent icons show next to names
4. Wowhead tooltips appear on hover (may take a moment for the script to load)
5. "Differences only" mode works
6. Hero section shows correct tree name

- [ ] **Step 3: Run existing tests**

```
npx vitest run
```

Verify talent string tests still pass (SpecTreeTab has no unit tests — it's a rendering component).

- [ ] **Step 4: Commit**

```
git add src/components/compare/SpecTreeTab.tsx
git commit -m "feat: redesign talent diff display with colored cells, choice splitting, Wowhead tooltips"
```

---

### Task 8: Visual Polish Pass

**Files:**
- Modify: `src/components/compare/CompareLayout.tsx`
- Modify: `src/components/compare/StickyHeader.tsx` (if exists, for glassmorphic treatment)

- [ ] **Step 1: Add glassmorphic backdrop to surfaces**

UI surfaces should be semi-transparent with backdrop blur so the grid shows through. In `CompareLayout.tsx`, update the outer container class:

Change:

```tsx
    <div className="min-h-screen flex flex-col">
```

to:

```tsx
    <div className="min-h-screen flex flex-col" data-no-grid-click>
```

This ensures clicks inside the compare layout don't trigger grid wells.

- [ ] **Step 2: Run type check**

```
npx tsc --noEmit
```

Verify no type errors.

- [ ] **Step 3: Run tests**

```
npx vitest run
```

Verify all existing tests pass.

- [ ] **Step 4: Commit**

```
git add src/components/compare/CompareLayout.tsx
git commit -m "feat: add glassmorphic treatment and grid click exclusion to compare layout"
```

---

### Task 9: Deploy and Verify

- [ ] **Step 1: Build for production**

```
npx next build
```

Verify no build errors.

- [ ] **Step 2: Deploy to Vercel**

```
npx vercel --prod
```

- [ ] **Step 3: Verify on production**

Open the deployed URL and check:
1. Grid background animates on both `/` and `/compare` pages
2. Cursor gravity and click wells work
3. Tab transitions play when switching tabs
4. Talent diff shows colored cells, icons, choice splitting
5. Wowhead tooltips load on hover
6. Performance is acceptable (no jank or excessive CPU)

- [ ] **Step 4: Commit any final fixes if needed**
