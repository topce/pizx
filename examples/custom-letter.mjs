#!/usr/bin/env pizx
// ─── custom-letter.mjs — define your own letter as a cordis plugin ─────────
//
// pizx is built on cordis: a letter is just a plugin that registers a
// template tag on ctx.letters. This example defines Σ (summarize) in a
// plugin file, loads it via pizx.config.mjs, and uses it in this script.
//
// Run:   node dist/cli.js --trace --export-log examples/custom-letter.mjs

import { chalk } from 'zx'

console.log(chalk.bold('\n custom letter — Σ (summarize), defined by examples/plugins/summarize.mjs\n'))

// Σ is injected as a global by the CLI (and pizx/globals) — no import needed.
const summary = await Σ({ maxWords: 20 })`
pizx is a zx fork with native Pi AI integration, built on the cordis plugin
framework. It ships with π (text generation) and Π (coding agent) built in,
and lets you define your own letters as plugins. Every run is traceable and
can be exported as JSONL logs; cacheable letters can hit a local cache.
`

console.log(`  ${chalk.cyan(summary)}`)
console.log(chalk.dim('\n  try: pizx --letters   to see Σ listed with π and Π'))
