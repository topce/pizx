#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── route — routing ─────────────────────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): classify the input
// and dispatch it to a specialized handler — separation of concerns, so each
// prompt can be optimized for its own kind of input. Inputs the classifier
// cannot place fall through to the fallback slot.
//
// Slots:  classifier → π · fallback → π
// Run:    node dist/cli.js examples/word-route.mjs
//         pizx examples/word-route.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\nroute — 1) support triage with category descriptions\n'))

// `routes` maps each category to a handler letter; `categories` gives the
// classifier human-readable descriptions. A reply that echoes a description
// maps back to its route.
const reply = await route({
  model: MODEL,
  routes: { refund: 'π', tech: 'π', general: 'π' },
  categories: {
    refund: 'Refund requests and order problems',
    tech: 'Technical support and product questions',
    general: 'Anything else',
  },
})`
my package never arrived and support is ignoring me
`
console.log(chalk.green(reply.text))
console.log(chalk.dim(`duration: ${reply.duration}ms\n`))

// 2) Model tiering — the article's cheap/capable split, via pre-configured
// tags in the routes dict (commented: needs an anthropic credential):
//
//   const answer = await route({
//     routes: {
//       easy: π({ model: 'deepseek/deepseek-v4-flash' }),
//       hard: π({ model: 'anthropic/claude-sonnet-4-5' }),
//     },
//   })`explain monads in one sentence`
//
// Handlers can be agents or other words too:
//   await route({ routes: { refund: 'Π', tech: 'ralph', general: 'π' } })`…`
