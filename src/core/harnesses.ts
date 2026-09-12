/**
 * pizx harnesses service — the registry of CLI harness specs used by ε.
 *
 * A harness spec is a tiny declarative description of how to invoke an AI
 * harness binary: the executable, the "run headless" args, how the prompt is
 * delivered, and flag-name overrides for irregular CLIs. Plugins define specs
 * here; cordis effects guarantee that unloading a plugin removes its specs.
 * The ε letter core knows nothing about any specific harness — it only looks
 * up specs and builds argv (plugin/spec-driven).
 */

import { type Context, type Plugin, Service } from '@cordisjs/core'
import { PizxError } from './errors.ts'

// CSI/OSC/other escape sequences emitted by TUI-style CLIs. Matching the ESC
// control character is the point, so the rule below is suppressed.
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI requires matching ESC
const ANSI_RE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g
// A TUI prompt marker left at the start of the answer: `> `, possibly
// wrapped in SGR codes.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matches SGR codes before the marker
const LEADING_MARKER_RE = /^(?:\u001b\[[0-9;]*m)*\s*>\s+/

/**
 * Clean a harness's stdout for use as letter text (only when the spec sets
 * `stripAnsi`). Removes ANSI escape sequences, then a leading TUI prompt
 * marker such as Kiro's `> `.
 */
export function cleanHarnessOutput(raw: string): string {
  return raw.replace(ANSI_RE, '').replace(LEADING_MARKER_RE, '').trim()
}

/** Declarative spec describing how ε invokes one harness binary. */
export interface HarnessSpec {
  /** Executable to spawn. Defaults to the harness name. */
  command?: string
  /** Args inserted before generated flags, e.g. ['chat', '--no-interactive'] (kiro) or ['-p'] (claude). */
  runArgs?: string[]
  /** Prompt delivery: final positional arg ('arg', default) or stdin ('stdin'). */
  prompt?: 'arg' | 'stdin'
  /** Override the auto-generated flag name for an option key (e.g. { print: '-p' }). */
  flags?: Record<string, string>
  /** Map boolean-false options to --no-<flag>. Default true. */
  negateBooleans?: boolean
  /**
   * Strip terminal decoration from stdout before it becomes the letter's text.
   * Some harnesses render a TUI prompt even in headless mode — Kiro CLI prints
   * a highlighted `> ` before the answer — so without this, ANSI escape
   * sequences and the marker end up inside the result text.
   */
  stripAnsi?: boolean
  /** One-line description for diagnostics. */
  description?: string
}

export interface RegisteredHarness {
  name: string
  spec: HarnessSpec
  /** Plugin (or 'app') that registered the harness — for diagnostics. */
  owner: string
}

declare module '@cordisjs/core' {
  interface Context {
    harnesses: Harnesses
  }
}

export class Harnesses extends Service {
  private readonly registry = new Map<string, RegisteredHarness>()

  constructor(ctx: Context) {
    super(ctx, 'harnesses')
  }

  /**
   * Register a harness spec. Registration is an effect: unloading the calling
   * plugin removes it.
   *
   * @throws `PizxError('VALIDATION')` when the name is taken or the spec is
   * malformed.
   */
  define(name: string, spec: HarnessSpec, owner: Plugin | 'app' = 'app'): HarnessSpec {
    if (typeof name !== 'string' || name.length === 0) {
      throw new PizxError('VALIDATION', 'pizx/harnesses: harness name must be a non-empty string')
    }
    this.validateSpec(name, spec)
    const ownerName =
      owner === 'app' ? 'app' : typeof owner === 'function' ? owner.name || 'anonymous' : 'plugin'

    const existing = this.registry.get(name)
    if (existing) {
      throw new PizxError(
        'VALIDATION',
        `pizx/harnesses: harness '${name}' is already registered by ${existing.owner} (tried to define from ${ownerName})`
      )
    }

    const entry: RegisteredHarness = {
      name,
      spec: { ...spec },
      owner: ownerName,
    }
    this.registry.set(name, entry)

    // Effect: undo on plugin unload.
    this.ctx.effect(() => () => this.remove(name))
    return entry.spec
  }

  /** Look up a harness spec by name. */
  get(name: string): HarnessSpec | undefined {
    return this.registry.get(name)?.spec
  }

  /** All registered harnesses. */
  entries(): RegisteredHarness[] {
    return [...this.registry.values()]
  }

  /** Names of all registered harnesses. */
  names(): string[] {
    return [...this.registry.keys()]
  }

  /** Remove a harness spec (used by the unload effect). */
  remove(name: string): void {
    this.registry.delete(name)
  }

  private validateSpec(name: string, spec: HarnessSpec): void {
    if (spec === null || typeof spec !== 'object') {
      throw new PizxError('VALIDATION', `pizx/harnesses: spec for '${name}' must be an object`)
    }
    if (spec.command !== undefined && typeof spec.command !== 'string') {
      throw new PizxError('VALIDATION', `pizx/harnesses: 'command' of '${name}' must be a string`)
    }
    if (
      spec.runArgs !== undefined &&
      (!Array.isArray(spec.runArgs) || spec.runArgs.some((a) => typeof a !== 'string'))
    ) {
      throw new PizxError(
        'VALIDATION',
        `pizx/harnesses: 'runArgs' of '${name}' must be a string array`
      )
    }
    if (spec.prompt !== undefined && spec.prompt !== 'arg' && spec.prompt !== 'stdin') {
      throw new PizxError(
        'VALIDATION',
        `pizx/harnesses: 'prompt' of '${name}' must be 'arg' or 'stdin'`
      )
    }
    if (
      spec.flags !== undefined &&
      (typeof spec.flags !== 'object' ||
        spec.flags === null ||
        Object.values(spec.flags).some((v) => typeof v !== 'string'))
    ) {
      throw new PizxError(
        'VALIDATION',
        `pizx/harnesses: 'flags' of '${name}' must be a string→string map`
      )
    }
    if (spec.stripAnsi !== undefined && typeof spec.stripAnsi !== 'boolean') {
      throw new PizxError(
        'VALIDATION',
        `pizx/harnesses: 'stripAnsi' of '${name}' must be a boolean`
      )
    }
  }
}
