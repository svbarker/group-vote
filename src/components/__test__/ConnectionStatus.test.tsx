import { render, screen } from '@testing-library/react'
import { ConnectionStatus } from '../ConnectionStatus'

// Mock the Convex hook so the component test never opens a websocket; hoisted so
// the mock factory can reference it despite vi.mock being lifted to the top.
const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))
vi.mock('convex/react', () => ({ useQuery: () => useQueryMock() }))

describe('ConnectionStatus', () => {
  it('shows a connecting state while the query is loading', () => {
    useQueryMock.mockReturnValue(undefined)
    render(<ConnectionStatus />)
    expect(screen.getByText(/connecting to convex/i)).toBeInTheDocument()
  })

  it('shows the live server time once connected', () => {
    useQueryMock.mockReturnValue({ ok: true, serverTime: 0 })
    render(<ConnectionStatus />)
    expect(screen.getByText(/backend live/i)).toBeInTheDocument()
  })
})
