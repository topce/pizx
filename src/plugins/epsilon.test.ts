/**
 * ε letter plugin tests — boot a context WITHOUT any llm service to prove the
 * letter is fully independent of pi, and run it against the mock harness
 * executable (no real claude/kiro-cli required).
 */

import { fileURLToPath } from 'node:url'
import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPizxError } from '../core/errors.ts'
import { Harnesses } from '../core/harnesses.ts'
import { Letters } from '../core/letters.ts'
import type { LetterFn } from '../core/tags.ts'
import { Trace } from '../core/trace.ts'
import { epsilonPlugin } from './epsilon.ts'
import { claudeHarnessPlugin } from './harness-claude.ts'
import { kiroHarnessPlugin } from './harness-kiro.ts'

const MOCK = fileURLToPath(new URL('../testing/harness-mock.mjs', import.meta.url))

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
  vi.restoreAllMocks()
})

async function boot(): Promise<void> {
  ctx.plugin({
    name: 'test-core',
    apply(ctx: Context) {
      ctx.plugin(Trace)
      ctx.plugin(Letters)
      ctx.plugin(Harnesses)
    },
  })
  ctx.plugin(epsilonPlugin)
  ctx.plugin(kiroHarnessPlugin)
  ctx.plugin(claudeHarnessPlugin)
  ctx.plugin({
    name: 'test-mock-harness',
    inject: ['harnesses'],
    apply(ctx: Context) {
      ctx.harnesses.define('mock', {
        command: process.execPath,
        runArgs: [MOCK],
        prompt: 'arg',
        description: 'mock harness for tests',
      })
      ctx.harnesses.define('mock-stdin', {
        command: process.execPath,
        runArgs: [MOCK, '--echo-stdin'],
        prompt: 'stdin',
      })
      ctx.harnesses.define('mock-renamed', {
        command: process.execPath,
        runArgs: [MOCK],
        prompt: 'arg',
        flags: { printMode: '-p' },
        negateBooleans: false,
      })
    },
  })
  await ctx.start()
}

function mustLetter(name: string): LetterFn {
  const fn = ctx.letters.get(name)
  if (!fn) throw new Error(`letter ${name} not registered`)
  return fn
}

function quietStdio() {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
}

