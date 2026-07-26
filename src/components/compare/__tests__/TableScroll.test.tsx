import { render, screen } from '@testing-library/react'
import { makeReport } from '@/test/factories'
import { AbilitiesTab } from '../AbilitiesTab'
import { StatsTab } from '../StatsTab'
import { BuffsTab } from '../BuffsTab'

const reports = [
  makeReport({ id: 'a', characterName: 'Build A' }),
  makeReport({ id: 'b', characterName: 'Build B' }),
]

describe.each([
  ['Ability breakdown', AbilitiesTab],
  ['Stat comparison', StatsTab],
  ['Buffs and resources', BuffsTab],
])('%s scroll container', (label, Tab) => {
  it('is keyboard reachable and named', () => {
    render(<Tab reports={reports} />)
    const region = screen.getByRole('region', { name: label })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('table-scroll')
  })
})
