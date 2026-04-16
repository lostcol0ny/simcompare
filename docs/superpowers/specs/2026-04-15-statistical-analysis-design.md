# Statistical Analysis Features — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

Add statistical analysis and visualization features that surface insights currently hidden in the SimC data. Four features: DPS distribution curves, per-ability variance, DPS-per-cast efficiency, and burst window detection on the DPS timeline.

## 1. DPS Distribution — Overlapping Bell Curves

### Location

Timeline tab — new section between "DPS Over Time" and "Resource Timelines."

### Chart

Overlapping normal distribution curves, one per build. Each curve is computed from the build's `dps.mean` and `dps.std_dev` (the raw per-iteration std_dev, not the standard error of the mean).

- Curves use build colors: solid 2px stroke, ~12% fill opacity
- Dashed vertical line at each build's mean, labeled with the DPS value
- X-axis spans from `min(all means - 3σ)` to `max(all means + 3σ)`
- Y-axis is probability density (unlabeled — relative shape matters, not absolute values)
- The curve is rendered as an SVG `<path>` by sampling the normal PDF at ~100 points across the x-range

### Overlap Statistic

For 2 builds: probability that the lower-DPS build beats the higher on any given pull.

Formula: `P(B > A) = Φ(-Δμ / √(σ_A² + σ_B²))` where Φ is the standard normal CDF.

For N>2 builds: show pairwise overlap for each non-leader build vs. the leader (highest mean DPS). Display as "chance X beats A on any pull."

Standard normal CDF approximation: use the rational approximation from Abramowitz & Stegun (sufficient precision for display purposes, no library needed).

### Stat Pills

Three pills below the chart:

- **Overlap**: "X% chance B beats A on any pull" (or one line per non-leader build for N>2)
- **DPS Range (95% CI)**: `mean ± 1.96σ` per build, color-coded
- **Consistency**: std_dev as absolute number and as % of mean per build

### Data Source

- `StatBlock.mean` — already used
- `StatBlock.std_dev` — raw per-iteration std_dev (NOT divided by √count)
- `StatBlock.min`, `StatBlock.max` — for reference in CI pills

Currently `Report.dpsStdDev` stores `std_dev / √count` (standard error). Add new fields:
- `Report.dpsMin: number`
- `Report.dpsMax: number`  
- `Report.dpsRawStdDev: number` (the per-iteration std_dev)

## 2. Per-Ability Variance — Table Column

### Location

Abilities tab — new "Variance" column in the ability table.

### Display

- Column header: "Variance"
- Value: Coefficient of variation (CV) = `(std_dev / mean) * 100`, displayed as "4.2%"
- Color coding:
  - CV ≤ 10%: normal text color (`text-text-secondary`)
  - CV > 10%: warning color (`text-warning`)
  - CV > 20%: negative color (`text-negative`)
- Only shown for top-level abilities with DPS > 0. Children and zero-DPS rows show "—"
- Column position: after the per-build DPS columns, before the "Δ vs best" column

### Data Source

- `AbilityStat.portion_aps.std_dev` — currently not extracted
- Add `dpsStdDev: number` field to `ParsedAbility`
- Extract `stat.portion_aps?.std_dev ?? 0` in `parseAbilities()` in `raidbots.ts`

## 3. DPS Per Cast — Table Column

### Location

Abilities tab — new "Per Cast" column in the ability table.

### Display

- Column header: "Per Cast"
- Value: `dps / castsPerFight`, formatted with k-suffix for values ≥ 1000 (e.g., "2.1k")
- Show "—" when `castsPerFight === 0` (passive procs, auras)
- Only show for top-level abilities. Children show "—"
- Column position: after the Variance column, before "Δ vs best"

### Data Source

- Already available: `ParsedAbility.dps` and `ParsedAbility.castsPerFight`
- Pure computation, no new data to parse

## 4. Burst Window Detection — Timeline Enhancement

### Location

Timeline tab — enhancement to the existing "DPS Over Time" chart. Nice-to-have feature.

### Detection Algorithm

For each build independently:

1. Compute baseline = overall mean of the build's `timelineDps` array
2. Use the existing smoothed (rolling average) DPS data
3. A burst starts when smoothed DPS exceeds `1.3 × baseline` for ≥3 consecutive seconds
4. A burst ends when smoothed DPS drops below `1.1 × baseline` (lower exit threshold prevents flickering)
5. Record each burst's start time, end time, and peak DPS value

### Visual

- Translucent vertical shading behind the chart during burst windows, using each build's `REPORT_COLORS` at ~6% opacity
- Small triangle markers at the top edge of the chart at burst midpoints
- "burst" text labels above each marker

These are rendered as Recharts `<ReferenceArea>` components (for shading) and custom SVG elements (for markers/labels).

### Stat Pills

Three pills below the DPS chart (only shown if any bursts detected):

- **Burst Windows**: count per build
- **Avg Burst Peak**: average peak DPS during bursts, shown as % above baseline
- **Avg Burst Duration**: average burst length in seconds

### Edge Cases

- No bursts detected (flat profile): skip burst pills entirely, no shading
- Builds with different fight durations: detection runs independently per build
- Very short fights (<30s): skip burst detection

## 5. Data Pipeline Changes

### Types (`src/lib/types.ts`)

Add to `Report`:
```typescript
dpsMin: number        // StatBlock.min
dpsMax: number        // StatBlock.max
dpsRawStdDev: number  // StatBlock.std_dev (per-iteration, not standard error)
```

Add to `ParsedAbility`:
```typescript
dpsStdDev: number     // portion_aps.std_dev
```

### Parser (`src/lib/raidbots.ts`)

- Extract `cd.dps.min`, `cd.dps.max`, `cd.dps.std_dev` into the new Report fields
- Extract `stat.portion_aps?.std_dev ?? 0` into ParsedAbility.dpsStdDev

## 6. Files to Modify

- `src/lib/types.ts` — add fields to Report and ParsedAbility
- `src/lib/raidbots.ts` — extract additional StatBlock fields
- `src/components/compare/TimelineTab.tsx` — add DPS Distribution section, burst window detection + pills
- `src/components/compare/AbilitiesTab.tsx` — add Variance and Per Cast columns

## 7. Out of Scope

- Actual cast-timing data (not available in Raidbots JSON)
- Histogram from individual iteration DPS values (only summary stats available)
- Interactive filtering or drill-down on distributions
- Damage school composition charts
