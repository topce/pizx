/**
 * TypeSafe primitive letters — `choice`, `score`, `noul`.
 *
 * Each is an ordinary pizx letter backed by the `ctx.typesafe` service, so it
 * gets option chaining, `.cache`, tracing, and `--json` for free — like `π`/`Π`.
 * The three differ only in the shape of the typed answer they return:
 *
 *   await noul({ instructions: 'Does the customer request a refund?' })`${ticket}`
 *   await choice({ instructions: 'Which team?', criteria: { billing: '…', technical: '…' } })`${ticket}`
 *   await score({ instructions: 'How frustrated?', criteria: ['calm', 'civil', 'angry'] })`${ticket}`
 *
 * Input rule: the template body is the `state` (what is being judged); the
 * `instructions` option is the question. When `instructions` is omitted the body
 * is used as the question instead and `state` stays null — so a bare
 * `` noul`Is this urgent?` `` works. For structured (non-string) state, pass it
 * through the `state` option: pizx's template interpolation uses `String()`, so
 * `` noul`${obj}` `` would otherwise render `[object Object]`.
 *
 * `.text` is the usable scalar (label / number / probability); `.answer` is the
 * full typed TypeSafe answer (with `confidence`, `probabilities`, `legend`), and
 * both survive the result cache.
 */

import type { Plugin } from '@cordisjs/core'
import type {
  ChoiceCriteria,
  EntryType,
  NoulQuestion,
  Questions,
  ScoreCriteria,
} from '@typesafe-ai/sdk'
import Schema from 'schemastery'
import { PizxError } from '../core/errors.ts'
import { type LetterEnv, LetterOutput } from '../core/tags.ts'
import { type ConfirmGate, confirmGateSchema, confirmPhase } from '../core/utils.ts'

const commonOptions = {
  instructions: Schema.any().description('The question (string, object, or array)'),
  state: Schema.any().description('Structured state; overrides the template body'),
  model: Schema.string().description('TypeSafe model id, e.g. jev-1.13.0'),
  timeoutMs: Schema.natural().description('Per-attempt timeout in ms'),
  quiet: Schema.boolean().default(false).description('Suppress printing the result'),
  confirm: confirmGateSchema.description('Confirmation gate before sending state'),
}

const options = {
  noul: Schema.object({
    ...commonOptions,
    criteria: Schema.any().description('Optional { true, false } descriptions of the outcomes'),
  }),
  choice: Schema.object({
    ...commonOptions,
    criteria: Schema.any().description('Required: map of label → description'),
  }),
  score: Schema.object({
    ...commonOptions,
    criteria: Schema.any().description('Required: ordered list of level descriptions (≥2)'),
  }),
}

type BaseOpts = {
  instructions?: unknown
  state?: unknown
  model?: string
  timeoutMs?: number
  quiet: boolean
  confirm?: boolean | ConfirmGate
  criteria?: unknown
}

/** Validated option types for the primitive letters. */
export type NoulOpts = ReturnType<typeof options.noul>
export type ChoiceOpts = ReturnType<typeof options.choice>
export type ScoreOpts = ReturnType<typeof options.score>

/** Resolve the template body + options into TypeSafe's (state, instructions) pair. */
function resolveInput(
  name: string,
  prompt: string,
  opts: BaseOpts
): { instructions: EntryType; state: EntryType } {
  const hasInstructions = opts.instructions !== undefined && opts.instructions !== null
  const body: EntryType = prompt.length > 0 ? prompt : null
  const instructions = (hasInstructions ? opts.instructions : body) as EntryType
  if (instructions === null || instructions === undefined) {
    throw new PizxError(
      'VALIDATION',
      `pizx/${name}: no question — pass \`instructions\`, or put it in the template body ` +
        `(e.g. ${name}\`Is this urgent?\`)`,
      { letter: name }
    )
  }
  const state = opts.state !== undefined ? (opts.state as EntryType) : hasInstructions ? body : null
  return { instructions, state }
}

/** Validate the criteria shape up front, so bad usage is VALIDATION, not an API error. */
function validateChoiceCriteria(name: string, criteria: unknown): ChoiceCriteria {
  if (
    criteria === null ||
    typeof criteria !== 'object' ||
    Array.isArray(criteria) ||
    Object.keys(criteria as Record<string, unknown>).length === 0
  ) {
    throw new PizxError(
      'VALIDATION',
      `pizx/${name}: \`criteria\` must be a non-empty map of label → description`,
      { letter: name }
    )
  }
  return criteria as ChoiceCriteria
}

