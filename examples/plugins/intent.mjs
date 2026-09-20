/**
 * intent — a "word": TypeSafe's Intent Routing pattern.
 *
 * Classify an incoming request with one TypeSafe Choice question and dispatch
 * each intent to the optimal handler: deterministic logic, a specialist LLM, or
 * a human. Unlike `gate`, which applies per-action confidence thresholds,
 * `intent` uses a single confidence floor and falls back to a safe handler.
 *
 *   await intent({
 *     instructions: 'What does the user want?',
 *     criteria: { refund: '…', technical: '…' },
 *     intents: { refund: 'billingFlow', technical: 'Π' },
 *     fallback: 'human',
 *     floor: 0.6,
 *     escalate: 'human',
 *   })`${query}`
 *
 * Options:
 *   instructions — the classification question.
 *   criteria     — map of intent → description (required).
 *   intents      — map of intent → handler letter ref (string or tag).
 *   fallback     — handler for unclassified intents.
 *   escalate     — handler for confidence below `floor` (defaults to fallback).
 *   floor        — minimum confidence to act (default 0).
 *   classifierModel — TypeSafe model for the classification question.
 *   model        — forwarded to the handler letters (like every word's `model`).
 *
 * `.answer` adds { escalated, handledBy } to the Choice answer.
 */

import Schema from 'schemastery'
import { classifyAndDispatch, refSchema } from './_dispatch.mjs'

export const name = 'intent'

export const inject = ['words', 'letters', 'typesafe']

export function apply(ctx) {
  ctx.words.define('intent', {
    aliases: ['intent-routing'],
    description: 'Intent — classify with TypeSafe Choice, dispatch to a handler',
    options: {
      instructions: Schema.any(),
      criteria: Schema.any(),
      intents: Schema.dict(refSchema).default({}),
      fallback: refSchema,
      escalate: refSchema,
      floor: Schema.number().default(0),
      classifierModel: Schema.string(),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: (prompt, opts, env) =>
      classifyAndDispatch('intent', env.ctx, prompt, opts, (answer) => {
        const escalated = answer.confidence < (opts.floor ?? 0)
        const handler = escalated
          ? (opts.escalate ?? opts.fallback)
          : (opts.intents?.[answer.choice] ?? opts.fallback)
        return { handler, escalated }
      }),
  })
}

export default { name, inject, apply }
