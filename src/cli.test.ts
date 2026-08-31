import { describe, expect, it, vi } from 'vitest'
import {
  EXIT_CODES,
  errorToJson,
  exitCodeFor,
  lettersToJson,
  parseArgs,
  reportError,
  resultToJson,
  shouldDisableColor,
  shouldPrintResult,
  shouldReadStdin,
} from './cli.ts'
import { PizxError, type PizxErrorCode } from './core/errors.ts'
import { LetterOutput } from './core/tags.ts'

describe('cli parseArgs', () => {
  it('parses simple flags', () => {
    const { flags, positional } = parseArgs(['--trace', '--cache', 'script.mjs'])
    expect(flags.trace).toBe(true)
    expect(flags.cache).toBe(true)
    expect(positional).toEqual(['script.mjs'])
  })

  it('parses valued flags', () => {
    const { flags } = parseArgs(['-m', 'anthropic/x', '--system', 'sys', '--config', 'c.mjs'])
    expect(flags.model).toBe('anthropic/x')
    expect(flags.system).toBe('sys')
    expect(flags.config).toBe('c.mjs')
  })

  it('parses --export-log with and without a path', () => {
    expect(parseArgs(['--export-log', 'out.jsonl']).flags.exportLog).toBe('out.jsonl')
    // Script-looking tokens are the script, not the log path: the default
    // log path applies (see the --export-log branch comment in cli.ts).
    expect(parseArgs(['--export-log', 'script.mjs']).flags.exportLog).toBeNull()
    expect(parseArgs(['--export-log']).flags.exportLog).toBeNull()
  })

  it('parses aliases and modes', () => {
    const { flags } = parseArgs(['-p', '-q', '-v'])
    expect(flags.print).toBe(true)
    expect(flags.quiet).toBe(true)
    expect(flags.version).toBe(true)
  })

  it('keeps unknown args as positional', () => {
    const { positional } = parseArgs(['a.mjs', '--whatever', 'b'])
    expect(positional).toEqual(['a.mjs', '--whatever', 'b'])
  })

  it('parses --no-cache', () => {
    expect(parseArgs(['--no-cache']).flags.noCache).toBe(true)
  })

  it('parses --no-color', () => {
    expect(parseArgs(['--no-color']).flags.noColor).toBe(true)
  })

  it('parses --json', () => {
    expect(parseArgs(['--json']).flags.json).toBe(true)
  })

  it('parses --acp and --acp-server', () => {
    const { flags, positional } = parseArgs([
      '--acp',
      '--acp-server',
      'kiro-cli acp',
      'fix the bug',
    ])
    expect(flags.acp).toBe(true)
    expect(flags.acpServer).toBe('kiro-cli acp')
    expect(positional).toEqual(['fix the bug'])
  })

  it('parses --acp without a server as positional prompt', () => {
    const { flags, positional } = parseArgs(['--acp', 'hello'])
    expect(flags.acp).toBe(true)
    expect(flags.acpServer).toBeUndefined()
    expect(positional).toEqual(['hello'])
  })
})

describe('shouldPrintResult', () => {
  // Non-quiet + streamed (cache miss): run() already streamed to stdout,
  // so the CLI must NOT print again (would duplicate the answer).
  it('does not print when streamed live (non-quiet, not cached)', () => {
    expect(shouldPrintResult(false, false)).toBe(false)
  })

  // The regression this fixes: a cache hit skips run()/streaming, so without
  // this the second run of the same prompt printed nothing.
  it('prints on a cache hit even in non-quiet mode', () => {
    expect(shouldPrintResult(false, true)).toBe(true)
  })

  // Quiet mode suppresses streaming, so the CLI always prints the final text.
  it('prints in quiet mode regardless of cache', () => {
    expect(shouldPrintResult(true, false)).toBe(true)
    expect(shouldPrintResult(true, true)).toBe(true)
  })
})

describe('exitCodeFor', () => {
  const cases: Array<[PizxErrorCode, number]> = [
    ['VALIDATION', 2],
    ['AUTH', 3],
    ['AGENT', 4],
    ['ACP', 5],
    ['CANCELLED', 6],
    ['INTERNAL', 7],
  ]

  it.each(cases)('maps PizxError code %s to exit code %i', (code, expected) => {
    expect(exitCodeFor(new PizxError(code, 'boom'))).toBe(expected)
    expect(EXIT_CODES[code]).toBe(expected)
  })

  it('maps a foreign Error to 1', () => {
    expect(exitCodeFor(new Error('nope'))).toBe(1)
  })

  it('maps a non-error value to 1', () => {
    expect(exitCodeFor('nope')).toBe(1)
    expect(exitCodeFor(undefined)).toBe(1)
    expect(exitCodeFor(null)).toBe(1)
  })
})

