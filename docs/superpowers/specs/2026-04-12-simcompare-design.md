# SimCompare — Design Spec

**Date:** 2026-04-12  
**Status:** Approved  
**Primary user:** Kalamazi (WoW warlock content creator)  
**Secondary use:** Personal use by the author; shareable comparison links

---

## Overview

SimCompare is a Next.js web app deployed on Vercel that lets users compare multiple Raidbots DPS simulation reports side by side. The primary workflow is: paste 2–4 report URLs → see a structured comparison across DPS summary, ability breakdown, talent tree, and character stats. Comparisons are shareable via URL — no accounts, no database.

---

## Problem Being Solved

Kalamazi regularly compares multiple Raidbots simulation reports when making warlock guides. Currently he tabs between multiple browser windows, which is error-prone and difficult to present on screen. SimCompare replaces that workflow with a single structured comparison page that can also be shared as a link.

---

## Tech Stack

- **Framework:** Next.js (App Router) deployed on Vercel
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Data source:** Raidbots public API (`/simbot/report/{id}/data.json`)
- **Talent tree structure:** Blizzard Game Data API (client credentials flow, no user login required)
- **State:** URL search params only — no backend, no database

---

## Data Layer

### Raidbots API

Endpoint: `https://www.raidbots.com/simbot/report/{reportId}/data.json`

Requires a standard browser `User-Agent` header. Called client-side from the browser.

Key fields extracted per report:

| Field | Path in JSON |
|---|---|
| Character name | `sim.players[0].name` |
| Spec | `sim.players[0].specialization` |
| Race | `sim.players[0].race` |
| Encoded talent string | `sim.players[0].talents` |
| Overall DPS (mean) | `sim.players[0].collected_data.dps.mean` |
| DPS std deviation | `sim.players[0].collected_data.dps.std_dev` |
| Buffed stats | `sim.players[0].collected_data.buffed_stats` |
| Fight style | `sim.options.fight_style` |
| Target count | `sim.options.desired_targets` |
| Fight duration | `sim.options.max_time` |
| Per-ability breakdown | `sim.players[0].stats[]` |
| Pet ability breakdown | `sim.players[0].stats_pets[]` |

Per-ability stat fields:
- `spell_name` — display name
- `id` — spell ID
- `school` — damage school (shadow, fire, physical, etc.)
- `num_executes.mean` — average casts per fight
- `portion_aps.mean` — ability's DPS contribution
- `compound_amount` — total damage dealt
- `children[]` — child abilities (e.g. pet attacks triggered by a parent)

### Blizzard Game Data API

Endpoint: `/data/wow/playable-specialization/{specId}/talent-tree`

Used to fetch the talent tree structure for a given spec: node positions (row/column), connections between nodes, spell IDs, and display names. Requires a free Blizzard developer client ID/secret (client credentials OAuth, no user login). Tree structure is cached aggressively — it only changes on game patches.

Talent icons are loaded from Blizzard's media CDN using the spell ID from each node.

### Talent String Decoding

The `talents` field in `data.json` is WoW's loadout export format (base64-encoded binary). Decoding it produces a list of `{nodeId, rank}` pairs indicating which talent nodes are active. This is combined with the tree structure from the Blizzard API to determine selected/unselected state per node.

---

## Application Structure

### Two screens

**Screen 1 — Input page** (`/`)

Users paste Raidbots report URLs. Each URL is validated on paste: the report ID is extracted, `data.json` is fetched immediately, and a preview card appears showing character name, spec, DPS, and fight conditions. State transitions:

- **Loading** (yellow) — fetch in progress
- **Valid** (green card) — data loaded, preview shown
- **Invalid** (red) — 404 or non-Raidbots URL

Each report card has a remove (×) button. The "Compare Reports" button is disabled until at least 2 reports are in a valid state. On submit, report IDs are encoded into the URL and the user is navigated to the comparison view.

Reports are labeled A, B, C, D in order of addition. Removing a report re-labels remaining ones.

