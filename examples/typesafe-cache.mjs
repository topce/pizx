#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── typesafe-cache.mjs — caching typed decisions ────────────────────────────
// A TypeSafe answer is a pure function of (state, questions, model), which
// makes the result cache a near-perfect fit: an identical question over an
// identical state is answered from disk without an API call.
//
// Cache keys include the model, the state (template body or `state` option),
// and the question (`instructions` / `criteria`), so asking two different
// questions over the same state never collides.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/typesafe-cache.mjs

import { createPizx } from '@topce/pizx'
import { chalk } from 'zx'

// Enable the cache app-wide; cacheable letters use it automatically.
const app = await createPizx({ cache: true })

try {
  const ticket = 'Order A-104 was charged twice. Please refund the duplicate charge.'

  const ask = () =>
    app.noul({ instructions: 'Does the customer request a refund?', quiet: true })`${ticket}`

  // ── First call: hits the API ──────────────────────────────────────────────
  const first = await ask()
  echo(chalk.bold('\n first call\n'))
  echo(`  value       : ${first.text}`)
  echo(`  from cache  : ${first.isFromCache}`)
  echo(`  tokens      : ${first.totalTokens}  · cost $${first.totalCost.toFixed(6)}`)

  // ── Second, identical call: served from the local cache ──────────────────
  const second = await ask()
  echo(chalk.bold('\n second, identical call\n'))
  echo(`  value       : ${second.text}`)
  echo(`  from cache  : ${chalk.green(String(second.isFromCache))}`)
  echo(`  tokens      : ${second.totalTokens}  · cost $${second.totalCost.toFixed(6)}`)

  // ── The typed answer survives the cache ──────────────────────────────────
  echo(`\n  answer preserved across the hit: ${JSON.stringify(second.answer)}`)

  // ── Different question, same state: a different key, a fresh call ─────────
  const urgent = await app.noul({
    instructions: 'Is the message time-sensitive?',
    quiet: true,
  })`${ticket}`
  echo(`\n  different question, same state → cache miss: ${urgent.isFromCache} (p=${urgent.text})`)

  echo(chalk.dim(`\n  cache: ${app.ctx.cache.config.dir}`))
  echo(chalk.dim('  run `pizx --no-cache examples/typesafe-cache.mjs` to bypass it\n'))
} finally {
  await app.dispose()
}
