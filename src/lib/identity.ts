// Per-device identity (PLAN §1). No accounts: a user is a generated `userId`
// persisted in localStorage, plus a display name. The host additionally holds a
// secret `hostToken` per room, minted server-side by createPoll.

const USER_ID_KEY = 'gv:userId'
const NAME_KEY = 'gv:name'
const hostTokenKey = (code: string) => `gv:hostToken:${code.toUpperCase()}`

// Stable per-device id, created on first use and reused across polls.
export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim())
}

export function saveHostToken(code: string, token: string): void {
  localStorage.setItem(hostTokenKey(code), token)
}

// Present iff this device created the room — used later to gate host controls.
export function getHostToken(code: string): string | null {
  return localStorage.getItem(hostTokenKey(code))
}
