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

import {
  acp,
  agent,
  ai,
  codingAgent,
  getDefaultApp,
  Pi,
  pi,
  piAgent,
  Π,
  α,
  π,
} from './core/default-app.ts'

const app = await getDefaultApp()

const g = globalThis as Record<string, unknown>
for (const entry of app.ctx.letters.entries()) {
  g[entry.name] = entry.fn
  for (const alias of entry.aliases) g[alias] = entry.fn
}

export { getDefaultApp } from './core/default-app.ts'
export {
  acp,
  agent,
  ai,
  app,
  codingAgent,
  // English aliases
  Pi,
  pi,
  piAgent,
  Π,
  α,
  π,
}
