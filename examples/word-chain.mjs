#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── chain — prompt chaining ─────────────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): decompose a task
// into a fixed sequence of steps where each step processes the previous
// step's output — trading latency for accuracy by making every call easier.
// Optional "gate" checks between steps stop the chain early when a step
// goes off track.
//
// Slot:   step → π  (gate → π)
// Run:    node dist/cli.js examples/word-chain.mjs
//         pizx examples/word-chain.mjs
//
// Two ways to declare the steps (both at once is a VALIDATION error):
//   stepPrompts — ordered instructions, all run through the `step` slot.
//   steps       — ordered letter refs (names or pre-configured tags).

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\nchain — 1) stepPrompts: translate, then rhyme\n'))

const translated = await chain({
  model: MODEL,
  stepPrompts: ['translate the input to French', 'make it rhyme'],
})`
pizx is a zx fork with AI letters
`
console.log(chalk.green(translated.text))
console.log(chalk.dim(`duration: ${translated.duration}ms\n`))

console.log(chalk.bold('\nchain — 2) steps + gate: two Σ steps, gated\n'))

// `steps` takes ordered letter refs — here the registered Σ (summarize)
// letter runs twice, each time on the previous output. A pre-configured π
// tag fills the gate slot and answers PASS/FAIL after every step; FAIL
// stops the chain and is reported.
const gated = await chain({
  model: MODEL,
  steps: ['Σ', 'Σ'],
  gate: π({ model: MODEL, system: 'You are a terse process checker.' }),
})`
pizx is a zx fork on the cordis plugin framework. Letters like π, Π, and α
are template tags backed by language models, registered by plugins. Words
compose letters into AI patterns — chains, fan-outs, loops, routing, voting,
and refinement — and are themselves letters, so they compose recursively.
`
console.log(chalk.green(gated.text))
console.log(chalk.dim(`duration: ${gated.duration}ms\n`))

// Swap any step for another word — chains nest inside chains:
//   await chain({ steps: ['ralph', 'fleet'] })`fix the docs`
//   await chain({ stepPrompts: ['summarize', 'shorten'], gate: 'η' })`…`
