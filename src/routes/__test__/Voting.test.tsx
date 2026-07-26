import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Voting } from '../Voting'
import type { PollState } from '../Room'

// Capture the mutations. Voting uses two (submitBallot + advancePhase); the same
// spy backs both — tests assert on the call payload, which disambiguates.
const { mutationMock, getHostTokenMock } = vi.hoisted(() => ({
  mutationMock: vi.fn(),
  getHostTokenMock: vi.fn(),
}))
const submitBallotMock = mutationMock
vi.mock('convex/react', () => ({ useMutation: () => mutationMock }))
vi.mock('@/lib/identity', () => ({
  getUserId: () => 'me',
  getHostToken: () => getHostTokenMock(),
}))

// Option ids are a branded Convex type; cast string fixtures deliberately.
const oid = (s: string) => s as PollState['options'][number]['id']

function votingState(): PollState {
  return {
    poll: {
      code: 'WXYZ',
      title: 'Dinner',
      phase: 'voting',
      allowUserOptions: true,
      createdAt: 0,
    },
    ballotCount: 0,
    users: [{ userId: 'me', name: 'Mo', isHost: false, joinedAt: 1 }],
    options: [
      { id: oid('o1'), text: 'Pizza', addedByUserId: 'me', createdAt: 1 },
      { id: oid('o2'), text: 'Tacos', addedByUserId: 'me', createdAt: 2 },
    ],
  }
}

function renderVoting() {
  return render(
    <MemoryRouter initialEntries={['/room/WXYZ']}>
      <Voting state={votingState()} code="WXYZ" />
    </MemoryRouter>,
  )
}

describe('Voting', () => {
  beforeEach(() => {
    submitBallotMock.mockReset()
    getHostTokenMock.mockReset().mockReturnValue(null) // guest by default
  })

  it('renders every option plus the hard-no cutoff line', () => {
    renderVoting()
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    // The cutoff row is present and reorderable (identified by its own control).
    expect(
      screen.getByRole('button', { name: /move cutoff line up/i }),
    ).toBeInTheDocument()
  })

  it('submits everything as ranked when nothing is rejected', async () => {
    const user = userEvent.setup()
    renderVoting()
    await user.click(screen.getByRole('button', { name: /submit ranking/i }))

    expect(submitBallotMock).toHaveBeenCalledWith({
      code: 'WXYZ',
      userId: 'me',
      ranking: ['o1', 'o2'],
      rejected: [],
    })
  })

  it('rejecting an option drops it below the cutoff on submit', async () => {
    const user = userEvent.setup()
    renderVoting()

    await user.click(screen.getByRole('button', { name: /^reject pizza$/i }))
    // The control flips to a restore affordance once Pizza is below the line.
    expect(
      screen.getByRole('button', { name: /restore pizza to ranked/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /submit ranking/i }))
    expect(submitBallotMock).toHaveBeenCalledWith({
      code: 'WXYZ',
      userId: 'me',
      ranking: ['o2'],
      rejected: ['o1'],
    })
  })

  it('hides the end-voting control from non-host voters', () => {
    renderVoting()
    expect(
      screen.queryByRole('button', { name: /end voting/i }),
    ).not.toBeInTheDocument()
  })

  it('lets the host close voting to reveal results', async () => {
    getHostTokenMock.mockReturnValue('host-token')
    const user = userEvent.setup()
    renderVoting()

    await user.click(
      screen.getByRole('button', { name: /end voting & reveal results/i }),
    )
    expect(mutationMock).toHaveBeenCalledWith({
      code: 'WXYZ',
      hostToken: 'host-token',
    })
  })

  it('reorders with the non-drag move buttons', async () => {
    const user = userEvent.setup()
    renderVoting()

    // Move Tacos above Pizza without any drag gesture (WCAG 2.5.7 alternative).
    await user.click(screen.getByRole('button', { name: /move tacos up/i }))
    await user.click(screen.getByRole('button', { name: /submit ranking/i }))

    expect(submitBallotMock).toHaveBeenCalledWith({
      code: 'WXYZ',
      userId: 'me',
      ranking: ['o2', 'o1'],
      rejected: [],
    })
  })
})
