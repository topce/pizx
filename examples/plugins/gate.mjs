/**
 * gate — a "word": TypeSafe's Confidence-Gated Routing pattern.
 *
 * The answer tells you *what*; confidence tells you *whether to act*. Classify
 * with one Choice question, then route to a per-choice handler only when the
 * confidence clears that action's threshold. Below the floor (or below a risky
 * action's threshold) the input escalates instead — to a human or a safer path.
 *
 *   await gate({
 *     instructions: 'What action is the user requesting?',
 *     criteria: { check_balance: '…', approve_transfer: '…', other: '…' },
 *     routes: { check_balance: 'showBalance', approve_transfer: 'approveTransfer' },
 *     thresholds: { approve_transfer: 0.85 },
 *     floor: 0.6,
 *     escalate: 'supportAgent',
 *   })`${command}`
 *
 * Options:
 *   instructions — the classification question.
 *   criteria     — map of choice → description (required).
 *   routes       — map of choice → handler letter ref (string or tag).
 *   thresholds   — optional per-choice confidence thresholds.
 *   floor        — minimum confidence for any action (default 0).
 *   escalate     — handler for below-floor / below-threshold inputs.
 *   classifierModel — TypeSafe model for the classification question.
 *   model        — forwarded to the handler letters (like every word's `model`).
 *
 * `.answer` adds { escalated, handledBy } to the Choice answer.
 */

import Schema from 'schemastery'
import { classifyAndDispatch, refSchema } from './_dispatch.mjs'

export const name = 'gate'

export const inject = ['words', 'letters', 'typesafe']

export function apply(ctx) {
  ctx.words.define('gate', {
    aliases: ['confidence-routing', 'confidence-gated-routing'],
    description: 'Gate — route by TypeSafe Choice, gated on per-action confidence',
    options: {
      instructions: Schema.any(),
      criteria: Schema.any(),
      routes: Schema.dict(refSchema).default({}),
      thresholds: Schema.dict(Schema.number()).default({}),
      floor: Schema.number().default(0),
      escalate: refSchema,
      classifierModel: Schema.string(),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: (prompt, opts, env) =>
      classifyAndDispatch('gate', env.ctx, prompt, opts, (answer) => {
        const threshold = opts.thresholds?.[answer.choice]
        const escalated =
          answer.confidence < (opts.floor ?? 0) ||
          (threshold !== undefined && answer.confidence < threshold)
        const handler = escalated
          ? opts.escalate
          : (opts.routes?.[answer.choice] ?? opts.escalate)
        return { handler, escalated }
      }),
  })
}

export default { name, inject, apply }
