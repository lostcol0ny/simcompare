import type { RaidbotsRawData, Report, ParsedAbility } from './types'

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
  // Always negative so it won't collide with real spell IDs
  return h <= 0 ? h - 1 : -h - 1
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
          // Flatten the (potentially nested) pet actor tree to leaf abilities
          // that have actual DPS, then merge duplicates by spell name. This handles
          // both real pets (Felguard has Felstorm + Legion Strike + Melee) and
          // ability-based actors (Implosion imps all cast "Implosion").
          const rawChildren = parseAbilities(petStats, totalDps)
          const leaves = collectLeaves(rawChildren)
          if (leaves.length === 0) return null

          const merged = mergeLeavesByName(leaves, totalDps)
          const petDps = merged.reduce((sum, a) => sum + a.dps, 0)

          if (merged.length === 1) {
            // Single ability → promote to player level, no expand arrow
            return merged[0] satisfies ParsedAbility
          }

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

  // buffed_stats nests the computed stats under a `stats` sub-object
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
  }
}

/** Recursively collect all abilities with dps > 0 from a parsed tree. */
function collectLeaves(abilities: ParsedAbility[]): ParsedAbility[] {
  const result: ParsedAbility[] = []
  for (const a of abilities) {
    if (a.dps > 0) {
      result.push(a)
    } else if (a.children.length > 0) {
      result.push(...collectLeaves(a.children))
    }
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

    // SimC compound ability pattern: parent has dps:0 and one or more children
    // all sharing the same spell name. Collapse by summing child DPS into the parent
    // so it appears as a flat ability rather than an expandable group.
    let flatChildren = children
    if (dps === 0 && children.length > 0 && children.every((c) => c.spellName === spellName)) {
      dps = children.reduce((sum, c) => sum + c.dps, 0)
      flatChildren = []
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
