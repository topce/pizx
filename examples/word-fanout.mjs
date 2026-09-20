#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── fanout — TypeSafe Speculative Fan-Out ───────────────────────────────────
// Ask every question the code might need in a single System One call —
// including speculative ones — and let the code decide what is relevant.
// System One evaluates all questions against the state in parallel, so adding
// questions barely changes latency and costs only a few tokens.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/word-fanout.mjs

const ticket = `Order #98423 was charged twice. I also can't log in after the update,
and adding Apple Pay would help. This is getting frustrating.`

const out = await fanout({
  questions: {
    category: {
      type: 'choice',
      instructions: 'Which team should handle this?',
      criteria: {
        bug_report: 'Something is broken or erroring',
        billing: 'Charges, invoices, refunds, subscriptions',
        feature_request: 'A request for new functionality',
        account: 'Login, permissions, profile',
      },
    },
    // Speculative: only matters if it turns out to be a bug report.
    bug_severity: {
      type: 'score',
      instructions: 'How severe is the reported issue?',
      criteria: ['Cosmetic', 'Degraded feature', 'Blocking, no workaround'],
    },
    // Speculative: only matters for billing.
    refund_requested: {
      type: 'noul',
      instructions: 'Is a refund or credit explicitly requested?',
    },
    frustration: {
      type: 'score',
      instructions: 'How frustrated is the user?',
      criteria: ['Calm', 'Frustrated but civil', 'Very angry'],
    },
  },
})`${ticket}`

const a = out.answer
echo('category       :', a.category.choice, `(conf ${a.category.confidence})`)
echo('bug severity   :', a.bug_severity.score, '(only used if category is bug_report)')
echo('refund?        :', a.refund_requested.noul, '(only used if category is billing)')
echo('frustration    :', a.frustration.score)

// One call, full decision tree — filter in code.
if (a.category.choice === 'bug_report' && a.bug_severity.score > 1.5) {
  echo('→ escalate to engineering')
} else if (a.category.choice === 'billing' && a.refund_requested.noul > 0.7) {
  echo('→ route to billing, refund likely')
} else {
  echo('→ route to', a.category.choice)
}
