#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

/**
 * ε (epsilon) — drive any CLI AI harness from a pizx script.
 *
 * ε is the "bring your own agent" letter: name a harness, and every other
 * option is forwarded to its CLI as a flag (`model` → --model, camelCase →
 * --kebab-case, booleans bare, false → --no-*, arrays repeated). So a job you
 * already run by hand becomes a script without learning a new API:
 *
 *     claude -p "review this diff" --model sonnet
 *     await ε({ harness: 'claude', model: 'sonnet' })`review this diff`
 *
 * The job here is a second opinion on the last commit — a real review of a
 * real diff, written up by a harness and filed by the script.
 *
 * Run:    pizx examples/epsilon-basic.mjs
 *         HARNESS=kiro pizx examples/epsilon-basic.mjs
 */
//
// level 3/5 ●●●○○ · previous: examples/custom-letter.mjs (define your own letter (Ξ)) · next: examples/acp-basic.mjs

import { chalk, fs, path } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── 1. Real input: the change under review ─────────────────────────────────
const staged = (await $`git diff --staged`).stdout.trim()
const diff = staged || (await $`git show HEAD`).stdout.trim()
const stat = (await $({ nothrow: true })`git show --stat --format= HEAD`).stdout.trim()
const subject = (await $`git log -1 --format=%s`).stdout.trim()

echo(chalk.bold('\n ε — second opinion on the current change\n'))
echo(`  ${chalk.cyan(subject)}`)
echo(chalk.dim(`  ${stat.split('\n').length} files touched · reviewing "${staged ? 'staged changes' : 'HEAD'}"`))

// ── 2. Discover which harnesses are installed ──────────────────────────────
// Harness backends are spec plugins; 'claude' and 'kiro' ship with pizx.
// `h.harness` is how ε tells you which one answered.
const CANDIDATES = [
  { harness: 'claude', label: 'Claude Code', requires: 'claude' },
  { harness: 'kiro', label: 'Kiro CLI', requires: 'kiro-cli' },
  { harness: process.env.HARNESS, label: process.env.HARNESS, requires: process.env.HARNESS },
].filter((c) => c.harness)

const available = []
for (const candidate of CANDIDATES) {
  const found = (await $({ nothrow: true })`which ${candidate.requires}`).exitCode === 0
  echo(`  ${found ? chalk.green('✓') : chalk.dim('·')} ${candidate.label} (${candidate.harness})`)
  if (found && !available.some((a) => a.harness === candidate.harness)) available.push(candidate)
}

if (available.length === 0) {
  echo(chalk.yellow('\n  no harness found — install one of: claude, kiro-cli'))
  echo(chalk.dim('  (or set HARNESS=<binary> and add a spec; see docs/epsilon.md)\n'))
  process.exit(0)
}

// ── 3. One review per harness, concurrently ────────────────────────────────
const REVIEW_PROMPT = `You are reviewing a commit before merge.

Subject: ${subject}

Diff (truncated to 8000 chars):
${diff.slice(0, 8000)}

Reply with:
  1. the most likely bug or regression in this change (or "none found")
  2. one thing a reviewer should verify manually
Maximum 120 words. No preamble.`

const reviews = await Promise.all(
  available.map(async ({ harness, label }) => {
    const started = Date.now()
    try {
      // Pass `model` explicitly when you care: without it the harness falls
      // back to its own config — or to whatever ANTHROPIC_MODEL/MODEL the
      // calling shell exported, which is a common source of surprises.
      const result = await ε.quiet({ harness })`${REVIEW_PROMPT}`
      return { harness, label, ok: true, text: result.text.trim(), ms: Date.now() - started }
    } catch (err) {
      // Exit code 8 / HARNESS is reported as a PizxError — one dead harness
      // must not sink the whole report. Keep the first line; it names the
      // exit code or the missing binary.
      const detail = err.message.split('\n').filter(Boolean).slice(0, 2).join(' ')
      return { harness, label, ok: false, error: detail, ms: Date.now() - started }
    }
  })
)

for (const review of reviews) {
  echo(chalk.bold(`\n  ── ${review.label} ──`))
  echo(
    review.ok
      ? review.text.split('\n').map((l) => `  ${l}`).join('\n')
      : chalk.red(`  failed: ${review.error}`)
  )
  echo(chalk.dim(`  (${review.ms}ms)`))
}

// ── 4. Reconcile the reviews with π ────────────────────────────────────────
// Two agents disagreeing is information. π weighs them into one call.
const usable = reviews.filter((r) => r.ok)
if (usable.length === 0) {
  echo(chalk.yellow('\n  every harness failed — nothing to reconcile.'))
  echo(chalk.dim('  check: the harness CLI runs by hand, and that no stale ANTHROPIC_MODEL'))
  echo(chalk.dim('  or similar env var is being exported into it (pass `model` to pin one).\n'))
  process.exit(0)
}

if (usable.length > 1) {
  const merged = await π.quiet({ model: MODEL, maxTokens: 16384 })`
Two AI reviewers examined the same commit. Merge their findings.

${usable.map((r) => `## ${r.label}\n${r.text}`).join('\n\n')}

Reply with at most four lines: the consensus finding first, then anything only
one reviewer caught, marked with its source. No preamble.
`
  echo(chalk.bold('\n  ── reconciled (π) ──'))
  echo(merged.text.trim().split('\n').map((l) => `  ${l}`).join('\n'))
}

// ── 5. File the report ─────────────────────────────────────────────────────
const out = `/tmp/pizx-review-${Date.now()}.md`
await fs.writeFile(
  out,
  [
    `# Review: ${subject}`,
    '',
    `Harnesses: ${available.map((a) => a.harness).join(', ')}`,
    '',
    ...reviews.map((r) => `## ${r.label}\n\n${r.ok ? r.text : `_failed: ${r.error}_`}\n`),
  ].join('\n')
)
echo(chalk.dim(`\n  written: ${path.relative(process.cwd(), out)}`))

// ── Notes ──────────────────────────────────────────────────────────────────
// * Any other option is passed straight to the harness CLI:
//     ε({ harness: 'claude', maxTurns: 2, allowedTools: ['Read'] })`…`
//     ε({ harness: 'claude', args: ['--dangerously-skip-permissions'] })`…`
// * A non-zero harness exit is a HARNESS error (CLI exit code 8) — catch it
//   per call, the way the map above does, instead of losing the whole run.
// * ε never sends anything through pi: the harness brings its own auth, so
//   this script works with no pi credentials at all.
// * The diff is untrusted input to an external process. Treat review prompts
//   like any other injection risk, and keep harness permissions tight.
// * The CLI equivalent, no script: pizx --run --run-harness claude "review this diff"
