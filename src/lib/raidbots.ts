import type { RaidbotsRawData, Report, ParsedAbility, ParsedBuff, ParsedGain, SetBonus } from './types'

const RAIDBOTS_REPORT_PATTERN = /raidbots\.com\/simbot\/report\/([A-Za-z0-9]+)/

export function extractReportId(url: string): string | null {
  const match = url.match(RAIDBOTS_REPORT_PATTERN)
  return match ? match[1] : null
}

export async function fetchReport(reportId: string): Promise<Report> {
  const res = await fetch(`/api/report/${reportId}`)
  if (!res.ok) throw new Error(`Report not found (${res.status})`)
  const raw: RaidbotsRawData = await res.json()
  return parseRaidbotsData(reportId, raw)
}

function formatPetName(key: string): string {
  return key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function petNameToId(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  }
  return h <= 0 ? h - 1 : -h - 1
}

/**
 * Detect tier set from gear item names by grouping on first 2 underscore-segments.
 * Returns the largest group if it has >= 2 pieces.
 * e.g. "abyssal_immolators_dreadrobe" -> prefix "abyssal_immolators"
 */
function detectSetBonus(gear: Record<string, { name: string }>): SetBonus | null {
  const prefixCount = new Map<string, number>()
  for (const item of Object.values(gear)) {
    const parts = item.name.split('_')
    if (parts.length < 3) continue  // no unique suffix -> not a set item
    const prefix = parts.slice(0, 2).join('_')
    prefixCount.set(prefix, (prefixCount.get(prefix) ?? 0) + 1)
  }
  let best: [string, number] | null = null
  for (const [prefix, count] of prefixCount) {
    if (count >= 2 && (!best || count > best[1])) best = [prefix, count]
  }
  if (!best) return null
  // Format: "abyssal_immolators" -> "Abyssal Immolator" (drop trailing 's')
  const words = best[0].split('_')
  const setName = words
    .map((w, i) => {
      const title = w.charAt(0).toUpperCase() + w.slice(1)
      return i === words.length - 1 ? title.replace(/s$/, '') : title
    })
    .join(' ')
  return { setName, pieces: best[1] }
}

function parseBuff(raw: { name: string; spell_name?: string; uptime: number }): ParsedBuff {
  const rawName = raw.spell_name || raw.name
  const name = rawName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { name, uptime: raw.uptime }
}

function parseGains(rawGains: RaidbotsRawData['sim']['players'][0]['gains']): ParsedGain[] {
  const result: ParsedGain[] = []
  for (const gain of rawGains) {
    for (const [key, val] of Object.entries(gain)) {
      if (key === 'name') continue
      if (typeof val !== 'object' || val === null) continue
      const v = val as { actual: number; overflow: number; count: number }
      if (v.actual <= 0) continue
      result.push({
        source: gain.name as string,
        resource: key,
        actual: v.actual,
        overflow: v.overflow,
        count: v.count,
      })
    }
  }
  return result
}

