/**
 * PiOutput — the result object returned by the π tag.
 * Patterned after zx's ProcessOutput.
 */

import type { CallTrace } from './patterns/types.ts'

export class PiOutput {
  /** Trace entry for this single LLM call. Populated by the π tag. */
  public trace: CallTrace[] = []

  constructor(
    /** Full AI response text */
    public readonly text: string,
    /** The model id that produced this output */
    public readonly modelUsed: string,
    /** Raw streaming events from pi-ai */
    public readonly events: readonly unknown[] = [],
    /** Start timestamp (ms) */
    public readonly startTime: number = Date.now(),
    /** End timestamp (ms) */
    public readonly endTime: number = Date.now()
  ) {}

  /** Duration in milliseconds */
  get duration(): number {
    return this.endTime - this.startTime
  }

  /** Total input tokens (convenience accessor) */
  get inputTokens(): number {
    return this.trace[0]?.inputTokens ?? 0
  }

  /** Total output tokens (convenience accessor) */
  get outputTokens(): number {
    return this.trace[0]?.outputTokens ?? 0
  }

  /** Total tokens (convenience accessor) */
  get totalTokens(): number {
    return this.trace[0]?.totalTokens ?? 0
  }

  /** Total cost in USD (convenience accessor) */
  get totalCost(): number {
    return this.trace[0]?.cost ?? 0
  }

  toString(): string {
    return this.text
  }

  valueOf(): string {
    return this.text
  }

  [Symbol.toPrimitive](): string {
    return this.text
  }

  /** Number of characters in output */
  get length(): number {
    return this.text.length
  }

  /** Number of lines in output */
  get lines(): number {
    return this.text.split('\n').length
  }
}
