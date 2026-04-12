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
  stats_pets: Record<string, AbilityStat[]>
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
  attribute?: { intellect?: number }
  stats?: {
    spell_power?: number
    spell_crit?: number       // decimal fraction, e.g. 0.2456
    spell_haste?: number      // decimal fraction, e.g. 0.7948
    mastery_value?: number    // decimal fraction, e.g. 0.3773
    damage_versatility?: number // decimal fraction, e.g. 0.0514
  }
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
