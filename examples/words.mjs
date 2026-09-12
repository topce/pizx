#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />
// ─── words.mjs — the word library tour ──────────────────────────────────────
//
// Words are AI patterns built by composing the π/Π/α/ε letters through the
// ctx.words service. Each word's letters live in replaceable slots — swap a
// slot by name ('α') or by tag (Π) at call time and the pattern stays the
// same. Letters that need options get them through the word: `server`,
// `cwd`, `model`, … are forwarded to whichever letters fill the slots.
//
// Words are themselves letters, so they compose recursively:
// letters → words → bigger words.
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
// This tour runs each one once, on the repo's own content — the same shapes
// the focused examples (examples/word-*.mjs) use, kept short here.
//
// level 5/5 ●●●●● · previous: examples/word-orchestrate.mjs (word 7/7 — orchestrator-workers) · next: examples/acp-word-slots.mjs
//
// Run:   pizx examples/words.mjs

import { $, chalk, fs } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const ACP_SERVER = ['kiro-cli', 'acp']

// A CLI can be on PATH and still be unusable (wrong version, not logged in).
// Probing `--version` before an optional section keeps these examples honest:
// they either do the real work or say plainly why they did not.
async function usable(bin) {
  const probe = await $({ nothrow: true })`${bin} --version`
  return probe.exitCode === 0
}


echo(chalk.bold(`\n words — the word library (${MODEL})\n`))

// Show each word's result without the token/cost noise, and keep one failing
// word from ending the tour.
async function section(title, fn) {
  echo(chalk.cyan(` ${title}\n`))
  const started = Date.now()
  try {
    const result = await fn()
    echo(`${result.text.trim()}\n`)
    echo(chalk.dim(`    ${Date.now() - started}ms\n`))
  } catch (err) {
    echo(chalk.red(`    failed: ${err.message.split('\n')[0]}\n`))
  }
}

// ── Shared, real inputs ────────────────────────────────────────────────────
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))
const changelog = await fs.readFile('CHANGELOG.md', 'utf-8')
const firstEntry = changelog.indexOf('\n## ')
const secondEntry = changelog.indexOf('\n## ', firstEntry + 1)
const notes = secondEntry > firstEntry ? changelog.slice(firstEntry, secondEntry).trim() : ''
const commits = (await $`git log -8 --no-merges --oneline`).stdout.trim()
const subjects = commits.split('\n').map((l) => l.replace(/^[0-9a-f]+ /, ''))

// ── 1. fleet — parallel fan-out ────────────────────────────────────────────
// One task per line; the worker slot (π by default) runs them concurrently.
// Built for many SHORT answers — results are shown truncated to 200 chars.
await section('1. fleet — parallel fan-out, one task per changed area', () => {
  const tasks = [
    'Write one conventional-commit subject (max 60 chars) for: adding the ε letter that runs any CLI AI harness',
    'Write one conventional-commit subject (max 60 chars) for: adding the seven-word AI pattern library',
    'Write one conventional-commit subject (max 60 chars) for: adding --json output and structured exit codes',
  ].join('\n')
  return fleet({ model: MODEL, concurrency: 3 })`${tasks}`
})

// ── 2. chain — prompt chaining ─────────────────────────────────────────────
// Sequential steps; each one refines the previous step's output. A `gate`
// letter can check every step and stop the chain early.
await section('2. chain — distil the release notes, then write the announcement', () =>
  chain({
    model: MODEL,
    maxTokens: 16384,
    stepPrompts: [
      'Rewrite these release notes as 3-4 user-facing changes, no hashes.',
      'Turn the change list into a two-sentence announcement for users.',
    ],
  })`
Step 1 — if the input is release notes, reply with 3-4 user-facing changes.
Step 2 — if the input is a change list, reply with a two-sentence announcement.

Input for step 1:
${notes || commits}
`
)

// ── 3. route — classify, then dispatch ─────────────────────────────────────
// The classifier picks a category; the per-category handler takes over.
// Handlers can be tags, so each category can use its own model or prompt.
await section('3. route — triage a support request against the release notes', () =>
  route({
    model: MODEL,
    maxTokens: 16384,
    routes: { howto: 'π', bug: 'π', release: 'π' },
    categories: {
      howto: 'How do I use a feature?',
      bug: 'Something is broken or behaves unexpectedly',
      release: 'What changed in a release, or when will X ship?',
    },
  })`
Newest release notes:
${notes || commits}

Support request:
${subjects[0] ? `pizx hangs since ${subjects[0].slice(0, 40)} — is that expected?` : 'how do I use the cache?'}
`
)

