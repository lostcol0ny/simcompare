# Timeline Tab Enhancements — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

Enhance the Timeline tab to serve as the visual analysis hub for build comparisons. Add three new chart sections alongside the existing DPS-over-time and resource timeline charts: a DPS breakdown with grouped horizontal bars, a buff uptime comparison chart, and resource summary stats.

## 1. DPS Breakdown — Grouped Horizontal Bars

### Layout

One row per ability (top 7 by max DPS across all builds, plus an "Other" bucket). Each row contains:

- **Ability name** (left-aligned, 120px width)
- **One horizontal bar per build**, stacked vertically within the row, each with:
  - Build label (A/B/C...) in build color
  - Bar filled proportionally to the max DPS value across all abilities/builds
  - Raw DPS number displayed inline on the bar
  - Percentage of total DPS displayed to the right of the bar
- Bar fills use `BUILD_COLORS` gradient (dark fill → bright border color)

### "Biggest Differences" Delta Grid

Below the bars, a 3-column grid showing the top 3 abilities with the largest percentage-point difference between builds. Each cell shows the ability name and per-build percentages, with the higher value highlighted in green.

### Data Source

- `Report.abilities: ParsedAbility[]` — use `dps`, `percentOfTotal`, `spellName`
- Flatten the ability tree (top-level only, children are sub-components)
- Sort by max DPS across all builds, take top 7
- "Other" = total DPS minus sum of top 7

## 2. Buff Uptime Comparison

### Layout

Horizontal bar chart with one row per buff. Each row contains:

- **Buff name** (right-aligned, 140px width)
- **One bar per build**, stacked vertically, filled to uptime percentage
- Bar fills use `BUILD_COLORS` gradient
- **Percentage labels** to the right, color-coded per build

### Filtering & Sorting

- Only show buffs with ≥5% uptime in at least one build
- Sort by maximum uptime across all builds, descending
- Note at bottom: "Showing buffs with ≥5% uptime in at least one build"

### Data Source

- `Report.buffs: ParsedBuff[]` — use `name`, `uptime` (0–100)

## 3. Resource Summary Stats

### Layout

Small stat pills displayed above each existing resource timeline chart. Three pills per resource:

- **Avg Level** — mean of the per-second resource timeline array
- **Total Generated** — sum of `actual` from all `ParsedGain` entries matching this resource
- **Overflow (wasted)** — sum of `overflow` from matching `ParsedGain` entries

Each pill shows values for all builds, color-coded with build colors, separated by " / ".

### Data Source

- `Report.resourceTimelines` — per-second arrays for avg level calculation
- `Report.gains: ParsedGain[]` — `resource`, `actual`, `overflow` fields

## 4. Section Order in Timeline Tab

1. DPS Over Time (existing, unchanged)
2. DPS Breakdown (new)
3. Buff Uptime Comparison (new)
4. Resource Timelines with summary stats (existing charts, new stats above)

## 5. Implementation Notes

- All charts use Recharts (`BarChart` with `layout="vertical"` for grouped bars)
- Build colors: `BUILD_COLORS` for bar fills/borders, consistent with talent diff display
- Scales to N builds — each row adds more bars
- No new API calls needed — all data already present on `Report` objects
- Keep the existing `TimelineTab.tsx` structure — add new sections between the DPS chart and resource charts

## 6. Files to Modify

- `src/components/compare/TimelineTab.tsx` — add DPS breakdown, buff uptime, and resource summary sections

## 7. Out of Scope

- Buff duration overlays on DPS timeline (data not available from Raidbots)
- Ability damage-type breakdown (school data exists but low value for comparison)
- Interactive filtering or drill-down on abilities
