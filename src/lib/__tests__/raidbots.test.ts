import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractReportId, parseRaidbotsData, fetchReport } from '../raidbots'
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
            attribute: { intellect: 2529 },
            stats: {
              spell_power: 2529,
              spell_crit: 0.2457,
              spell_haste: 0.7949,
              mastery_value: 0.3773,
              damage_versatility: 0.0515,
            },
          },
          timeline_dmg: { data: [] },
          resource_timelines: {},
        },
        buffs: [],
        gains: [],
        gear: {},
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
        stats_pets: {},
      },
    ],
  },
}

const MOCK_RAW_EXTENDED: RaidbotsRawData = {
  sim: {
    ...MOCK_RAW.sim,
    players: [{
      ...MOCK_RAW.sim.players[0],
      buffs: [
        { name: 'demonic_core', spell_name: 'Demonic Core', uptime: 70.8 },
        { name: 'pet_movement', uptime: 4.5 },
        { name: 'demonic_power', spell_name: 'Demonic Power', uptime: 100.0 },
      ],
      gains: [
        { name: 'demonbolt', soul_shard: { actual: 190.46, overflow: 0, count: 95.23 } },
        { name: 'shadow_bolt', soul_shard: { actual: 42.77, overflow: 0, count: 42.77 } },
        { name: 'Mana Regen', mana: { actual: 634400, overflow: 263410, count: 1064 } },
      ],
      gear: {
        head:      { name: 'abyssal_immolators_smoldering_flames' },
        chest:     { name: 'abyssal_immolators_dreadrobe' },
        legs:      { name: 'abyssal_immolators_pillars' },
        hands:     { name: 'abyssal_immolators_grasps' },
        neck:      { name: 'eternal_voidsong_chain' },
        shoulders: { name: 'viceroys_umbral_mantle' },
      },
      collected_data: {
        ...MOCK_RAW.sim.players[0].collected_data,
        timeline_dmg: { data: [100000, 200000, 150000, 300000, 250000] },
        resource_timelines: {
          soul_shard: { data: [4, 3, 3, 2, 5] },
        },
      },
    }],
  },
}

