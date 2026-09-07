/**
 * ε (epsilon) — run any CLI AI harness as a letter, via a tiny zx wrapper.
 *
 *   await ε({ harness: 'claude', model: 'sonnet' })`review this diff`
 *   await run({ harness: 'kiro', maxTurns: 3 })`fix the failing tests`
 *   await ε.quiet({ harness: 'claude' })`list TODOs`
 *   for await (const c of ε({ harness: 'claude' }).stream`explain x`) ...
 *
 * ε knows nothing about any specific harness: plugins register declarative
 * specs on ctx.harnesses (executable, run args, prompt delivery, flag
 * renames) and ε builds the argv from the spec + options and spawns it.
 * Every option ε does not own is forwarded to the harness CLI as a flag —
 * camelCase → --kebab-case, booleans bare, false → --no-*, arrays repeated,
 * 1-char keys → -x. It has no relationship to pi: the harness is an explicit
 * subprocess, and the letter is cache: false (harness runs mutate the
 * filesystem).
 */

import type { Plugin } from '@cordisjs/core'
import Schema from 'schemastery'
import { $, type ProcessOutput, type ProcessPromise, quote } from 'zx'
import { isPizxError, PizxError } from '../core/errors.ts'
import type { HarnessSpec } from '../core/harnesses.ts'
import type { LetterEnv } from '../core/tags.ts'
import { LetterOutput } from '../core/tags.ts'
import { confirmGateSchema, confirmPhase, getErrorMessage } from '../core/utils.ts'

const PREFIX = 'pizx/ε'

/**
 * pizx-owned option keys. Everything else in the options object is forwarded
 * to the harness CLI as flags (`cache` is the tag runner's, never a flag).
 */
const KNOWN_KEYS = new Set([
  'harness',
  'cwd',
  'env',
  'quiet',
  'timeoutMs',
  'confirm',
  'args',
  'cache',
])

const options = Schema.object({
  harness: Schema.string().description('Harness name (required), e.g. "claude" or "kiro"'),
  cwd: Schema.string().description('Working directory for the harness'),
  env: Schema.dict(Schema.string()).description('Extra environment variables for the harness'),
  quiet: Schema.boolean().default(false).description('Suppress live output echo'),
  timeoutMs: Schema.natural().description('Kill the harness after this many ms'),
  confirm: confirmGateSchema.description(
    'Confirmation gate: true | { semi } | { hitl } | { auto }'
  ),
  args: Schema.array(Schema.string()).description('Raw extra args appended verbatim'),
})

/**
 * Loose on purpose: schemastery object schemas retain unknown keys, so any
 * harness option the CLI supports passes through to `flagArgs`.
 */
export type EpsilonOpts = ReturnType<typeof options> & Record<string, unknown>

// ── Harness resolution ──────────────────────────────────────────────────────

function requireHarness(
  env: LetterEnv,
  name: string | undefined
): { name: string; spec: HarnessSpec } {
  if (!name) {
    throw new PizxError(
      'VALIDATION',
      `${PREFIX}: no harness specified — pass { harness: 'claude' } or { harness: 'kiro' }`,
      { letter: 'ε' }
    )
  }
  const spec = env.ctx.harnesses.get(name)
  if (!spec) {
    const registered = env.ctx.harnesses.names()
    const list =
      registered.length > 0 ? registered.join(', ') : '(none — is a harness plugin loaded?)'
    throw new PizxError(
      'VALIDATION',
      `${PREFIX}: unknown harness '${name}' — registered: ${list}`,
      {
        letter: 'ε',
      }
    )
  }
  return { name, spec }
}

// ── Flag conversion ─────────────────────────────────────────────────────────

/** Auto-generate a flag name: camelCase → --kebab-case, 1-char → -x. */
function autoFlag(key: string): string {
  if (key.length === 1) return `-${key}`
  const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
  return kebab.startsWith('-') ? kebab : `--${kebab}`
}

/** `--flag` → `--no-flag`; short flags are omitted on false (no convention). */
function negatedFlag(flag: string): string | undefined {
  return flag.startsWith('--') ? `--no-${flag.slice(2)}` : undefined
}

