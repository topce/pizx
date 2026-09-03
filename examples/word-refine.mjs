#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── refine — evaluator-optimizer ────────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): one letter
// generates a draft, another evaluates it against explicit criteria, and
// the generator revises from the evaluator's feedback — until a PASS or the
// pass budget runs out. The flagship pattern for tasks where iterative
// refinement provides measurable value (translation, writing, search).
//
// Slots:  generate → π · evaluate → π
// Run:    node dist/cli.js examples/word-refine.mjs
//         pizx examples/word-refine.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\nrefine — generate → evaluate → revise, until PASS\n'))

const result = await refine({
  model: MODEL,
  criteria: 'one sentence, no jargon, under 40 words',
  maxPasses: 3,
})`
define a pizx "word"
`
console.log(chalk.green(result.text))
console.log(chalk.dim(`\nduration: ${result.duration}ms\n`))

// The criteria drive the loop — make them as specific as you like:
//   await refine({ criteria: 'capture nuance and register', maxPasses: 4 })`
//     translate this poem`
//   await refine({ evaluate: 'vote' })`…`   // the evaluator slot votes instead
