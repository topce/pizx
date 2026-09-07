/**
 * kiro harness spec — registers the Amazon Kiro coding agent on ctx.harnesses
 * so ε can run it headless: `kiro-cli run <prompt>`.
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
      runArgs: ['run'],
      prompt: 'arg',
      description: 'Amazon Kiro coding agent — headless: kiro-cli run <prompt>',
    })
  },
}
