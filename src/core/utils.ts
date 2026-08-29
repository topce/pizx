/**
 * Shared utilities for the pizx core.
 */

import { createHash, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

/** Extract a string message from any error-like value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Build a string from a template literal with interpolated values. */
export function build(pieces: TemplateStringsArray, args: unknown[]): string {
  let s = ''
  for (let i = 0; i < pieces.length; i++) {
    s += pieces[i]
    if (i < args.length) s += String(args[i])
  }
  return s.trim()
}

/** Stable SHA-256 hex digest of a string (used for cache keys and run ids). */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** Short, sortable, unique run id: `pizx-<millis>-<rand4>`. */
export function newRunId(): string {
  return `pizx-${Date.now()}-${randomBytes(2).toString('hex')}`
}

// ── Confirmation gates ──────────────────────────────────────────────────────

/** Execution mode for confirm gates. Exactly one key must be true. */
export type ConfirmGate =
  | { hitl: true } // Human-In-The-Loop: gate before every phase
  | { semi: true } // Semi-autonomous: gate at major decision points only
  | { auto: true } // Fully autonomous: no gates

export type ConfirmMode = 'auto' | 'semi' | 'hitl'

/** Resolve the confirm union to a simple mode string. `true` maps to 'semi'. */
export function resolveMode(confirm: boolean | ConfirmGate | undefined): ConfirmMode {
  if (confirm === undefined || confirm === false) return 'auto'
  if (confirm === true) return 'semi'
  if ('hitl' in confirm) return 'hitl'
  if ('semi' in confirm) return 'semi'
  return 'auto'
}

/** Decide whether to gate at this phase for the given mode. */
export function shouldGate(mode: ConfirmMode, isMajorPhase: boolean): boolean {
  if (mode === 'hitl') return true
  if (mode === 'semi') return isMajorPhase
  return false
}

/**
 * If the confirm mode indicates, pause and prompt the user for confirmation.
 * Returns true if execution should continue, false to abort.
 */
export async function confirmPhase(
  description: string,
  phase: string,
  isMajorPhase: boolean,
  opts: { confirm?: boolean | ConfirmGate }
): Promise<boolean> {
  const mode = resolveMode(opts.confirm)
  if (!shouldGate(mode, isMajorPhase)) return true

  process.stderr.write(`\n  ── Confirm (${phase}) ──\n  ${description}\n  Proceed? [Y/n] `)
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  const answer = await new Promise<string>((resolve) => {
    rl.question('', (ans: string) => resolve(ans))
  })
  rl.close()
  const trimmed = answer.trim().toLowerCase()
  return trimmed === '' || trimmed === 'y' || trimmed === 'yes'
}

// ── Small async helpers ─────────────────────────────────────────────────────

/** Atomic file write: write to `<path>.tmp` then rename into place. */
export async function atomicWriteFile(
  write: (path: string) => Promise<void>,
  finalPath: string
): Promise<void> {
  const tmp = `${finalPath}.tmp`
  await write(tmp)
  const { rename, rm } = await import('node:fs/promises')
  try {
    await rename(tmp, finalPath)
  } catch {
    await rm(tmp, { force: true }).catch(() => {})
    throw new Error(`pizx: failed to write ${finalPath}`)
  }
}
