import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type LlmCallEvent, Trace } from './trace.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
})

async function startTrace(config?: { enabled?: boolean }): Promise<Trace> {
  ctx.plugin(Trace, config)
  await ctx.start()
  return ctx.trace
}

describe('Trace service', () => {
  it('records a run-start event and a stable run id', async () => {
    const trace = await startTrace()
    expect(trace.runId).toMatch(/^pizx-/)
    expect(trace.events[0]).toMatchObject({ kind: 'run-start', runId: trace.runId })
  })

  it('opens spans with letter-start/letter-end and parent links', async () => {
    const trace = await startTrace()
    const span = trace.span('π', 'hello')
    expect(span.spanId).toBeTruthy()
    trace.within(span, () => {
      trace.current()?.emit({ kind: 'cache-miss', key: 'abc' })
    })
    span.end('ok', 'world')

    const start = trace.events.find((e) => e.kind === 'letter-start')
    const end = trace.events.find((e) => e.kind === 'letter-end')
    const miss = trace.events.find((e) => e.kind === 'cache-miss')
    expect(start).toMatchObject({ letter: 'π', prompt: 'hello', spanId: span.spanId })
    expect(end).toMatchObject({ spanId: span.spanId, status: 'ok', outputPreview: 'world' })
    expect(miss).toMatchObject({ spanId: span.spanId, key: 'abc' })
    expect(span.spanEvents).toHaveLength(3) // letter-start + cache-miss + letter-end
  })

  it('isolates concurrent spans via AsyncLocalStorage', async () => {
    const trace = await startTrace()
    const a = trace.span('π', 'a')
    const b = trace.span('Π', 'b')
    expect(a.parentSpanId).toBeUndefined()
    expect(b.parentSpanId).toBeUndefined()

    const results = await Promise.all([
      trace.within(a, async () => {
        await Promise.resolve()
        return trace.current()?.spanId
      }),
      trace.within(b, async () => {
        await Promise.resolve()
        return trace.current()?.spanId
      }),
    ])
    expect(results).toEqual([a.spanId, b.spanId])

    // Events attributed to the correct spans.
    a.emit({ kind: 'cache-hit', key: 'ka' })
    b.emit({ kind: 'cache-hit', key: 'kb' })
    a.end('ok', 'A')
    b.end('ok', 'B')
    expect(a.spanEvents.map((e) => e.kind)).toContain('cache-hit')
    expect(b.spanEvents).toHaveLength(3)
    expect(a.spanEvents).toHaveLength(3)
  })

  it('nests child spans under the current span', async () => {
    const trace = await startTrace()
    const outer = trace.span('Σ', 'delegate')
    const child = trace.within(outer, () => trace.span('π', 'inner'))
    expect(child.parentSpanId).toBe(outer.spanId)
  })

  it('records ACP tool-call events on spans and exports them', async () => {
    const trace = await startTrace()
    const span = trace.span('α', 'hello')
    span.emit({
      kind: 'tool-call',
      server: 'kiro-cli acp',
      toolCallId: 'call-1',
      title: 'Reading a file',
      status: 'pending',
    })
    span.end('ok', 'done')

    expect(span.toolCalls).toHaveLength(1)
    expect(span.toolCalls[0]).toMatchObject({
      kind: 'tool-call',
      spanId: span.spanId,
      server: 'kiro-cli acp',
      toolCallId: 'call-1',
      title: 'Reading a file',
      status: 'pending',
    })
    const jsonl = trace.exportLog('jsonl')
    expect(jsonl).toContain('"kind":"tool-call"')
    expect(jsonl).toContain('"server":"kiro-cli acp"')
  })

  it('aggregates totals from llm-call and cache events', async () => {
    const trace = await startTrace()
    const span = trace.span('π', 'q')
    span.emit({
      kind: 'llm-call',
      modelId: 'fake/model',
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
      totalTokens: 15,
      costUsd: 0.0033,
      durationMs: 12,
    })
    span.emit({ kind: 'cache-hit', key: 'k1' })
    span.emit({ kind: 'cache-miss', key: 'k2' })
    span.end('ok', 'done')

    const totals = trace.totals()
    expect(totals).toMatchObject({
      letters: 1,
      llmCalls: 1,
      cacheHits: 1,
      cacheMisses: 1,
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
      totalTokens: 15,
      costUsd: 0.0033,
    })
  })

  it('exports JSONL with run-end finalized exactly once', async () => {
    const trace = await startTrace()
    const span = trace.span('π', 'q')
    span.end('ok', 'ans')
    const jsonl = trace.exportLog('jsonl')
    const lines = jsonl.split('\n').map((l) => JSON.parse(l))
    expect(lines[0]).toMatchObject({ kind: 'run-start' })
    expect(lines.at(-1)).toMatchObject({ kind: 'run-end', totals: expect.any(Object) })

    // Idempotent.
    expect(trace.exportLog('jsonl')).toBe(jsonl)
    expect(trace.finalize()).toHaveLength(lines.length)
  })

  it('exports JSON with runId, totals, events', async () => {
    const trace = await startTrace()
    const json = JSON.parse(trace.exportLog('json'))
    expect(json.runId).toBe(trace.runId)
    expect(json.events[0].kind).toBe('run-start')
    expect(json.totals.letters).toBe(0)
  })

  it('disables recording when enabled: false (span structure still works)', async () => {
    const trace = await startTrace({ enabled: false })
    const span = trace.span('π', 'q')
    span.end('ok', 'ans')
    // Only the run-start pushed at construction remains.
    expect(trace.events).toHaveLength(1)
    expect(trace.events[0].kind).toBe('run-start')
    expect(span.spanId).toBeTruthy()
  })

  it('flushes JSONL to a file atomically', async () => {
    const trace = await startTrace()
    trace.span('π', 'q').end('ok', 'ans')
    const { mkdtemp, readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const dir = await mkdtemp(join(tmpdir(), 'pizx-trace-'))
    const dest = join(dir, 'run.jsonl')
    const written = await trace.flush(dest)
    expect(written).toBe(dest)
    const lines = (await readFile(dest, 'utf-8')).trim().split('\n')
    expect(JSON.parse(lines[0]).kind).toBe('run-start')
    expect(JSON.parse(lines[lines.length - 1]).kind).toBe('run-end')
  })

  it('exposes llm calls on the span for LetterOutput compatibility', async () => {
    const trace = await startTrace()
    const span = trace.span('π', 'q')
    const event: LlmCallEvent = span.emit({
      kind: 'llm-call',
      modelId: 'm',
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 2,
      costUsd: 0,
      durationMs: 1,
    }) as LlmCallEvent
    expect(span.llmCalls).toEqual([event])
  })

  it('re-exports fresh JSONL after new events are recorded (L7)', async () => {
    const trace = await startTrace()
    const first = trace.exportLog('jsonl')
    expect(first).not.toContain('"letter":"after"')

    trace.span('after', 'q').end('ok', 'ans')
    const second = trace.exportLog('jsonl')
    expect(second).not.toBe(first)
    expect(second).toContain('"letter":"after"')
  })
})
