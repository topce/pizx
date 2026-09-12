#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── refine — evaluator-optimizer ────────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): one letter generates
// a draft, another evaluates it against explicit criteria, and the generator
// revises from the feedback — until PASS or the pass budget runs out. The
// flagship pattern for output you would otherwise edit by hand.
//
// Slots:  generate → π · evaluate → π
// Run:    pizx examples/word-refine.mjs
//
// The criteria are the whole game. "Make it better" loops forever; a number,
// a forbidden-words list, and a required element converge.
//
// level 4/5 ●●●●○ · previous: examples/word-vote.mjs (word 4/7 — voting) · next: examples/word-ralph.mjs

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

// ── Real source material: what the README actually claims ──────────────────
const readme = await fs.readFile('README.md', 'utf-8')
const current = readme.split('\n').find((l) => l.startsWith('> '))?.replace(/^> /, '') ?? ''
const features = (await fs.readFile('package.json', 'utf-8')).slice(0, 700)

echo(chalk.bold('\nrefine — generate → evaluate → revise, until PASS\n'))
echo(chalk.dim(`  current tagline: ${current.slice(0, 72) || '(none)'}\n`))

const tagline = await withBudget([4096, 16384], (maxTokens) =>
  refine({
    model: MODEL,
    maxTokens,
    maxPasses: 3,
    criteria:
      'one sentence, at most 14 words, no marketing buzzwords ' +
      '(no "revolutionary", "seamless", "supercharge", "unleash", "game-changer"), ' +
      'mentions both shell scripting and AI in some form, ' +
      'no exclamation mark, no emoji',
  })`
Write the one-line tagline for this tool's README.

What it is: a zx fork that adds AI template tags called letters (π text,
Π coding agent, α any ACP agent, ε any CLI AI harness) on the cordis plugin
framework.

package.json:
${features}

Reply with the tagline only — no quotes, no alternatives, no explanation.
`
)

echo(chalk.green(tagline.text.trim()))
echo(chalk.dim(`\nduration: ${tagline.duration}ms\n`))

// Tune the loop:
//   await refine({ criteria: 'grade 6 reading level, no passive voice', maxPasses: 4 })`
//     rewrite these docs paragraphs`
//   await refine({ evaluate: 'vote' })`…`      // the evaluator votes instead of judging alone
//   await refine({ generate: 'Π' })`…`         // the generator edits files instead of text
//
// Cost note: each pass is a generate + evaluate pair. maxPasses caps the
// spend; a tight PASS condition is what makes the loop stop early.
