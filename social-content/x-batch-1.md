# pizx — X (Twitter) Content Batch 2

**Target:** IT Developers, open-source community, AI/ML engineers
**Format:** Mix of single tweets, threads, and reply-bait
**Frequency:** 3-5 posts/day
**Note:** Put links in first reply, not main tweet body (better reach)

---

## Thread 1: The Origin Thread (4 tweets)

**Goal:** Awareness → GitHub star

**Tweet 1 (Hook):**
```
I was wrong about shell scripting.

I thought AI and shell commands had to live in separate worlds. curl + jq. Python scripts. Context switching everywhere.

Then I forked zx and added 15 AI template tags.

Now $`ls` and π`analyze this` live in the same file. No SDK. No separate runtime.
```

**Tweet 2:**
```
Each Greek letter = one pattern:

π  → ask an LLM
Π  → coding agent with tools
Ρ  → analyze → plan → execute → review (loop)
Φ  → run agents in parallel
Σ  → decompose → sub-agents → synthesize
Δ  → multi-perspective debate
Λ  → pipeline: stage₁ → stage₂ → stage₃
Ω  → orchestrator: plan → dispatch → synthesize

Weird? Yes. Fast to type? Absolutely.
```

**Tweet 3:**
```
Real example. 3 lines:

#!/usr/bin/env pizx

const bugs = await Φ`review every file for bugs`
await Π`fix everything: bugs, types, tests, docs: ${bugs.text}`

That's parallel code review → auto-fix. One shebang.

No LangChain. No CrewAI. Just template tags.
```

**Tweet 4 (CTA):**
```
pizx = zx + 15 native AI patterns

npm install @topce/pizx
github.com/topce/pizx

MIT. Built on pi-ai + pi-coding-agent.
```

---

## Thread 2: The Ralph Loop Thread (3 tweets)

**Goal:** Show the most powerful pattern

**Tweet 1 (Hook):**
```
The most underrated AI pattern is the self-correcting loop.

Generate → Review → Improve → Repeat.

Most frameworks make you wire this up manually. pizx gives it to you as a single tag.

await Ρ`migrate Express to Hono`

Ralph Loop: one line. Five phases. Fully automatic.
```

**Tweet 2:**
```
Under the hood:

1. Analyze — read your codebase
2. Plan — map every change needed
3. Execute — apply changes file by file  
4. Review — audit its own output
5. Loop — fix mistakes, repeat until done

It catches its own bugs. Fixes them. Moves on.

One template literal. Zero orchestration code.
```

**Tweet 3:**
```
Every pattern in pizx follows the same API:

await Φ`...`  — parallel agents
await Δ`...`  — multi-perspective debate
await Λ`...`  — pipeline stages
await Ω`...`  — orchestrator

Learn one tag. Know them all. 15 patterns. One import.
```

---

## Thread 3: The Contrarian Thread (3 tweets)

**Goal:** Engagement, debate, positioning

**Tweet 1 (Hook):**
```
Hot take for the AI dev crowd:

You don't need LangChain to run 3 agents.

You don't need CrewAI to review code in parallel.

You need:
1. Shell commands ($)
2. LLM calls (π)
3. A few patterns (Φ Σ Δ Ω)

That's it. Everything else is overhead for the 80% case.
```

**Tweet 2:**
```
pizx strips it down to the essentials:

import { $, π, Φ, Σ, Δ, Ω } from '@topce/pizx'

15 patterns. One import. Runs as a shebang. Zero config beyond auth.

Same design philosophy as zx itself: make the common case fast, get out of the way for the rest.
```

**Tweet 3:**
```
To be clear: heavy frameworks have their place.

Production systems with guardrails, observability, streaming — use them.

But if your "agent" is "read file → ask LLM → fix file", you don't need 50 lines of chain definitions.

You need a template literal.

pizx: github.com/topce/pizx
```

---

## Single Tweet 4: Multi-Model Routing

```
One script. Two models. Automatic routing.

await Ω({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash'
})`design a notification system`

Plan with Claude (deep reasoning).
Execute with DeepSeek (fast, cheap).

pizx routes per phase. No manual orchestration required.
```

---

## Single Tweet 5: Pipeline = Unix Pipes for AI

```
Unix pipes | but with AI agents:

await Λ`
  stage1: extract all API endpoints from the codebase
  stage2: write tests for every endpoint (happy path + edge cases)
  stage3: review test coverage and identify gaps
`

Each stage receives full context from the previous.

3 agents. 1 pipeline. 0 boilerplate.

pizx: github.com/topce/pizx
```

---

## Single Tweet 6: Launch Announcement

```
pizx v0.1.0 is out 🚀

What ships:
• π / Π — AI text generation + coding agent (read, bash, edit, write)
• 8 agent patterns: Ρ Φ Σ Δ Λ Ψ Ω Ν
• 3 communication patterns: Θ Μ Β
• 4 orchestration topologies: Α Γ Χ Τ
• Per-phase model selection
• Option chaining + quiet mode
• 95 unit tests

npm install @topce/pizx
```

---

## Single Tweet 7: Fleet Pattern

```
Run parallel AI review on your entire codebase:

await Φ({ concurrency: 5 })`
  security audit on the auth module
  error handling review on the API layer
  SQL injection check on database queries
`

3 tasks. 5 concurrent agents. One template literal.

pizx: github.com/topce/pizx
```

---

## Single Tweet 8: Shebangs

```
The most underrated developer interface?

The shebang.

#!/usr/bin/env pizx

A file starting with this can use shell commands, AI agents, and multi-agent patterns. No build step. No imports needed.

Write. Execute. Ship.

pizx: npm install @topce/pizx
```

---

## Engagement Tweets

### E1: Poll
```
How do you integrate AI into your shell workflows?

🟢 DIY: zx + curl + jq
🔵 Full framework: LangChain / CrewAI
🟡 Python scripts
🟣 pizx: all-in-one template tags

Built pizx because option A drove me crazy.
```

### E2: Feedback Ask
```
Building pizx in public — 15 AI patterns in one npm package.

What agent workflow do you find yourself wiring up manually?

I'm looking for the 16th pattern.
```

### E3: Reply Template
```
[Reply to someone discussing AI frameworks]

Try pizx. Same agent patterns, one import, runs as a shebang.

Not saying frameworks are bad. Just saying sometimes a template literal is all you need.
```

---

## 1-Week Posting Schedule (X)

| Day | Posts |
|-----|-------|
| Mon | Thread 1 (Origin) + Tweet 6 (Launch) + E1 (Poll) |
| Tue | Thread 2 (Ralph Loop) + Tweet 4 (Multi-Model) |
| Wed | Thread 3 (Contrarian) + Tweet 5 (Pipeline) + E3 (Reply) |
| Thu | Tweet 7 (Fleet) + Tweet 8 (Shebang) + E2 (Feedback) |
| Fri | Engagement — quote-tweet relevant dev threads |
| Sat | E1 poll results + follow-up discussion |
| Sun | Light engagement / rest |

**Notes:**
- Quote-tweet AI agent / dev tool discussions with insight
- Reply to 5-10 dev tweets daily (quality > quantity)
- Space threads 2-3 hours apart
- First 30 min engagement is critical — be ready to reply
