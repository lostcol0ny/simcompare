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
      spellName: first.spellName,
      school: first.school,
      maxDps,
      values,
      children: allChildIds.size > 0 ? buildAbilityRows(childReports) : [],
    })
  }

  return rows.sort((a, b) => b.maxDps - a.maxDps)
}
