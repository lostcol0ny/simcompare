# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                      # Next.js dev server on :3000
npm run build                    # Production build
npm run lint                     # ESLint (eslint-config-next + TS)
npm test                         # Vitest run-once (jsdom env, globals enabled)
npm run test:watch               # Vitest watch mode
npx vitest run path/to/file.test.ts   # Run a single test file
npm run generate:simc-nodes      # Regenerate src/data/simc-slot-maps.json from SimC source
```

Required env (in `.env.local`) for the talent-tree API route to work:
- `BLIZZARD_CLIENT_ID`
- `BLIZZARD_CLIENT_SECRET`

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Architecture

SimCompare is a stateless comparison viewer for [Raidbots](https://www.raidbots.com/) WoW sim reports. **No data is persisted server-side** — all comparison state lives in the URL (`/compare?reports=id1,id2&names=...`), and the browser fetches each report fresh through the app's API routes.

### Request flow

1. User pastes Raidbots URLs on `/` (`ReportInputPage`). `extractReportId` pulls the report ID via regex.
2. `fetchReport(id)` hits `/api/report/[reportId]` (server route), which proxies `raidbots.com/simbot/report/{id}/data.json` (Raidbots requires server-side fetch — CDN caches 5 min).
3. Raw JSON is normalized client-side by `parseRaidbotsData` in `src/lib/raidbots.ts` into the `Report` shape (`src/lib/types.ts`).
4. Navigating to `/compare` mounts `CompareLayout`, which renders all 6 tab panels at once and toggles visibility via CSS classes (`tab-panel-active`). All tabs receive the same `Report[]` array.
5. The Talents (Spec Tree) tab additionally fetches `/api/talent-tree/[specId]` to render trees.

### The talent-string subsystem (the non-obvious part)

WoW loadout strings are a **custom bitstream**, not standard base64-decoded bytes. To render them you need to know which game DB node IDs correspond to which bit slots — and the slot order must match the game encoder exactly.

- `src/lib/talent-string.ts` — `decodeTalentString` reads the bitstream (8-bit version, 16-bit spec ID, 128-bit hash, then per-node bits). Produces `SelectedTalent[]` keyed by **slot index** (not real node IDs).
- `src/data/simc-slot-maps.json` — authoritative mapping from SimC class ID → sorted node ID list. Generated from `trait_data.inc` in the SimC `midnight` branch via `scripts/generate-simc-nodes.mjs`. Contains three sections: `slotMaps` (the bit-slot order), `heroTrees` (per-hero-tree node IDs), and `selectionNodes` (sub-tree-selection node → choiceIndex → subTreeId, used for hero tree detection).
- `src/app/api/talent-tree/[specId]/route.ts` — fetches Blizzard's talent tree (OAuth), enriches with sibling-spec node IDs and SimC's authoritative hero-tree memberships, returns `TalentTreeData` with `allSlotNodeIds` already pre-sorted. Spell icons are fetched in batches of 30 via `fetchSpellIcons` and cached (`s-maxage=86400`).
- `src/lib/talent-decode.ts` — `mapSelections` converts slot-indexed selections → real node IDs using `allSlotNodeIds`. `detectHeroTree` first tries the deterministic sub-tree-selection path, then falls back to exclusive-node scoring.

**Always prefer SimC's data (`simc-slot-maps.json`)** over Blizzard's API responses for slot ordering and hero-tree membership. Blizzard's data is sometimes incomplete; SimC's is canonical because it comes from the game DBC.

### Spec/class IDs

`src/lib/spec-ids.ts` maps Blizzard spec IDs ↔ SimC class IDs and provides `getSiblingSpecIds()` (other specs sharing the same class — needed for slot maps because the game encoder iterates **all** specs of a class in node-ID order).

### Caching/runtime notes

- The Blizzard OAuth token is cached in module-level state in `talent-tree/[specId]/route.ts` (`cachedToken`) and refreshed before expiry.
- Both API routes use Next's `next: { revalidate: ... }` for fetch-level caching.
- Report removal in `CompareLayout` uses `window.history.replaceState` (not `router.replace`) to avoid an RSC refetch when the data is already in client state.

### Testing

Vitest with jsdom environment, `globals: true`, setup file at `src/test/setup.ts` (loads `@testing-library/jest-dom`). Tests live alongside source under `__tests__/` (e.g., `src/lib/__tests__/talent-string.test.ts`).
