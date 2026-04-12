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
    expect(result.abilities[0].percentOfTotal).toBeGreaterThan(0)
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
