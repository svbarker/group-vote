import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Lobby } from './Lobby'

// Mock the reactive hook so we can drive each render state deterministically
// (see PLAN §2.5 — component tests mock the Convex hook rather than hit the net).
const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))
vi.mock('convex/react', () => ({
  useQuery: () => useQueryMock(),
  useMutation: () => vi.fn(),
}))
vi.mock('@/lib/identity', () => ({
  getUserId: () => 'me',
  getHostToken: () => null,
}))

function renderLobby() {
  return render(
    <MemoryRouter initialEntries={['/room/WXYZ']}>
      <Routes>
        <Route path="/room/:code" element={<Lobby />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Lobby', () => {
  it('shows a loading state before the first result', () => {
    useQueryMock.mockReturnValue(undefined)
    renderLobby()
    expect(screen.getByText(/loading room/i)).toBeInTheDocument()
  })

  it('shows room-not-found when the query returns null', () => {
    useQueryMock.mockReturnValue(null)
    renderLobby()
    expect(
      screen.getByRole('heading', { name: /room not found/i }),
    ).toBeInTheDocument()
  })

  it('lists users, tagging the host and the current device', () => {
    useQueryMock.mockReturnValue({
      poll: {
        code: 'WXYZ',
        title: 'Dinner',
        phase: 'lobby',
        allowUserOptions: true,
        createdAt: 0,
      },
      users: [
        { userId: 'host-1', name: 'Hana', isHost: true, joinedAt: 1 },
        { userId: 'me', name: 'Mo', isHost: false, joinedAt: 2 },
      ],
      options: [],
    })
    renderLobby()

    expect(screen.getByText('WXYZ')).toBeInTheDocument()
    expect(screen.getByText(/2 people here/i)).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('lists options and offers an add box when the poll allows it', () => {
    useQueryMock.mockReturnValue({
      poll: {
        code: 'WXYZ',
        title: 'Dinner',
        phase: 'lobby',
        allowUserOptions: true,
        createdAt: 0,
      },
      users: [{ userId: 'me', name: 'Mo', isHost: false, joinedAt: 1 }],
      options: [
        { id: 'o1', text: 'Pizza', addedByUserId: 'me', createdAt: 1 },
        { id: 'o2', text: 'Tacos', addedByUserId: 'me', createdAt: 2 },
      ],
    })
    renderLobby()

    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText(/2 options/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/add an option/i)).toBeInTheDocument()
  })

  it('hides the add box when guests may not add options', () => {
    useQueryMock.mockReturnValue({
      poll: {
        code: 'WXYZ',
        title: 'Dinner',
        phase: 'lobby',
        allowUserOptions: false,
        createdAt: 0,
      },
      users: [{ userId: 'me', name: 'Mo', isHost: false, joinedAt: 1 }],
      options: [],
    })
    renderLobby()

    expect(screen.queryByLabelText(/add an option/i)).not.toBeInTheDocument()
  })
})
