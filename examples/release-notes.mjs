#!/usr/bin/env pizx
// ─── release-notes.mjs — turn git history into release notes ───────────────
//
// The most common real use of π: read something from the repo, hand it to a
// model, write the result back out. Here the input is the commit range since
// the last tag and the output is a notes file.
//
//   $ git log                              → the raw material
//   π …                                    → classify and rewrite it
//   fs.writeFile('RELEASE-NOTES.md', …)    → the deliverable
//
// level 1/5 ●○○○○ · previous: examples/quick-ask.mjs (one π call on real data) · next: examples/basic-capital-pi.mjs
//
// Run:   pizx examples/release-notes.mjs
//        SINCE=v1.4.0 OUT=/tmp/notes.md pizx examples/release-notes.mjs

import { chalk, fs, path } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── 1. Gather the real input with the shell ────────────────────────────────
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))
// Default to "since the previous tag", which is what a release actually needs.
const prevTag = (await $({ nothrow: true })`git describe --tags --abbrev=0 HEAD^`).stdout.trim()
const since = process.env.SINCE ?? (prevTag || 'HEAD~20')
// --oneline gives "hash subject" per line. (For git format strings with
// spaces, pass them pre-quoted with zx's `quote`: $`git log ${quote('--pretty=%h %s')}`.)
const commits = (await $`git log ${since}..HEAD --no-merges --oneline`).stdout.trim()

echo(chalk.bold(`\n release notes — ${pkg.name}@${pkg.version}\n`))
echo(chalk.dim(`  range:  ${since}..HEAD (${commits ? commits.split('\n').length : 0} commits)`))

if (!commits) {
  echo(chalk.yellow(`  nothing to document between ${since} and HEAD\n`))
  process.exit(0)
}

// ── 2. Ask π to shape it ───────────────────────────────────────────────────
// Note the generous maxTokens: on a reasoning model, thinking is billed
// against the same budget, and a tight cap can be spent entirely on thinking
// (the reply then comes back empty).
const notes = await π.quiet({
  model: MODEL,
  maxTokens: 16384,
  system:
    'You write release notes for a developer tool. Group changes under ' +
    'Added / Fixed / Changed / Docs. Use one bullet per change, plain ' +
    'markdown, no preamble, no title heading, no invented details.',
})`
Write the release notes for ${pkg.name} ${pkg.version}.

Commits since ${since}:
${commits}
`

if (!notes.text.trim()) {
  echo(chalk.red(`  π returned no text (${notes.outputTokens} output tokens) — raise maxTokens`))
  process.exit(1)
}

// ── 3. Assemble the deliverable ────────────────────────────────────────────
const header = `# ${pkg.name} ${pkg.version}\n\n_Changes since ${since}._\n`
const body = `${header}\n${notes.text.trim()}\n`

const out = process.env.OUT ?? `/tmp/${pkg.name.replace(/^@[^/]+\//, '')}-${pkg.version}-notes.md`
await fs.writeFile(out, body)

echo(`\n${body}`)
echo(chalk.dim(`  written:  ${path.relative(process.cwd(), out)}`))
echo(chalk.dim(`  cost:     ${notes.modelId} · ${notes.totalTokens} tokens · ${notes.duration}ms`))

// ── Notes ──────────────────────────────────────────────────────────────────
// * `.quiet` keeps the model's text out of the stream, so stdout carries only
//   what this script prints — the file path and the notes themselves.
// * The same prompt, no script:  git log v1.4.1..HEAD | pizx -p - > NOTES.md
// * For a diff-shaped input, pipe `git diff` instead of `git log`.
// * `SINCE=v1.0.0` regenerates notes across many releases in one call.
