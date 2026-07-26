// Room-code generation (PLAN §7). Kept as a pure, dependency-free helper so it
// can be unit-tested (QA-2.1) and reused by the createPoll collision-retry loop.

// Unambiguous alphabet — excludes O/0, I/1, L. 23 chars.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 4

// Largest multiple of the alphabet length that fits in a byte. Bytes at or above
// this are rejected so every letter is equally likely (no modulo bias).
const UNBIASED_CUTOFF = 256 - (256 % ROOM_CODE_ALPHABET.length)

// Default randomness: Web Crypto, available in Convex's V8 isolate and the
// browser. Injectable so tests can feed a deterministic byte source.
function cryptoBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function generateRoomCode(
  randomBytes: (n: number) => Uint8Array = cryptoBytes,
): string {
  let code = ''
  while (code.length < ROOM_CODE_LENGTH) {
    for (const byte of randomBytes(ROOM_CODE_LENGTH)) {
      if (byte >= UNBIASED_CUTOFF) continue // reject to keep the draw uniform
      code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
      if (code.length === ROOM_CODE_LENGTH) break
    }
  }
  return code
}
