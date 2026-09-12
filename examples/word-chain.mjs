#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── chain — prompt chaining ─────────────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): decompose a task
// into a fixed sequence of steps where each step refines the previous one —
// trading latency for accuracy by making every call easier.
//
// Slot:   step → π  (gate → π)
// Run:    pizx examples/word-chain.mjs
//
// Two ways to declare steps (declaring both is a VALIDATION error):
//   stepPrompts — ordered instructions, all run through the `step` slot.
//   steps       — ordered letter refs (names or pre-configured tags).
//
// The job: turn this release's commits into an announcement paragraph. One
// call would have to read raw history *and* write *and* edit; the chain makes
// each call do one thing to the output of the last.
//
// level 4/5 ●●●●○ · previous: examples/word-fleet.mjs (word 1/7 — parallel fan-out) · next: examples/word-route.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// Reasoning models bill thinking against maxTokens, and every step receives
// the whole original template — so a step can spend its budget thinking and
// return nothing. When a letter's output drives the next call, retry with
// more headroom instead of failing silently.
async function withBudget(retries, fn) {
  let last
  for (const maxTokens of retries) {
    last = await fn(maxTokens)
    if (last.text.trim()) return last
    process.stderr.write(`  (empty reply at maxTokens=${maxTokens} — retrying with headroom)\n`)
  }
  return last
}

// ── Real input: the newest release notes in the repo ───────────────────────
// CHANGELOG.md is written for maintainers — bullet-per-change, dense. Both
// chains below turn it into something a user reads.
const changelog = await fs.readFile('CHANGELOG.md', 'utf-8')
const firstEntry = changelog.indexOf('\n## ')
const secondEntry = changelog.indexOf('\n## ', firstEntry + 1)
const notes = secondEntry > firstEntry ? changelog.slice(firstEntry, secondEntry).trim() : ''
const history = notes || (await $`git log -8 --oneline`).stdout.trim()

echo(chalk.bold(`\nchain — turning release notes into an announcement (${history.split('\n').length} lines)\n`))

// ── 1. stepPrompts: one slot, a sequence of instructions ───────────────────
// Each step receives the previous step's output as its input, so the prompts
// stay short and single-purpose.
const draft = await withBudget([4096, 16384], (maxTokens) =>
  chain({
    model: MODEL,
    maxTokens,
    stepPrompts: [
      'Rewrite these commits as 3-5 user-facing changes. Drop internal churn, merge duplicates, no hashes.',
      'Turn the change list into a short release announcement paragraph. Open with what the release enables, not with "this release".',
    ],
  })`
Step 1 — if the input is release notes, reply with 3-4 user-facing changes, one
per line, no commit hashes and no internal details.

${history}
`
)

echo(chalk.bold('chain — 1) stepPrompts: distil, then announce\n'))
echo(chalk.green(draft.text.trim()))
echo(chalk.dim(`\nduration: ${draft.duration}ms\n`))

// ── 2. steps + gate: verified steps, ending in a hard constraint ───────────
// `steps` takes ordered letter refs — here Ξ (the commit letter defined in
// examples/plugins/commit.mjs) writes a subject from the real commit list, and
// π rewrites it to fit a 50-character budget. The gate answers PASS/FAIL after
// every step, so an off-track intermediate result stops the chain and is
// reported instead of being carried forward.
//
// Wording matters here. The gate sees the original template next to every step
// output, so each step is phrased as a condition on its *input*: a list of
// commits for step 1, a single subject line for step 2.
const gated = await withBudget([4096, 16384], (maxTokens) =>
  chain({
    model: MODEL,
    maxTokens,
    stepPrompts: [
      'Rewrite these release notes as at most three short bullets, user-facing, no hashes.',
      'Rewrite the bullets as ONE short line a user would understand, no bullets.',
    ],
    gate: π({
      model: MODEL,
      system:
        'You verify one deliverable. Reply with exactly one line: "PASS", or ' +
        '"FAIL: <reason>". PASS only for plain markdown under 80 words, with no ' +
        'commit hashes and no code fences.',
    }),
  })`
Step 1 — if the input is release notes, reply with at most three short bullets.
Step 2 — if the input is a bullet list, reply with one short line.

Input for step 1:
${history}
`
)

echo(chalk.bold('chain — 2) steps + gate: Ξ writes the subject, π tightens it\n'))
echo(chalk.green(gated.text.trim()))
echo(chalk.dim(`\nduration: ${gated.duration}ms\n`))

// Swap any step for another word — chains nest inside chains:
//   await chain({ steps: ['ralph', 'fleet'] })`fix the docs`
//   await chain({ stepPrompts: ['summarize the diff', 'list the risks'], gate: 'vote' })`…`
//   await chain({ steps: [π({ model: 'cheap-model' }), π({ model: 'smart-model' })] })`…`
