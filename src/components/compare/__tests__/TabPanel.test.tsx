import { render, screen } from '@testing-library/react'
import { TabPanel } from '../TabPanel'

describe('TabPanel', () => {
  it('marks the inactive panel inert', () => {
    render(<TabPanel id="stats" active={false}>content</TabPanel>)
    expect(screen.getByText('content')).toHaveAttribute('inert')
  })

  it('does not mark the active panel inert', () => {
    render(<TabPanel id="stats" active>content</TabPanel>)
    expect(screen.getByText('content')).not.toHaveAttribute('inert')
  })

  it('exposes tabpanel semantics wired to its tab', () => {
    render(<TabPanel id="talents" active>content</TabPanel>)
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('id', 'panel-talents')
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-talents')
  })

  it('applies the active class only when active', () => {
    const { rerender } = render(<TabPanel id="buffs" active={false}>c</TabPanel>)
    expect(screen.getByText('c')).not.toHaveClass('tab-panel-active')
    rerender(<TabPanel id="buffs" active>c</TabPanel>)
    expect(screen.getByText('c')).toHaveClass('tab-panel-active')
  })
})
