/**
 * route — a "word": routing (classification + dispatch, from Anthropic's
 * "Building effective agents"). A classifier letter assigns the input to one
 * category; the per-category handler letter takes it from there. Inputs the
 * classifier cannot place fall through to the fallback slot.
 *
 *   await route({ routes: { refund: 'π', tech: 'π', general: 'π' } })`query`
 *   await route({ routes: { easy: π({ model: 'cheap' }), hard: π({ model: 'smart' }) } })`query`
 *
 * Slots:
 *   classifier → π — assigns the input to exactly one category.
 *   fallback   → π — handles inputs the classifier cannot place.
 *
 * Options:
 *   routes     — dict of category → LetterRef (name or pre-configured tag).
 *                Required; at least one route must be declared.
 *   categories — optional dict of category → description fed to the
 *                classifier (defaults to the route keys themselves).
 */

import Schema from 'schemastery'
import { PizxError } from '@topce/pizx'

export const name = 'route'

export const inject = ['words', 'letters', 'llm']

export function apply(ctx) {
  ctx.words.define('route', {
    aliases: ['branch'],
    description: 'Route — classify the input, dispatch to a per-category handler (routing)',
    slots: { classifier: 'π', fallback: 'π' },
    options: {
      routes: Schema.dict(Schema.union([Schema.string(), Schema.function()])).default({}),
      categories: Schema.dict(Schema.string()).default({}),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      // Forward any letter options (model, server, cwd, …) to slot letters.
      const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }

      const routes = opts.routes ?? {}
      const keys = Object.keys(routes)
      if (keys.length === 0) {
        throw new PizxError(
          'VALIDATION',
          "route: no routes defined — pass `routes: { category: 'π', … }`"
        )
      }
      // Each route key gets its description (or the key itself) for the
      // classifier; a reply matching a description maps back to its key.
      const categories = opts.categories ?? {}
      const labels = keys.map((k) => categories[k] ?? k)

      const raw = (
        await ctx.words.call(
          opts.classifier,
          `Classify the input into exactly one of these categories:\n${labels
            .map((c) => `- ${c}`)
            .join('\n')}\n\nReply with only the category name.\n\nInput:\n${prompt}`,
          slotOpts
        )
      ).text
      const category = (raw.split('\n')[0] ?? '').trim().toLowerCase()
      let match = keys.find((k) => k.toLowerCase() === category)
      if (!match) {
        match = keys.find((k) => (categories[k] ?? k).trim().toLowerCase() === category)
      }
      const handler = match ? routes[match] : opts.fallback
      const viaFallback = !match

      if (!opts.quiet) {
        const label = typeof handler === 'string' ? handler : 'tag'
        process.stderr.write(
          viaFallback
            ? `route: '${category || '(none)'}' → fallback (${label})\n`
            : `route: '${match}' → ${label}\n`
        )
      }

      const out = await ctx.words.call(handler, prompt, slotOpts)
      const note = viaFallback
        ? `(no route for '${category || '(no category)'}' — handled by fallback)`
        : `(routed to '${match}')`
      return `${note}\n\n${out.text}`
    },
  })
}

export default { name, inject, apply }
