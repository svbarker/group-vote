import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

// Home calls useMutation; stub convex/react so the test needs no ConvexProvider
// and stays focused on route rendering.
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}))

describe('App', () => {
  it('renders the Home screen at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: /group vote/i }),
    ).toBeInTheDocument()
  })
})
