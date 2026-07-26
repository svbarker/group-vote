import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical, Ban, Undo2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/gv/button'
import { cn } from '@/lib/utils'
import { getUserId } from '@/lib/identity'
import { RoomShell } from './RoomShell'
import type { PollState } from './Room'

type OptionId = PollState['options'][number]['id']

// Sentinel row that marks the "hard no" cutoff inside the single ranking list:
// everything above it is ranked (index 0 = top choice), everything below scores
// zero (PLAN §6). Kept in the same list so one reorder gesture — drag or the
// non-drag move buttons — handles both ranking and rejecting.
const CUTOFF_ID = '__cutoff__'

// Honor prefers-reduced-motion so the drag transforms don't animate for users
// who've asked the OS to minimize motion (WCAG 2.3.3).
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// Human-readable placement of an item, for screen-reader announcements.
function describePlacement(order: string[], id: string): string {
  const cutoff = order.indexOf(CUTOFF_ID)
  if (id === CUTOFF_ID) {
    const rejectedCount = order.length - 1 - cutoff
    return `Cutoff moved. ${cutoff} ranked, ${rejectedCount} below the cutoff.`
  }
  const index = order.indexOf(id)
  if (index < cutoff) return `Ranked ${index + 1} of ${cutoff}.`
  return 'Moved below the cutoff — a hard no.'
}

