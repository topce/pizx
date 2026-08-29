/**
 * pizx.config.mjs — plugin composition for the examples directory.
 *
 * The CLI (and pizx/globals) picks this file up automatically when running
 * scripts from this directory. Every plugin here defines one or more
 * letters, which then become globals in scripts.
 */

import summarize from './plugins/summarize.mjs'
import ralph from './plugins/ralph.mjs'

export const plugins = [summarize, ralph]
