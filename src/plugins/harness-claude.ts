/**
 * claude harness spec — registers Anthropic Claude Code on ctx.harnesses so ε
 * can run it headless: `claude -p <prompt>`.
 *
 * This is the entire plugin — every harness pizx can run is a declarative
 * spec like this one. See src/plugins/harness-kiro.ts and docs/epsilon.md.
 */

import type { Plugin } from '@cordisjs/core'

export const claudeHarnessPlugin: Plugin.Object = {
  name: 'pizx-harness-claude',
  inject: ['harnesses'],
  apply(ctx) {
    ctx.harnesses.define('claude', {
      command: 'claude',
      runArgs: ['-p'],
      prompt: 'arg',
      description: 'Anthropic Claude Code — headless: claude -p <prompt>',
    })
  },
}
