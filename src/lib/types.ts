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
    timeline_dmg: { data: number[] }
    resource_timelines: Record<string, { data: number[] }>
  }
  stats: AbilityStat[]
  stats_pets: Record<string, AbilityStat[]>
  buffs: RawBuff[]
  gains: RawGain[]
  gear: Record<string, { name: string }>
}

export interface RawBuff {
  name: string
  spell_name?: string
  uptime: number  // percentage 0–100
}

export interface RawGain {
  name: string
  // keys are resource names e.g. "soul_shard", "mana", "energy"
  [resource: string]: string | number | { actual: number; overflow: number; count: number }
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
    spell_crit?: number
    spell_haste?: number
    mastery_value?: number
    damage_versatility?: number
    haste_rating?: number
    crit_rating?: number
    mastery_rating?: number
    versatility_rating?: number
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

/** A buff with its average uptime percentage */
export interface ParsedBuff {
  name: string
  uptime: number  // 0–100
}

/** Resource gained from a single source ability */
export interface ParsedGain {
  source: string      // ability name e.g. "demonbolt"
  resource: string    // resource type e.g. "soul_shard"
  actual: number      // mean amount gained per fight
  overflow: number    // mean amount wasted (over cap)
  count: number       // mean number of gain events per fight
}

/** Tier set detected from gear item names */
export interface SetBonus {
  setName: string   // human-readable e.g. "Abyssal Immolator"
  pieces: number    // 2 or 4
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
    hasteRating: number
    critRating: number
    masteryRating: number
    versatilityRating: number
  }
  setBonus: SetBonus | null
  buffs: ParsedBuff[]
  gains: ParsedGain[]
  timelineDps: number[]                          // one DPS value per second
  resourceTimelines: Record<string, number[]>    // resource name → per-second values
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
  classNodeIds: number[]  // IDs of class talent nodes
  specNodeIds: number[]   // IDs of spec talent nodes
  heroNodeIds: number[]   // IDs of hero talent nodes (all hero trees, deduplicated)
  heroTrees: HeroTree[]   // per-hero-spec node membership (for filtering)
  specIconUrl: string     // Icon URL from Blizzard spec media API
}

/** One hero talent spec (e.g. "Diabolist") and the node IDs it owns */
export interface HeroTree {
  name: string
  nodeIds: number[]
}

export interface TalentNode {
  id: number
  row: number
  col: number
  name: string
  spellId: number
  iconUrl: string
  maxRank: number
  lockedBy: number[]
  connects: number[]
  choiceNames?: string[]  // for choice nodes: [choice0Name, choice1Name]
}

/** A decoded talent node selection from a loadout string */
export interface SelectedTalent {
  nodeId: number
  rank: number
  choiceIndex?: number  // 0 or 1 for choice nodes
}

/** Status of a report being loaded on the input page */
export type ReportLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'valid'; report: Report }
  | { status: 'error'; message: string }
