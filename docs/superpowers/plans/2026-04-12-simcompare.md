# SimCompare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app that lets users compare 2–4 Raidbots DPS simulation reports side by side, with shareable URLs and a visual talent tree diff.

**Architecture:** Client-side React app (Next.js App Router) that fetches Raidbots data directly from the browser. Blizzard Game Data API calls are proxied through a Next.js API route to keep the client secret server-side. All comparison state lives in URL search params — no database, no auth.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest, deployed on Vercel.

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1.1: Scaffold Next.js project**

```bash
cd /home/toby/projects/simcompare
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

When prompted, accept all defaults.

- [ ] **Step 1.2: Install Vitest and testing utilities**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 1.3: Add vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: { '@': '/home/toby/projects/simcompare/src' },
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 1.4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.5: Configure Tailwind color tokens**

Replace `tailwind.config.ts` content:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0d1a',
          raised: '#14141f',
          overlay: '#1e1e2e',
        },
        border: {
          DEFAULT: '#1e1e2e',
          subtle: '#2d2d3d',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          muted: '#4c1d95',
        },
        positive: {
          DEFAULT: '#4ade80',
          bg: '#0d1f0d',
          border: '#166534',
        },
        negative: {
          DEFAULT: '#f87171',
          bg: '#1f0d0d',
          border: '#7f1d1d',
        },
        warning: {
          DEFAULT: '#fbbf24',
          bg: '#1a1200',
          border: '#854d0e',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          muted: '#64748b',
          faint: '#475569',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 1.6: Set up globals.css**

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  background-color: #0d0d1a;
  color: #e2e8f0;
}
```

- [ ] **Step 1.7: Set up root layout**

Replace `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SimCompare',
  description: 'Compare Raidbots simulation reports side by side',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 1.8: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, default Next.js page loads.

- [ ] **Step 1.9: Commit**

```bash
git init
git add -A
git commit -m "feat: bootstrap Next.js project with Tailwind token config and Vitest"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/__tests__/types.test.ts`

- [ ] **Step 2.1: Write the types**

Create `src/lib/types.ts`:
```typescript
/** Raw response shape from Raidbots /simbot/report/{id}/data.json */
export interface RaidbotsRawData {
  sim: {
    options: {
      fight_style: string
      desired_targets: number
      max_time: number
      vary_combat_length: number
    }
    players: RaidbotsPlayer[]
  }
}

export interface RaidbotsPlayer {
  name: string
  race: string
  specialization: string
  talents: string
  collected_data: {
    dps: StatBlock
    buffed_stats: BuffedStats
  }
  stats: AbilityStat[]
  stats_pets: AbilityStat[]
}

export interface StatBlock {
  sum: number
  count: number
  mean: number
  min: number
  max: number
  variance: number
  std_dev: number
}

export interface BuffedStats {
  attribute: { Intellect: number }
  spell_power: number
  spell_crit: number
  spell_haste: number
  mastery_value: number
  damage_versatility: number
}

export interface AbilityStat {
  id: number
  spell_name: string
  name: string
  school?: string
  type: string
  num_executes: { mean: number }
  compound_amount: number
  portion_aps?: StatBlock
  children?: AbilityStat[]
}

/** Parsed, normalized report used throughout the app */
export interface Report {
  id: string
  characterName: string
  specialization: string
  race: string
  talentString: string
  dps: number
  dpsStdDev: number
  fightStyle: string
  targetCount: number
  fightDuration: number
  varyLength: number
  abilities: ParsedAbility[]
  buffedStats: {
    intellect: number
    spellPower: number
    spellCrit: number
    spellHaste: number
    mastery: number
    versatility: number
  }
}

export interface ParsedAbility {
  id: number
  spellName: string
  school: string
  dps: number
  castsPerFight: number
  percentOfTotal: number
  children: ParsedAbility[]
}

/** Talent tree data from Blizzard API */
export interface TalentTreeData {
  specId: number
  nodes: TalentNode[]
}

export interface TalentNode {
  id: number
  row: number
  col: number
  name: string
  spellId: number
  iconUrl: string
  maxRank: number
  lockedBy: number[]   // node IDs that must be selected first
  connects: number[]   // node IDs this connects to
}

/** A decoded talent node selection from a loadout string */
export interface SelectedTalent {
  nodeId: number
  rank: number
}

/** Status of a report being loaded on the input page */
export type ReportLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'valid'; report: Report }
  | { status: 'error'; message: string }
```

- [ ] **Step 2.2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Raidbots API Client

**Files:**
- Create: `src/lib/raidbots.ts`
- Create: `src/lib/__tests__/raidbots.test.ts`

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/__tests__/raidbots.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { extractReportId, parseRaidbotsData } from '../raidbots'
import type { RaidbotsRawData } from '../types'

const VALID_URL = 'https://www.raidbots.com/simbot/report/mifG5CJJ1wEEkSqXnLsPr6'
const REPORT_ID = 'mifG5CJJ1wEEkSqXnLsPr6'

describe('extractReportId', () => {
  it('extracts ID from a full Raidbots URL', () => {
    expect(extractReportId(VALID_URL)).toBe(REPORT_ID)
  })

  it('extracts ID from URL with trailing slash', () => {
    expect(extractReportId(VALID_URL + '/')).toBe(REPORT_ID)
  })

  it('extracts ID from URL with sub-path', () => {
    expect(extractReportId(VALID_URL + '/simc')).toBe(REPORT_ID)
  })

  it('returns null for a non-Raidbots URL', () => {
    expect(extractReportId('https://example.com/foo')).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(extractReportId('not a url')).toBeNull()
  })
})

const MOCK_RAW: RaidbotsRawData = {
  sim: {
    options: {
      fight_style: 'Patchwerk',
      desired_targets: 10,
      max_time: 360,
      vary_combat_length: 0.2,
    },
    players: [
      {
        name: 'Beyloc',
        race: 'Orc',
        specialization: 'Demonology Warlock',
        talents: 'CoQAy0jxID==',
        collected_data: {
          dps: { sum: 0, count: 1, mean: 523320.82, min: 459982, max: 578566, variance: 0, std_dev: 132.92 },
          buffed_stats: {
            attribute: { Intellect: 2529 },
            spell_power: 2529,
            spell_crit: 24.57,
            spell_haste: 79.49,
            mastery_value: 37.73,
            damage_versatility: 5.15,
          },
        },
        stats: [
          {
            id: 264178,
            spell_name: 'Demonbolt',
            name: 'demonbolt',
            school: 'shadowflame',
            type: 'damage',
            num_executes: { mean: 94.48 },
            compound_amount: 1854306,
            portion_aps: { sum: 0, count: 1, mean: 5150.11, min: 0, max: 0, variance: 0, std_dev: 0 },
            children: [],
          },
        ],
        stats_pets: [],
      },
    ],
  },
}

describe('parseRaidbotsData', () => {
  it('extracts character name and spec', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    expect(result.characterName).toBe('Beyloc')
    expect(result.specialization).toBe('Demonology Warlock')
  })

  it('extracts overall DPS', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    expect(result.dps).toBeCloseTo(523320.82)
    expect(result.dpsStdDev).toBeCloseTo(132.92)
  })

  it('extracts fight conditions', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    expect(result.fightStyle).toBe('Patchwerk')
    expect(result.targetCount).toBe(10)
    expect(result.fightDuration).toBe(360)
  })

  it('extracts buffed stats', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    expect(result.buffedStats.intellect).toBe(2529)
    expect(result.buffedStats.spellHaste).toBeCloseTo(79.49)
  })

  it('extracts abilities sorted by DPS descending', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    expect(result.abilities).toHaveLength(1)
    expect(result.abilities[0].spellName).toBe('Demonbolt')
    expect(result.abilities[0].dps).toBeCloseTo(5150.11)
  })

  it('skips abilities with zero DPS and no children', () => {
    const raw: RaidbotsRawData = {
      ...MOCK_RAW,
      sim: {
        ...MOCK_RAW.sim,
        players: [{
          ...MOCK_RAW.sim.players[0],
          stats: [
            { id: 1, spell_name: 'Zero DPS', name: 'zero', type: 'damage', num_executes: { mean: 0 }, compound_amount: 0 },
          ],
        }],
      },
    }
    const result = parseRaidbotsData('abc123', raw)
    expect(result.abilities).toHaveLength(0)
  })

  it('calculates percentOfTotal for each ability', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    // Only one ability — it should be 100% of its own DPS (portion of player total is different)
    expect(result.abilities[0].percentOfTotal).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/raidbots.test.ts
```

