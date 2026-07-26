import { render, screen, fireEvent } from '@testing-library/react'
import { TabNav } from '../TabNav'

const press = (key: string) =>
  fireEvent.keyDown(document.activeElement as HTMLElement, { key })

describe('TabNav', () => {
  it('exposes a tablist with one selected tab', () => {
    render(<TabNav active="talents" onChange={() => {}} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(6)
    expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1)
  })

  it('wires each tab to its panel', () => {
    render(<TabNav active="summary" onChange={() => {}} />)
    const tab = screen.getByRole('tab', { name: 'Talents' })
    expect(tab).toHaveAttribute('id', 'tab-talents')
    expect(tab).toHaveAttribute('aria-controls', 'panel-talents')
  })

  it('keeps only the active tab in the tab order', () => {
    render(<TabNav active="stats" onChange={() => {}} />)
    const inOrder = screen.getAllByRole('tab').filter((t) => t.tabIndex === 0)
    expect(inOrder).toHaveLength(1)
    expect(inOrder[0]).toHaveAccessibleName('Stats')
  })

  it('selects the next tab on ArrowRight', () => {
    const onChange = vi.fn()
    render(<TabNav active="summary" onChange={onChange} />)
    screen.getByRole('tab', { name: 'Summary' }).focus()
    press('ArrowRight')
    expect(onChange).toHaveBeenCalledWith('abilities')
  })

  it('wraps from the last tab to the first on ArrowRight', () => {
    const onChange = vi.fn()
    render(<TabNav active="buffs" onChange={onChange} />)
    screen.getByRole('tab', { name: 'Buffs & Resources' }).focus()
    press('ArrowRight')
    expect(onChange).toHaveBeenCalledWith('summary')
  })

  it('jumps to the first and last tab on Home and End', () => {
    const onChange = vi.fn()
    render(<TabNav active="stats" onChange={onChange} />)
    screen.getByRole('tab', { name: 'Stats' }).focus()
    press('Home')
    expect(onChange).toHaveBeenCalledWith('summary')
    press('End')
    expect(onChange).toHaveBeenCalledWith('buffs')
  })
})
