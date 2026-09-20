/**
 * composite — a "word": TypeSafe's Composite Scoring pattern.
 *
 * Break a complex judgment into independent Score questions, normalize each to
 * 0–1, and combine them with weights you control in code. One System One call
 * for every dimension; change the weights to change the ranking without
 * rewriting a prompt.
 *
 *   await composite({
 *     dimensions: {
 *       python: { instructions: '…', criteria: [...], weight: 0.4 },
 *       design: { instructions: '…', criteria: [...], weight: 0.4 },
 *       lead:   { instructions: '…', criteria: [...], weight: 0.2 },
 *     },
 *   })`${resume}`
 *
 * Options:
 *   dimensions — map of name → { instructions, criteria (≥2 levels), weight? }.
 *   weights    — optional name → weight overrides.
 *   normalize  — divide each score by (levels − 1) to 0–1 (default true).
 *   model      — TypeSafe model override.
 *
 * `.answer` is { score, parts: { name: { score, normalized, weight, contribution, confidence } } }.
 */

import Schema from 'schemastery'
import { LetterOutput, PizxError } from '@topce/pizx'

export const name = 'composite'

export const inject = ['words', 'letters', 'typesafe']

export function apply(ctx) {
  ctx.words.define('composite', {
    aliases: ['composite-scoring'],
    description: 'Composite — weighted combination of several TypeSafe Score questions',
    options: {
      dimensions: Schema.dict(Schema.any()).default({}),
      weights: Schema.dict(Schema.number().min(0)).default({}),
      normalize: Schema.boolean().default(true),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    cacheable: true,
    run: async (prompt, opts, env) => {
      const { ctx } = env
      const names = Object.keys(opts.dimensions ?? {})
      if (names.length === 0) {
        throw new PizxError(
          'VALIDATION',
          'composite: pass `dimensions: { name: { instructions, criteria, weight? }, … }`',
          { letter: 'composite' }
        )
      }

      const questions = {}
      for (const n of names) {
        const d = opts.dimensions[n]
        if (!d || typeof d !== 'object' || !Array.isArray(d.criteria) || d.criteria.length < 2) {
          throw new PizxError(
            'VALIDATION',
            `composite: dimension '${n}' needs { instructions, criteria } with ≥2 levels`,
            { letter: 'composite' }
          )
        }
        if (typeof d.weight === 'number' && d.weight < 0) {
          throw new PizxError(
            'VALIDATION',
            `composite: dimension '${n}' weight must be ≥ 0 (got ${d.weight})`,
            { letter: 'composite' }
          )
        }
        questions[n] = {
          type: 'score',
          instructions: d.instructions ?? n,
          criteria: d.criteria,
        }
      }

      const result = await ctx.typesafe.ask(prompt || null, questions, { model: opts.model })

      const parts = {}
      let weighted = 0
      let weightSum = 0
      for (const n of names) {
        const d = opts.dimensions[n]
        const a = result.answers[n]
        const levels = d.criteria.length
        const normalized = opts.normalize ? a.score / Math.max(1, levels - 1) : a.score
        const weight = opts.weights?.[n] ?? d.weight ?? 1
        parts[n] = {
          score: a.score,
          normalized,
          weight,
          contribution: normalized * weight,
          confidence: a.confidence,
        }
        weighted += normalized * weight
        weightSum += weight
      }
      const score = weightSum > 0 ? weighted / weightSum : 0
      const answer = { score, parts }

      const lines = [
        `Composite score: ${score.toFixed(3)}`,
        ...names.map(
          (n) =>
            `  ${n}: ${parts[n].score} (norm ${parts[n].normalized.toFixed(2)}, ` +
            `w ${parts[n].weight}, conf ${parts[n].confidence})`
        ),
      ]
      if (!opts.quiet) process.stderr.write(`composite: ${names.length} dimension(s)\n`)
      const out = new LetterOutput(lines.join('\n'), result.model)
      out.withAnswer(answer)
      return out
    },
  })
}

export default { name, inject, apply }
