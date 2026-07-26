import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Room } from './Room'

// Room owns the reactive query and the phase switch; mock the hook to drive each
// state deterministically (PLAN §2.5). Child screens have their own tests.
const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))
vi.mock('convex/react', () => ({
  useQuery: () => useQueryMock(),
  useMutation: () => vi.fn(),
}))
vi.mock('@/lib/identity', () => ({
  getUserId: () => 'me',
  getHostToken: () => null,
}))

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={['/room/WXYZ']}>
      <Routes>
        <Route path="/room/:code" element={<Room />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Room', () => {
  it('shows a loading state before the first result', () => {
    useQueryMock.mockReturnValue(undefined)
    renderRoom()
    expect(screen.getByText(/loading room/i)).toBeInTheDocument()
  })

  it('shows room-not-found when the query returns null', () => {
    useQueryMock.mockReturnValue(null)
    renderRoom()
    expect(
      screen.getByRole('heading', { name: /room not found/i }),
    ).toBeInTheDocument()
  })

  it('renders the lobby while the poll is in the lobby phase', () => {
    useQueryMock.mockReturnValue({
      poll: {
        code: 'WXYZ',
        title: 'Dinner',
        phase: 'lobby',
        allowUserOptions: true,
        createdAt: 0,
      },
      ballotCount: 0,
      users: [{ userId: 'me', name: 'Mo', isHost: false, joinedAt: 1 }],
      options: [],
    })
    renderRoom()
    expect(screen.getByText(/1 person here/i)).toBeInTheDocument()
  })

  it('renders the voting surface once the poll is in the voting phase', () => {
    useQueryMock.mockReturnValue({
      poll: {
        code: 'WXYZ',
        title: 'Dinner',
        phase: 'voting',
        allowUserOptions: true,
        createdAt: 0,
      },
      ballotCount: 0,
      users: [{ userId: 'me', name: 'Mo', isHost: false, joinedAt: 1 }],
      options: [{ id: 'o1', text: 'Pizza', addedByUserId: 'me', createdAt: 1 }],
    })
    renderRoom()
    expect(
      screen.getByRole('button', { name: /submit ranking/i }),
    ).toBeInTheDocument()
  })

  it('renders the reveal screen once the poll is revealed', () => {
    // The mock returns one value for every useQuery; this object satisfies both
    // getPollState (Room reads .poll.phase) and getResults (Reveal reads
    // .standings), so Room routes to the reveal and it renders the winner.
    useQueryMock.mockReturnValue({
      poll: {
        code: 'WXYZ',
        title: 'Dinner',
        phase: 'revealed',
        allowUserOptions: true,
        createdAt: 0,
      },
      ballotCount: 1,
      users: [{ userId: 'me', name: 'Mo', isHost: false, joinedAt: 1 }],
      options: [{ id: 'o1', text: 'Pizza', addedByUserId: 'me', createdAt: 1 }],
      standings: [{ optionId: 'o1', text: 'Pizza', score: 2, firstPlaceVotes: 1 }],
    })
    renderRoom()
    expect(screen.getByText(/results ·/i)).toBeInTheDocument()
    expect(screen.getByText(/winner/i)).toBeInTheDocument()
  })
})
