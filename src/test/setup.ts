// Registers jest-dom matchers (toBeInTheDocument, etc.) with Vitest's expect
// and augments its types. RTL auto-cleanup runs via Vitest's global afterEach.
import '@testing-library/jest-dom/vitest'

// jsdom ships no matchMedia; stub it (defaults to "no preference") so components
// that read media queries — e.g. prefers-reduced-motion — render under test.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
