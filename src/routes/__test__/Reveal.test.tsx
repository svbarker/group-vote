import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Reveal } from '../Reveal'
import type { PollState } from '../Room'

// Mock the reactive results query; each test sets its return value.
const { useQueryMock, getHostTokenMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  getHostTokenMock: vi.fn(),
}))
vi.mock('convex/react', () => ({ useQuery: () => useQueryMock() }))
vi.mock('@/lib/identity', () => ({ getHostToken: () => getHostTokenMock() }))

const state = {
  poll: {
    code: 'WXYZ',
    title: 'Dinner',
    phase: 'revealed',
    allowUserOptions: true,
    createdAt: 0,
  },
  ballotCount: 3,
  users: [],
  options: [],
} as unknown as PollState

function renderReveal() {
  return render(
    <MemoryRouter>
      <Reveal state={state} code="WXYZ" />
    </MemoryRouter>,
  )
}

describe('Reveal', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    getHostTokenMock.mockReset().mockReturnValue(null)
  })

  it('shows a tallying state until results arrive', () => {
    useQueryMock.mockReturnValue(undefined)
    renderReveal()
    expect(screen.getByText(/tallying the votes/i)).toBeInTheDocument()
  })

  it('spotlights a single winner and lists full standings', () => {
    useQueryMock.mockReturnValue({
      poll: { code: 'WXYZ', title: 'Dinner' },
      ballotCount: 3,
      standings: [
        { optionId: 'o1', text: 'Tacos', score: 5, firstPlaceVotes: 2 },
        { optionId: 'o2', text: 'Pizza', score: 3, firstPlaceVotes: 1 },
        { optionId: 'o3', text: 'Sushi', score: 1, firstPlaceVotes: 0 },
      ],
    })
    renderReveal()
    expect(screen.getByText(/winner/i)).toBeInTheDocument()
    // Winner name renders in the spotlight and the standings list.
    expect(screen.getAllByText('Tacos').length).toBeGreaterThan(0)
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText(/3 ballots counted/i)).toBeInTheDocument()
  })

  it('calls out a tie when the top score is shared', () => {
    useQueryMock.mockReturnValue({
      poll: { code: 'WXYZ', title: 'Dinner' },
      ballotCount: 2,
      standings: [
        { optionId: 'o1', text: 'Tacos', score: 2, firstPlaceVotes: 1 },
        { optionId: 'o2', text: 'Pizza', score: 2, firstPlaceVotes: 1 },
      ],
    })
    renderReveal()
    expect(screen.getByText(/it's a tie/i)).toBeInTheDocument()
  })

  it('reports no clear winner when every ballot rejected everything', () => {
    useQueryMock.mockReturnValue({
      poll: { code: 'WXYZ', title: 'Dinner' },
      ballotCount: 1,
      standings: [
        { optionId: 'o1', text: 'Tacos', score: 0, firstPlaceVotes: 0 },
        { optionId: 'o2', text: 'Pizza', score: 0, firstPlaceVotes: 0 },
      ],
    })
    renderReveal()
    expect(screen.getByText(/no clear winner/i)).toBeInTheDocument()
  })

  it('offers the host a new-poll control; guests only see leave', () => {
    getHostTokenMock.mockReturnValue('host-token')
    useQueryMock.mockReturnValue({
      poll: { code: 'WXYZ', title: 'Dinner' },
      ballotCount: 1,
      standings: [{ optionId: 'o1', text: 'Tacos', score: 2, firstPlaceVotes: 1 }],
    })
    renderReveal()
    expect(
      screen.getByRole('button', { name: /start a new poll/i }),
    ).toBeInTheDocument()
  })
})
