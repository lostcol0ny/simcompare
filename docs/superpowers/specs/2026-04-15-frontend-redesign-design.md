# SimCompare Frontend Redesign — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

Redesign the SimCompare frontend with three focus areas: an improved talent diff display, an interactive animated background, and polished tab transitions. The visual direction is inspired by Geometry Wars — neon-on-dark with reactive, physics-based elements.

## 1. Talent Diff Display

### Layout: Enhanced Table with Colored Cells

Replace the current checkmark table with colored cells per build column.

- **Selected**: cell filled with the build's color (green A, blue B, yellow C, etc.)
- **Not selected**: hollow cell with a faint border (`#334155`)
- **Icons**: 22×22px Blizzard spell icons (already fetched by the talent-tree API route) displayed next to each talent name
- **Sections**: Class → Hero (named, e.g. "Diabolist") → Spec, each with its own uppercase header
- **Default**: diffs-only (talents where at least one build differs); "Show all" toggle available
- **Scales to N builds**: each build gets a narrow column — works for 2–6+ reports

### Choice Nodes

When builds pick different options from the same choice node, split into separate rows — one per choice option. Each row tagged with a `choice` badge. This makes diffs scannable: you see "Build A took X, Build B took Y" without reading cell labels.

### Wowhead Tooltips

Integrate Wowhead's embed tooltip script for rich hover tooltips on talent names.

- Add `<script src="https://wow.zamimg.com/js/tooltips.js">` to the page
- Render talent names as `<a href="https://www.wowhead.com/spell={spellId}">` links
- Wowhead's script auto-attaches tooltips to these links on hover
- Provides full in-game tooltip: description, cooldown, range, resource cost
- No additional API calls needed — Wowhead handles everything client-side

### Build Colors

Keep the current palette:
- Build A: green (`#4ade80` border, `#14532d` fill)
- Build B: blue (`#60a5fa` border, `#1e3a5f` fill)
- Build C: yellow (`#fbbf24` border, `#3d2d00` fill)
- Additional builds: extend with distinct colors as needed

## 2. Animated Background

### Spacetime Grid

A full-viewport canvas behind all page content. Dark background (`#050510`) with:

- **Grid**: dots at 48px spacing connected by faint lines (`rgba(100, 116, 139, 0.06)`), dot radius ~1.2px
- **Wave undulation**: gentle sine-based drift (amplitude 4px, speed 0.8) giving the grid organic movement
- **Motes of light**: 3 colored blobs (purple `[124,58,237]`, blue `[59,130,246]`, green `[74,222,128]`) that drift slowly across the canvas, illuminating nearby grid points with a quadratic falloff (radius ~140–180px)
- **Tilt-shift**: dots near the top/bottom viewport edges fade and shrink, creating depth

### Cursor Interaction

- **Gravity well**: grid points within 220px of the cursor are pulled toward it with quadratic falloff, max displacement ~35px. Creates a "spacetime warping" effect.
- **Click blip**: clicking the background creates a temporary gravity well (50px radius, 12px max pull, 0.5s duration with fast ramp-up and quadratic decay). Just grid deformation, no particles or visual effects.

### Performance

- Canvas renders at `devicePixelRatio` for crisp dots on HiDPI displays
- Grid computation is O(rows × cols) per frame — lightweight for typical viewport sizes
- `requestAnimationFrame` loop with dt clamping (max 50ms) for consistent behavior
- UI content sits above the canvas with `backdrop-filter: blur(12px)` glassmorphic cards

## 3. Tab Transitions

### Scale + Fade

When switching between tabs (Summary, Talents, Stats, Abilities, etc.):

- **Outgoing panel**: opacity → 0, scale → 0.92, over 300ms ease
- **Incoming panel**: opacity 0 → 1, scale 0.92 → 1, over 300ms ease
- Panels are absolutely positioned in a viewport container; only the active panel receives pointer events
- Gives a sense of depth — content zooms in from behind rather than just appearing

### Implementation

CSS transitions on `.tab-panel`:
```css
.tab-panel {
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.tab-panel.active {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
```

## 4. Files to Create/Modify

### New Files
- `src/components/GridBackground.tsx` — canvas-based animated background component
- `src/components/WowheadTooltip.tsx` — script loader for Wowhead tooltip integration

### Modified Files
- `src/components/compare/SpecTreeTab.tsx` — rewrite SectionList to use colored cells, choice node splitting, Wowhead links
- `src/app/layout.tsx` — add GridBackground as a page-level background behind all content
- `src/app/globals.css` — add tab transition CSS classes
- `src/components/compare/CompareLayout.tsx` — add scale+fade transition classes to tab panels

## 5. Out of Scope

- Tree graph view (existing `TalentTree.tsx` SVG component) — keep as-is, not replacing
- Color scheme overhaul — keeping current palette
- Mobile-specific optimizations for the background (can revisit if performance is an issue)
- Spell description data from Blizzard API (Wowhead handles this)