export function Voting({ state, code }: { state: PollState; code: string }) {
  const navigate = useNavigate()
  const submitBallot = useMutation(api.polls.submitBallot)
  const myUserId = getUserId()
  const reducedMotion = useReducedMotion()

  const { poll, options, ballotCount, users } = state

  // Local working order, seeded once: every option ranked in its existing order,
  // cutoff at the bottom (nothing rejected yet). Options are frozen during voting
  // (addOption is lobby-only), so this never needs to re-sync from the server.
  const [order, setOrder] = useState<string[]>(() => [
    ...options.map((o) => o.id),
    CUTOFF_ID,
  ])
  const orderRef = useRef(order)
  useEffect(() => {
    orderRef.current = order
  }, [order])

  const [liveMessage, setLiveMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const textById = new Map(options.map((o) => [o.id as string, o.text]))
  const labelOf = (id: string) =>
    id === CUTOFF_ID ? 'the cutoff line' : (textById.get(id) ?? 'option')

  const sensors = useSensors(
    // Mouse needs a small drag threshold so a click on the move buttons doesn't
    // start a drag; touch uses press-and-hold so the list still scrolls.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const cutoffIndex = order.indexOf(CUTOFF_ID)

  function commit(next: string[], announce: string) {
    setOrder(next)
    setLiveMessage(announce)
    setSubmitted(false) // order changed → the on-file ballot is now stale
  }

  function moveBy(id: string, delta: -1 | 1) {
    const from = order.indexOf(id)
    const to = from + delta
    if (to < 0 || to >= order.length) return
    const next = arrayMove(order, from, to)
    commit(next, `${labelOf(id)}: ${describePlacement(next, id)}`)
  }

  // Jump an option straight across the cutoff (fast non-drag path): reject sends
  // it just below the line, restore brings it just above.
  function toggleReject(id: string) {
    const from = order.indexOf(id)
    const rejecting = from < cutoffIndex
    const without = order.filter((x) => x !== id)
    const cut = without.indexOf(CUTOFF_ID)
    const insertAt = rejecting ? cut + 1 : cut
    const next = [...without.slice(0, insertAt), id, ...without.slice(insertAt)]
    commit(next, `${labelOf(id)}: ${describePlacement(next, id)}`)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    setOrder(arrayMove(order, from, to))
    setSubmitted(false)
  }

  // dnd-kit renders these into its own visually-hidden live region during a drag.
  // Placement is computed from the pre-drag order (orderRef is still the committed
  // order inside the event tick), so the message is accurate regardless of when
  // React flushes the state update.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${labelOf(String(active.id))} is over ${labelOf(String(over.id))}.`
        : `${labelOf(String(active.id))} is no longer over a drop target.`,
    onDragEnd: ({ active, over }) => {
      const current = orderRef.current
      const from = current.indexOf(String(active.id))
      const to = over ? current.indexOf(String(over.id)) : from
      const next = from === to ? current : arrayMove(current, from, to)
      return `Dropped ${labelOf(String(active.id))}. ${describePlacement(next, String(active.id))}`
    },
    onDragCancel: ({ active }) =>
      `Cancelled. ${labelOf(String(active.id))} returned to its place.`,
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const cut = order.indexOf(CUTOFF_ID)
    const ranking = order.slice(0, cut) as OptionId[]
    const rejected = order.slice(cut + 1) as OptionId[]
    try {
      await submitBallot({ code, userId: myUserId, ranking, rejected })
      setSubmitted(true)
    } catch {
      setSubmitError('Could not submit your ballot — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const rankedCount = cutoffIndex
  const rejectedCount = order.length - 1 - cutoffIndex

  return (
    <RoomShell>
      <div className="space-y-2 text-center">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Voting · {poll.code}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{poll.title}</h1>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {ballotCount} of {users.length} voted
        </p>
      </div>

      <div>
        <p id="ranking-instructions" className="text-muted-foreground text-sm">
          Drag options into your preferred order, or use the move buttons.
          Anything below the cutoff line is a hard no and scores zero.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'To pick up an option, press Space or Enter. Use the arrow keys to move it, then press Space or Enter again to drop. Press Escape to cancel. You can also use the move-up, move-down, and reject buttons on each option.',
            },
          }}
        >
          <SortableContext
            items={order}
            strategy={verticalListSortingStrategy}
          >
            <ul
              aria-label="Your ranking"
              aria-describedby="ranking-instructions"
              className="mt-3 space-y-2"
            >
              {order.map((id, index) =>
                id === CUTOFF_ID ? (
                  <CutoffRow
                    key={id}
                    reducedMotion={reducedMotion}
                    canMoveUp={index > 0}
                    canMoveDown={index < order.length - 1}
                    onMoveUp={() => moveBy(id, -1)}
                    onMoveDown={() => moveBy(id, 1)}
                  />
                ) : (
                  <OptionRow
                    key={id}
                    id={id}
                    text={textById.get(id) ?? ''}
                    rejected={index > cutoffIndex}
                    reducedMotion={reducedMotion}
                    canMoveUp={index > 0}
                    canMoveDown={index < order.length - 1}
                    onMoveUp={() => moveBy(id, -1)}
                    onMoveDown={() => moveBy(id, 1)}
                    onToggleReject={() => toggleReject(id)}
                  />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>

        <p className="text-muted-foreground mt-2 text-xs">
          {rankedCount} ranked · {rejectedCount} hard no
        </p>
      </div>

      {/* Polite live region for the non-drag move/reject buttons; dnd-kit voices
          the drag gestures through its own region. */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      <div className="space-y-2">
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? 'Submitting…'
            : submitted
              ? 'Update ranking'
              : 'Submit ranking'}
        </Button>
        {submitted && !submitError && (
          <p role="status" className="text-center text-sm text-muted-foreground">
            Ballot submitted. You can keep editing until voting closes.
          </p>
        )}
        {submitError && (
          <p role="alert" className="text-center text-sm text-destructive">
            {submitError}
          </p>
        )}
      </div>

      <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
        Leave
      </Button>
    </RoomShell>
  )
}

// Shared per-row layout with the drag handle + non-drag move controls.
function RowFrame({
  id,
  reducedMotion,
  className,
  handleLabel,
  children,
  controls,
}: {
  id: string
  reducedMotion: boolean
  className?: string
  handleLabel: string
  children: React.ReactNode
  controls: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: reducedMotion ? undefined : transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-2',
        isDragging && 'z-10 shadow-lg',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={handleLabel}
        className="shrink-0 cursor-grab touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </Button>
      {children}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {controls}
      </span>
    </li>
  )
}

function OptionRow({
  id,
  text,
  rejected,
  reducedMotion,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleReject,
}: {
  id: string
  text: string
  rejected: boolean
  reducedMotion: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleReject: () => void
}) {
  return (
    <RowFrame
      id={id}
      reducedMotion={reducedMotion}
      handleLabel={`Drag to reorder ${text}`}
      className={cn(rejected && 'border-dashed opacity-60')}
      controls={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${text} up`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${text} down`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              rejected ? `Restore ${text} to ranked` : `Reject ${text}`
            }
            aria-pressed={rejected}
            onClick={onToggleReject}
          >
            {rejected ? (
              <Undo2 className="size-4" />
            ) : (
              <Ban className="size-4" />
            )}
          </Button>
        </>
      }
    >
      <span className="min-w-0 truncate font-medium">{text}</span>
    </RowFrame>
  )
}

function CutoffRow({
  reducedMotion,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  reducedMotion: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <RowFrame
      id={CUTOFF_ID}
      reducedMotion={reducedMotion}
      handleLabel="Drag to move the cutoff line"
      className="border-destructive/60 border-dashed bg-destructive/5"
      controls={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move cutoff line up"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move cutoff line down"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-4" />
          </Button>
        </>
      }
    >
      <span className="text-destructive text-xs font-semibold tracking-wide uppercase">
        Hard no ↓ (scores zero)
      </span>
    </RowFrame>
  )
}
