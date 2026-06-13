#!/usr/bin/env pizx
/**
 * ─── import-verify.mjs — Verify all English aliases import correctly ─
 *
 * Quick no-network test: imports all English aliases and checks they're
 * callable functions. No LLM calls — just verifies the module exports work.
 *
 * Run:
 *   pizx english-examples/import-verify.mjs
 */

import { chalk } from 'zx'
import {
  // Core
  pi,
  Pi,
  // Agent patterns
  ralph,
  fleet,
  subagent,
  debate,
  pipeline,
  critique,
  orchestrator,
  team,
  // Communication patterns
  thread,
  memory,
  broadcast,
  // Orchestration topologies
  adaptive,
  graph,
  learn,
  store,
} from '@topce/pizx'

console.log(chalk.bold.green('\n ✓ Verifying English word aliases...\n'))

const aliases = {
  pi,
  Pi,
  ralph,
  fleet,
  subagent,
  debate,
  pipeline,
  critique,
  orchestrator,
  team,
  thread,
  memory,
  broadcast,
  adaptive,
  graph,
  learn,
  store,
}

let passed = 0
let failed = 0

for (const [name, tag] of Object.entries(aliases)) {
  if (typeof tag === 'function') {
    console.log(`  ${chalk.green('✓')} ${name}`)
    passed++
  } else {
    console.log(`  ${chalk.red('✗')} ${name} — not a function (got ${typeof tag})`)
    failed++
  }
}

console.log(chalk.bold(`\n ${passed} passed, ${failed} failed\n`))

if (failed > 0) {
  process.exit(1)
}
