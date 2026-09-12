#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />
// ─── typed-globals.mjs — letters as typed values, not text ─────────────────
//
// The reference directive above pulls in the ambient declarations from
// @topce/pizx/globals, so your editor knows the shape of every letter and of
// the LetterOutput they resolve to. That matters most when a model's answer
// drives program logic: you want a parsed object, not prose you have to
// scrape.
//
// This script performs a real pre-release check and then *branches on it* —
// the pattern behind every serious use of π in a pipeline.
//
// level 2/5 ●●○○○ · previous: examples/hello-pizx.mjs ($ + π + Π in one script) · next: examples/basic-capital-pi.mjs
//
// Run:   pizx examples/typed-globals.mjs
//        pizx --trace examples/typed-globals.mjs

const MODEL = 'deepseek/deepseek-v4-flash'

// ── 1. Gather the release facts with the shell ─────────────────────────────
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))
const branch = (await $`git rev-parse --abbrev-ref HEAD`).stdout.trim()
const tag = (await $({ nothrow: true })`git describe --tags --abbrev=0`).stdout.trim()
const ahead = (await $`git rev-list ${tag || 'HEAD'}..HEAD --count`).stdout.trim()
const tests = await $({ nothrow: true })`npm test --silent -- --reporter=dot`

echo(`release check: ${pkg.name}@${pkg.version} on ${branch}`)
echo(`  last tag: ${tag || '(none)'}   commits ahead: ${ahead}   tests: ${tests.exitCode === 0 ? 'green' : 'red'}`)

// ── 2. One π call whose answer is data ─────────────────────────────────────
// Ask for JSON and parse it. LetterOutput.text is a plain string — nothing
// here is special to pizx, which is exactly the point: a letter composes with
// JSON.parse, if, and everything else in JavaScript.
const verdict = await π.quiet({
  model: MODEL,
  maxTokens: 16384,
  system: 'You are a release manager. Reply with JSON only — no prose, no code fences.',
})`
Decide whether this repository state is ready to publish.

package:        ${pkg.name}@${pkg.version}
last tag:       ${tag || '(none)'}
commits ahead:  ${ahead}
branch:         ${branch}
test suite:     ${tests.exitCode === 0 ? 'passing' : 'FAILING'}

Score the release 0-100 and list blocking problems.

Reply exactly in this shape:
{"ready": true|false, "score": <0-100>, "blockers": ["…"], "headline": "<12 words max>"}
`

const check = JSON.parse(verdict.text.replace(/^```(?:json)?|```$/g, '').trim())

// ── 3. Spread the shell and the model into one typed object ────────────────
// `check` comes from the model, the rest from git and npm. To the code below
// there is no difference — and to your editor, every field is typed.
const report = {
  package: pkg.name,
  version: pkg.version,
  branch,
  commitsSinceTag: Number(ahead),
  testsGreen: tests.exitCode === 0,
  ready: Boolean(check.ready),
  score: Number(check.score),
  blockers: check.blockers ?? [],
  headline: String(check.headline ?? ''),
}

echo(`\n${report.headline}`)
echo(`  ready:   ${report.ready ? 'yes' : 'no'}   score: ${report.score}/100`)
for (const blocker of report.blockers) echo(`  blocker: ${blocker}`)

// ── 4. LetterOutput metadata is typed too ──────────────────────────────────
// The fields are documented in AGENTS.md and visible in your editor:
// text, modelId, isFromCache, duration, tokens, totalCost, turnCount.
echo(
  `\n  π: ${verdict.modelId} · ${verdict.inputTokens} in / ${verdict.outputTokens} out` +
    ` · ${verdict.duration}ms · $${verdict.totalCost.toFixed(6)}`
)
echo(`  cacheable: ${verdict.isFromCache ? 'served from cache' : 'fresh model call'}`)

// Branch on the typed value instead of printing it.
if (!report.ready) {
  echo('\n  → blocked; fix the above before tagging')
  process.exitCode = 1
} else {
  echo('\n  → cleared for release: git tag v' + report.version)
}
