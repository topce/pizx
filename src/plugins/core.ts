/**
 * pizx core plugin — mounts the framework services on a cordis context.
 *
 * Services: trace (execution tracing), cache (result cache), llm (model/auth
 * access), letters (the template-tag registry). Mount order does not matter:
 * cordis inject dependencies gate readiness regardless of order.
 */

import type { Context, Plugin } from '@cordisjs/core'
import type { CacheConfig } from '../core/cache.ts'
import { Cache } from '../core/cache.ts'
import { Letters } from '../core/letters.ts'
import type { LlmConfig } from '../core/llm.ts'
import { Llm } from '../core/llm.ts'
import type { TraceConfig } from '../core/trace.ts'
import { Trace } from '../core/trace.ts'

export interface CoreConfig {
  trace?: TraceConfig
  cache?: CacheConfig
  llm?: LlmConfig
}

export const corePlugin: Plugin.Object<Context, CoreConfig> = {
  name: 'pizx-core',
  apply(ctx, config: CoreConfig = {}) {
    ctx.plugin(Trace, config.trace)
    ctx.plugin(Cache, config.cache)
    ctx.plugin(Llm, config.llm)
    ctx.plugin(Letters)
  },
}
