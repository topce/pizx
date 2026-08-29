/**
 * pizx trace service — structured, span-based execution tracing.
 *
 * Every letter invocation opens a span; LLM calls and cache operations inside
 * it are recorded as events carrying the current span id (tracked through
 * AsyncLocalStorage, so concurrent letters never interleave). The run-level
 * store can be exported as JSONL/JSON logs, deepseek-harness style.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { type Context, Service } from '@cordisjs/core'
import { version as pizxVersion } from '../../package.json'
import { newRunId, sha256 } from './utils.ts'

// ── Event types ─────────────────────────────────────────────────────────────

export interface RunTotals {
  letters: number
  llmCalls: number
  cacheHits: number
  cacheMisses: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  durationMs: number
}

export interface RunStartEvent {
  kind: 'run-start'
  runId: string
  ts: number
  node: string
  pizx: string
}

export interface RunEndEvent {
  kind: 'run-end'
  runId: string
  ts: number
  totals: RunTotals
}

export interface LetterStartEvent {
  kind: 'letter-start'
  spanId: string
  parentSpanId?: string
  letter: string
  prompt: string
  model?: string
  ts: number
}

export interface LetterEndEvent {
  kind: 'letter-end'
  spanId: string
  status: 'ok' | 'error'
  outputPreview: string
  fromCache?: boolean
  durationMs: number
  ts: number
}

export interface LlmCallEvent {
  kind: 'llm-call'
  spanId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  durationMs: number
  ts: number
}

export interface CacheEvent {
  kind: 'cache-hit' | 'cache-miss'
  spanId: string
  key: string
  ts: number
}

/** A tool call reported by an ACP agent (α letter) inside a span. */
export interface AcpToolCallEvent {
  kind: 'tool-call'
  spanId: string
  /** The ACP server command line that reported the tool call. */
  server: string
  toolCallId: string
  title: string
  status: string
  ts: number
}

export interface TraceErrorEvent {
  kind: 'error'
  spanId?: string
  message: string
  ts: number
}

export type TraceEvent =
  | RunStartEvent
  | RunEndEvent
  | LetterStartEvent
  | LetterEndEvent
  | LlmCallEvent
  | CacheEvent
  | AcpToolCallEvent
  | TraceErrorEvent

/** Any trace event with an optional/omitted timestamp (stamped by record). */
export type TraceEventInput =
  | Omit<RunStartEvent, 'ts'>
  | Omit<RunEndEvent, 'ts'>
  | Omit<LetterStartEvent, 'ts'>
  | Omit<LetterEndEvent, 'ts'>
  | Omit<LlmCallEvent, 'ts'>
  | Omit<CacheEvent, 'ts'>
  | Omit<AcpToolCallEvent, 'ts'>
  | Omit<TraceErrorEvent, 'ts'>

/** Events a span may emit (spanId is stamped by the span itself). */
export type SpanEventInput =
  | Omit<LetterStartEvent, 'ts' | 'spanId'>
  | Omit<LetterEndEvent, 'ts' | 'spanId'>
  | Omit<LlmCallEvent, 'ts' | 'spanId'>
  | Omit<CacheEvent, 'ts' | 'spanId'>
  | Omit<AcpToolCallEvent, 'ts' | 'spanId'>
  | Omit<TraceErrorEvent, 'ts' | 'spanId'>

// ── Span ────────────────────────────────────────────────────────────────────

let spanCounter = 0

/** A single letter invocation span. Events emitted while it is active carry its id. */
export class TraceSpan {
  readonly spanId: string
  readonly parentSpanId: string | undefined
  /** Creation timestamp (ms since epoch). */
  readonly startTime: number
  private readonly events: TraceEvent[] = []

  constructor(
    private readonly trace: Trace,
    parent: TraceSpan | undefined,
    public readonly letter: string,
    public readonly prompt: string,
    public readonly model?: string
  ) {
    this.spanId = `s${++spanCounter}-${sha256(`${letter}:${prompt}:${Date.now()}:${Math.random()}`).slice(0, 6)}`
    this.parentSpanId = parent?.spanId
    this.startTime = Date.now()
  }

  /** Record an event attributed to this span. Returns the event. */
  emit(event: SpanEventInput): TraceEvent {
    return this.trace.record({ ...event, spanId: this.spanId })
  }

  /** Close the span with a status and output preview. */
  end(status: 'ok' | 'error', output: string, fromCache?: boolean): LetterEndEvent {
    return this.emit({
      kind: 'letter-end',
      status,
      outputPreview: output.slice(0, 200),
      fromCache,
      durationMs: Date.now() - this.startTime,
    }) as LetterEndEvent
  }

  /** Events recorded within this span only. */
  get spanEvents(): readonly TraceEvent[] {
    return this.events
  }

  /** LLM calls made within this span (for LetterOutput.trace compatibility). */
  get llmCalls(): LlmCallEvent[] {
    return this.events.filter((e): e is LlmCallEvent => e.kind === 'llm-call')
  }

  /** Number of cache hits recorded within this span. */
  get cacheHits(): number {
    return this.events.filter((e) => e.kind === 'cache-hit').length
  }

  /** ACP tool calls recorded within this span (α letter). */
  get toolCalls(): AcpToolCallEvent[] {
    return this.events.filter((e): e is AcpToolCallEvent => e.kind === 'tool-call')
  }

  /** @internal — called by Trace.record to attach events to this span. */
  _attach(event: TraceEvent): void {
    this.events.push(event)
  }
}

// ── Service ─────────────────────────────────────────────────────────────────

const spanStorage = new AsyncLocalStorage<TraceSpan>()

