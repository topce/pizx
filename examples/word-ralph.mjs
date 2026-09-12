#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── ralph — the iterative agent loop ────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): the autonomous
// agent — an LLM loop over analyze → plan → execute → review, stopping when
// the review says DONE or the iteration budget runs out.
//
// Slots:  analyze → π · plan → π · execute → Π · review → π
// Run:    pizx examples/word-ralph.mjs
//
// The default `execute` slot is Π, a coding agent with real tools. This
// example points it at a *scratch directory* so the demo can edit files,
// run tests, and iterate without touching your working tree — and the goal
// has an objective pass/fail, which is what makes the review step meaningful.
//
// level 5/5 ●●●●● · previous: examples/word-refine.mjs (word 5/7 — evaluator-optimizer) · next: examples/word-orchestrate.mjs

import { chalk, fs, os, path } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── A self-contained, failing project in a temp directory ──────────────────
const work = path.join(os.tmpdir(), `pizx-ralph-${Date.now()}`)
await fs.promises.mkdir(path.join(work, 'src'), { recursive: true })
await fs.promises.mkdir(path.join(work, 'test'), { recursive: true })

await fs.writeFile(
  path.join(work, 'package.json'),
  JSON.stringify({ name: 'scratch', type: 'module' }, null, 2)
)
// The module under test: a slugify with two real bugs.
await fs.writeFile(
  path.join(work, 'src', 'slugify.mjs'),
  `export function slugify(input) {
  return input.toLowerCase().replace(' ', '-')
}
`
)
// The spec the code must satisfy.
await fs.writeFile(
  path.join(work, 'test', 'slugify.test.mjs'),
  `import assert from 'node:assert/strict'
import { slugify } from '../src/slugify.mjs'

assert.equal(slugify('Hello World'), 'hello-world')
assert.equal(slugify('  Trim  Me  '), 'trim-me')
assert.equal(slugify('Ünïcodé Ís Fün'), 'unicode-is-fun')
assert.equal(slugify('a--b'), 'a-b')
console.log('all slugify tests passed')
`
)

// Show the starting state honestly: the suite fails before ralph runs.
const before = await $({ nothrow: true, cwd: work })`node test/slugify.test.mjs`
echo(chalk.bold('\nralph — a failing module in a scratch directory\n'))
echo(chalk.dim(`  cwd: ${work}`))
echo(`  before: ${before.exitCode === 0 ? chalk.green('passing') : chalk.red(`failing (exit ${before.exitCode})`)}`)
echo(chalk.dim(`  ${`${before.stderr}`.split('\n').filter((l) => l.includes('AssertionError') || l.includes('actual')).slice(0, 2).join('\n  ')}`))

// ── The loop ───────────────────────────────────────────────────────────────
// `execute: 'Π'` is the default — spelled out here because the slot is what
// makes this an *agent* loop rather than a chain of prompts. `cwd` is
// forwarded to the agent, so all its edits stay in the scratch directory.
//
// The `review` slot is the part worth copying: the default reviewer is π,
// which only sees text and will happily take the executor's word for it. A
// reviewer with read-only tools can re-run the test itself, which is what
// makes the loop's exit condition trustworthy.
const result = await ralph({
  model: MODEL,
  cwd: work,
  execute: 'Π',
  review: Π({
    model: MODEL,
    cwd: work,
    quiet: true,
    tools: ['read', 'bash', 'ls'],
    system:
      'You verify work. Run `node test/slugify.test.mjs` yourself before judging. ' +
      'Reply DONE only if that command exits 0; otherwise reply ITERATE and say ' +
      'exactly what still fails. End with one line: DONE or ITERATE.',
  }),
  maxIterations: 3,
  timeoutMs: 300000,
})`
make \`node test/slugify.test.mjs\` exit 0 from the ${work} directory
`

echo(chalk.green(result.text.trim()))
echo(chalk.dim(`\nduration: ${result.duration}ms`))

// ── Verification: the script checks the claim, not the agent ───────────────
// Never let the model's summary be the source of truth when a command can be.
const after = await $({ nothrow: true, cwd: work })`node test/slugify.test.mjs`
const passed = after.exitCode === 0
echo(`\n  after:  ${passed ? chalk.green('passing') : chalk.red(`failing (exit ${after.exitCode})`)}`)
echo(chalk.dim(`  ${`${after.stdout}`.trim() || `${after.stderr}`.trim().split('\n')[0]}`))

if (passed) {
  echo(chalk.dim('\n  the fixed module:'))
  echo((await fs.readFile(path.join(work, 'src', 'slugify.mjs'), 'utf-8')).split('\n').map((l) => `    │ ${l}`).join('\n'))
} else {
  echo(chalk.yellow('\n  the loop ended without a green suite — inspect the plan in the result above'))
}

await fs.promises.rm(work, { recursive: true, force: true })
echo(chalk.dim(`\n  (scratch directory removed: ${work})\n`))

// ── Swap the slots ─────────────────────────────────────────────────────────
//   await ralph({ execute: 'α', server: ['kiro-cli', 'acp'] })`refactor auth`
//   await ralph({ execute: π({ model: 'cheap' }) })`draft the release post`   // no file writes
//   await ralph({ review: 'vote' })`…`        // the reviewer votes instead of judging alone
//   await ralph({ maxIterations: 1 })`…`      // one shot: analyze, plan, execute, done
//
// `ralph` is never cached (the executor mutates files) and its per-iteration
// progress prints to stderr unless you pass `quiet: true`.