/** Convert every non-pizx option into CLI flag argv. */
function flagArgs(opts: EpsilonOpts, spec: HarnessSpec): string[] {
  const out: string[] = []
  const overrides = spec.flags ?? {}
  for (const [key, value] of Object.entries(opts)) {
    if (KNOWN_KEYS.has(key)) continue
    const flag = overrides[key] ?? autoFlag(key)
    if (typeof value === 'boolean') {
      if (value) out.push(flag)
      else if (spec.negateBooleans !== false) {
        const neg = negatedFlag(flag)
        if (neg) out.push(neg)
      }
    } else if (typeof value === 'string' || typeof value === 'number') {
      out.push(flag, String(value))
    } else if (Array.isArray(value)) {
      for (const item of value) out.push(flag, String(item))
    } else if (value !== undefined) {
      throw new PizxError(
        'VALIDATION',
        `${PREFIX}: option '${key}' has an unsupported type — use a string, number, boolean, or array`
      )
    }
  }
  return out
}

interface BuiltCommand {
  argv: string[]
  stdinInput?: string
}

/** Assemble the full argv: [command, ...runArgs, ...flags, ...args, prompt?]. */
function buildCommand(
  name: string,
  spec: HarnessSpec,
  opts: EpsilonOpts,
  prompt: string
): BuiltCommand {
  const argv = [
    spec.command ?? name,
    ...(spec.runArgs ?? []),
    ...flagArgs(opts, spec),
    ...(opts.args ?? []),
  ]
  if (spec.prompt === 'stdin') return { argv, stdinInput: prompt }
  return { argv: [...argv, prompt] }
}

function modelId(harness: string, opts: EpsilonOpts): string {
  return typeof opts.model === 'string' ? `run:${harness}:${opts.model}` : `run:${harness}`
}

// ── Spawning (tiny zx wrapper) ──────────────────────────────────────────────

/**
 * Spawn the harness via zx: the argv is pre-quoted with zx's `quote` and
 * passed as a single verbatim piece, so zx handles shell escaping exactly
 * like it does for interpolated args. `nothrow` makes every failure resolve
 * as a ProcessOutput we can inspect; the timeout is a manual process-group
 * kill via `killProcessGroup` (zx's own `.timeout()`/`.kill()` machinery is
 * avoided — its process-tree lookup crashes on some platforms).
 */
function spawnHarness(built: BuiltCommand, opts: EpsilonOpts): ProcessPromise {
  const cmd = built.argv.map((a) => quote(a)).join(' ')
  // A single pre-quoted piece, passed verbatim (no second round of quoting).
  const pieces = [cmd] as unknown as TemplateStringsArray
  const p = $({
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    input: built.stdinInput,
    nothrow: true,
    detached: true,
  })(pieces).stdio('pipe', 'pipe', 'pipe')
  if (opts.timeoutMs) {
    const timer = setTimeout(() => killProcessGroup(p), opts.timeoutMs)
    p.finally(() => clearTimeout(timer)).catch(() => {})
  }
  return p
}

