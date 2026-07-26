/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Convex deployment URL, written to .env.local by `convex dev`. */
  readonly VITE_CONVEX_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
