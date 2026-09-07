/**
 * Harnesses service tests — registry behavior, effect-based removal, and
 * spec validation. Boot a bare context: no llm service needed.
 */

import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Harnesses } from './harnesses.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
})

async function boot(): Promise<void> {
  ctx.plugin(Harnesses)
  await ctx.start()
}

describe('harnesses service', () => {
  it('defines and looks up specs', async () => {
    await boot()
    ctx.harnesses.define('mock', { command: 'mock-cli', runArgs: ['run'] })
    expect(ctx.harnesses.get('mock')).toEqual({ command: 'mock-cli', runArgs: ['run'] })
    expect(ctx.harnesses.names()).toEqual(['mock'])
    expect(ctx.harnesses.entries()[0]?.owner).toBe('app')
  })

  it('rejects duplicate names with a VALIDATION PizxError', async () => {
    await boot()
    ctx.harnesses.define('mock', { command: 'mock-cli' })
    expect(() => ctx.harnesses.define('mock', { command: 'other' })).toThrowError(
      /already registered/
    )
  })

  it('rejects malformed specs with a VALIDATION PizxError', async () => {
    await boot()
    expect(() =>
      ctx.harnesses.define('bad', { runArgs: ['ok', 3] as unknown as string[] })
    ).toThrowError(/runArgs/)
    expect(() => ctx.harnesses.define('bad2', { prompt: 'telepathy' as 'arg' })).toThrowError(
      /prompt/
    )
    expect(() =>
      ctx.harnesses.define('bad3', { flags: { x: 1 } as unknown as Record<string, string> })
    ).toThrowError(/flags/)
  })

  it('removes specs when the registering plugin unloads', async () => {
    const plugin = {
      name: 'test-harness',
      inject: ['harnesses'],
      apply(ctx: Context) {
        ctx.harnesses.define('ephemeral', { command: 'ephemeral-cli' })
      },
    }
    ctx.plugin(Harnesses)
    ctx.plugin(plugin)
    await ctx.start()
    expect(ctx.harnesses.get('ephemeral')).toBeTruthy()

    // Dispose the plugin's scope — its effect must remove the spec.
    ctx.registry.get(plugin)?.dispose()
    expect(ctx.harnesses.get('ephemeral')).toBeUndefined()
    await ctx.stop()
  })
})
