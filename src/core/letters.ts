/**
 * pizx letters service — the registry of user-facing template tags.
 *
 * Plugins define letters here; cordis effects guarantee that unloading a
 * plugin removes its letters and their globalThis bindings. Letter names are
 * arbitrary strings (Greek letters, words, emoji) in one flat namespace.
 */

import { type Context, type Plugin, Service } from '@cordisjs/core'
import { PizxError } from './errors.ts'
import { createLetterTag, type LetterDefinition, type LetterFn } from './tags.ts'

export type { LetterDefinition, LetterEnv, LetterFn, LetterOutput, LetterPromise } from './tags.ts'

export interface RegisteredLetter {
  name: string
  aliases: string[]
  description: string
  cacheable: boolean
  fn: LetterFn
  /** Plugin (or 'app') that registered the letter — for diagnostics. */
  owner: string
}

declare module '@cordisjs/core' {
  interface Context {
    letters: Letters
  }
  interface Events<in C extends Context = Context> {
    'pizx/letter-removed'(name: string): void
  }
}

export class Letters extends Service {
  private readonly registry = new Map<string, RegisteredLetter>()
  /** Alias → canonical letter name. */
  private readonly aliases = new Map<string, string>()

  constructor(ctx: Context) {
    super(ctx, 'letters')
  }

  /**
   * Register a letter (and its aliases) as a template tag. Returns the tag.
   * Registration is an effect: unloading the calling plugin removes it.
   *
   * @throws when the name or any alias is already registered.
   */
  define<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    def: LetterDefinition<T>,
    owner: Plugin | 'app' = 'app'
  ): LetterFn<T> {
    const ownerName =
      owner === 'app' ? 'app' : typeof owner === 'function' ? owner.name || 'anonymous' : 'plugin'

    this.assertAvailable(name, ownerName)
    for (const alias of def.aliases ?? []) this.assertAvailable(alias, ownerName)

    const entry: RegisteredLetter = {
      name,
      aliases: [...(def.aliases ?? [])],
      description: def.description ?? '',
      cacheable: def.cacheable ?? def.cache !== false,
      fn: undefined as unknown as LetterFn,
      owner: ownerName,
    }
    // Letters capture the ROOT context so letter implementations can reach
    // services (ctx.llm / ctx.trace / ctx.cache) without inject warnings.
    entry.fn = createLetterTag(this.ctx.root, name, def) as LetterFn

    this.registry.set(name, entry)
    for (const alias of entry.aliases) this.aliases.set(alias, name)

    // Effect: undo on plugin unload.
    this.ctx.effect(() => () => this.remove(name))
    return entry.fn
  }

  /** Resolve a letter by name or alias. */
  get(name: string): LetterFn | undefined {
    return this.registry.get(this.aliases.get(name) ?? name)?.fn
  }

  /** All registered letters. */
  entries(): RegisteredLetter[] {
    return [...this.registry.values()]
  }

  /** Canonical names of all registered letters. */
  names(): string[] {
    return [...this.registry.keys()]
  }

  /** Remove a letter and its aliases (used by the unload effect). */
  remove(name: string): void {
    const entry = this.registry.get(name)
    if (!entry) return
    for (const alias of entry.aliases) this.aliases.delete(alias)
    this.registry.delete(name)
    this.ctx.emit('pizx/letter-removed', name)
  }

  private assertAvailable(name: string, owner: string): void {
    if (this.registry.has(name) || this.aliases.has(name)) {
      const existing = this.registry.get(name) ?? this.registry.get(this.aliases.get(name) ?? '')
      throw new PizxError(
        'VALIDATION',
        `pizx: letter '${name}' is already registered by ${existing?.owner ?? 'another plugin'} (tried to define from ${owner})`
      )
    }
  }
}
