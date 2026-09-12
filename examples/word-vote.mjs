#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── vote — parallelization: voting ──────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): run the same prompt
// N times in parallel and aggregate the answers — multiple independent
// perspectives instead of one sample. A clear majority wins outright;
// otherwise the judge letter settles it.
//
// Slots:  voter → π · judge → π
// Run:    pizx examples/word-vote.mjs
//
//   mode: 'majority' — a strict majority wins; the judge synthesizes a
//                      consensus when the voters split (default).
//   mode: 'best'     — the judge always picks the best answer.
//
// Voting earns its cost on two kinds of task: ones with a verifiable answer
// (agreement is evidence) and ones where sampling produces genuinely
// different options worth choosing between. Both are below.
//
// level 4/5 ●●●●○ · previous: examples/word-route.mjs (word 3/7 — routing) · next: examples/word-refine.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

async function withBudget(retries, fn) {
  let last
  for (const maxTokens of retries) {
    last = await fn(maxTokens)
    if (last.text.trim()) return last
    process.stderr.write(`  (empty reply at maxTokens=${maxTokens} — retrying with headroom)\n`)
  }
  return last
}

echo(chalk.bold('\nvote — 1) majority: 3 independent audits of the same diff\n'))

// ── Real input: the last commit's diff ─────────────────────────────────────
const diff = (await $`git show HEAD`).stdout.trim().slice(0, 6000)
const subject = (await $`git log -1 --format=%s`).stdout.trim()

// A narrow, checkable question is what makes voting useful: the voters cannot
// disagree endlessly about taste, and their agreement means something.
const verdict = await withBudget([4096, 16384], (maxTokens) =>
  vote({
    model: MODEL,
    maxTokens,
    votes: 3,
    concurrency: 3,
  })`
Commit under review: ${subject}

Diff:
${diff}

Question: does this change introduce a file-system side effect that runs
during import (module load), rather than only when a function is called?
Answer with exactly one line: "YES: <file>" or "NO", then one sentence of
evidence.
`
)

echo(chalk.green(verdict.text.trim()))
echo(chalk.dim(`\nduration: ${verdict.duration}ms\n`))

echo(chalk.bold('vote — 2) best: 4 candidate release headlines, judged\n'))

// ── Sampling for options, not for truth ────────────────────────────────────
// Here the voters are meant to diverge; the judge picks the strongest one.
const best = await withBudget([4096, 16384], (maxTokens) =>
  vote({
    model: MODEL,
    maxTokens: maxTokens * 2, // 4 parallel voters, all reasoning at once
    votes: 4,
    concurrency: 4,
    mode: 'best',
  })`
Write one release-note headline (max 12 words) for this commit:

${subject}

The headline is for developers deciding whether to upgrade. Reply with the
headline only, no quotes, no punctuation at the end.
`
)

echo(chalk.green(best.text.trim()))
echo(chalk.dim(`\nduration: ${best.duration}ms\n`))

// Tune the tally:
//   await vote({ votes: 5, concurrency: 5 })`is this diff safe to merge?`
//   await vote({ voter: 'Π', votes: 2 })`…`      // agent voters inspect the repo themselves
//   await vote({ voter: 'α', server: ['kiro-cli', 'acp'] })`…`
//   await vote({ judge: 'refine' })`…`            // the judge refines instead of picking
//
// Cost note: N voters means N× the tokens. Use it where disagreement is
// informative — security, migrations, anything irreversible.
