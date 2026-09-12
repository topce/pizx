/**
 * Harnesses service tests — registry behavior, effect-based removal, and
 * spec validation. Boot a bare context: no llm service needed.
 */

import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanHarnessOutput, Harnesses } from './harnesses.ts'

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

  it('accepts stripAnsi and rejects a non-boolean value', async () => {
    await boot()
    ctx.harnesses.define('tui', { command: 'tui-cli', stripAnsi: true })
    expect(ctx.harnesses.get('tui')?.stripAnsi).toBe(true)
    expect(() =>
      ctx.harnesses.define('bad', { command: 'bad-cli', stripAnsi: 'yes' as unknown as boolean })
    ).toThrowError(/stripAnsi/)
  })
})

describe('cleanHarnessOutput', () => {
  it('removes ANSI escapes and a leading TUI prompt marker', () => {
    // Shape produced by `kiro-cli chat --no-interactive`.
    expect(cleanHarnessOutput('\u001b[m> \u001b[0mOK')).toBe('OK')
  })

  it('keeps ordinary text, including a mid-line >', () => {
    expect(cleanHarnessOutput('  a > b  ')).toBe('a > b')
    expect(cleanHarnessOutput('line one\nline two')).toBe('line one\nline two')
  })

  it('strips escape sequences without a marker', () => {
    expect(cleanHarnessOutput('\u001b[31mred\u001b[0m')).toBe('red')
  })
})
