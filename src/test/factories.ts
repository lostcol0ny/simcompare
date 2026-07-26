import type { Report } from '@/lib/types'

export function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'r1',
    characterName: 'Build A',
    specialization: 'Demonology',
    race: 'Orc',
    talentString: '',
    dps: 1_284_910,
    dpsStdDev: 0,
    dpsMin: 0,
    dpsMax: 0,
    dpsRawStdDev: 0,
    fightStyle: 'Patchwerk',
    targetCount: 1,
    fightDuration: 300,
    varyLength: 0,
    abilities: [],
    buffedStats: {
      intellect: 0, spellPower: 0, spellCrit: 0, spellHaste: 0, mastery: 0,
      versatility: 0, hasteRating: 0, critRating: 0, masteryRating: 0,
      versatilityRating: 0,
    },
    setBonus: null,
    buffs: [],
    gains: [],
    timelineDps: [],
    resourceTimelines: {},
    ...overrides,
  }
}
