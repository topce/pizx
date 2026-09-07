/**
 * Default pizx application — lazily booted for the `import { π } from 'pizx'`
 * and `pizx/globals` experiences. The app is created on first use and shared
 * across the process; dispose it with disposeDefaultApp().
 */

import { createPizx, type Pizx, type PizxConfig } from './context.ts'
import { forwardTag, type LetterFn } from './tags.ts'

let _app: Promise<Pizx> | undefined
let _config: PizxConfig | undefined

/** Get (or lazily boot) the process-wide default pizx app. */
export function getDefaultApp(): Promise<Pizx> {
  _app ??= createPizx(_config)
  return _app
}

/** Configure the default app before first use (throws once booted). */
export function configureDefaultApp(config: PizxConfig): void {
  if (_app) throw new Error('pizx: default app already created — configure before first use')
  _config = { ..._config, ...config }
}

/** Dispose the default app so the next getDefaultApp() boots fresh. */
export async function disposeDefaultApp(): Promise<void> {
  if (!_app) return
  const app = await _app
  await app.dispose()
  _app = undefined
}

async function letter(name: string): Promise<LetterFn | undefined> {
  return (await getDefaultApp()).letter(name)
}

/** π template tag — text generation via pi-ai (forwards to the default app). */
export const π = forwardTag('π', letter)
/** Π template tag — coding agent with tools (forwards to the default app). */
export const Π = forwardTag('Π', letter)
/** α template tag — any ACP-compatible coding agent (forwards to the default app). */
export const α = forwardTag('α', letter)
/** ε template tag — any CLI AI harness, e.g. { harness: 'claude' } (forwards to the default app). */
export const ε = forwardTag('ε', letter)

// English aliases (π = pi/ai, Π = Pi/piAgent/codingAgent, α = acp/agent, ε = run/harness/cli).
export const pi = π
export const ai = π
export const Pi = Π
export const piAgent = Π
export const codingAgent = Π
export const acp = α
export const agent = α
export const run = ε
export const harness = ε
export const cli = ε
