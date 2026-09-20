#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── typesafe-custom-letter.mjs — build your own decision letter ─────────────
// The built-in `noul`/`choice`/`score` letters are only a starting point: the
// `ctx.typesafe` service is public, so a custom letter can wrap a specific,
// reusable judgment and expose it with the same DX as π/Π/α — option chaining,
// `.quiet`/`.cache`, tracing, and a line in `pizx --letters`.
//
// Here `urgency` answers one fixed question about a message. Because it is
// cacheable and takes structured options, callers get a typed, reusable
// primitives-shaped letter without re-describing the question each time.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/typesafe-custom-letter.mjs

import { createPizx, LetterOutput, Schema } from '@topce/pizx'
import { chalk } from 'zx'

const app = await createPizx({ cache: true })

// A custom letter backed by one TypeSafe question.
const urgency = app.define('urgency', {
  aliases: ['urgent'],
  description: 'Urgency — TypeSafe probability that a message is time-sensitive',
  options: Schema.object({
    model: Schema.string(),
    quiet: Schema.boolean().default(false),
  }),
  run: async (prompt, opts, env) => {
    const { answers } = await env.ctx.typesafe.ask(
      prompt || null,
      {
        urgency: {
          type: 'noul',
          instructions: 'Does this message convey urgency or time-sensitivity?',
        },
      },
      { model: opts.model }
    )
    const answer = answers.urgency
    const text = String(answer.noul)
    if (!opts.quiet) process.stdout.write(`${text}\n`)
    // Attach the typed answer the same way the built-in letters do.
    return new LetterOutput(text).withAnswer(answer)
  },
})

try {
  const messages = [
    'Hi — whenever you get a chance, could you take a look at the docs page?',
    'Our production API is returning 500s on every request and we are losing orders. Please help ASAP.',
  ]

  echo(chalk.bold('\n custom letter `urgency` (aliases: urgent)\n'))

  for (const message of messages) {
    const out = await urgency({ quiet: true })`${message}`
    const level = out.answer.noul > 0.7 ? 'URGENT' : 'routine'
    echo(`  ${level.padEnd(8)} p=${out.text}  ${chalk.dim(message.slice(0, 48))}…`)
  }

  // It behaves like any other letter: `.cache` and the result cache apply.
  const cached = await urgency({ quiet: true })`${messages[1]}`
  echo(`\n  repeat call from cache: ${chalk.green(String(cached.isFromCache))}`)

  echo(chalk.dim('\n  define one letter per reusable judgment — the service is the extension point.'))
  echo(chalk.dim('  see: src/plugins/typesafe.ts for how the three built-ins are defined\n'))
} finally {
  await app.dispose()
}