function validateScoreCriteria(name: string, criteria: unknown): ScoreCriteria {
  if (!Array.isArray(criteria) || criteria.length < 2) {
    throw new PizxError(
      'VALIDATION',
      `pizx/${name}: \`criteria\` must be an ordered list of at least two level descriptions`,
      { letter: name }
    )
  }
  return criteria as unknown as ScoreCriteria
}

function validateNoulCriteria(name: string, criteria: unknown): NoulQuestion['criteria'] {
  if (criteria === undefined || criteria === null) return undefined
  if (typeof criteria !== 'object' || Array.isArray(criteria)) {
    throw new PizxError(
      'VALIDATION',
      `pizx/${name}: \`criteria\` must be { true?, false? } descriptions`,
      { letter: name }
    )
  }
  return criteria as NoulQuestion['criteria']
}

/** Confirm before sending state to TypeSafe, honoring the shared confirm gate. */
async function gatePhase(name: string, state: EntryType, opts: BaseOpts): Promise<void> {
  const preview = typeof state === 'string' ? state : JSON.stringify(state ?? null)
  const shown = `${preview.slice(0, 200)}${preview.length > 200 ? '…' : ''}`
  if (!(await confirmPhase(`Send to TypeSafe:\n    ${shown}`, 'send', true, opts))) {
    throw new PizxError('CANCELLED', `pizx/${name}: cancelled by user at phase 'send'`, {
      letter: name,
    })
  }
}

/** Ask one question, render its scalar, and attach the typed answer. */
async function runQuestion(
  name: string,
  prompt: string,
  opts: BaseOpts,
  env: LetterEnv,
  build: (instructions: EntryType) => Record<string, unknown>,
  render: (answer: Record<string, unknown>) => string
): Promise<LetterOutput> {
  const { instructions, state } = resolveInput(name, prompt, opts)
  await gatePhase(name, state, opts)
  const t0 = Date.now()
  const result = await env.ctx.typesafe.ask(
    state,
    { [name]: build(instructions) } as unknown as Questions,
    {
      model: opts.model,
      timeoutMs: opts.timeoutMs,
    }
  )
  const answer = (result.answers as unknown as Record<string, Record<string, unknown>>)[name]
  const text = render(answer)
  if (!opts.quiet) process.stdout.write(`${text}\n`)
  return new LetterOutput(text, result.model, false, t0, Date.now()).withAnswer(answer)
}

export const typesafePlugin: Plugin.Object = {
  name: 'pizx-typesafe',
  inject: ['letters', 'typesafe'],
  apply(ctx) {
    ctx.letters.define('noul', {
      aliases: ['Noul'],
      description: 'TypeSafe Noul — probability that a yes/no statement is true',
      options: options.noul,
      run: (prompt, opts, env) =>
        runQuestion(
          'noul',
          prompt,
          opts as BaseOpts,
          env,
          (instructions) => {
            const criteria = validateNoulCriteria('noul', (opts as BaseOpts).criteria)
            return {
              type: 'noul',
              instructions,
              ...(criteria !== undefined ? { criteria } : {}),
            }
          },
          (answer) => String(answer.noul)
        ),
    })

    ctx.letters.define('choice', {
      aliases: ['Choice'],
      description: 'TypeSafe Choice — pick one label from a fixed set (with confidence)',
      options: options.choice,
      run: (prompt, opts, env) =>
        runQuestion(
          'choice',
          prompt,
          opts as BaseOpts,
          env,
          (instructions) => ({
            type: 'choice',
            instructions,
            criteria: validateChoiceCriteria('choice', (opts as BaseOpts).criteria),
          }),
          (answer) => String(answer.choice)
        ),
    })

    ctx.letters.define('score', {
      aliases: ['Score'],
      description: 'TypeSafe Score — position on an ordered rubric (with confidence)',
      options: options.score,
      run: (prompt, opts, env) =>
        runQuestion(
          'score',
          prompt,
          opts as BaseOpts,
          env,
          (instructions) => ({
            type: 'score',
            instructions,
            criteria: validateScoreCriteria('score', (opts as BaseOpts).criteria),
          }),
          (answer) => String(answer.score)
        ),
    })
  },
}

export default typesafePlugin
