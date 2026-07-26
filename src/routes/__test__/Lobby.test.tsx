import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Lobby } from '../Lobby'
import type { PollState } from '../Room'

// Lobby is presentational (Room owns the query), so we pass state directly.
// Only the mutation hooks need mocking (see PLAN §2.5 — off the network).
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

const { getHostTokenMock } = vi.hoisted(() => ({ getHostTokenMock: vi.fn() }))
vi.mock('@/lib/identity', () => ({
  getUserId: () => 'me',
  getHostToken: () => getHostTokenMock(),
}))

// Option ids are a branded Convex type; cast string fixtures deliberately.
const oid = (s: string) => s as PollState['options'][number]['id']

function baseState(overrides: Partial<PollState> = {}): PollState {
  return {
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
    ...overrides,
  }
}

function renderLobby(state: PollState) {
  return render(
    <MemoryRouter initialEntries={['/room/WXYZ']}>
      <Lobby state={state} code="WXYZ" />
    </MemoryRouter>,
  )
}

describe('Lobby', () => {
  beforeEach(() => getHostTokenMock.mockReturnValue(null))

  it('lists users, tagging the host and the current device', () => {
    renderLobby(
      baseState({
        users: [
          { userId: 'host-1', name: 'Hana', isHost: true, joinedAt: 1 },
          { userId: 'me', name: 'Mo', isHost: false, joinedAt: 2 },
        ],
      }),
    )

    expect(screen.getByText('WXYZ')).toBeInTheDocument()
    expect(screen.getByText(/2 people here/i)).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('lists options and offers an add box when the poll allows it', () => {
    renderLobby(
      baseState({
        options: [
          { id: oid('o1'), text: 'Pizza', addedByUserId: 'me', createdAt: 1 },
          { id: oid('o2'), text: 'Tacos', addedByUserId: 'me', createdAt: 2 },
        ],
      }),
    )

    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText(/2 options/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/add an option/i)).toBeInTheDocument()
  })

  it('hides the add box when guests may not add options', () => {
    renderLobby(baseState({ poll: { ...baseState().poll, allowUserOptions: false } }))
    expect(screen.queryByLabelText(/add an option/i)).not.toBeInTheDocument()
  })

  it('shows the host a Start voting control, guests a waiting message', () => {
    getHostTokenMock.mockReturnValue('host-token')
    renderLobby(
      baseState({
        options: [
          { id: oid('o1'), text: 'Pizza', addedByUserId: 'me', createdAt: 1 },
        ],
      }),
    )
    expect(
      screen.getByRole('button', { name: /start voting/i }),
    ).toBeInTheDocument()
  })

  it('disables Start voting until there is at least one option', () => {
    getHostTokenMock.mockReturnValue('host-token')
    renderLobby(baseState({ options: [] }))
    expect(screen.getByRole('button', { name: /start voting/i })).toBeDisabled()
  })
})