export function parseRaidbotsData(reportId: string, raw: RaidbotsRawData): Report {
  const player = raw.sim.players[0]
  const opts = raw.sim.options
  const cd = player.collected_data

  const totalDps = cd.dps.mean
  const playerAbilities = parseAbilities(player.stats ?? [], totalDps)

  const petGroupAbilities: ParsedAbility[] = player.stats_pets
    ? Object.entries(player.stats_pets)
        .map(([petKey, petStats]) => {
          const rawChildren = parseAbilities(petStats, totalDps)
          const leaves = collectLeaves(rawChildren)
          if (leaves.length === 0) return null
          const merged = mergeLeavesByName(leaves, totalDps)
          const petDps = merged.reduce((sum, a) => sum + a.dps, 0)
          if (merged.length === 1) return merged[0] satisfies ParsedAbility
          return {
            id: petNameToId(petKey),
            spellName: formatPetName(petKey),
            school: 'physical',
            dps: petDps,
            castsPerFight: 0,
            percentOfTotal: totalDps > 0 ? (petDps / totalDps) * 100 : 0,
            children: merged,
          } satisfies ParsedAbility
        })
        .filter((p): p is ParsedAbility => p !== null)
    : []

  const abilities = [...playerAbilities, ...petGroupAbilities].sort((a, b) => b.dps - a.dps)

  const bs = cd.buffed_stats as {
    attribute?: { intellect?: number }
    stats?: {
      spell_power?: number
      spell_crit?: number
      spell_haste?: number
      mastery_value?: number
      damage_versatility?: number
    }
  }

  const MIN_UPTIME = 5  // % — filter out transient/irrelevant buffs
  const buffs: ParsedBuff[] = (player.buffs ?? [])
    .filter((b) => b.uptime >= MIN_UPTIME)
    .map(parseBuff)
    .sort((a, b) => b.uptime - a.uptime)

  const gains: ParsedGain[] = parseGains(player.gains ?? [])

  const timelineDps: number[] = cd.timeline_dmg?.data ?? []
  const resourceTimelines: Record<string, number[]> = {}
  for (const [resource, tl] of Object.entries(cd.resource_timelines ?? {})) {
    resourceTimelines[resource] = tl.data
  }

  const setBonus = detectSetBonus(player.gear ?? {})

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
      intellect: bs.attribute?.intellect ?? 0,
      spellPower: bs.stats?.spell_power ?? 0,
      spellCrit: (bs.stats?.spell_crit ?? 0) * 100,
      spellHaste: (bs.stats?.spell_haste ?? 0) * 100,
      mastery: (bs.stats?.mastery_value ?? 0) * 100,
      versatility: (bs.stats?.damage_versatility ?? 0) * 100,
    },
    setBonus,
    buffs,
    gains,
    timelineDps,
    resourceTimelines,
  }
}

/** Recursively collect all abilities with dps > 0 from a parsed tree. */
function collectLeaves(abilities: ParsedAbility[]): ParsedAbility[] {
  const result: ParsedAbility[] = []
  for (const a of abilities) {
    if (a.dps > 0) result.push(a)
    else if (a.children.length > 0) result.push(...collectLeaves(a.children))
  }
  return result
}

/** Merge leaf abilities by spell name, summing DPS and casts. */
function mergeLeavesByName(leaves: ParsedAbility[], totalDps: number): ParsedAbility[] {
  const map = new Map<string, ParsedAbility>()
  for (const a of leaves) {
    const existing = map.get(a.spellName)
    if (existing) {
      const dps = existing.dps + a.dps
      map.set(a.spellName, {
        ...existing,
        dps,
        castsPerFight: existing.castsPerFight + a.castsPerFight,
        percentOfTotal: totalDps > 0 ? (dps / totalDps) * 100 : 0,
      })
    } else {
      map.set(a.spellName, { ...a, children: [] })
    }
  }
  return [...map.values()].sort((a, b) => b.dps - a.dps)
}

function parseAbilities(
  stats: RaidbotsRawData['sim']['players'][0]['stats'],
  totalDps: number
): ParsedAbility[] {
  const parsed: ParsedAbility[] = []

  for (const stat of stats) {
    let dps = stat.portion_aps?.mean ?? 0
    const children = stat.children ? parseAbilities(stat.children, totalDps) : []

    if (dps === 0 && children.length === 0) continue

    const rawName = stat.spell_name || stat.name || ''
    const spellName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
    if (!spellName) continue

    let flatChildren = children
    if (dps === 0 && children.length > 0) {
      const childSum = children.reduce((sum, c) => sum + c.dps, 0)
      if (childSum > 0) {
        dps = childSum
        if (children.every((c) => c.spellName === spellName)) {
          flatChildren = []
        }
      }
    }

    parsed.push({
      id: stat.id,
      spellName,
      school: stat.school ?? 'physical',
      dps,
      castsPerFight: stat.num_executes.mean,
      percentOfTotal: totalDps > 0 ? (dps / totalDps) * 100 : 0,
      children: flatChildren,
    })
  }

  return parsed.sort((a, b) => b.dps - a.dps)
}
