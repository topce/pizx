#!/usr/bin/env node
/**
 * Mock CLI harness for ε tests — stands in for claude/kiro-cli/… so the ε
 * letter can be tested without any real harness binary.
 *
 * Behavior driven by the flags it receives (which doubles as an assertion
 * surface for flag conversion, since every flag ends up in process.argv):
 *
 *   --echo-stdin        read stdin and print `stdin:<text>`
 *   --sleep <ms>        wait <ms> before finishing (timeout tests)
 *   --fail <code>       write to stderr and exit <code> (failure tests)
 *
 * Always prints a first line, then `argv:<json of process.argv.slice(2)>`.
 */

import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const args = process.argv.slice(2)

if (args.includes('--fail')) {
  const code = Number(args[args.indexOf('--fail') + 1] ?? 2)
  process.stderr.write('mock stderr: failing on purpose\n')
  process.exit(code)
}

process.stdout.write('mock first line\n')

if (args.includes('--echo-stdin')) {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  process.stdout.write(`stdin:${Buffer.concat(chunks).toString()}\n`)
}

if (args.includes('--sleep')) {
  const ms = Number(args[args.indexOf('--sleep') + 1] ?? 100)
  await sleep(ms)
}

process.stdout.write(`argv:${JSON.stringify(args)}\n`)
