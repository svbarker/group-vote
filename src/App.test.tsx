import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the Group Vote heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /group vote/i }),
    ).toBeInTheDocument()
  })
})
