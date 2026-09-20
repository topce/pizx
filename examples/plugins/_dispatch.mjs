/**
 * _dispatch — the shared skeleton behind the TypeSafe classify-and-dispatch
 * words (`gate` and `intent`). Both ask one Choice question and route to a
 * handler; only the escalation policy differs, so that policy is the `decide`
 * callback each word supplies.
 *
 * Not a plugin itself — it exposes the schema fragment and the helper the two
 * word plugins import.
 */

import Schema from 'schemastery'
import { LetterOutput, PizxError } from '@topce/pizx'

/** A handler slot: a registered letter name or a pre-configured tag. */
export const refSchema = Schema.union([Schema.string(), Schema.function()])

/**
 * Classify `prompt` with one TypeSafe Choice question, then dispatch to the
 * handler that `decide(answer, opts)` chooses. `decide` returns
 * `{ handler, escalated }`; `handler` may be undefined (the caller had no route
 * and no fallback), which is a VALIDATION error.
 */
export async function classifyAndDispatch(name, ctx, prompt, opts, decide) {
  if (!opts.criteria || typeof opts.criteria !== 'object' || Array.isArray(opts.criteria)) {
    throw new PizxError(
      'VALIDATION',
      `${name}: \`criteria\` must be a map of choice → description`,
      { letter: name }
    )
  }
  if (opts.instructions === undefined || opts.instructions === null) {
    throw new PizxError('VALIDATION', `${name}: \`instructions\` is required`, { letter: name })
  }

  const result = await ctx.typesafe.ask(
    prompt || null,
    { intent: { type: 'choice', instructions: opts.instructions, criteria: opts.criteria } },
    { model: opts.classifierModel }
  )
  const answer = result.answers.intent
  const { handler, escalated } = decide(answer, opts)
  if (handler === undefined) {
    throw new PizxError(
      'VALIDATION',
      `${name}: no handler for '${answer.choice}' and no fallback` +
        (escalated ? ' (confidence below floor/threshold)' : ''),
      { letter: name }
    )
  }

  const label = typeof handler === 'string' ? handler : 'tag'
  const note = `${name}: '${answer.choice}' conf ${answer.confidence} → ${
    escalated ? `escalate (${label})` : label
  }`
  if (!opts.quiet) process.stderr.write(`${note}\n`)

  const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }
  const out = await ctx.words.call(handler, prompt, slotOpts)
  const merged = new LetterOutput(`${note}\n\n${out.text}`, out.modelId)
  merged.withAnswer({ ...answer, escalated, handledBy: label })
  return merged
}
