/**
 * pizx cache service — content-addressed disk cache for letter outputs.
 *
 * Keys are stable SHA-256 digests over (letter, model, system, prompt,
 * cache-relevant options) so identical invocations hit the disk cache and
 * skip the LLM call entirely. Only side-effect-free letters are cached
 * (Π-style agents declare `cache: false` in their definition).
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { type Context, Service } from '@cordisjs/core'
import { sha256 } from './utils.ts'

export interface CacheConfig {
  /** Enable the cache. Default false — enable per call, via config, or `--cache`. */
  enabled?: boolean
  /** Cache directory. Default `<cwd>/.pizx/cache`. */
  dir?: string
  /** Entry TTL in ms. Default 24h. */
  ttlMs?: number
  /** Max entries before LRU eviction. Default 200. */
  maxEntries?: number
  /** Max total bytes before LRU eviction. Default 20 MiB. */
  maxBytes?: number
}

interface CacheEntry {
  key: string
  value: unknown
  created: number
  ttlMs: number
}

/** Fields of a letter invocation that influence its output. */
export interface CacheKeyInput {
  letter: string
  model: string
  system?: string
  prompt: string
  opts?: unknown
}

/** Option keys that may change a letter's output (and therefore the key). */
const CACHE_RELEVANT_KEYS = new Set([
  'maxTokens',
  'thinkingLevel',
  'thinkingBudgets',
  'appendSystemPrompt',
  'system',
  'timeoutMs',
  // TypeSafe letters/words: the question and structured state are options, not
  // part of the prompt, so they must be hashed into the key to avoid collisions.
  'instructions',
  'criteria',
  'state',
  'questions',
  'dimensions',
  'weights',
  'pick',
  'normalize',
])

/** Reduce opts to the cache-relevant subset, with deterministic key order. */
export function pickCacheRelevantOpts(opts: unknown): Record<string, unknown> | undefined {
  if (!opts || typeof opts !== 'object') return undefined
  const out: Record<string, unknown> = {}
  const source = opts as Record<string, unknown>
  for (const key of [...CACHE_RELEVANT_KEYS].sort()) {
    if (key in source && source[key] !== undefined) out[key] = source[key]
  }
  return Object.keys(out).length > 0 ? out : undefined
}

declare module '@cordisjs/core' {
  interface Context {
    cache: Cache
  }
}

export class Cache extends Service<CacheConfig> {
  private readonly memory = new Map<string, CacheEntry>()
  private readonly cfg: {
    enabled: boolean
    dir: string
    ttlMs: number
    maxEntries: number
    maxBytes: number
  }

  constructor(ctx: Context, config?: CacheConfig) {
    super(ctx, 'cache')
    const merged = {
      enabled: config?.enabled ?? false,
      dir: config?.dir ?? resolve('.pizx/cache'),
      ttlMs: config?.ttlMs ?? 24 * 60 * 60 * 1000,
      maxEntries: config?.maxEntries ?? 200,
      maxBytes: config?.maxBytes ?? 20 * 1024 * 1024,
    }
    this.config = merged
    this.cfg = {
      enabled: merged.enabled,
      dir: resolve(merged.dir),
      ttlMs: merged.ttlMs,
      maxEntries: merged.maxEntries,
      maxBytes: merged.maxBytes,
    }
  }

  get enabled(): boolean {
    return this.cfg.enabled
  }

  /** Derive a stable content-addressed key for a letter invocation. */
  key(input: CacheKeyInput): string {
    const optsJson = JSON.stringify(pickCacheRelevantOpts(input.opts) ?? null)
    return sha256(
      `${input.letter}\u0000${input.model}\u0000${input.system ?? ''}\u0000${input.prompt}\u0000${optsJson}`
    )
  }

  private entryPath(key: string): string {
    return join(this.cfg.dir, `${key}.json`)
  }

  /** Fetch an unexpired entry. Returns undefined on miss/expiry/corruption. */
  async get<T = unknown>(key: string): Promise<{ value: T; created: number } | undefined> {
    if (!this.enabled) return undefined
    const cached = this.memory.get(key)
    if (cached) {
      if (cached.created + cached.ttlMs < Date.now()) {
        this.memory.delete(key)
        return undefined
      }
      return { value: cached.value as T, created: cached.created }
    }
    const path = this.entryPath(key)
    if (!existsSync(path)) return undefined
    try {
      const raw = JSON.parse(await readFile(path, 'utf-8')) as CacheEntry
      if (raw.key !== key || raw.created + raw.ttlMs < Date.now()) {
        await rm(path, { force: true }).catch(() => {})
        return undefined
      }
      this.memory.set(key, raw)
      return { value: raw.value as T, created: raw.created }
    } catch {
      // Corrupt entry — drop it and treat as a miss.
      await rm(path, { force: true }).catch(() => {})
      return undefined
    }
  }

  /** Store an entry (atomic write) and run LRU eviction. */
  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    if (!this.enabled) return
    const entry: CacheEntry = {
      key,
      value,
      created: Date.now(),
      ttlMs: ttlMs ?? this.cfg.ttlMs,
    }
    this.memory.set(key, entry)
    await mkdir(this.cfg.dir, { recursive: true })
    const path = this.entryPath(key)
    const tmp = `${path}.tmp`
    await writeFile(tmp, JSON.stringify(entry), 'utf-8')
    await rename(tmp, path)
    await this.evict()
  }

  /** Remove everything (used by tests and `pizx --no-cache` hygiene). */
  async clear(): Promise<void> {
    this.memory.clear()
    if (existsSync(this.cfg.dir)) {
      await rm(this.cfg.dir, { recursive: true, force: true })
    }
  }

  /** Evict oldest entries by mtime until under maxEntries and maxBytes. */
  private async evict(): Promise<void> {
    let files: string[]
    try {
      files = (await readdir(this.cfg.dir)).filter((f) => f.endsWith('.json'))
    } catch {
      return
    }
    const stats = new Map<string, { mtime: number; size: number }>()
    for (const f of files) {
      try {
        const s = await stat(join(this.cfg.dir, f))
        stats.set(f, { mtime: s.mtimeMs, size: s.size })
      } catch {
        // ignore disappearing files
      }
    }
    const entries = [...stats.entries()].sort((a, b) => a[1].mtime - b[1].mtime)
    let totalBytes = entries.reduce((s, [, v]) => s + v.size, 0)
    let overflow = entries.length - this.cfg.maxEntries
    for (const [f, { size }] of entries) {
      if (overflow <= 0 && totalBytes <= this.cfg.maxBytes) break
      await rm(join(this.cfg.dir, f), { force: true }).catch(() => {})
      this.memory.delete(f.slice(0, -'.json'.length))
      totalBytes -= size
      overflow--
    }
  }
}
