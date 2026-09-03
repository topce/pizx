#!/usr/bin/env pizx
// ─── words.mjs — the word library tour ──────────────────────────────────────
//
// Words are AI patterns built by composing the π/Π/α letters via the
// ctx.words service. Each word's letters live in replaceable slots — swap a
// slot by name ('α') or by tag (Π) at call time, and the pattern stays the
// same. Letters that need options get them through the word: `server`,
// `cwd`, `model`, … are forwarded to whichever letters fill the slots.
//
// Words are themselves letters, so they can be used anywhere a letter can —
// and can be composed into bigger words (letters → words → sentences).
//
// Seven words ship as plugins (see examples/pizx.config.mjs + plugins/):
//   ralph        iterative analyze/plan/execute/review agent loop
//   fleet        parallel fan-out (sectioning)
//   chain        prompt chaining — sequential steps + optional gate
//   route        routing — classify, then dispatch
//   vote         voting — N parallel answers, tallied
//   refine       evaluator-optimizer — revise against criteria until PASS
//   orchestrate  orchestrator-workers — decompose, fan out, synthesize
//
// These are the workflow patterns from Anthropic's "Building effective
// agents". Run:   node dist/cli.js examples/words.mjs
//                 pizx examples/words.mjs

import { $, chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const ACP_SERVER = ['kiro-cli', 'acp']

console.log(chalk.bold(`\n words — the word library (${MODEL})\n`))

// ── fleet — parallel fan-out of a worker letter ─────────────────────────────
// The template splits into one task per line. The `worker` slot (default π)
// runs each task in parallel, then the word fans the results back in.
console.log(chalk.cyan(' 1. fleet — parallel fan-out (worker = π, 3 tasks)\n'))
const fleetResult = await fleet({ model: MODEL, concurrency: 3 })`
summarize git merge in one sentence
summarize git rebase in one sentence
summarize git cherry-pick in one sentence
`
console.log(chalk.green(fleetResult.text))
console.log(chalk.dim(`    duration: ${fleetResult.duration}ms\n`))

// ── ralph — iterative analyze/plan/execute/review loop ──────────────────────
// Slots: analyze/plan/review = π, execute = Π. Here `execute` is swapped Π → π
// so the whole loop stays pure text (no coding agent). With the default slots,
// the same word drives the Π agent in the execute step.
//
// `quiet` is left off so per-iteration progress prints to stderr ("  ralph 1/2").
console.log(chalk.cyan(' 2. ralph — loop, execute swapped Π → π (progress on stderr)\n'))
const ralphResult = await ralph({
  model: MODEL,
  execute: 'π', // <-- slot replacement: swap the agent step (Π) for a text step (π)
  maxIterations: 2,
})`
write a one-sentence definition of a pizx "word"
`
console.log(chalk.green(ralphResult.text))
console.log(chalk.dim(`    duration: ${ralphResult.duration}ms\n`))

// ── ralph with an ACP agent (α) in the execute slot ─────────────────────────
// A letter that needs options gets them through the word: pass `server` next
// to the slot name and the word forwards it to the α slot. The slot also
// accepts a pre-configured tag directly:
//   execute: α({ server: ACP_SERVER })
console.log(chalk.cyan(` 3. ralph — execute swapped to α (${ACP_SERVER.join(' ')}, maxIterations 1)\n`))
if ((await $({ nothrow: true })`which kiro-cli`).exitCode !== 0) {
  console.log(chalk.dim('  (skipped — kiro-cli not found; point `server` at any ACP agent to run)\n'))
} else {
  const acpResult = await ralph({
    execute: 'α', // <-- the ACP agent letter fills the execute slot
    server: ACP_SERVER,
    maxIterations: 1,
    quiet: true,
  })`
write a one-sentence definition of a pizx "word"
`
  console.log(chalk.green(acpResult.text))
  console.log(chalk.dim(`    duration: ${acpResult.duration}ms\n`))
}

// ── chain — prompt chaining (pipeline) ──────────────────────────────────────
// Sequential steps, each consuming the previous output. `stepPrompts` runs
// the `step` slot (π) once per instruction; `steps` would take ordered
// letter refs instead. An optional `gate` letter can stop the chain early.
console.log(chalk.cyan(' 4. chain — sequential steps, each consumes the previous output\n'))
const chainResult = await chain({ model: MODEL, stepPrompts: ['translate the input to French', 'make it rhyme'] })`
pizx is a zx fork with AI letters
`
console.log(chalk.green(chainResult.text))
console.log(chalk.dim(`    duration: ${chainResult.duration}ms\n`))

// ── route — routing (classification + dispatch) ─────────────────────────────
// The classifier (default π) assigns the input to one category; the
// per-category handler letter takes it from there. Routes can be letter
// names or pre-configured tags — e.g. a cheap model for easy queries and a
// capable one for hard ones:
//   routes: { easy: π({ model: 'cheap' }), hard: π({ model: 'smart' }) }
console.log(chalk.cyan(' 5. route — classify, then dispatch to a specialized handler\n'))
const routeResult = await route({ model: MODEL, routes: { greeting: 'π', complaint: 'π' } })`
my package never arrived and support is ignoring me
`
console.log(chalk.green(routeResult.text))
console.log(chalk.dim(`    duration: ${routeResult.duration}ms\n`))

// ── vote — voting parallelization ───────────────────────────────────────────
// The same prompt runs through the voter letter N times in parallel; a clear
// majority wins outright, otherwise the judge settles the vote. mode='best'
// always asks the judge to pick the best answer.
console.log(chalk.cyan(' 6. vote — 3 parallel answers, tallied (majority)\n'))
const voteResult = await vote({ model: MODEL, votes: 3 })`
which git command stages all changes?
`
console.log(chalk.green(voteResult.text))
console.log(chalk.dim(`    duration: ${voteResult.duration}ms\n`))

// ── refine — evaluator-optimizer ────────────────────────────────────────────
// Generate → evaluate against explicit criteria → revise from the feedback,
// until the evaluator says PASS or the pass budget runs out.
console.log(chalk.cyan(' 7. refine — evaluate against criteria, revise until PASS\n'))
const refineResult = await refine({ model: MODEL, criteria: 'one sentence, no jargon', maxPasses: 2 })`
define a pizx "word"
`
console.log(chalk.green(refineResult.text))
console.log(chalk.dim(`    duration: ${refineResult.duration}ms\n`))

// ── orchestrate — orchestrator-workers ──────────────────────────────────────
// A planner decomposes the task (model-driven, unlike fleet's fixed split),
// workers run the subtasks in parallel, and a synthesizer merges the results.
// Swap `worker` for 'Π' to fan out coding agents:
//   await orchestrate({ worker: 'Π' })`implement the TODOs across src/`
console.log(chalk.cyan(' 8. orchestrate — decompose, fan out, synthesize\n'))
const orchestrateResult = await orchestrate({ model: MODEL, concurrency: 3 })`
list three reasons to use a plugin framework for AI scripting
`
console.log(chalk.green(orchestrateResult.text))
console.log(chalk.dim(`    duration: ${orchestrateResult.duration}ms\n`))

// ── The same words, different letters ───────────────────────────────────────
// Swap any slot by name or tag — the pattern is unchanged, the letters change:
//
//   await fleet({ worker: 'Π' })`fix the bugs in src/`   // parallel agents
//   await ralph({ execute: 'α', server: ['kiro-cli', 'acp'] })`refactor auth`
//   await ralph({ review: 'fleet' })`…`                   // review via a fan-out word
//   await chain({ steps: ['ralph', 'fleet'] })`…`         // a loop, then a fan-out
//   await route({ routes: { hard: 'ralph', easy: 'π' } })`…`
//   await orchestrate({ worker: 'refine' })`…`            // refine every section
//
// Words inherit everything letters have: .quiet, .cache, tracing, and globals.

console.log(chalk.dim('  (words are letters — they compose recursively; see docs/words.md)\n'))
