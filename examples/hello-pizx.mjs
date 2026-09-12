#!/usr/bin/env pizx
// ─── hello-pizx.mjs — shell + AI, composed ─────────────────────────────────
//
// The whole point of pizx: `$` gives you the shell, the letters give you
// models, and both live in ordinary JavaScript. This script does a real job —
// draft a commit subject from what you have staged, then have a coding agent
// check it against the actual diff.
//
//   const diff = (await $`git diff --staged`).stdout   // 1. gather facts
//   const msg  = await π`write a commit subject…`      // 2. ask a model
//   const ok   = await Π`verify this against the…`     // 3. let an agent check
//
// level 2/5 ●●○○○ · previous: examples/release-notes.mjs (git history → π → a file) · next: examples/typed-globals.mjs
//
// Run:   pizx examples/hello-pizx.mjs
//        git add -A && pizx examples/hello-pizx.mjs    # with something staged

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

echo(chalk.bold('\n hello pizx — shell + AI, composed\n'))

// ── 1. $ — the shell, unchanged from zx ────────────────────────────────────
// Real data from the real repo, not a hardcoded string.
const branch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
const staged = (await $`git diff --staged`).stdout.trim()
const recent = (await $`git log --oneline -5`).stdout.trim()
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))

// The diff is what matters; fall back to recent history so the demo runs from
// a clean tree too.
const diff = staged || recent
const source = staged ? 'staged changes' : 'the last five commits'

echo(`  $ git branch      → ${chalk.green(branch)}`)
echo(`  $ staged diff     → ${staged ? chalk.green(`${staged.split('\n').length} lines`) : chalk.dim('clean tree')}`)
echo(`  $ package.json    → ${chalk.green(`${pkg.name}@${pkg.version}`)}`)

// ── 2. π — a model call fed by the shell ───────────────────────────────────
// Two dials matter here. `thinkingLevel: 'low'` keeps a mechanical task from
// over-thinking, and `maxTokens` is generous because thinking is billed
// against that same budget — a tight cap can be spent before any text is
// produced, and the reply comes back empty rather than as an error.
const draft = await π.quiet({ model: MODEL, thinkingLevel: 'low', maxTokens: 16384 })`
Write one conventional-commit subject line (max 72 chars) for the changes below.
Reply with the subject line only — no body, no markdown, no quotes.

Repository: ${pkg.name}
Branch: ${branch}
Source: ${source}
---
${diff.slice(0, 6000)}
`
// A LetterOutput is not a string: read .text. (It stringifies too, but .text
// is explicit and keeps JSON.stringify honest.)
const subject = draft.text.trim()
if (subject) {
  echo(`\n  π commit subject  → ${chalk.cyan(subject)}`)
} else {
  // An empty reply is a real outcome on reasoning models — say so instead of
  // quietly substituting something the model never said.
  echo(`\n  π commit subject  → ${chalk.yellow('(empty reply — thinking used the whole budget)')}`)
}
echo(chalk.dim(`    ${draft.modelId} · ${draft.duration}ms · ${draft.outputTokens} output tokens`))

// ── 3. Π — an agent that can read the repo itself ──────────────────────────
// Read-only tools: this demo inspects, it never edits your tree. When the
// draft came back empty, the agent writes the subject itself — the fallback
// is a different model, not a silent hardcoded string.
const proposed = subject || `(no draft — write one from the change itself)`
const review = await Π({ model: MODEL, quiet: true, tools: ['read', 'bash', 'ls'] })`
Proposed commit subject: "${proposed}"

Check it against the real change: run \`git diff --staged\` (if empty, use
\`git show --stat HEAD\`). Reply in exactly two lines:
  accurate: yes|no — one short reason
  better:   <improved subject line, or "keep">
`
echo(chalk.dim('  Π verification (read-only tools):'))
echo(review.text.split('\n').map((l) => `    │ ${l}`).join('\n'))
echo(chalk.dim(`    ${review.turnCount} turns · ${review.duration}ms`))

// ── 4. π.quiet — the value you pipe into the next step ─────────────────────
// Quiet mode is for machines: no streaming, just the result. Here it returns
// JSON the script parses and branches on — the model decides, the shell acts.
const raw = await π.quiet({
  model: MODEL,
  thinkingLevel: 'low',
  maxTokens: 8192,
  system: 'You reply with JSON only. No prose, no code fences.',
})`
Is the subject below a release-worthy change or an ordinary commit?

Subject: ${subject || review.text.split('\n').find((l) => l.includes('better:')) || '(unknown)'}
Recent commits: ${recent.replace(/\n/g, ' | ')}

Reply exactly: {"release": true|false, "reason": "<8 words max>"}
`
let gate
try {
  gate = JSON.parse(raw.text.replace(/^```(?:json)?|```$/g, '').trim())
} catch {
  gate = { release: false, reason: 'model did not return usable JSON' }
}
echo(`\n  π.quiet gate      → ${gate.release ? chalk.yellow('release-worthy') : chalk.dim('ordinary commit')}`)
echo(chalk.dim(`    reason: ${gate.reason}`))

// ── The payoff: the script branches on what the model said ─────────────────
// This is a usable hook, not a demo trick. The one-liner equivalent:
//   git diff --staged | pizx -p "write a conventional-commit subject for this diff"
if (gate.release) {
  echo(chalk.dim('\n  → would trigger the release flow: examples/release-notes.mjs\n'))
} else {
  echo(chalk.dim('\n  → no release flow; commit as usual\n'))
}

echo(chalk.dim('  next: examples/typed-globals.mjs — same letters, but the model\'s answer drives the exit code\n'))