// ── 4. vote — N parallel answers, tallied ──────────────────────────────────
// A clear majority wins; a split goes to the judge. mode='best' always asks
// the judge to pick the strongest answer instead.
await section('4. vote — 3 release headlines, judged', () =>
  vote({
    model: MODEL,
    maxTokens: 32768,
    votes: 3,
    concurrency: 3,
    mode: 'best',
  })`
Write one release-note headline (max 12 words) for this release:

${notes.slice(0, 1500)}

Reply with the headline only — no quotes.
`
)

// ── 5. refine — evaluator-optimizer ────────────────────────────────────────
// Generate → evaluate against explicit criteria → revise from the feedback,
// until the evaluator says PASS or the pass budget runs out.
await section('5. refine — a tagline that must satisfy hard criteria', () =>
  refine({
    model: MODEL,
    maxTokens: 16384,
    maxPasses: 3,
    criteria: 'one sentence, at most 14 words, no buzzwords, no exclamation mark',
  })`
Write the one-line tagline for ${pkg.name}: ${pkg.description}

Reply with the tagline only.
`
)

// ── 6. ralph — the agent loop ──────────────────────────────────────────────
// analyze → plan → execute → review, repeated until the review says DONE.
// The default execute slot is Π (a coding agent); here it is swapped to π so
// the tour stays text-only. examples/word-ralph.mjs runs the real agent on a
// scratch project and verifies the fix with a test command.
await section('6. ralph — analyze/plan/execute/review loop (execute swapped Π → π)', () =>
  ralph({
    model: MODEL,
    maxTokens: 16384,
    execute: 'π',
    maxIterations: 2,
    quiet: true,
  })`
write a one-paragraph description of what the words library is for
`
)

// ── 7. orchestrate — orchestrator-workers ──────────────────────────────────
// The planner decomposes the task at run time (unlike fleet's fixed split),
// workers run the subtasks in parallel, and a synthesizer merges them.
await section('7. orchestrate — decompose, fan out, synthesize', () =>
  orchestrate({
    model: MODEL,
    maxTokens: 16384,
    maxWorkers: 3,
    concurrency: 3,
  })`
Turn the commit history below into release notes for ${pkg.name} ${pkg.version}.
Split the commits into up to 3 groups by area, have each worker reply with one
bullet of at most 12 words, then synthesize one release-notes section.

Commits:
${commits}
`
)

// ── α in a slot (optional) ─────────────────────────────────────────────────
// Any slot can be filled by the ACP letter: pass `server` next to the slot
// name and the word forwards it. Needs kiro-cli installed and logged in.
if (!(await usable(ACP_SERVER[0]))) {
  echo(chalk.dim(` (α slots skipped — ${ACP_SERVER[0]} is not usable here; see examples/acp-word-slots.mjs)\n`))
} else {
  await section(`8. fleet — worker → α (${ACP_SERVER.join(' ')})`, () =>
    fleet({ worker: 'α', server: ACP_SERVER, concurrency: 2, quiet: true })`
name the letters registered by src/plugins/pi.ts, with their aliases
name the letters registered by src/plugins/acp.ts, with their aliases
`
  )
}

// ── The same words, different letters ──────────────────────────────────────
// Swap any slot by name or tag — the pattern is unchanged, the letters change:
//
//   await fleet({ worker: 'Π' })`fix the bugs in src/`          // parallel agents
//   await ralph({ execute: 'α', server: ['kiro-cli', 'acp'] })`refactor auth`
//   await ralph({ review: 'fleet' })`…`                          // review via a fan-out
//   await chain({ steps: ['ralph', 'fleet'] })`…`                // a loop, then a fan-out
//   await route({ routes: { hard: 'ralph', easy: 'π' } })`…`
//   await orchestrate({ worker: 'refine' })`…`                   // refine every section
//
// Words inherit everything letters have: .quiet, .cache, tracing, globals.

echo(chalk.dim('  (words are letters — they compose recursively; see docs/words.md)\n'))
