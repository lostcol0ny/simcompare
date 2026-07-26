import type { Report, ParsedAbility } from '@/lib/types'

export interface AbilityDelta {
  id: number
  name: string
  baseline: number
  compared: number
  delta: number
}

function byId(abilities: ParsedAbility[]): Map<number, ParsedAbility> {
  return new Map(abilities.map((a) => [a.id, a]))
}

/**
 * Top-level abilities only. Child abilities roll up into their parent, so
 * including them would double-count. Anything the visible rows fail to
 * account for is returned as `remainder` rather than dropped — the ledger
 * must always sum to the headline figure.
 */
export function computeAbilityDeltas(
  baseline: Report,
  compared: Report,
  limit = 8
): { rows: AbilityDelta[]; remainder: number; total: number } {
  const baseById = byId(baseline.abilities)
  const compById = byId(compared.abilities)

  const all: AbilityDelta[] = []
  for (const id of new Set([...baseById.keys(), ...compById.keys()])) {
    const base = baseById.get(id)
    const comp = compById.get(id)
    all.push({
      id,
      name: comp?.spellName ?? base!.spellName,
      baseline: base?.dps ?? 0,
      compared: comp?.dps ?? 0,
      delta: (comp?.dps ?? 0) - (base?.dps ?? 0),
    })
  }

  all.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const rows = all.slice(0, limit)
  const total = compared.dps - baseline.dps
  const remainder = total - rows.reduce((sum, r) => sum + r.delta, 0)

  return { rows, remainder, total }
}
