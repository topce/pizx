/**
 * pizx globals — boots the default app and injects every registered letter
 * into global scope, mirroring the `zx/globals` pattern.
 *
 *   import '@topce/pizx/globals'
 *   const answer = await π`explain async/await`
 *
 * Letters defined by plugins loaded from pizx.config.mjs (or registered via
 * app.define()) are injected too — names and aliases both.
 */

import { getDefaultApp } from './core/default-app.ts'

const app = await getDefaultApp()

const g = globalThis as Record<string, unknown>
for (const entry of app.ctx.letters.entries()) {
  g[entry.name] = entry.fn
  for (const alias of entry.aliases) g[alias] = entry.fn
}

// The π/Π/α names and aliases (plus configureDefaultApp/disposeDefaultApp) are
// re-exported from the single source in default-app.ts; only `app` is added here.
export * from './core/default-app.ts'
export { app }
