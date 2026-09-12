#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── route — routing ─────────────────────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): classify the input
// and dispatch it to a specialized handler — separation of concerns, so each
// prompt can be optimized for its own kind of input. Inputs the classifier
// cannot place fall through to the fallback slot.
//
// Slots:  classifier → π · fallback → π
// Run:    pizx examples/word-route.mjs
//
// The realistic use is triage: one entry point, several jobs, and a cost
// decision about which model each job deserves.
//
// level 4/5 ●●●●○ · previous: examples/word-chain.mjs (word 2/7 — prompt chaining) · next: examples/word-vote.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// Reasoning models bill thinking against maxTokens, so a call can spend the
// whole budget thinking and come back empty. Retry with more headroom rather
// than treating an empty string as an answer.
async function withBudget(retries, fn) {
  let last
  for (const maxTokens of retries) {
    last = await fn(maxTokens)
    if (last.text.trim()) return last
    process.stderr.write(`  (empty reply at maxTokens=${maxTokens} — retrying with headroom)\n`)
  }
  return last
}

// ── Real input: the repo's own newest release notes ────────────────────────
const changelog = await fs.readFile('CHANGELOG.md', 'utf-8')
const firstEntry = changelog.indexOf('\n## ')
const secondEntry = changelog.indexOf('\n## ', firstEntry + 1)
const notes =
  secondEntry > firstEntry ? changelog.slice(firstEntry, secondEntry).trim() : changelog.slice(0, 2000)

echo(chalk.bold('\nroute — 1) triage: classify, then answer\n'))

// `routes` maps each category to a handler letter; `categories` gives the
// classifier human-readable descriptions, and a reply that echoes one of
// those descriptions maps back to its route.
const REQUEST =
  'after the last update my script hangs when I pass --run with a harness that is not installed'

const answer = await withBudget([4096, 16384], (maxTokens) =>
  route({
    model: MODEL,
    maxTokens,
    routes: { howto: 'π', bug: 'π', release: 'π' },
    categories: {
      howto: 'How do I use a feature?',
      bug: 'Something is broken or behaves unexpectedly',
      release: 'What changed in a release, or when will X ship?',
    },
  })`
The project's newest release notes:
${notes}

Support request:
${REQUEST}
`
)

echo(chalk.green(answer.text.trim()))
echo(chalk.dim(`\nduration: ${answer.duration}ms\n`))

// ── 2. Model tiering — the same word, different letters per route ──────────
// Handlers can be pre-configured tags, so cheap categories run on a cheap
// model and hard ones on a capable model: the article's cost lever. Most
// traffic is easy, and you should not pay frontier prices for it.
echo(chalk.bold('route — 2) model tiering: one entry point, per-route prompts\n'))

const CLAIMS = [
  'how do I disable the cache for one letter only?',
  'pizx corrupts my files when two scripts run at once',
  'just say hello',
]

for (const claim of CLAIMS) {
  const triaged = await withBudget([4096, 16384], (maxTokens) =>
    route({
      model: MODEL,
      maxTokens,
      routes: {
        howto: π({
          model: MODEL,
          system: 'Answer in at most two sentences. Name the relevant option if you know it.',
        }),
        bug: π({
          model: MODEL,
          system: 'Ask for the exact failing command and its output. Two sentences.',
        }),
        other: π({ model: MODEL, system: 'Reply with one friendly sentence.' }),
      },
      categories: {
        howto: 'How do I use a feature?',
        bug: 'Something is broken or behaves unexpectedly',
        other: 'Anything else',
      },
    })`${claim}`
  )

  echo(chalk.cyan(`  "${claim}"`))
  echo(`    ${triaged.text.trim().split('\n').slice(-1)[0]}\n`)
}

// Handlers can be agents or other words too:
//   await route({ routes: { bug: 'ralph', howto: 'π', release: 'orchestrate' } })`…`
//   await route({ routes: { fast: π({ model: 'cheap' }), slow: π({ model: 'smart' }) } })`…`
//   await route({ fallback: 'Ξ' })`…`     // the custom commit letter catches the rest
