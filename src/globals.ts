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
import type { LetterFn } from './core/tags.ts'
import type { AlphaOpts } from './plugins/acp.ts'
import type { PiOpts } from './plugins/pi.ts'
import type { AgentOpts } from './plugins/pi-agent.ts'

const app = await getDefaultApp()

const g = globalThis as Record<string, unknown>
for (const entry of app.ctx.letters.entries()) {
  g[entry.name] = entry.fn
  for (const alias of entry.aliases) g[alias] = entry.fn
}

// ── Ambient global types ─────────────────────────────────────────────────────
// The CLI (and importing this module) inject the built-in letters as globals at
// runtime. This augmentation gives script authors type-checking and editor
// autocomplete without an import — opt in at the top of a script with:
//
//   /// <reference types="@topce/pizx/globals" />
//   const answer = await π`what is the capital of France?`
//
// User-defined letters (from pizx.config.mjs) are injected at runtime too but
// can't be typed here; cast or declare them yourself if you want types.
declare global {
  /** π — Pi AI text generation. Aliases: `pi`, `ai`. */
  const π: LetterFn<PiOpts>
  const pi: LetterFn<PiOpts>
  const ai: LetterFn<PiOpts>
  /** Π — Pi coding agent with tools. Aliases: `Pi`, `piAgent`, `codingAgent`. */
  const Π: LetterFn<AgentOpts>
  const Pi: LetterFn<AgentOpts>
  const piAgent: LetterFn<AgentOpts>
  const codingAgent: LetterFn<AgentOpts>
  /** α — Any ACP-compatible coding agent. Aliases: `acp`, `agent`. */
  const α: LetterFn<AlphaOpts>
  const acp: LetterFn<AlphaOpts>
  const agent: LetterFn<AlphaOpts>
}

// The π/Π/α names and aliases (plus configureDefaultApp/disposeDefaultApp) are
// re-exported from the single source in default-app.ts; only `app` is added here.
export * from './core/default-app.ts'
export { app }
