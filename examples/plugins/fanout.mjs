/**
 * fanout — a "word": TypeSafe's Speculative Fan-Out pattern.
 *
 * Ask every question the code might need in a single System One call — including
 * speculative ones whose answer only matters for some inputs — then let the code
 * decide what is relevant. One request, answers in parallel.
 *
 *   await fanout({
 *     questions: {
 *       category: { type: 'choice', instructions: '…', criteria: { billing: '…', bug: '…' } },
 *       severity: { type: 'score',  instructions: '…', criteria: ['low', 'high'] },
 *       refund:   { type: 'noul',   instructions: 'Is a refund requested?' },
 *     },
 *   })`${ticket}`
 *
 * Options:
 *   questions — map of name → TypeSafe question ({ type, instructions, criteria? }).
 *   pick      — optional subset of answer names to keep in the output.
 *   model     — TypeSafe model override.
 *
 * The result's `.answer` is the answers map; `.text` is the same as pretty JSON.
 */

import Schema from 'schemastery'
import { LetterOutput, PizxError } from '@topce/pizx'

export const name = 'fanout'

export const inject = ['words', 'letters', 'typesafe']

export function apply(ctx) {
  ctx.words.define('fanout', {
    aliases: ['fan-out'],
    description: 'Fanout — many TypeSafe questions (speculative included) in one call',
    options: {
      questions: Schema.dict(Schema.any()).default({}),
      pick: Schema.array(Schema.string()).default([]),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    cacheable: true,
    run: async (prompt, opts, env) => {
      const { ctx } = env
      const entries = Object.entries(opts.questions ?? {})
      if (entries.length === 0) {
        throw new PizxError(
          'VALIDATION',
          'fanout: pass `questions: { name: { type, instructions, criteria? }, … }`',
          { letter: 'fanout' }
        )
      }
      const result = await ctx.typesafe.ask(prompt || null, opts.questions, { model: opts.model })
      const answers = opts.pick?.length
        ? Object.fromEntries(
            opts.pick.filter((k) => k in result.answers).map((k) => [k, result.answers[k]])
          )
        : result.answers
      if (!opts.quiet) {
        process.stderr.write(`fanout: ${entries.length} question(s) → ${result.model}\n`)
      }
      const out = new LetterOutput(JSON.stringify(answers, null, 2), result.model)
      out.withAnswer(answers)
      return out
    },
  })
}

export default { name, inject, apply }
