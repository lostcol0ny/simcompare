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