describe('parseRaidbotsData — new fields', () => {
  it('parses buff uptimes, excluding buffs with uptime < 5%', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW_EXTENDED)
    expect(result.buffs).toHaveLength(2)  // pet_movement (4.5%) excluded
    const names = result.buffs.map(b => b.name)
    expect(names).toContain('Demonic Core')
    expect(names).toContain('Demonic Power')
    const core = result.buffs.find(b => b.name === 'Demonic Core')!
    expect(core.uptime).toBeCloseTo(70.8)
  })

  it('parses resource gains, skipping non-object resource values', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW_EXTENDED)
    const shardGains = result.gains.filter(g => g.resource === 'soul_shard')
    expect(shardGains).toHaveLength(2)
    const db = shardGains.find(g => g.source === 'demonbolt')!
    expect(db.actual).toBeCloseTo(190.46)
    expect(db.overflow).toBe(0)
    expect(db.count).toBeCloseTo(95.23)
  })

  it('detects set bonus from gear item name prefixes', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW_EXTENDED)
    expect(result.setBonus).not.toBeNull()
    expect(result.setBonus!.pieces).toBe(4)
    expect(result.setBonus!.setName).toBe('Abyssal Immolator')
  })

  it('returns null setBonus when fewer than 2 matching items', () => {
    const noSet: RaidbotsRawData = {
      ...MOCK_RAW_EXTENDED,
      sim: {
        ...MOCK_RAW_EXTENDED.sim,
        players: [{
          ...MOCK_RAW_EXTENDED.sim.players[0],
          gear: {
            head: { name: 'eternal_voidsong_chain' },
            neck: { name: 'viceroys_umbral_mantle' },
          },
        }],
      },
    }
    const result = parseRaidbotsData('abc123', noSet)
    expect(result.setBonus).toBeNull()
  })

  it('parses DPS timeline', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW_EXTENDED)
    expect(result.timelineDps).toEqual([100000, 200000, 150000, 300000, 250000])
  })

  it('parses resource timelines', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW_EXTENDED)
    expect(result.resourceTimelines['soul_shard']).toEqual([4, 3, 3, 2, 5])
  })

  it('returns setBonus with pieces: 2 for exactly 2 matching gear items', () => {
    const twopiece: RaidbotsRawData = {
      ...MOCK_RAW_EXTENDED,
      sim: {
        ...MOCK_RAW_EXTENDED.sim,
        players: [{
          ...MOCK_RAW_EXTENDED.sim.players[0],
          gear: {
            head:  { name: 'abyssal_immolators_smoldering_flames' },
            chest: { name: 'abyssal_immolators_dreadrobe' },
            neck:  { name: 'eternal_voidsong_chain' },
          },
        }],
      },
    }
    const result = parseRaidbotsData('abc123', twopiece)
    expect(result.setBonus).not.toBeNull()
    expect(result.setBonus!.pieces).toBe(2)
  })

  it('uses buff name as fallback when spell_name is absent', () => {
    const noSpellName: RaidbotsRawData = {
      ...MOCK_RAW_EXTENDED,
      sim: {
        ...MOCK_RAW_EXTENDED.sim,
        players: [{
          ...MOCK_RAW_EXTENDED.sim.players[0],
          buffs: [{ name: 'demonic_power', uptime: 50.0 }],
        }],
      },
    }
    const result = parseRaidbotsData('abc123', noSpellName)
    expect(result.buffs).toHaveLength(1)
    expect(result.buffs[0].name).toBe('Demonic Power')
  })
})

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
    expect(result.abilities[0].percentOfTotal).toBeGreaterThan(0)
  })

  it('passes through hero spec for the actively-simmed spec, ignoring other specs in the envelope', () => {
    // Mirrors real Raidbots data: every spec the character has loadouts for
    // appears, each with its own active loadout. Demonology Warlock is being
    // simmed (spec 266) — picking the first entry blindly would return
    // Affliction's hero spec instead.
    const withHero: RaidbotsRawData = {
      ...MOCK_RAW,
      simbot: {
        meta: {
          rawFormData: {
            character: {
              v2: {
                specializations: {
                  specializations: [
                    { specialization: { id: 265, name: 'Affliction' },  loadouts: [{ is_active: true, selected_hero_talent_tree: { id: 58, name: 'Hellcaller' } }] },
                    { specialization: { id: 266, name: 'Demonology' },  loadouts: [{ is_active: true, selected_hero_talent_tree: { id: 59, name: 'Diabolist' } }] },
                    { specialization: { id: 267, name: 'Destruction' }, loadouts: [{ is_active: true, selected_hero_talent_tree: { id: 57, name: 'Soul Harvester' } }] },
                  ],
                },
              },
            },
          },
        },
      },
    }
    const result = parseRaidbotsData('abc123', withHero)
    expect(result.selectedHeroTreeId).toBe(59)
    expect(result.selectedHeroName).toBe('Diabolist')
  })

  it('handles localized hero name objects ({ en_US })', () => {
    const localized: RaidbotsRawData = {
      ...MOCK_RAW,
      sim: {
        ...MOCK_RAW.sim,
        players: [{ ...MOCK_RAW.sim.players[0], specialization: 'Unholy Death Knight' }],
      },
      simbot: {
        meta: {
          rawFormData: {
            character: {
              v2: {
                specializations: {
                  specializations: [
                    { specialization: { id: 252, name: 'Unholy' }, loadouts: [{ is_active: true, selected_hero_talent_tree: { id: 32, name: { en_US: 'Rider of the Apocalypse' } } }] },
                  ],
                },
              },
            },
          },
        },
      },
    }
    const result = parseRaidbotsData('abc123', localized)
    expect(result.selectedHeroName).toBe('Rider of the Apocalypse')
  })

  it('leaves hero fields undefined when simbot envelope is absent', () => {
    const result = parseRaidbotsData('abc123', MOCK_RAW)
    expect(result.selectedHeroTreeId).toBeUndefined()
    expect(result.selectedHeroName).toBeUndefined()
  })

  it('leaves hero fields undefined when no envelope entry matches the simmed spec', () => {
    const mismatched: RaidbotsRawData = {
      ...MOCK_RAW,
      simbot: {
        meta: {
          rawFormData: {
            character: {
              v2: {
                specializations: {
                  specializations: [
                    { specialization: { id: 265, name: 'Affliction' }, loadouts: [{ is_active: true, selected_hero_talent_tree: { id: 58, name: 'Hellcaller' } }] },
                  ],
                },
              },
            },
          },
        },
      },
    }
    const result = parseRaidbotsData('abc123', mismatched)
    expect(result.selectedHeroTreeId).toBeUndefined()
    expect(result.selectedHeroName).toBeUndefined()
  })
})

describe('fetchReport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('constructs the correct URL and returns a Report', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RAW,
    } as Response)
    const report = await fetchReport('mifG5CJJ1wEEkSqXnLsPr6')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/report/mifG5CJJ1wEEkSqXnLsPr6'
    )
    expect(report.id).toBe('mifG5CJJ1wEEkSqXnLsPr6')
  })

  it('throws when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    await expect(fetchReport('bad')).rejects.toThrow('404')
  })
})
