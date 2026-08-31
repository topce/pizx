import { describe, expect, it } from 'vitest'
import { parseArgs, shouldPrintResult } from './cli.ts'

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