**Screen 2 — Comparison view** (`/compare?reports=id1,id2,...`)

URL encodes all report IDs. Opening the URL re-fetches all reports and renders the comparison. This URL is the share link — no other mechanism needed.

Layout: sticky header + tab navigation + content area.

---

## Comparison View Layout

### Sticky Header

Always visible regardless of active tab. Contains:
- App name (SimCompare)
- Report labels with character name, spec, and DPS per report
- Headline delta (e.g. "A +5.1%") against the highest-DPS report
- "Copy share link" button

### Tab Navigation

Four tabs: **Summary · Abilities · Spec Tree · Stats**

---

## Tab Designs

### Summary Tab

Side-by-side columns (one per report). Each column shows:
- Character name, spec, race
- Overall DPS (large, prominent)
- DPS error margin
- Fight conditions (style, targets, duration)
- Secondary stats summary (haste, crit, mastery, vers)

A banner below the columns shows the headline delta between the highest and lowest DPS report.

### Abilities Tab

A table with one row per ability. Columns: ability name + school + cast rate, then one DPS column per report, then a delta column showing each report's DPS relative to the highest-DPS report. Sorted by DPS descending.

- Abilities present in only one build are labeled **"A only"** / **"B only"** rather than showing a delta
- Delta is color-coded: green (leading), neutral (within ~3%), red (trailing)
- Pet abilities are grouped as children under their parent ability, collapsed by default, with a toggle to show/hide
- Cast rate shown as average executions per fight (from `num_executes.mean`)

### Spec Tree Tab

**Same-spec comparison (primary case):**

A unified talent tree overlay. One tree is rendered using Blizzard API node positions and connections. Nodes are color-coded by selection state across all loaded reports:

| Color | Meaning |
|---|---|
| Purple | Selected in all builds |
| Green (outline) | Selected in build A only |
| Red (outline) | Selected in build B only |
| Grey | Selected in neither build |

For 3+ reports, the two-color scheme is replaced with a combination label on each node (e.g. "A+B not C"). The "Show differences only" toggle still applies — nodes selected identically across all builds are hidden.

A "Show differences only" toggle hides all shared (purple) and unselected (grey) nodes, leaving only the diverging choices.

Hovering a node shows a tooltip with: talent name, description, rank, and which builds have it selected.

**Cross-spec comparison (secondary case):**

A warning banner indicates the builds use different specializations and that a unified overlay is not possible. Two separate trees are shown side by side, read-only, with no diff overlay. All other tabs (Summary, Abilities, Stats) still function normally.

### Stats Tab

A comparison table grouped into two sections:

**Fight Conditions** (shown first — immediately flags mismatched sim settings):
- Fight style, target count, fight duration

**Primary Stats:**
- Intellect, Spell Power

**Secondary Stats:**
- Haste, Crit, Mastery, Versatility

Deltas for secondary stats use percentage points (pp), not relative percentages — e.g. "−7.4pp" rather than "−9.3%" for a stat already expressed as a percentage.

---

## Sharing

The comparison URL (`/compare?reports=id1,id2,id3`) is the share mechanism. Opening the URL re-fetches all reports and renders the full comparison. The "Copy share link" button in the sticky header copies the current URL to clipboard. No server-side state, no login required.

---

## Scope Boundaries (explicit exclusions)

- No user accounts or saved comparisons
- No server-side caching of Raidbots data (client-side fetch only for MVP)
- No export to image/PDF
- Full visual talent tree rendering is in scope; pixel-perfect recreation of WoW's in-game UI is not a goal
- No support for non-Raidbots simulation tools

---

## Open Questions (resolved)

- **Blizzard API credentials:** User will obtain a free client ID/secret from Blizzard's developer portal. Client credentials flow only (no user OAuth).
- **Same vs cross-spec detection:** Compare `sim.players[0].specialization` across reports. If all match → unified overlay. If any differ → cross-spec warning + side-by-side.
- **Report label ordering:** A, B, C, D in the order added on the input page. Removing a report re-labels remaining ones sequentially.
