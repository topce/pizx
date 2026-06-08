/**
 * PiOutput — the result object returned by the π tag.
 * Patterned after zx's ProcessOutput.
 */

export class PiOutput {
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
