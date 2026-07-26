import { describe, expect, test } from 'vitest'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
} from './roomCode'

describe('generateRoomCode', () => {
  test('produces a code of the right length from the alphabet', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    for (const ch of code) {
      expect(ROOM_CODE_ALPHABET).toContain(ch)
    }
  })

  test('never emits ambiguous characters', () => {
    const codes = Array.from({ length: 200 }, () => generateRoomCode())
    expect(codes.join('')).not.toMatch(/[O0I1L]/)
  })

  test('maps random bytes onto the alphabet by index', () => {
    // bytes [0,1,2,3] -> first four alphabet letters
    const code = generateRoomCode(() => new Uint8Array([0, 1, 2, 3]))
    expect(code).toBe(ROOM_CODE_ALPHABET.slice(0, 4))
  })

  test('rejects out-of-range bytes to keep the draw unbiased', () => {
    // 253 is >= the unbiased cutoff (256 - 256%23) and must be skipped, so the
    // generator falls through to the next bytes instead of wrapping via modulo.
    const batches = [
      new Uint8Array([253, 0, 1, 2]), // 253 skipped -> A, B, C
      new Uint8Array([3, 9, 9, 9]), // -> D
    ]
    let call = 0
    const code = generateRoomCode(() => batches[call++])
    expect(code).toBe('ABCD')
  })

  test('draws well-distributed codes (high uniqueness over a sample)', () => {
    const sample = Array.from({ length: 500 }, () => generateRoomCode())
    const unique = new Set(sample)
    // Expected collisions over 500 draws in a ~280k space is < 1; a floor of
    // 480 leaves enormous headroom while still catching a stuck generator.
    expect(unique.size).toBeGreaterThan(480)
  })
})
