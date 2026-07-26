import { fireEvent, render, screen, within } from '@testing-library/react'
import { BaselineSelector } from '../BaselineSelector'
import type { Report } from '@/lib/types'

const reports = [
  { characterName: 'Diabolist' },
  { characterName: 'Sac Souls' },
  { characterName: 'Soul Link' },
] as Report[]

describe('BaselineSelector', () => {
  it('labels both selects', () => {
    render(<BaselineSelector reports={reports} baselineIndex={0} comparedIndex={1} onChange={() => {}} />)
    expect(screen.getByLabelText('Baseline')).toBeInTheDocument()
    expect(screen.getByLabelText('Compared with')).toBeInTheDocument()
  })

  it('never offers the same build on both sides', () => {
    render(<BaselineSelector reports={reports} baselineIndex={0} comparedIndex={1} onChange={() => {}} />)
    const compared = screen.getByLabelText('Compared with')
    expect(within(compared).queryByRole('option', { name: /Diabolist/ })).not.toBeInTheDocument()
  })

  it('reports the new pairing on change', () => {
    const onChange = vi.fn()
    render(<BaselineSelector reports={reports} baselineIndex={0} comparedIndex={1} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Compared with'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith(0, 2)
  })
})