Expected: FAIL — `Cannot find module '../raidbots'`

- [ ] **Step 3.3: Implement raidbots.ts**

Create `src/lib/raidbots.ts`:
```typescript
import type { RaidbotsRawData, Report, ParsedAbility } from './types'

const RAIDBOTS_REPORT_PATTERN = /raidbots\.com\/simbot\/report\/([A-Za-z0-9]+)/

export function extractReportId(url: string): string | null {
  const match = url.match(RAIDBOTS_REPORT_PATTERN)
  return match ? match[1] : null
}

export async function fetchReport(reportId: string): Promise<Report> {
  const url = `https://www.raidbots.com/simbot/report/${reportId}/data.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Report not found (${res.status})`)
  const raw: RaidbotsRawData = await res.json()
  return parseRaidbotsData(reportId, raw)
}

export function parseRaidbotsData(reportId: string, raw: RaidbotsRawData): Report {
  const player = raw.sim.players[0]
  const opts = raw.sim.options
  const cd = player.collected_data

  const totalDps = cd.dps.mean
  const allStats = [...player.stats, ...player.stats_pets]

  const abilities = parseAbilities(allStats, totalDps)

  return {
    id: reportId,
    characterName: player.name,
    specialization: player.specialization,
    race: player.race,
    talentString: player.talents,
    dps: cd.dps.mean,
    dpsStdDev: cd.dps.std_dev,
    fightStyle: opts.fight_style,
    targetCount: opts.desired_targets,
    fightDuration: opts.max_time,
    varyLength: opts.vary_combat_length,
    abilities,
    buffedStats: {
      intellect: cd.buffed_stats.attribute.Intellect,
      spellPower: cd.buffed_stats.spell_power,
      spellCrit: cd.buffed_stats.spell_crit,
      spellHaste: cd.buffed_stats.spell_haste,
      mastery: cd.buffed_stats.mastery_value,
      versatility: cd.buffed_stats.damage_versatility,
    },
  }
}