export interface TraceConfig {
  /** Record spans and events. Default true; set false for zero-overhead runs. */
  enabled?: boolean
  /** Directory used by flush() when no explicit path is given. Default `.pizx/logs`. */
  dir?: string
}

declare module '@cordisjs/core' {
  interface Context {
    trace: Trace
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Events<in C extends Context = Context> {
    'pizx/trace'(event: TraceEvent): void
  }
}

export class Trace extends Service<TraceConfig> {
  readonly runId = newRunId()
  readonly events: TraceEvent[] = []
  private readonly spans = new Map<string, TraceSpan>()
  private finalized = false
  private jsonlCache = ''
  private jsonCache = ''

  constructor(ctx: Context, config?: TraceConfig) {
    super(ctx, 'trace')
    this.config = {
      enabled: config?.enabled ?? true,
      dir: config?.dir ?? '.pizx/logs',
    }
    this.events.push({
      kind: 'run-start',
      runId: this.runId,
      ts: Date.now(),
      node: process.version,
      pizx: pizxVersion,
    })
  }

  get enabled(): boolean {
    return this.config.enabled !== false
  }

  /** The span of the innermost letter invocation currently executing, if any. */
  current(): TraceSpan | undefined {
    return spanStorage.getStore()
  }

  /** Open a child span (of the current span, if any) and record letter-start. */
  span(letter: string, prompt: string, model?: string): TraceSpan {
    const parent = spanStorage.getStore()
    const s = new TraceSpan(this, parent, letter, prompt, model)
    this.spans.set(s.spanId, s)
    this.record({
      kind: 'letter-start',
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      letter,
      prompt,
      model,
      ts: s.startTime,
    })
    return s
  }

  /** Run fn with span as the AsyncLocalStorage context. */
  within<T>(span: TraceSpan, fn: () => T): T {
    return spanStorage.run(span, fn)
  }

  /** Record an event at run level (unless tracing is disabled). */
  record(event: TraceEventInput & { ts?: number }): TraceEvent {
    if (!this.enabled) return event as TraceEvent
    const full = { ...event, ts: event.ts ?? Date.now() }
    this.events.push(full)
    if ('spanId' in full && full.spanId) this.spans.get(full.spanId)?._attach(full)
    this.ctx.emit('pizx/trace', full)
    return full
  }

  // ── Aggregation & export ──────────────────────────────────────────────────

  /** Aggregate token/cost/cache totals across the whole run. */
  totals(): RunTotals {
    const totals: RunTotals = {
      letters: 0,
      llmCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      durationMs: 0,
    }
    for (const e of this.events) {
      switch (e.kind) {
        case 'letter-start':
          totals.letters++
          break
        case 'llm-call':
          totals.llmCalls++
          totals.inputTokens += e.inputTokens
          totals.outputTokens += e.outputTokens
          totals.cacheReadTokens += e.cacheReadTokens
          totals.cacheWriteTokens += e.cacheWriteTokens
          totals.totalTokens += e.totalTokens
          totals.costUsd += e.costUsd
          break
        case 'cache-hit':
          totals.cacheHits++
          break
        case 'cache-miss':
          totals.cacheMisses++
          break
        default:
          break
      }
    }
    const first = this.events[0]?.ts ?? Date.now()
    const last = this.events.at(-1)?.ts ?? first
    totals.durationMs = last - first
    return totals
  }

  /** Append run-end once and return the full event list (idempotent). */
  finalize(): TraceEvent[] {
    if (!this.finalized) {
      this.finalized = true
      this.events.push({
        kind: 'run-end',
        runId: this.runId,
        ts: Date.now(),
        totals: this.totals(),
      })
    }
    return this.events
  }

  /** Export the run as a JSONL (default) or JSON string, including run-end. */
  exportLog(format: 'jsonl' | 'json' = 'jsonl'): string {
    if (format === 'jsonl') {
      if (!this.jsonlCache) {
        this.jsonlCache = this.finalize()
          .map((e) => JSON.stringify(e))
          .join('\n')
      }
      return this.jsonlCache
    }
    if (!this.jsonCache) {
      this.jsonCache = JSON.stringify(
        { runId: this.runId, totals: this.totals(), events: this.finalize() },
        null,
        2
      )
    }
    return this.jsonCache
  }

  /** Human-readable summary (used by `pizx --trace`). */
  summary(): string {
    const t = this.totals()
    const attempts = t.cacheHits + t.cacheMisses
    const hitRatio = attempts > 0 ? t.cacheHits / attempts : 0
    return [
      `run ${this.runId} — ${t.letters} letter(s), ${t.llmCalls} LLM call(s), ${(t.durationMs / 1000).toFixed(1)}s`,
      `  tokens: in=${t.inputTokens} out=${t.outputTokens} cacheRead=${t.cacheReadTokens} cacheWrite=${t.cacheWriteTokens}`,
      `  cache: ${t.cacheHits} hit / ${t.cacheMisses} miss (${(hitRatio * 100).toFixed(0)}%) — cost $${t.costUsd.toFixed(4)}`,
    ].join('\n')
  }

  /** Write the exported log atomically. Defaults to `<dir>/<runId>.<ext>`. */
  async flush(path?: string, format: 'jsonl' | 'json' = 'jsonl'): Promise<string> {
    const ext = format === 'jsonl' ? 'jsonl' : 'json'
    const dest = path ?? `${this.config.dir}/${this.runId}.${ext}`
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { atomicWriteFile } = await import('./utils.ts')
    await mkdir(dirnameOf(dest), { recursive: true })
    await atomicWriteFile(
      (tmp) =>
        writeFile(tmp, `${this.exportLog(format)}${format === 'jsonl' ? '\n' : ''}`, 'utf-8'),
      dest
    )
    return dest
  }
}

function dirnameOf(p: string): string {
  return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.'
}