describe('ε letter plugin', () => {
  it('registers ε with the run/harness/cli aliases and cache: false', async () => {
    await boot()
    const entry = ctx.letters.entries().find((e) => e.name === 'ε')
    expect(entry).toBeTruthy()
    expect(entry?.aliases).toEqual(['run', 'harness', 'cli'])
    expect(entry?.cacheable).toBe(false)
    for (const alias of ['run', 'harness', 'cli']) {
      expect(ctx.letters.get(alias)).toBe(ctx.letters.get('ε'))
    }
  })

  it('registers the built-in kiro and claude harness specs', async () => {
    await boot()
    expect(ctx.harnesses.get('kiro')).toEqual({
      command: 'kiro-cli',
      runArgs: ['chat', '--no-interactive'],
      prompt: 'arg',
      stripAnsi: true,
      description: 'Amazon Kiro coding agent — headless: kiro-cli chat --no-interactive <prompt>',
    })
    expect(ctx.harnesses.get('claude')).toEqual({
      command: 'claude',
      runArgs: ['-p'],
      prompt: 'arg',
      description: 'Anthropic Claude Code — headless: claude -p <prompt>',
    })
  })

  it('rejects with a friendly error when no harness is specified', async () => {
    await boot()
    const ε = mustLetter('ε')
    await expect(ε`hello`).rejects.toThrow('no harness specified')
  })

  it('rejects with a friendly error for an unknown harness', async () => {
    await boot()
    const ε = mustLetter('ε')
    await expect(ε({ harness: 'nope' })`hello`).rejects.toThrow(/unknown harness 'nope'/)
  })

  it('runs a prompt turn without any llm service (no pi involved)', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    const out = await ε({ harness: 'mock' })`hello world`

    expect(out.text).toContain('mock first line')
    expect(out.text).toContain('argv:["hello world"]')
    expect(out.modelId).toBe('run:mock')
    expect(out.isFromCache).toBe(false)
    expect(out.duration).toBeGreaterThanOrEqual(0)
  })

  it('converts unknown options into CLI flags and appends raw args', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    const out = await ε({
      harness: 'mock',
      model: 'sonnet',
      maxTurns: 3,
      verbose: true,
      silent: false,
      tags: ['a', 'b'],
      m: 'x',
      args: ['--raw-flag'],
    })`prompt text`

    expect(out.text).toContain(
      'argv:["--model","sonnet","--max-turns","3","--verbose","--no-silent","--tags","a","--tags","b","-m","x","--raw-flag","prompt text"]'
    )
    expect(out.modelId).toBe('run:mock:sonnet')
  })

  it('applies harness-spec flag renames and boolean behavior', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    // mock-renamed: printMode → -p, negateBooleans off → false flags dropped.
    const out = await ε({ harness: 'mock-renamed', printMode: true, dryRun: false })`q`

    expect(out.text).toContain('argv:["-p","q"]')
  })

  it('delivers the prompt via stdin when the spec says so', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    const out = await ε({ harness: 'mock-stdin' })`piped prompt`

    expect(out.text).toContain('stdin:piped prompt')
  })

  it('rejects unsupported option types with VALIDATION', async () => {
    await boot()
    const ε = mustLetter('ε')
    await expect(
      ε({ harness: 'mock', nested: { deep: true } as unknown as string })`x`
    ).rejects.toThrow(/unsupported type/)
  })

  it('fails with a HARNESS error (exit code + stderr tail) on non-zero exit', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    const err = await ε({ harness: 'mock', fail: 3 })`x`.catch((e) => e)
    expect(isPizxError(err)).toBe(true)
    expect(err.code).toBe('HARNESS')
    expect(err.message).toContain("harness 'mock' failed with exit code 3")
    expect(err.message).toContain('mock stderr: failing on purpose')
  })

  it('kills the harness and reports a HARNESS error on timeout', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    const err = await ε({ harness: 'mock', sleep: 30000, timeoutMs: 150 })`x`.catch((e) => e)
    expect(isPizxError(err)).toBe(true)
    expect(err.code).toBe('HARNESS')
    expect(err.message).toContain("harness 'mock' timed out after 150ms")
  })

  it('reports a HARNESS error with an install hint when the binary is missing', async () => {
    await boot()
    quietStdio()
    ctx.plugin({
      name: 'test-missing-harness',
      inject: ['harnesses'],
      apply(ctx: Context) {
        ctx.harnesses.define('missing', { command: 'definitely-not-a-real-binary-xyz' })
      },
    })
    await ctx.start()

    const ε = mustLetter('ε')
    const err = await ε({ harness: 'missing' })`x`.catch((e) => e)
    expect(isPizxError(err)).toBe(true)
    expect(err.code).toBe('HARNESS')
    expect(err.message).toContain('failed to start')
    expect(err.message).toContain('installed?')
  })

  it('streams output lines as an async generator', async () => {
    await boot()
    quietStdio()
    const ε = mustLetter('ε')

    const chunks: string[] = []
    for await (const chunk of ε({ harness: 'mock' }).stream`hello`) {
      chunks.push(chunk)
    }
    const joined = chunks.join('')
    expect(joined).toContain('mock first line')
    expect(joined).toContain('argv:["hello"]')
  })

  it('quiet suppresses the live stdout echo but keeps the result text', async () => {
    await boot()
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const ε = mustLetter('ε')

    const out = await ε({ harness: 'mock', quiet: true })`hello`

    expect(out.text).toContain('mock first line')
    const echoed = stdoutWrite.mock.calls.map((c) => String(c[0])).join('')
    expect(echoed).not.toContain('mock first line')
  })

  it('works through the run alias', async () => {
    await boot()
    quietStdio()
    const run = mustLetter('run')
    const out = await run({ harness: 'mock' })`hi`
    expect(out.text).toContain('argv:["hi"]')
  })
})
