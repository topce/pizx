import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Cache, type CacheConfig, pickCacheRelevantOpts } from './cache.ts'

let ctx: Context
let dir: string

beforeEach(async () => {
  ctx = new Context()
  dir = await mkdtemp(join(tmpdir(), 'pizx-cache-'))
})

afterEach(async () => {
  await ctx.stop()
})

async function startCache(config?: CacheConfig): Promise<Cache> {
  ctx.plugin({
    name: 'test-cache',
    apply(ctx: Context) {
      ctx.plugin(Cache, { enabled: true, dir, ...config })
    },
  })
  await ctx.start()
  return ctx.cache
}

describe('Cache service', () => {
  it('derives stable keys independent of option order', () => {
    const cache = new Cache(new Context())
    const a = cache.key({ letter: 'π', model: 'm', prompt: 'hi', opts: { a: 1, b: 2 } })
    const b = cache.key({ letter: 'π', model: 'm', prompt: 'hi', opts: { b: 2, a: 1 } })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes the key when prompt/model/system/letter change', () => {
    const cache = new Cache(new Context())
    const base = { letter: 'π', model: 'm', prompt: 'hi' }
    expect(cache.key(base)).not.toBe(cache.key({ ...base, prompt: 'hi ' }))
    expect(cache.key(base)).not.toBe(cache.key({ ...base, model: 'm2' }))
    expect(cache.key(base)).not.toBe(cache.key({ ...base, letter: 'Π' }))
    expect(cache.key(base)).not.toBe(cache.key({ ...base, system: 'sys' }))
  })

  it('roundtrips values to disk and memory', async () => {
    const cache = await startCache()
    const key = cache.key({ letter: 'π', model: 'm', prompt: 'hello' })
    await cache.set(key, 'the answer')
    const hit = await cache.get<string>(key)
    expect(hit?.value).toBe('the answer')
    expect((await readdir(dir)).length).toBeGreaterThan(0)
  })

  it('returns undefined for unknown keys and disabled caches', async () => {
    const cache = await startCache()
    expect(await cache.get('nope')).toBeUndefined()
    expect(await cache.get('')).toBeUndefined()

    const disabled = new Cache(new Context())
    expect(await disabled.get('x')).toBeUndefined()
    await disabled.set('x', 1) // no-op, no crash
  })

  it('expires entries past ttl', async () => {
    const cache = await startCache()
    const key = cache.key({ letter: 'π', model: 'm', prompt: 'x' })
    await cache.set(key, 'v', 1)
    await new Promise((r) => setTimeout(r, 10))
    expect(await cache.get(key)).toBeUndefined()
  })

  it('tolerates corrupt entries (treats them as misses)', async () => {
    const cache = await startCache()
    const key = cache.key({ letter: 'π', model: 'm', prompt: 'x' })
    await writeFile(join(dir, `${key}.json`), '{not json', 'utf-8')
    expect(await cache.get(key)).toBeUndefined()
  })

  it('evicts entries beyond maxEntries (oldest first)', async () => {
    const cache = await startCache({ maxEntries: 2, maxBytes: 1024 * 1024 })
    const keys = ['a', 'b', 'c'].map((p) => cache.key({ letter: 'π', model: 'm', prompt: p }))
    await cache.set(keys[0], '1')
    await new Promise((r) => setTimeout(r, 5))
    await cache.set(keys[1], '2')
    await new Promise((r) => setTimeout(r, 5))
    await cache.set(keys[2], '3')

    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
    expect(files.length).toBeLessThanOrEqual(2)
    // The oldest (keys[0]) was evicted.
    expect(files).not.toContain(`${keys[0]}.json`)
  })

  it('clears everything', async () => {
    const cache = await startCache()
    const key = cache.key({ letter: 'π', model: 'm', prompt: 'x' })
    await cache.set(key, 'v')
    await cache.clear()
    expect(await cache.get(key)).toBeUndefined()
    const { existsSync } = await import('node:fs')
    expect(existsSync(dir)).toBe(false)
  })

  it('persists across service instances (disk is the shared layer)', async () => {
    const first = await startCache()
    const key = first.key({ letter: 'π', model: 'm', prompt: 'p' })
    await first.set(key, 'persisted')

    // Re-read from a fresh instance via raw file content.
    const raw = JSON.parse(await readFile(join(dir, `${key}.json`), 'utf-8'))
    expect(raw).toMatchObject({ key, value: 'persisted' })
  })
})

describe('pickCacheRelevantOpts', () => {
  it('keeps only cache-relevant keys in stable order', () => {
    const opts = { maxTokens: 100, quiet: true, system: 's', thinkingLevel: 'low', x: 1 }
    expect(pickCacheRelevantOpts(opts)).toEqual({
      maxTokens: 100,
      system: 's',
      thinkingLevel: 'low',
    })
  })

  it('returns undefined for empty/irrelevant opts', () => {
    expect(pickCacheRelevantOpts(undefined)).toBeUndefined()
    expect(pickCacheRelevantOpts({ quiet: true })).toBeUndefined()
    expect(pickCacheRelevantOpts('nope')).toBeUndefined()
  })
})
