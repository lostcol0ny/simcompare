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

export function parseRaidbotsData(reportId: string, raw: RaidbotsRawData): Report {
  const player = raw.sim.players[0]
  const opts = raw.sim.options
  const cd = player.collected_data

  const totalDps = cd.dps.mean
  const allStats = [...(player.stats ?? []), ...(player.stats_pets ?? [])]

  const abilities = parseAbilities(allStats, totalDps)

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
