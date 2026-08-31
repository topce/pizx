#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />
// ─── typed-globals.mjs — type-checked letters in a plain script ─────────────
//
// The reference directive above pulls in the ambient global declarations from
// @topce/pizx/globals. No import is needed — the pizx CLI injects π/Π/α (and
// their aliases pi/ai, Pi/piAgent/codingAgent, acp/agent) as globals at
// runtime. In a TypeScript-aware editor you now get autocomplete and
// type-checking on the letters, their options, and the LetterOutput result.
//
// Run:   pizx examples/typed-globals.mjs

const MODEL = 'deepseek/deepseek-v4-flash'

// π is typed as LetterFn<PiOpts>: options and the awaited LetterOutput are typed.
const answer = await π({ model: MODEL, maxTokens: 256 })`what is the capital of France?`

// LetterOutput fields are typed: text, modelId, isFromCache, duration, tokens…
echo(`answer:    ${answer.text}`)
echo(`model:     ${answer.modelId}`)
echo(`fromCache: ${answer.isFromCache}`)
echo(`duration:  ${answer.duration}ms`)

// Aliases resolve to the same typed tags (pi === π, ai === π).
const shout = await pi.quiet({ model: MODEL })`reply with just: OK`
echo(`alias π:   ${shout.text}`)