/** Kill the harness (and its descendants) as a process group. */
function killProcessGroup(p: ProcessPromise): void {
  try {
    if (p.child?.pid) process.kill(-p.child.pid, 'SIGTERM')
  } catch {
    try {
      p.child?.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

/**
 * Build the HARNESS error from a failed ProcessOutput. Avoids zx's
 * `out.message` getter: it can crash on empty outputs (zx 8.8.5) and
 * formats for humans — we own the contract here.
 */
function harnessError(
  harness: string,
  command: string,
  out: ProcessOutput,
  timeoutMs: number | undefined
): PizxError {
  const stderr = out.stderr.trim()
  const suffix = stderr ? `\n    ${stderr.slice(-800)}` : ''
  let message: string
  if (timeoutMs && out.signal) {
    message = `${PREFIX}: harness '${harness}' timed out after ${timeoutMs}ms (killed with ${out.signal})`
  } else if (out.exitCode === 127) {
    // The shell's "command not found": the binary itself is missing.
    message = `${PREFIX}: harness '${harness}' failed to start — '${command}' not found — is it installed?`
  } else if (out.exitCode !== null) {
    message = `${PREFIX}: harness '${harness}' failed with exit code ${out.exitCode}`
  } else if (out.cause) {
    const cause = getErrorMessage(out.cause)
    const hint = /ENOENT|not found/i.test(cause) ? ` — is '${command}' installed?` : ''
    message = `${PREFIX}: harness '${harness}' failed to start: ${cause}${hint}`
  } else {
    message = `${PREFIX}: harness '${harness}' failed (signal ${out.signal ?? 'unknown'})`
  }
  return new PizxError('HARNESS', `${message}${suffix}`, { letter: 'ε', cause: out })
}

function usageTraceEvent(model: string, durationMs: number) {
  return {
    kind: 'llm-call' as const,
    modelId: model,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    durationMs,
  }
}

// ── Letter implementation ───────────────────────────────────────────────────

async function run(prompt: string, opts: EpsilonOpts, env: LetterEnv): Promise<LetterOutput> {
  const { span } = env
  const { name, spec } = requireHarness(env, opts.harness)
  const command = spec.command ?? name
  const label = `run:${name}`

  if (
    !(await confirmPhase(
      `Run harness ${name} (${command}):\n    ${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}`,
      'send',
      true,
      opts
    ))
  ) {
    throw new PizxError('CANCELLED', `${PREFIX}: Execution cancelled by user at phase 'send'`, {
      letter: 'ε',
    })
  }

  if (!opts.quiet) {
    process.stderr.write(
      `ε (${label}): ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}\n`
    )
  }

  const t0 = Date.now()
  try {
    const built = buildCommand(name, spec, opts, prompt)
    const p = spawnHarness(built, opts)
    p.stdout?.on('data', (chunk: Buffer) => {
      if (!opts.quiet) process.stdout.write(chunk)
    })
    p.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk)
    })

    const out = await p
    if (!out.ok) throw harnessError(name, command, out, opts.timeoutMs)

    const text = out.stdout.trim() || '(no output)'
    const t1 = Date.now()
    span?.emit(usageTraceEvent(modelId(name, opts), t1 - t0))
    if (!opts.quiet) {
      process.stderr.write(`  ε: done (${out.duration}ms)\n`)
      if (text) process.stdout.write('\n')
    }
    return new LetterOutput(text, modelId(name, opts), false, t0, t1)
  } catch (err) {
    if (isPizxError(err)) throw err
    throw new PizxError('HARNESS', `${PREFIX}: harness '${name}' failed: ${getErrorMessage(err)}`, {
      letter: 'ε',
      cause: err,
    })
  }
}

async function* stream(prompt: string, opts: EpsilonOpts, env: LetterEnv): AsyncGenerator<string> {
  const { span } = env
  const { name, spec } = requireHarness(env, opts.harness)
  const t0 = Date.now()

  const built = buildCommand(name, spec, opts, prompt)
  const p = spawnHarness(built, opts)
  p.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk)
  })

  try {
    for await (const line of p) yield `${line}\n`
    const out = await p
    if (!out.ok) {
      throw harnessError(name, spec.command ?? name, out, opts.timeoutMs)
    }
    span?.emit(usageTraceEvent(modelId(name, opts), Date.now() - t0))
  } catch (err) {
    if (isPizxError(err)) throw err
    throw new PizxError('HARNESS', `${PREFIX}: harness '${name}' failed: ${getErrorMessage(err)}`, {
      letter: 'ε',
      cause: err,
    })
  }
}

export const epsilonPlugin: Plugin.Object = {
  name: 'pizx-epsilon',
  inject: ['letters', 'harnesses'],
  apply(ctx) {
    ctx.letters.define('ε', {
      aliases: ['run', 'harness', 'cli'],
      description: 'Run any CLI AI harness (kiro-cli, claude, …) as a subprocess',
      cache: false,
      options,
      run,
      stream,
    })
  },
}