function parseAbilities(
  stats: RaidbotsRawData['sim']['players'][0]['stats'],
  totalDps: number
): ParsedAbility[] {
  const parsed: ParsedAbility[] = []

  for (const stat of stats) {
    const dps = stat.portion_aps?.mean ?? 0
    const children = stat.children ? parseAbilities(stat.children, totalDps) : []

    if (dps === 0 && children.length === 0) continue

    parsed.push({
      id: stat.id,
      spellName: stat.spell_name,
      school: stat.school ?? 'physical',
      dps,
      castsPerFight: stat.num_executes.mean,
      percentOfTotal: totalDps > 0 ? (dps / totalDps) * 100 : 0,
      children,
    })
  }

  return parsed.sort((a, b) => b.dps - a.dps)
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
npm test -- src/lib/__tests__/raidbots.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/raidbots.ts src/lib/__tests__/raidbots.test.ts
git commit -m "feat: add Raidbots API client with report parsing"
```

---

## Task 4: URL Params Utility

**Files:**
- Create: `src/lib/url-params.ts`
- Create: `src/lib/__tests__/url-params.test.ts`

- [ ] **Step 4.1: Write failing tests**

Create `src/lib/__tests__/url-params.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { encodeReportIds, decodeReportIds } from '../url-params'

describe('encodeReportIds', () => {
  it('encodes a list of IDs into a comma-separated string', () => {
    const result = encodeReportIds(['abc', 'def', 'ghi'])
    expect(result).toBe('abc,def,ghi')
  })

  it('returns empty string for empty list', () => {
    expect(encodeReportIds([])).toBe('')
  })
})

describe('decodeReportIds', () => {
  it('decodes a comma-separated string into a list of IDs', () => {
    expect(decodeReportIds('abc,def,ghi')).toEqual(['abc', 'def', 'ghi'])
  })

  it('returns empty array for empty string', () => {
    expect(decodeReportIds('')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(decodeReportIds(null)).toEqual([])
    expect(decodeReportIds(undefined)).toEqual([])
  })

  it('filters out blank entries', () => {
    expect(decodeReportIds('abc,,def')).toEqual(['abc', 'def'])
  })
})
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/url-params.test.ts
```

Expected: FAIL — `Cannot find module '../url-params'`

- [ ] **Step 4.3: Implement url-params.ts**

Create `src/lib/url-params.ts`:
```typescript
export function encodeReportIds(ids: string[]): string {
  return ids.join(',')
}

export function decodeReportIds(param: string | null | undefined): string[] {
  if (!param) return []
  return param.split(',').filter(Boolean)
}
```

- [ ] **Step 4.4: Run tests**

```bash
npm test -- src/lib/__tests__/url-params.test.ts
```

Expected: All PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/url-params.ts src/lib/__tests__/url-params.test.ts
git commit -m "feat: add URL params encode/decode utility"
```

---

## Task 5: Talent String Decoder

**Files:**
- Create: `src/lib/talent-string.ts`
- Create: `src/lib/__tests__/talent-string.test.ts`

- [ ] **Step 5.1: Research the WoW loadout export format**

The WoW loadout export string is documented by the SimulationCraft project. Reference: https://github.com/simulationcraft/simc/blob/dragonflight/engine/player/player.cpp (search for `encode_talents`).

The format (as of TWW/Dragonflight):
- Base64url encoded (uses `-` and `_` instead of `+` and `/`)
- After decoding to bytes:
  - Byte 0: version (uint8, should be 1)
  - Bytes 1–2: specialization ID (uint16, big-endian)
  - Bytes 3–4: tree hash (uint16, can be ignored for our purposes)
  - Remaining bytes: packed talent selections, each talent stored as:
    - `node_id` as a 12-bit value
    - `rank` as a 4-bit value
    - Packed into 2-byte chunks (little-endian within the chunk)

Install a community decoder rather than implementing the bit-packing from scratch:

```bash
npm install talentstring
```

If `talentstring` is not available on npm, implement the decoder directly. Check availability first:

```bash
npm info talentstring 2>&1 | head -5
```

If the package exists, use it. If not, implement the decoder below manually in Step 5.3.

- [ ] **Step 5.2: Write failing tests**

Create `src/lib/__tests__/talent-string.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { decodeTalentString } from '../talent-string'

// The real talent string from the Demonology Warlock report
// Spec ID for Demonology Warlock is 265
const DEMO_TALENT_STRING = 'CoQAy0jxIDofkwJmoH7WhvESoxMMzoZzMz2MzYWGAAAAAAAwYGDL'

describe('decodeTalentString', () => {
  it('returns an array of selected talents', () => {
    const result = decodeTalentString(DEMO_TALENT_STRING)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('each talent has a nodeId and rank', () => {
    const result = decodeTalentString(DEMO_TALENT_STRING)
    for (const t of result) {
      expect(typeof t.nodeId).toBe('number')
      expect(typeof t.rank).toBe('number')
      expect(t.rank).toBeGreaterThan(0)
    }
  })

  it('throws on an empty string', () => {
    expect(() => decodeTalentString('')).toThrow()
  })
})
```

- [ ] **Step 5.3: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/talent-string.test.ts
```

Expected: FAIL — `Cannot find module '../talent-string'`

- [ ] **Step 5.4: Implement talent-string.ts**

Create `src/lib/talent-string.ts`:
```typescript
import type { SelectedTalent } from './types'

/**
 * Decodes a WoW loadout export string into a list of selected talent nodes.
 *
 * Format (SimC documentation):
 * - Base64url encoded
 * - Byte 0: version (uint8)
 * - Bytes 1–2: spec ID (uint16 big-endian)
 * - Bytes 3–4: tree hash (uint16, ignored)
 * - Remaining bytes: packed selections, 2 bytes per talent:
 *   - bits 0–11: node ID (12 bits)
 *   - bits 12–15: rank (4 bits)
 */
export function decodeTalentString(encoded: string): SelectedTalent[] {
  if (!encoded) throw new Error('Talent string must not be empty')

  // WoW uses base64url (- and _ instead of + and /)
  const base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(encoded.length / 4) * 4, '=')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  // Skip header: 1 byte version + 2 bytes spec ID + 2 bytes hash = 5 bytes
  const HEADER_SIZE = 5
  const selected: SelectedTalent[] = []

  for (let i = HEADER_SIZE; i + 1 < bytes.length; i += 2) {
    const lo = bytes[i]
    const hi = bytes[i + 1]
    const packed = lo | (hi << 8)
    const nodeId = packed & 0x0fff         // bits 0–11
    const rank = (packed >> 12) & 0x0f    // bits 12–15

    if (rank > 0) {
      selected.push({ nodeId, rank })
    }
  }

  if (selected.length === 0) {
    throw new Error('No talents decoded — string may be malformed')
  }

  return selected
}
```

- [ ] **Step 5.5: Run tests**

```bash
npm test -- src/lib/__tests__/talent-string.test.ts
```

Expected: All PASS. If the decoder produces wrong results (empty array or wrong node IDs), the bit-packing format may differ from the version above. In that case, refer to the SimC source at the URL in Step 5.1 and adjust the offset and bit layout.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/talent-string.ts src/lib/__tests__/talent-string.test.ts
git commit -m "feat: add WoW loadout export string decoder"
```

---

## Task 6: Blizzard API Route

**Files:**
- Create: `src/app/api/talent-tree/[specId]/route.ts`
- Modify: `.env.local` (add Blizzard credentials)

- [ ] **Step 6.1: Add Blizzard credentials to environment**

Create `.env.local` (do NOT commit this file):
```
BLIZZARD_CLIENT_ID=your_client_id_here
BLIZZARD_CLIENT_SECRET=your_client_secret_here
```

Register a free app at https://develop.battle.net/access/clients to get credentials. Select "Blizzard API" access (no special permissions needed).

Add `.env.local` to `.gitignore` if not already present:
```bash
echo '.env.local' >> .gitignore
```

- [ ] **Step 6.2: Implement the API route**

Create `src/app/api/talent-tree/[specId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import type { TalentTreeData, TalentNode } from '@/lib/types'

const TOKEN_URL = 'https://oauth.battle.net/token'
const API_BASE = 'https://us.api.blizzard.com'

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    next: { revalidate: 3600 }, // Cache token for 1 hour
  })

  if (!res.ok) throw new Error(`Blizzard OAuth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { specId: string } }
) {
  const specId = parseInt(params.specId, 10)
  if (isNaN(specId)) {
    return NextResponse.json({ error: 'Invalid spec ID' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()

    // Fetch the talent tree for the spec
    const treeRes = await fetch(
      `${API_BASE}/data/wow/playable-specialization/${specId}/talent-tree?namespace=static-us&locale=en_US`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 86400 }, // Cache tree for 24 hours (changes only on patches)
      }
    )

    if (!treeRes.ok) {
      return NextResponse.json(
        { error: `Blizzard API error: ${treeRes.status}` },
        { status: treeRes.status }
      )
    }

    const raw = await treeRes.json()
    const nodes = parseBlizzardTree(raw)

    const result: TalentTreeData = { specId, nodes }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function parseBlizzardTree(raw: unknown): TalentNode[] {
  const data = raw as {
    class_talent_nodes?: BlizzardNode[]
    spec_talent_nodes?: BlizzardNode[]
  }

  const allNodes = [
    ...(data.class_talent_nodes ?? []),
    ...(data.spec_talent_nodes ?? []),
  ]

  return allNodes.map((node) => {
    const entry = node.entries?.[0]
    return {
      id: node.id,
      row: node.raw_position_x ?? 0,
      col: node.raw_position_y ?? 0,
      name: entry?.definition?.name ?? 'Unknown',
      spellId: entry?.spell?.id ?? 0,
      iconUrl: entry?.definition?.icon
        ? `https://render.worldofwarcraft.com/us/icons/56/${entry.definition.icon}.jpg`
        : '',
      maxRank: node.entries?.length ?? 1,
      lockedBy: node.locked_by?.map((l: { talent_node: { id: number } }) => l.talent_node.id) ?? [],
      connects: node.children?.map((c: { id: number }) => c.id) ?? [],
    }
  })
}

interface BlizzardNode {
  id: number
  raw_position_x?: number
  raw_position_y?: number
  locked_by?: Array<{ talent_node: { id: number } }>
  children?: Array<{ id: number }>
  entries?: Array<{
    spell?: { id: number }
    definition?: { name: string; icon?: string }
  }>
}
```

- [ ] **Step 6.3: Test the API route manually**

```bash
npm run dev
```

Then in a new terminal:
```bash
curl "http://localhost:3000/api/talent-tree/265"
```

Expected: JSON response with `specId: 265` and a `nodes` array. Each node should have `id`, `row`, `col`, `name`. If you get a 500, check that `.env.local` has valid credentials and the server was restarted after adding them.

Note: Spec ID 265 is Demonology Warlock. Look up spec IDs at https://wowpedia.fandom.com/wiki/SpecializationID if you need others.

- [ ] **Step 6.4: Commit**

```bash
git add src/app/api/talent-tree/[specId]/route.ts .gitignore
git commit -m "feat: add Blizzard talent tree API route with server-side auth"
```

---

## Task 7: useReportLoader Hook

**Files:**
- Create: `src/hooks/useReportLoader.ts`

- [ ] **Step 7.1: Implement the hook**

Create `src/hooks/useReportLoader.ts`:
```typescript
'use client'

import { useState, useCallback } from 'react'
import { extractReportId, fetchReport } from '@/lib/raidbots'
import type { ReportLoadState } from '@/lib/types'

export interface LoadedReport {
  url: string
  state: ReportLoadState
}

export function useReportLoader() {
  const [reports, setReports] = useState<LoadedReport[]>([])

  const addReport = useCallback(async (url: string) => {
    const reportId = extractReportId(url)
    if (!reportId) {
      setReports((prev) => [
        ...prev,
        { url, state: { status: 'error', message: 'Not a valid Raidbots report URL' } },
      ])
      return
    }

    // Add as loading
    setReports((prev) => [...prev, { url, state: { status: 'loading' } }])

    try {
      const report = await fetchReport(reportId)
      setReports((prev) =>
        prev.map((r) =>
          r.url === url ? { url, state: { status: 'valid', report } } : r
        )
      )
    } catch {
      setReports((prev) =>
        prev.map((r) =>
          r.url === url
            ? { url, state: { status: 'error', message: 'Report not found or expired' } }
            : r
        )
      )
    }
  }, [])

  const removeReport = useCallback((url: string) => {
    setReports((prev) => prev.filter((r) => r.url !== url))
  }, [])

  const validReports = reports
    .filter((r) => r.state.status === 'valid')
    .map((r) => (r.state as { status: 'valid'; report: import('@/lib/types').Report }).report)

  return { reports, addReport, removeReport, validReports }
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/hooks/useReportLoader.ts
git commit -m "feat: add useReportLoader hook for report fetch state management"
```

---

## Task 8: Input Page

**Files:**
- Create: `src/components/input/ReportCard.tsx`
- Create: `src/components/input/ReportInputPage.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 8.1: Implement ReportCard**

Create `src/components/input/ReportCard.tsx`:
```typescript
'use client'

import type { ReportLoadState } from '@/lib/types'

interface Props {
  label: string
  url: string
  state: ReportLoadState
  onRemove: () => void
}

export function ReportCard({ label, url, state, onRemove }: Props) {
  const shortUrl = url.replace('https://', '').replace('http://', '')

  const borderColor = {
    idle: 'border-border',
    loading: 'border-warning-border',
    valid: 'border-positive-border',
    error: 'border-negative-border',
  }[state.status]

  const bgColor = {
    idle: 'bg-surface',
    loading: 'bg-warning-bg',
    valid: 'bg-positive-bg',
    error: 'bg-negative-bg',
  }[state.status]

  const labelColor = {
    idle: 'bg-surface-overlay text-text-muted',
    loading: 'bg-warning-border text-warning',
    valid: 'bg-positive-border text-positive',
    error: 'bg-negative-border text-negative',
  }[state.status]

  return (
    <div className={`rounded-lg border overflow-hidden ${borderColor} ${bgColor}`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${borderColor}`}>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${labelColor}`}>
          {label}
        </span>
        <span className="text-xs text-text-muted flex-1 truncate">{shortUrl}</span>
        {state.status === 'loading' && (
          <span className="text-xs text-warning animate-pulse">⟳ Loading…</span>
        )}
        {state.status === 'valid' && (
          <span className="text-sm text-positive">✓</span>
        )}
        {state.status === 'error' && (
          <span className="text-sm text-negative">✗</span>
        )}
        <button
          onClick={onRemove}
          className="text-text-faint hover:text-text-secondary text-sm ml-1"
          aria-label="Remove report"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-2">
        {state.status === 'loading' && (
          <p className="text-xs text-text-faint">Fetching report data…</p>
        )}
        {state.status === 'valid' && (
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-text-primary">
                {state.report.characterName} — {state.report.specialization}
              </p>
              <p className="text-xs text-positive">
                {state.report.race} · {state.report.fightStyle} · {state.report.targetCount} targets
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-positive">
                {Math.round(state.report.dps).toLocaleString()} DPS
              </p>
              <p className="text-xs text-positive opacity-70">
                ±{Math.round(state.report.dpsStdDev)}
              </p>
            </div>
          </div>
        )}
        {state.status === 'error' && (
          <p className="text-xs text-negative">{state.message}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2: Implement ReportInputPage**

Create `src/components/input/ReportInputPage.tsx`:
```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useReportLoader } from '@/hooks/useReportLoader'
import { ReportCard } from './ReportCard'
import { encodeReportIds, extractReportId } from '@/lib/raidbots'
import { encodeReportIds as encode } from '@/lib/url-params'

const LABELS = ['A', 'B', 'C', 'D']

export function ReportInputPage() {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { reports, addReport, removeReport, validReports } = useReportLoader()

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').trim()
    if (extractReportId(text)) {
      e.preventDefault()
      setInputValue('')
      addReport(text)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const text = inputValue.trim()
      if (text) {
        setInputValue('')
        addReport(text)
      }
    }
  }

  function handleCompare() {
    const ids = validReports.map((r) => r.id)
    router.push(`/compare?reports=${encode(ids)}`)
  }

  const canCompare = validReports.length >= 2
  const atMax = reports.length >= 4

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-3xl font-bold text-accent-light tracking-tight mb-1">
        SimCompare
      </h1>
      <p className="text-sm text-text-muted mb-8">
        Compare Raidbots simulation reports side by side
      </p>

      <div className="w-full max-w-xl flex flex-col gap-3">
        {reports.map((r, i) => (
          <ReportCard
            key={r.url}
            label={LABELS[i]}
            url={r.url}
            state={r.state}
            onRemove={() => removeReport(r.url)}
          />
        ))}

        {!atMax && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="Paste a Raidbots report URL…"
            className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent"
          />
        )}

        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className="mt-2 bg-accent text-white font-bold py-2.5 px-6 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        >
          Compare Reports →
        </button>

        {!canCompare && (
          <p className="text-xs text-text-faint text-center">
            Paste at least 2 valid report URLs to compare
          </p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 8.3: Wire up the input page**

Replace `src/app/page.tsx`:
```typescript
import { ReportInputPage } from '@/components/input/ReportInputPage'

export default function Home() {
  return <ReportInputPage />
}
```

- [ ] **Step 8.4: Fix the import in ReportInputPage**

The `encodeReportIds` import in ReportInputPage was imported twice with an alias. Clean up `src/components/input/ReportInputPage.tsx` — remove the duplicate import line:

```typescript
// Remove this line:
import { encodeReportIds } from '@/lib/raidbots'
// Keep only:
import { encodeReportIds as encode } from '@/lib/url-params'
```

- [ ] **Step 8.5: Test in browser**

```bash
npm run dev
```

Open http://localhost:3000. Paste `https://www.raidbots.com/simbot/report/mifG5CJJ1wEEkSqXnLsPr6`. Expected: card appears loading (yellow), then turns green with character name and DPS after ~1s.

- [ ] **Step 8.6: Commit**

```bash
git add src/components/input/ src/app/page.tsx
git commit -m "feat: add input page with report preloading and preview cards"
```

---

## Task 9: Compare Page Shell

**Files:**
- Create: `src/app/compare/page.tsx`
- Create: `src/components/compare/CompareLayout.tsx`
- Create: `src/components/compare/StickyHeader.tsx`
- Create: `src/components/compare/TabNav.tsx`

- [ ] **Step 9.1: Implement StickyHeader**

Create `src/components/compare/StickyHeader.tsx`:
```typescript
'use client'

import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function StickyHeader({ reports }: Props) {
  const maxDps = Math.max(...reports.map((r) => r.dps))
  const leader = reports.find((r) => r.dps === maxDps)
  const follower = reports.find((r) => r.dps !== maxDps)
  const delta =
    leader && follower
      ? (((leader.dps - follower.dps) / follower.dps) * 100).toFixed(1)
      : null

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
  }

  return (
    <div className="sticky top-0 z-50 bg-surface border-b border-border-subtle flex items-center justify-between px-4 py-2 gap-4">
      <span className="text-sm font-bold text-accent-light shrink-0">SimCompare</span>

      <div className="flex items-center gap-3 text-xs overflow-x-auto">
        {reports.map((r, i) => (
          <span key={r.id} className="flex items-center gap-1.5 shrink-0">
            <span className="text-text-muted">{LABELS[i]}:</span>
            <span className="text-text-secondary">
              {r.characterName} ({r.specialization.split(' ')[0]})
            </span>
            <span className="font-bold text-accent-light">
              {Math.round(r.dps / 1000).toLocaleString()}k
            </span>
          </span>
        ))}
        {delta && leader && (
          <span className="bg-positive/10 text-positive px-2 py-0.5 rounded text-xs font-bold shrink-0">
            {LABELS[reports.indexOf(leader)]} +{delta}%
          </span>
        )}
      </div>

      <button
        onClick={copyLink}
        className="text-xs text-positive hover:text-positive/80 shrink-0"
      >
        ⧉ Copy link
      </button>
    </div>
  )
}
```

- [ ] **Step 9.2: Implement TabNav**

Create `src/components/compare/TabNav.tsx`:
```typescript
'use client'

export type TabId = 'summary' | 'abilities' | 'spec-tree' | 'stats'

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'spec-tree', label: 'Spec Tree' },
  { id: 'stats', label: 'Stats' },
]

interface Props {
  active: TabId
  onChange: (id: TabId) => void
}

export function TabNav({ active, onChange }: Props) {
  return (
    <div className="bg-surface-raised border-b border-border-subtle flex px-4">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tab.id
              ? 'text-accent-light border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 9.3: Implement CompareLayout**

Create `src/components/compare/CompareLayout.tsx`:
```typescript
'use client'

import { useState } from 'react'
import type { Report } from '@/lib/types'
import { StickyHeader } from './StickyHeader'
import { TabNav, type TabId } from './TabNav'
import { SummaryTab } from './SummaryTab'
import { AbilitiesTab } from './AbilitiesTab'
import { SpecTreeTab } from './SpecTreeTab'
import { StatsTab } from './StatsTab'

interface Props {
  reports: Report[]
}

export function CompareLayout({ reports }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader reports={reports} />
      <TabNav active={activeTab} onChange={setActiveTab} />
      <div className="flex-1">
        {activeTab === 'summary' && <SummaryTab reports={reports} />}
        {activeTab === 'abilities' && <AbilitiesTab reports={reports} />}
        {activeTab === 'spec-tree' && <SpecTreeTab reports={reports} />}
        {activeTab === 'stats' && <StatsTab reports={reports} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 9.4: Implement the compare page**

Create `src/app/compare/page.tsx`:
```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fetchReport } from '@/lib/raidbots'
import { decodeReportIds } from '@/lib/url-params'
import { CompareLayout } from '@/components/compare/CompareLayout'
import type { Report } from '@/lib/types'

export default function ComparePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ids = decodeReportIds(searchParams.get('reports'))
    if (ids.length < 2) {
      router.replace('/')
      return
    }

    Promise.all(ids.map(fetchReport))
      .then((loaded) => {
        setReports(loaded)
        setLoading(false)
      })
      .catch(() => {
        setError('One or more reports could not be loaded.')
        setLoading(false)
      })
  }, [searchParams, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted text-sm">Loading reports…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-negative text-sm">{error}</p>
      </div>
    )
  }

  return <CompareLayout reports={reports} />
}
```

- [ ] **Step 9.5: Add placeholder tab components** (so CompareLayout compiles)

Create `src/components/compare/SummaryTab.tsx`:
```typescript
import type { Report } from '@/lib/types'
export function SummaryTab({ reports }: { reports: Report[] }) {
  return <div className="p-4 text-text-muted text-sm">Summary tab — coming soon</div>
}
```

Create `src/components/compare/AbilitiesTab.tsx`:
```typescript
import type { Report } from '@/lib/types'
export function AbilitiesTab({ reports }: { reports: Report[] }) {
  return <div className="p-4 text-text-muted text-sm">Abilities tab — coming soon</div>
}
```

Create `src/components/compare/SpecTreeTab.tsx`:
```typescript
import type { Report } from '@/lib/types'
export function SpecTreeTab({ reports }: { reports: Report[] }) {
  return <div className="p-4 text-text-muted text-sm">Spec Tree tab — coming soon</div>
}
```

Create `src/components/compare/StatsTab.tsx`:
```typescript
import type { Report } from '@/lib/types'
export function StatsTab({ reports }: { reports: Report[] }) {
  return <div className="p-4 text-text-muted text-sm">Stats tab — coming soon</div>
}
```

- [ ] **Step 9.6: Test end-to-end navigation**

```bash
npm run dev
```

1. Open http://localhost:3000, paste two report URLs, click Compare.
2. Expected: redirected to `/compare?reports=id1,id2`, loading message, then sticky header with DPS and tab navigation.

- [ ] **Step 9.7: Commit**

```bash
git add src/app/compare/ src/components/compare/
git commit -m "feat: add compare page shell with sticky header and tab navigation"
```

---

## Task 10: Summary Tab

**Files:**
- Modify: `src/components/compare/SummaryTab.tsx`

- [ ] **Step 10.1: Implement SummaryTab**

Replace `src/components/compare/SummaryTab.tsx`:
```typescript
import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

export function SummaryTab({ reports }: Props) {
  const maxDps = Math.max(...reports.map((r) => r.dps))
  const minDps = Math.min(...reports.map((r) => r.dps))
  const delta = (((maxDps - minDps) / minDps) * 100).toFixed(1)
  const leadIdx = reports.findIndex((r) => r.dps === maxDps)

  return (
    <div>
      <div className="flex divide-x divide-border">
        {reports.map((r, i) => (
          <div key={r.id} className="flex-1 p-5">
            <p className="text-xs text-text-faint uppercase tracking-wide mb-3">
              {LABELS[i]} — {r.specialization}
            </p>
            <p className="text-4xl font-bold text-accent-light">
              {fmt(r.dps)}
            </p>
            <p className="text-xs text-text-muted mt-1">DPS ±{fmt(r.dpsStdDev)}</p>

            <div className="mt-4 space-y-1 text-xs text-text-secondary">
              <p>{r.fightStyle} · {r.targetCount} targets · {r.fightDuration}s ±{Math.round(r.varyLength * 100)}%</p>
              <p>{r.race}</p>
            </div>

            <div className="mt-4 space-y-1 text-xs">
              <StatLine label="Haste" value={`${r.buffedStats.spellHaste.toFixed(1)}%`} />
              <StatLine label="Crit" value={`${r.buffedStats.spellCrit.toFixed(1)}%`} />
              <StatLine label="Mastery" value={`${r.buffedStats.mastery.toFixed(1)}%`} />
              <StatLine label="Versatility" value={`${r.buffedStats.versatility.toFixed(1)}%`} />
            </div>
          </div>
        ))}
      </div>

      {reports.length >= 2 && (
        <div className="bg-positive-bg border-t border-positive-border px-5 py-3 text-xs text-positive">
          ▲ {LABELS[leadIdx]} ({reports[leadIdx].characterName}) leads by{' '}
          {fmt(maxDps - minDps)} DPS (+{delta}%)
        </div>
      )}
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-text-secondary">
      <span className="text-text-faint">{label}</span>
      <span>{value}</span>
    </div>
  )
}
```

- [ ] **Step 10.2: Test in browser**

Open `/compare?reports=id1,id2`. Click the Summary tab. Expected: two columns with DPS, stats, and a green delta banner at the bottom.

- [ ] **Step 10.3: Commit**

```bash
git add src/components/compare/SummaryTab.tsx
git commit -m "feat: implement Summary tab"
```

---

## Task 11: Abilities Tab

**Files:**
- Modify: `src/components/compare/AbilitiesTab.tsx`

- [ ] **Step 11.1: Write the delta helper test**

Create `src/lib/__tests__/abilities.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildAbilityRows } from '../abilities'
import type { ParsedAbility, Report } from '../types'

function makeReport(abilities: Partial<ParsedAbility>[]): Report {
  return {
    id: 'test',
    characterName: 'Test',
    specialization: 'Demo Warlock',
    race: 'Orc',
    talentString: '',
    dps: 100,
    dpsStdDev: 1,
    fightStyle: 'Patchwerk',
    targetCount: 1,
    fightDuration: 300,
    varyLength: 0.2,
    buffedStats: { intellect: 0, spellPower: 0, spellCrit: 0, spellHaste: 0, mastery: 0, versatility: 0 },
    abilities: abilities.map((a) => ({
      id: a.id ?? 1,
      spellName: a.spellName ?? 'Test',
      school: a.school ?? 'shadow',
      dps: a.dps ?? 0,
      castsPerFight: a.castsPerFight ?? 1,
      percentOfTotal: a.percentOfTotal ?? 0,
      children: a.children ?? [],
    })),
  }
}

describe('buildAbilityRows', () => {
  it('marks abilities present in only one report', () => {
    const r1 = makeReport([{ id: 1, spellName: 'Doom', dps: 1000 }])
    const r2 = makeReport([{ id: 2, spellName: 'Chaos Bolt', dps: 900 }])
    const rows = buildAbilityRows([r1, r2])
    const doom = rows.find((r) => r.spellName === 'Doom')!
    expect(doom.values[0].dps).toBe(1000)
    expect(doom.values[1].dps).toBe(0)
    expect(doom.values[1].exclusive).toBe(false)
    expect(doom.values[0].exclusive).toBe(true)
  })

  it('calculates delta relative to max DPS ability across reports', () => {
    const r1 = makeReport([{ id: 1, spellName: 'Doom', dps: 1000 }])
    const r2 = makeReport([{ id: 1, spellName: 'Doom', dps: 800 }])
    const rows = buildAbilityRows([r1, r2])
    const doom = rows.find((r) => r.spellName === 'Doom')!
    // r1 leads — delta for r2 should be negative
    expect(doom.maxDps).toBe(1000)
  })

  it('sorts rows by max DPS descending', () => {
    const r1 = makeReport([
      { id: 1, spellName: 'Low', dps: 100 },
      { id: 2, spellName: 'High', dps: 500 },
    ])
    const rows = buildAbilityRows([r1])
    expect(rows[0].spellName).toBe('High')
    expect(rows[1].spellName).toBe('Low')
  })
})
```

- [ ] **Step 11.2: Run tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/abilities.test.ts
```

Expected: FAIL — `Cannot find module '../abilities'`

- [ ] **Step 11.3: Implement abilities helper**

Create `src/lib/abilities.ts`:
```typescript
import type { ParsedAbility, Report } from './types'

export interface AbilityValue {
  dps: number
  castsPerFight: number
  percentOfTotal: number
  exclusive: boolean  // true if this ability only exists in this report
}

export interface AbilityRow {
  id: number
  spellName: string
  school: string
  maxDps: number
  values: AbilityValue[]  // one per report, in report order
  children: AbilityRow[]
}

export function buildAbilityRows(reports: Report[]): AbilityRow[] {
  // Collect all unique spell IDs across all reports
  const allIds = new Set<number>()
  for (const r of reports) {
    for (const a of r.abilities) allIds.add(a.id)
  }

  const rows: AbilityRow[] = []

  for (const id of allIds) {
    const appearances = reports.map((r) => r.abilities.find((a) => a.id === id))
    const present = appearances.filter(Boolean) as ParsedAbility[]

    if (present.length === 0) continue

    const first = present[0]
    const maxDps = Math.max(...present.map((a) => a.dps))

    const values: AbilityValue[] = appearances.map((a) => ({
      dps: a?.dps ?? 0,
      castsPerFight: a?.castsPerFight ?? 0,
      percentOfTotal: a?.percentOfTotal ?? 0,
      exclusive: a !== undefined && present.length === 1,
    }))

    // Recursively build children
    const allChildIds = new Set<number>()
    for (const a of present) {
      for (const c of a.children ?? []) allChildIds.add(c.id)
    }

    const childReports = reports.map((r) => ({
      ...r,
      abilities: r.abilities.find((a) => a.id === id)?.children ?? [],
    }))

    rows.push({
      id,
      spellName: first.spell_name ?? first.spellName,
      school: first.school,
      maxDps,
      values,
      children: allChildIds.size > 0 ? buildAbilityRows(childReports) : [],
    })
  }

  return rows.sort((a, b) => b.maxDps - a.maxDps)
}
```

Note: `first.spell_name` handles the raw API field and `first.spellName` handles the parsed type — add `spell_name?: string` to `ParsedAbility` in `types.ts` or just use `spellName` consistently.

Fix `src/lib/abilities.ts` to use only `spellName`:
```typescript
      spellName: first.spellName,
```

- [ ] **Step 11.4: Run tests**

```bash
npm test -- src/lib/__tests__/abilities.test.ts
```

Expected: All PASS.

- [ ] **Step 11.5: Implement AbilitiesTab**

Replace `src/components/compare/AbilitiesTab.tsx`:
```typescript
'use client'

import { useState } from 'react'
import type { Report } from '@/lib/types'
import { buildAbilityRows, type AbilityRow } from '@/lib/abilities'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function AbilitiesTab({ reports }: Props) {
  const [showPets, setShowPets] = useState(false)
  const rows = buildAbilityRows(reports)

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border text-xs">
        <span className="text-text-muted">
          Sorted by DPS · <span className="text-accent-light">highest first</span>
        </span>
        <label className="flex items-center gap-2 cursor-pointer text-text-muted">
          Show pets
          <button
            role="switch"
            aria-checked={showPets}
            onClick={() => setShowPets((v) => !v)}
            className={`w-8 h-4 rounded-full relative transition-colors ${showPets ? 'bg-accent' : 'bg-surface-overlay'}`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showPets ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
        </label>
      </div>

      {/* Column headers */}
      <div
        className="grid px-4 py-1.5 bg-surface border-b border-border text-xs text-text-faint uppercase tracking-wide"
        style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px` }}
      >
        <span>Ability</span>
        {reports.map((r, i) => (
          <span key={r.id} className="text-right">
            {LABELS[i]} — {r.specialization.split(' ')[0]}
          </span>
        ))}
        <span className="text-center">Δ vs best</span>
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <AbilityRowComponent
          key={row.id}
          row={row}
          reports={reports}
          showPets={showPets}
          depth={0}
        />
      ))}
    </div>
  )
}

function AbilityRowComponent({
  row,
  reports,
  showPets,
  depth,
}: {
  row: AbilityRow
  reports: Report[]
  showPets: boolean
  depth: number
}) {
  const maxDps = Math.max(...row.values.map((v) => v.dps))
  const isChild = depth > 0

  if (isChild && !showPets) return null

  return (
    <>
      <div
        className={`grid items-center border-b border-border px-4 py-1.5 text-sm ${
          isChild ? 'bg-surface opacity-75' : depth % 2 === 0 ? 'bg-surface' : 'bg-surface-raised'
        }`}
        style={{
          gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px`,
          paddingLeft: `${16 + depth * 16}px`,
        }}
      >
        {/* Ability name */}
        <div>
          {isChild && <span className="text-text-faint mr-1 text-xs">└</span>}
          <span className={isChild ? 'text-xs text-text-secondary' : 'font-medium text-text-primary'}>
            {row.spellName}
          </span>
          {!isChild && (
            <div className="text-xs text-text-faint">
              {row.school} · {row.values[0]?.castsPerFight.toFixed(1)}×/fight
            </div>
          )}
        </div>

        {/* DPS per report */}
        {row.values.map((v, i) => (
          <div key={i} className="text-right">
            {v.dps > 0 ? (
              <>
                <span className="font-medium text-text-primary">{Math.round(v.dps).toLocaleString()}</span>
                {v.exclusive && (
                  <span className="ml-1 text-xs bg-positive/10 text-positive px-1 rounded">
                    {LABELS[i]} only
                  </span>
                )}
              </>
            ) : (
              <span className="text-text-faint">—</span>
            )}
          </div>
        ))}

        {/* Delta vs best */}
        <div className="text-center text-xs">
          {maxDps > 0 && row.values.filter((v) => v.dps > 0).length > 1 ? (
            row.values.map((v, i) => {
              if (v.dps === 0) return null
              const pct = ((v.dps - maxDps) / maxDps) * 100
              if (pct === 0) return null
              const color = pct < -5 ? 'text-negative' : pct < -2 ? 'text-text-muted' : 'text-positive'
              return (
                <span key={i} className={`block ${color}`}>
                  {LABELS[i]}: {pct.toFixed(1)}%
                </span>
              )
            })
          ) : (
            <span className="text-text-faint">—</span>
          )}
        </div>
      </div>

      {row.children.map((child) => (
        <AbilityRowComponent
          key={child.id}
          row={child}
          reports={reports}
          showPets={showPets}
          depth={depth + 1}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 11.6: Test in browser**

Load two reports and click the Abilities tab. Expected: sorted ability table with DPS columns, "A only"/"B only" labels for exclusive abilities, delta column, and a pet toggle.

- [ ] **Step 11.7: Commit**

```bash
git add src/components/compare/AbilitiesTab.tsx src/lib/abilities.ts src/lib/__tests__/abilities.test.ts
git commit -m "feat: implement Abilities tab with delta comparison and pet toggle"
```

---

## Task 12: Stats Tab

**Files:**
- Modify: `src/components/compare/StatsTab.tsx`

- [ ] **Step 12.1: Implement StatsTab**

Replace `src/components/compare/StatsTab.tsx`:
```typescript
import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function StatsTab({ reports }: Props) {
  return (
    <div className="p-4 max-w-3xl">
      <Section title="Fight Conditions">
        <StatRow label="Fight Style" values={reports.map((r) => r.fightStyle)} />
        <StatRow label="Targets" values={reports.map((r) => String(r.targetCount))} />
        <StatRow
          label="Duration"
          values={reports.map((r) => `${r.fightDuration}s ±${Math.round(r.varyLength * 100)}%`)}
        />
      </Section>

      <Section title="Primary Stats (buffed)">
        <StatRow
          label="Intellect"
          values={reports.map((r) => r.buffedStats.intellect.toLocaleString())}
          rawValues={reports.map((r) => r.buffedStats.intellect)}
        />
        <StatRow
          label="Spell Power"
          values={reports.map((r) => r.buffedStats.spellPower.toLocaleString())}
          rawValues={reports.map((r) => r.buffedStats.spellPower)}
        />
      </Section>

      <Section title="Secondary Stats (buffed)">
        <StatRow
          label="Haste"
          values={reports.map((r) => `${r.buffedStats.spellHaste.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.spellHaste)}
          unit="pp"
        />
        <StatRow
          label="Crit"
          values={reports.map((r) => `${r.buffedStats.spellCrit.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.spellCrit)}
          unit="pp"
        />
        <StatRow
          label="Mastery"
          values={reports.map((r) => `${r.buffedStats.mastery.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.mastery)}
          unit="pp"
        />
        <StatRow
          label="Versatility"
          values={reports.map((r) => `${r.buffedStats.versatility.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.versatility)}
          unit="pp"
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs text-text-faint uppercase tracking-wide mb-2">{title}</h3>
      <div className="border border-border rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function StatRow({
  label,
  values,
  rawValues,
  unit,
}: {
  label: string
  values: string[]
  rawValues?: number[]
  unit?: string
}) {
  const maxRaw = rawValues ? Math.max(...rawValues) : null

  return (
    <div className="grid border-b border-border last:border-0 text-sm"
      style={{ gridTemplateColumns: `160px repeat(${values.length}, 1fr)` }}
    >
      <span className="px-3 py-2 text-xs text-text-faint border-r border-border bg-surface">{label}</span>
      {values.map((v, i) => {
        const delta =
          rawValues && maxRaw !== null && rawValues[i] !== maxRaw
            ? rawValues[i] - maxRaw
            : null

        return (
          <span key={i} className="px-3 py-2 text-text-primary border-r border-border last:border-0">
            {v}
            {delta !== null && (
              <span className={`ml-1 text-xs ${delta > 0 ? 'text-positive' : 'text-negative'}`}>
                {delta > 0 ? '+' : ''}
                {unit === 'pp' ? `${delta.toFixed(1)}pp` : delta.toLocaleString()}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 12.2: Test in browser**

Click the Stats tab. Expected: three grouped sections (Fight Conditions, Primary Stats, Secondary Stats) with pp deltas on secondary stats.

- [ ] **Step 12.3: Commit**

```bash
git add src/components/compare/StatsTab.tsx
git commit -m "feat: implement Stats tab with percentage-point deltas"
```

---

## Task 13: TalentTree SVG Renderer

**Files:**
- Create: `src/components/compare/TalentTree.tsx`

This task renders a single talent tree as an SVG. It is called by SpecTreeTab with a set of nodes and selection states per build.

- [ ] **Step 13.1: Define the component interface**

The component will receive:
- `nodes: TalentNode[]` — from the Blizzard API (via the `/api/talent-tree/[specId]` route)
- `selections: SelectedTalent[][]` — one array per report (decoded from talent strings)
- `labels: string[]` — report labels ('A', 'B', 'C', 'D')

Node positions use `row` and `col` from the Blizzard API as pixel coordinates. Normalize them to fit in the SVG canvas.

- [ ] **Step 13.2: Implement TalentTree.tsx**

Create `src/components/compare/TalentTree.tsx`:
```typescript
'use client'

import { useState, useMemo } from 'react'
import type { TalentNode, SelectedTalent } from '@/lib/types'

interface Props {
  nodes: TalentNode[]
  selections: SelectedTalent[][]  // one per report
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
    for (const n of positioned) m.set(n.id, { px: (n as any).px, py: (n as any).py })
    return m
  }, [positioned])

  function nodeColor(state: NodeState): { fill: string; stroke: string } {
    if (state.inAll) return { fill: '#4c1d95', stroke: '#7c3aed' }
    if (state.inNone) return { fill: '#1e1e2e', stroke: '#334155' }
    if (state.inSome.length === 1 && state.inSome[0] === labels[0])
      return { fill: '#14532d', stroke: '#4ade80' }
    if (state.inSome.length === 1 && state.inSome[0] === labels[1])
      return { fill: '#7f1d1d', stroke: '#f87171' }
    // Multiple but not all
    return { fill: '#1e3a5f', stroke: '#60a5fa' }
  }

  const hoveredNode = hovered != null ? positioned.find((n) => n.id === hovered) : null
  const hoveredState = hovered != null ? nodeStates.get(hovered) : null

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
            if (!target) return null
            const { px, py } = posMap.get(node.id)!
            return (
              <line
                key={`${node.id}-${targetId}`}
                x1={px}
                y1={py}
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
          const { px, py } = posMap.get(node.id)!
          const { fill, stroke } = nodeColor(state)
          const isHovered = hovered === node.id

          return (
            <g
              key={node.id}
              transform={`translate(${px},${py})`}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle
                r={isHovered ? NODE_RADIUS + 3 : NODE_RADIUS}
                fill={fill}
                stroke={stroke}
                strokeWidth={state.inAll || state.inNone ? 1.5 : 2.5}
              />
              {node.iconUrl && (
                <image
                  href={node.iconUrl}
                  x={-NODE_RADIUS + 4}
                  y={-NODE_RADIUS + 4}
                  width={(NODE_RADIUS - 4) * 2}
                  height={(NODE_RADIUS - 4) * 2}
                  className="rounded"
                  style={{ opacity: state.inNone ? 0.3 : 1 }}
                />
              )}
              {!node.iconUrl && (
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
      {hoveredNode && hoveredState && (
        <div className="absolute top-2 right-2 bg-surface-overlay border border-border rounded-lg p-3 max-w-xs text-xs shadow-lg pointer-events-none">
          <p className="font-bold text-text-primary mb-1">{hoveredNode.name}</p>
          <p className="text-text-muted mb-2">Max rank: {hoveredNode.maxRank}</p>
          {hoveredState.inAll && (
            <p className="text-accent-light">Selected in all builds</p>
          )}
          {hoveredState.inNone && (
            <p className="text-text-faint">Not selected in any build</p>
          )}
          {!hoveredState.inAll && !hoveredState.inNone && (
            <p className="text-positive">
              Selected in: {hoveredState.inSome.join(', ')}
              <br />
              <span className="text-negative">
                Not in: {labels.filter((l) => !hoveredState.inSome.includes(l)).join(', ')}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 13.3: Commit**

```bash
git add src/components/compare/TalentTree.tsx
git commit -m "feat: add SVG talent tree renderer with diff overlay"
```

---

## Task 14: Spec Tree Tab

**Files:**
- Modify: `src/components/compare/SpecTreeTab.tsx`

- [ ] **Step 14.1: Add spec ID lookup utility**

The Blizzard API needs a spec ID (integer), but `data.json` gives us a string like `"Demonology Warlock"`. Add a lookup map.

Create `src/lib/spec-ids.ts`:
```typescript
/**
 * Maps Raidbots specialization strings to Blizzard spec IDs.
 * Add entries as needed for specs that appear in reports.
 * Full list: https://wowpedia.fandom.com/wiki/SpecializationID
 */
export const SPEC_ID_MAP: Record<string, number> = {
  'Affliction Warlock': 265,  // NOTE: verify actual IDs below
  'Demonology Warlock': 266,
  'Destruction Warlock': 267,
  'Balance Druid': 102,
  'Feral Druid': 103,
  'Guardian Druid': 104,
  'Restoration Druid': 105,
  'Beast Mastery Hunter': 253,
  'Marksmanship Hunter': 254,
  'Survival Hunter': 255,
  'Arcane Mage': 62,
  'Fire Mage': 63,
  'Frost Mage': 64,
  'Windwalker Monk': 269,
  'Brewmaster Monk': 268,
  'Mistweaver Monk': 270,
  'Holy Paladin': 65,
  'Protection Paladin': 66,
  'Retribution Paladin': 70,
  'Discipline Priest': 256,
  'Holy Priest': 257,
  'Shadow Priest': 258,
  'Assassination Rogue': 259,
  'Outlaw Rogue': 260,
  'Subtlety Rogue': 261,
  'Elemental Shaman': 262,
  'Enhancement Shaman': 263,
  'Restoration Shaman': 264,
  'Arms Warrior': 71,
  'Fury Warrior': 72,
  'Protection Warrior': 73,
  'Blood Death Knight': 250,
  'Frost Death Knight': 251,
  'Unholy Death Knight': 252,
  'Havoc Demon Hunter': 577,
  'Vengeance Demon Hunter': 581,
  'Devastation Evoker': 1467,
  'Preservation Evoker': 1468,
  'Augmentation Evoker': 1473,
}

export function getSpecId(specialization: string): number | null {
  return SPEC_ID_MAP[specialization] ?? null
}
```

**Important:** Verify the Warlock spec IDs against https://wowpedia.fandom.com/wiki/SpecializationID — the values above may be incorrect. Affliction is likely 265, Demonology 266, Destruction 267.

- [ ] **Step 14.2: Implement SpecTreeTab**

Replace `src/components/compare/SpecTreeTab.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import type { Report, TalentTreeData, SelectedTalent } from '@/lib/types'
import { decodeTalentString } from '@/lib/talent-string'
import { getSpecId } from '@/lib/spec-ids'
import { TalentTree } from './TalentTree'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function SpecTreeTab({ reports }: Props) {
  const [treeData, setTreeData] = useState<TalentTreeData | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [diffsOnly, setDiffsOnly] = useState(false)

  // Detect cross-spec
  const specs = [...new Set(reports.map((r) => r.specialization))]
  const isCrossSpec = specs.length > 1

  // Decode talent strings
  const selections: SelectedTalent[][] = reports.map((r) => {
    try {
      return decodeTalentString(r.talentString)
    } catch {
      return []
    }
  })

  // Count differences
  const firstSelIds = new Set(selections[0]?.map((s) => s.nodeId) ?? [])
  const allIds = new Set(selections.flatMap((sel) => sel.map((s) => s.nodeId)))
  const diffCount = [...allIds].filter((id) => {
    const inAll = selections.every((sel) => sel.some((s) => s.nodeId === id))
    return !inAll
  }).length

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
      .catch((e) => setTreeError(e.message))
  }, [reports, isCrossSpec])

  if (isCrossSpec) {
    return (
      <div className="p-4">
        <div className="bg-warning-bg border border-warning-border rounded-lg p-4 flex gap-3 mb-6">
          <span className="text-lg">⚠</span>
          <div>
            <p className="text-sm font-bold text-warning mb-1">Cross-spec comparison</p>
            <p className="text-xs text-warning/80">
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
                (Full tree rendering requires same-spec comparison)
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
      <div className="p-4 text-text-muted text-sm animate-pulse">
        Loading talent tree…
      </div>
    )
  }

  return (
    <div>
      {/* Legend + controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border text-xs flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <LegendItem color="bg-accent-muted border-accent" label="Both builds" />
          <LegendItem color="bg-positive-border border-positive" label={`${LABELS[0]} only`} />
          {reports.length > 1 && (
            <LegendItem color="bg-negative-border border-negative" label={`${LABELS[1]} only`} />
          )}
          <LegendItem color="bg-surface-overlay border-border-subtle" label="Neither" />
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full border ${color}`} />
      <span className="text-text-muted">{label}</span>
    </div>
  )
}
```

- [ ] **Step 14.3: Test in browser**

Load two Demonology reports. Click Spec Tree. Expected: loading state, then the SVG tree renders with purple nodes (shared), green (A only), red (B only), grey (neither). Hover a node to see the tooltip.

If the tree doesn't render correctly (wrong node positions, blank SVG), open DevTools → Network and inspect the `/api/talent-tree/266` response. Verify the `nodes` array has valid `row`/`col` values. If positions are all zero, the Blizzard API field names may differ — check `raw_position_x`/`raw_position_y` vs `column`/`row` in the actual response and adjust the `parseBlizzardTree` function in Task 6.

- [ ] **Step 14.4: Commit**

```bash
git add src/components/compare/SpecTreeTab.tsx src/lib/spec-ids.ts
git commit -m "feat: implement Spec Tree tab with unified overlay and cross-spec fallback"
```

---

## Task 15: Final Wiring and Polish

**Files:**
- Modify: `src/app/compare/page.tsx` (add Suspense for searchParams)
- Modify: `src/app/page.tsx` (verify input page works end-to-end)

- [ ] **Step 15.1: Wrap searchParams in Suspense**

Next.js App Router requires `useSearchParams()` to be wrapped in a Suspense boundary. Update `src/app/compare/page.tsx`:

```typescript
import { Suspense } from 'react'
// ... existing imports ...

function CompareContent() {
  // ... move all existing component code here (the full existing function body) ...
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted text-sm">Loading…</p>
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
```

- [ ] **Step 15.2: Run the full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 15.3: Run a build to catch type errors**

```bash
npm run build
```

Expected: Build succeeds. Fix any TypeScript errors before proceeding.

- [ ] **Step 15.4: End-to-end test**

1. Open http://localhost:3000
2. Paste `https://www.raidbots.com/simbot/report/mifG5CJJ1wEEkSqXnLsPr6`
3. Paste a second report URL
4. Click Compare
5. Verify Summary, Abilities, Spec Tree, and Stats tabs all render correctly
6. Copy the URL from the address bar and open it in a new tab — verify the comparison loads correctly (sharing works)

- [ ] **Step 15.5: Final commit**

```bash
git add -A
git commit -m "feat: complete SimCompare MVP — all tabs functional, sharing via URL"
```

---

## Task 16: Deploy to Vercel

- [ ] **Step 16.1: Install Vercel CLI**

```bash
npm i -g vercel
```

- [ ] **Step 16.2: Link project to Vercel**

```bash
vercel link
```

Follow the prompts to create a new project.

- [ ] **Step 16.3: Add environment variables to Vercel**

```bash
vercel env add BLIZZARD_CLIENT_ID
vercel env add BLIZZARD_CLIENT_SECRET
```

Enter the values from `.env.local` when prompted. Select all environments (production, preview, development).

- [ ] **Step 16.4: Deploy to production**

```bash
vercel --prod
```

Expected: build succeeds, deployment URL printed. Open the URL and verify the app works.

- [ ] **Step 16.5: Test the share link end-to-end**

Build a comparison on the deployed URL. Copy the share link. Open it in a private/incognito window. Verify it loads correctly with no local state.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Input page with URL validation, preloading, and preview cards
- ✅ Remove report (×) button on each card
- ✅ Compare button disabled until 2+ valid reports
- ✅ Comparison view at `/compare?reports=...`
- ✅ Sticky header with DPS, delta, and share button
- ✅ Four tabs: Summary, Abilities, Spec Tree, Stats
- ✅ Summary tab with DPS columns and delta banner
- ✅ Abilities tab with per-ability DPS, "X only" labels, pet toggle, delta vs best
- ✅ Spec Tree tab: unified overlay (same spec), cross-spec warning (different spec)
- ✅ TalentTree SVG renderer with color-coded nodes, hover tooltip, diffs-only toggle
- ✅ Talent string decoder (Task 5)
- ✅ Blizzard API proxy route keeping secret server-side (Task 6)
- ✅ Stats tab with pp deltas for secondary stats, fight conditions first
- ✅ Sharing via URL params — no backend state
- ✅ Tailwind color tokens for easy theming
- ✅ Vercel deployment

**Types consistent across tasks:** `Report`, `ParsedAbility`, `TalentNode`, `SelectedTalent`, `TalentTreeData`, `ReportLoadState` all defined in Task 2 and used consistently.

**Known implementation risk:** The WoW loadout export string bit-packing format in Task 5 is based on SimC documentation and may need adjustment if the actual output doesn't match expected talent selections. Verify against a known loadout string before relying on it.
