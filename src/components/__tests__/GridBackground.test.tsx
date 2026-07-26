import { render } from '@testing-library/react'
import { GridBackground } from '../GridBackground'

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const ctxStub = new Proxy({}, { get: () => vi.fn() })

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxStub) as never
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GridBackground', () => {
  it('starts an animation loop when motion is allowed', () => {
    mockMatchMedia(false)
    render(<GridBackground />)
    expect(requestAnimationFrame).toHaveBeenCalled()
  })

  it('never starts a loop when reduced motion is requested', () => {
    mockMatchMedia(true)
    render(<GridBackground />)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('cancels the loop on unmount', () => {
    mockMatchMedia(false)
    const { unmount } = render(<GridBackground />)
    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
