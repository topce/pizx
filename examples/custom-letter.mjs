#!/usr/bin/env pizx
// ─── custom-letter.mjs — define your own letter as a cordis plugin ─────────
//
// pizx is built on cordis: a letter is just a plugin that registers a template
// tag on ctx.letters. This example uses Ξ (commit), defined in
// examples/plugins/commit.mjs and loaded through pizx.config.mjs.
//
// Ξ is a *useful* letter, not a demo one — it is the prompt you would
// otherwise copy-paste into every commit-message script:
//
//   await Ξ({ maxChars: 60 })`${diff}`
//
// Because it is a letter, it also gets option chaining, `.quiet`/`.cache`,
// tracing, and a line in `pizx --letters` for free.
//
// level 3/5 ●●●○○ · previous: examples/trace-and-cache.mjs (result cache + JSONL trace) · next: examples/epsilon-basic.mjs
//
// Run:   pizx examples/custom-letter.mjs
//        pizx --letters examples/custom-letter.mjs     # Ξ listed with π/Π/α/ε
//        pizx --trace --export-log examples/custom-letter.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── Real input: what is staged, or the last commit as a fallback ───────────
const staged = (await $`git diff --staged`).stdout.trim()
const diff = staged || (await $`git show HEAD`).stdout.trim()
const source = staged ? 'staged changes' : 'the last commit'

echo(chalk.bold(`\n custom letter Ξ — ${source} (${diff.split('\n').length} diff lines)\n`))

// Ξ is injected as a global by the CLI (and pizx/globals) — no import needed.
const subject = await Ξ.quiet({ model: MODEL, maxChars: 72 })`
${diff.slice(0, 8000)}
`

echo(`  ${chalk.cyan(subject.text.trim())}`)

// ── Options are the letter's API — reuse it with different constraints ─────
// Same letter, no prompt duplication: a short subject for a UI, a plain
// imperative line for a squash commit.
const short = await Ξ.quiet({ model: MODEL, maxChars: 40, conventional: false })`
${diff.slice(0, 8000)}
`

echo(`\n  ${chalk.cyan(short.text.trim())}   ${chalk.dim('(≤40 chars, plain imperative)')}`)

echo(chalk.dim(`\n  Ξ: ${subject.modelId} · ${subject.totalTokens} tokens · ${subject.duration}ms`))
echo(chalk.dim('  try: pizx --letters   → Ξ appears alongside π, Π, α, ε and the words'))
echo(chalk.dim('  see: examples/plugins/commit.mjs for the 40-line plugin that defines it'))
echo(chalk.dim('  hook: .git/hooks/prepare-commit-msg can call this to prefill the subject\n'))
