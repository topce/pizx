/**
 * kiro harness spec — registers the Amazon Kiro coding agent on ctx.harnesses
 * so ε can run it headless: `kiro-cli chat --no-interactive <prompt>`.
 *
 * Kiro CLI has no `run` subcommand: headless mode is `chat` with
 * `--no-interactive` (the prompt is a positional argument). Older docs showed
 * `kiro-cli run <prompt>`, which fails with "unrecognized subcommand 'run'"
 * on current releases — hence the two runArgs.
 *
 * This is the entire plugin — every harness pizx can run is a declarative
 * spec like this one. See src/plugins/harness-claude.ts and docs/epsilon.md.
 */

import type { Plugin } from '@cordisjs/core'

export const kiroHarnessPlugin: Plugin.Object = {
  name: 'pizx-harness-kiro',
  inject: ['harnesses'],
  apply(ctx) {
    ctx.harnesses.define('kiro', {
      command: 'kiro-cli',
      runArgs: ['chat', '--no-interactive'],
      prompt: 'arg',
      // Kiro's headless mode still paints a TUI prompt, so stdout carries SGR
      // codes and a leading `> ` before the answer. Strip both.
      stripAnsi: true,
      description: 'Amazon Kiro coding agent — headless: kiro-cli chat --no-interactive <prompt>',
    })
  },
}
