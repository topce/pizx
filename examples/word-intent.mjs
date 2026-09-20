#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── intent — TypeSafe Intent Routing ────────────────────────────────────────
// Classify an incoming request with one TypeSafe Choice question, then dispatch
// each intent to the optimal handler: deterministic logic, a specialist LLM, or
// a human. A single confidence floor decides when to fall back to a safe path.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/word-intent.mjs

const query = 'I need to get my money back for the duplicate charge on order A-104.'

const out = await intent({
  instructions: 'What does the user want?',
  criteria: {
    refund: 'Get money returned',
    technical: 'Fix something broken',
    information: 'Ask a question',
  },
  // Each intent gets the handler that fits it best.
  intents: {
    refund: pi({ model: 'deepseek/deepseek-v4-flash', system: 'You handle billing requests. Confirm the refund and next steps.' }),
    technical: 'π',
    information: 'π',
  },
  fallback: 'π',
  escalate: 'π',
  floor: 0.6,
})`${query}`

echo('intent     :', out.answer.choice, `(confidence ${out.answer.confidence})`)
echo('handled by :', out.answer.handledBy)
echo('---')
echo(out.text)
