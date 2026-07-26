import { render, screen } from '@testing-library/react'
import { DeltaLedger } from '../DeltaLedger'
import { buildHue } from '@/lib/build-colors'
import type { Report, ParsedAbility } from '@/lib/types'

function ability(id: number, spellName: string, dps: number): ParsedAbility {
  return { id, spellName, school: 'shadow', dps, dpsStdDev: 0, castsPerFight: 0, percentOfTotal: 0, children: [] }
}

const baseline = { dps: 1_284_910, characterName: 'A', abilities: [ability(1, 'Demonbolt', 341_220)] } as Report
const compared = { dps: 1_246_332, characterName: 'B', abilities: [ability(1, 'Demonbolt', 317_110)] } as Report

describe('DeltaLedger', () => {
  it('leads with the signed total', () => {
    render(<DeltaLedger baseline={baseline} compared={compared} comparedIndex={1} />)
    expect(screen.getByText('−38,578')).toBeInTheDocument()
  })

  it('signs every ability delta explicitly', () => {
    render(<DeltaLedger baseline={baseline} compared={compared} comparedIndex={1} />)
    expect(screen.getByText('−24,110')).toBeInTheDocument()
  })

  it('draws bars in the compared build\'s hue, not a valence colour', () => {
    const { container } = render(<DeltaLedger baseline={baseline} compared={compared} comparedIndex={1} />)
    const bar = container.querySelector('[data-testid="delta-bar"]') as HTMLElement
    expect(bar.style.backgroundColor).toBe(hexToRgb(buildHue(1)))
  })

  it('shows the unaccounted remainder rather than hiding it', () => {
    render(<DeltaLedger baseline={baseline} compared={compared} comparedIndex={1} />)
    expect(screen.getByText(/everything else/i)).toBeInTheDocument()
    // remainder = total − Σrow_deltas = (1_246_332 − 1_284_910) − (317_110 − 341_220)
    //           = −38_578 − (−24_110) = −14_468
    // signed(−14_468) → '−14,468'
    expect(screen.getByText('−14,468')).toBeInTheDocument()
  })
})

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}