describe('reportError', () => {
  const flags = parseArgs([]).flags

  it('returns the mapped exit code and writes the message to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const code = reportError(new PizxError('AUTH', 'pizx: no creds — run `pi auth login`'), flags)
      expect(code).toBe(3)
      expect(spy).toHaveBeenCalledOnce()
      expect(String(spy.mock.calls[0][0])).toContain('pi auth login')
    } finally {
      spy.mockRestore()
    }
  })

  it('prefixes foreign errors with `pizx:` and returns 1', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const code = reportError(new Error('boom'), flags)
      expect(code).toBe(1)
      expect(String(spy.mock.calls[0][0])).toBe('pizx: boom\n')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('shouldDisableColor', () => {
  const base = parseArgs([]).flags

  it('is true when --no-color is set', () => {
    expect(shouldDisableColor(parseArgs(['--no-color']).flags, {})).toBe(true)
  })

  it('is false by default with no NO_COLOR', () => {
    expect(shouldDisableColor(base, {})).toBe(false)
  })

  it('respects a non-empty NO_COLOR env var', () => {
    expect(shouldDisableColor(base, { NO_COLOR: '1' })).toBe(true)
  })

  it('ignores an empty NO_COLOR env var', () => {
    expect(shouldDisableColor(base, { NO_COLOR: '' })).toBe(false)
  })

  it('is true when --json is set (JSON output must be uncolored)', () => {
    expect(shouldDisableColor(parseArgs(['--json']).flags, {})).toBe(true)
  })
})

describe('shouldReadStdin', () => {
  it('is true for an explicit "-" regardless of TTY', () => {
    expect(shouldReadStdin('-', true)).toBe(true)
    expect(shouldReadStdin('-', false)).toBe(true)
    expect(shouldReadStdin('-', undefined)).toBe(true)
  })

  it('reads stdin for an empty prompt only when piped (not a TTY)', () => {
    expect(shouldReadStdin('', false)).toBe(true)
    expect(shouldReadStdin('', undefined)).toBe(true)
    expect(shouldReadStdin('', true)).toBe(false)
  })

  it('does not read stdin when a prompt is provided', () => {
    expect(shouldReadStdin('hello', false)).toBe(false)
    expect(shouldReadStdin('hello', true)).toBe(false)
  })
})

describe('resultToJson', () => {
  it('serializes a full LetterOutput envelope', () => {
    const out = new LetterOutput('hello world', 'deepseek/deepseek-v4-flash', false, 1000, 1250)
    expect(resultToJson(out)).toEqual({
      text: 'hello world',
      modelId: 'deepseek/deepseek-v4-flash',
      fromCache: false,
      durationMs: 250,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      costUsd: 0,
    })
  })

  it('reflects a cache hit (no model, fromCache true)', () => {
    const out = new LetterOutput('cached answer', undefined, true, 5, 5)
    const json = resultToJson(out)
    expect(json.fromCache).toBe(true)
    expect(json.modelId).toBeUndefined()
    expect(json.durationMs).toBe(0)
  })
})

describe('errorToJson', () => {
  it('uses the PizxError code', () => {
    expect(errorToJson(new PizxError('ACP', 'server died'))).toEqual({
      error: { code: 'ACP', message: 'server died' },
    })
  })

  it('maps foreign and non-error values to UNKNOWN', () => {
    expect(errorToJson(new Error('boom'))).toEqual({
      error: { code: 'UNKNOWN', message: 'boom' },
    })
    expect(errorToJson('weird')).toEqual({ error: { code: 'UNKNOWN', message: 'weird' } })
  })
})

describe('lettersToJson', () => {
  it('serializes the registry to name/aliases/cacheable/description', () => {
    const entries = [
      { name: 'π', aliases: ['pi', 'ai'], cacheable: true, description: 'text gen' },
      { name: 'Π', aliases: ['Pi', 'piAgent'], cacheable: false, description: '' },
    ]
    expect(lettersToJson(entries)).toEqual([
      { name: 'π', aliases: ['pi', 'ai'], cacheable: true, description: 'text gen' },
      { name: 'Π', aliases: ['Pi', 'piAgent'], cacheable: false, description: '' },
    ])
  })

  it('copies the aliases array rather than aliasing it', () => {
    const entries = [{ name: 'π', aliases: ['pi'], cacheable: true, description: 'x' }]
    const out = lettersToJson(entries)
    expect(out[0].aliases).not.toBe(entries[0].aliases)
    expect(out[0].aliases).toEqual(entries[0].aliases)
  })
})
