/**
 * pizx.config.mjs — plugin composition for the examples directory.
 *
 * The CLI (and pizx/globals) picks this file up automatically when running
 * scripts from this directory. Every plugin here defines one or more
 * letters (or words — AI patterns composed from letters), which then become
 * globals in scripts.
 */

import summarize from './plugins/summarize.mjs'
import ralph from './plugins/ralph.mjs'
import fleet from './plugins/fleet.mjs'
import chain from './plugins/chain.mjs'
import route from './plugins/route.mjs'
import vote from './plugins/vote.mjs'
import refine from './plugins/refine.mjs'
import orchestrate from './plugins/orchestrate.mjs'

export const plugins = [summarize, ralph, fleet, chain, route, vote, refine, orchestrate]
