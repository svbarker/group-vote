import { render, screen } from '@testing-library/react'
import App from './App'

// App renders ConnectionStatus, which calls useQuery — stub it so the test needs
// no ConvexProvider and stays focused on the landing page.
vi.mock('convex/react', () => ({ useQuery: () => undefined }))

describe('App', () => {
  it('renders the Group Vote heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /group vote/i }),
    ).toBeInTheDocument()
  })
})
