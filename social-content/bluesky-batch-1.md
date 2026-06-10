# pizx — Bluesky Content Batch 1

**Audience:** IT Developers (JS/TS, shell scripting, AI/LLM)
**Platform:** Bluesky (300 char limit with link card)
**Goal:** Leads (npm installs / GitHub stars) + Community

---

## Post 1: The Hook — "I was wrong about shell scripting"

```
I was wrong about shell scripting.

I thought AI and shell commands had to live in separate worlds. curl + jq to hit APIs. Python scripts for agents. Context switching everywhere.

Then I forked zx and added 15 AI template tags.

π = ask an LLM
Π = run a coding agent
Φ = parallel agents
Ρ = analyze → plan → execute → review

Now I write `$` and `π` in the same file.

npm install @topce/pizx
github.com/topce/pizx
```

**Link card:** https://github.com/topce/pizx

---

## Post 2: Curiosity — "One tag. Five perspectives. One verdict."

```
This one tag runs a multi-agent debate on your codebase:

Δ`analyze this PR from optimist, pessimist, and pragmatist perspectives`

(Δ = Debate — 3+ AI perspectives converge on a verdict)

No config. No API wrappers. No YAML.

Just:
import { Δ } from '@topce/pizx'
await Δ({ perspectives: 5 })`debate this`

15 patterns. One import. Zero boilerplate.
```

---

## Post 3: Behind the Build — "Why Greek letters?"

```
Why Greek letters for template tags in pizx?

π (pi) = AI generation
Π (capital Pi) = Coding agent
Ρ (Rho) = Ralph Loop
Φ (Phi) = Fleet (parallel agents)
Σ (Sigma) = Subagents
Δ (Delta) = Debate
Λ (Lambda) = Pipeline
Ψ (Psi) = Critique loop
Ω (Omega) = Orchestrator

Single chars. Visually distinct. No ambiguity.

Weird at first. Then you can't go back.
```

---

## Post 4: Value Hook — "4 lines, 3 agents, 1 shebang"

```
4 lines. 3 agents. 1 shebang.

#!/usr/bin/env pizx

const bugs = await Φ`review every file for bugs and security issues`
const fixed = await Π`fix everything: bugs, types, tests, and docs: ${bugs.text}`

That's it. Fleet (Φ) parallel → Capital Pi (Π) fix.

No LangChain. No CrewAI. Just template tags.

npm install @topce/pizx
github.com/topce/pizx
```

---

## Post 5: Story — "I forked zx and added 15 AI tags"

```
3 months ago I was writing:
$`git log` → copy/paste to ChatGPT → copy/paste back

I wanted: $`git log` → π`write changelog` ... in one file, one shebang.

So I forked Google's zx and added 15 AI template tags.

Now I write scripts where shell commands and multi-agent AI patterns live side by side. No SDK. No separate runtime.

MIT licensed. npm install @topce/pizx
```
<br>github.com/topce/pizx

---

## Post 6: Contrarian — "Stop using LangChain for shell scripts"

```
Unpopular opinion:

LangChain / CrewAI / AutoGen are overkill when all you want is:

1. Shell commands ($)
2. LLM calls (π)
3. Composability (Φ Σ Δ Λ Ω)

pizx gives you all three in one import. Runs as a shebang. Zero config.

Heavy frameworks have their place. Your build script isn't it.

github.com/topce/pizx
```

---

## Post 7: Educational — "Ralph Loop: AI that checks its own work"

```
The Ralph Loop is the most useful pattern in pizx:

analyze → plan → execute → review → repeat

await Ρ`migrate this Express API to Hono`

One line. The agent reads your codebase, plans the migration, executes every file, reviews its own output, catches mistakes, and loops until done.

All in a template literal.

No DAG editor. No manual orchestration.
```

---

## Post 8: Value — "Unix pipes, but with AI agents"

```
Unix pipes | but with AI agents:

await Λ`
  stage1: extract all API endpoints from src/
  stage2: write comprehensive tests for each endpoint
  stage3: review tests for edge cases and coverage gaps
`

Each stage passes full context to the next.

3 agents. 1 pipeline. 0 boilerplate.
```

---

## Post 9: Launch — "pizx v0.1.0 ships today"

```
pizx v0.1.0 is out 🎉

• π / Π — AI text + coding agent with tools
• 8 agent patterns (Ρ Φ Σ Δ Λ Ψ Ω Ν)
• 3 communication patterns (Θ Μ Β)
• 4 orchestration topologies (Α Γ Χ Τ)
• Per-phase model routing
• Option chaining + quiet mode
• 95 unit tests

npm install @topce/pizx

Built on pi-ai and pi-coding-agent by @earendil-works
```

---

## Post 10: Advanced — "One script, multiple models"

```
One script. Two models. Auto-routed.

await Ω({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash'
})`design a notification system`

Plan with a reasoning model.
Execute with a fast model.

pizx routes per phase automatically.

Cheaper. Smarter. No orchestration code.
```

---

## Engagement Posts

### Post E1: Poll — "What's your AI scripting stack?"

```
Poll: How do you integrate AI into your shell workflows?

🟢 zx + curl + jq (DIY)
🔵 LangChain / CrewAI (full framework)
🟡 Custom Python scripts
🟣 pizx (all-in-one template tags)

Curious what the dev community uses.
```

### Post E2: Code challenge

```
What does this 4-line script do?

#!/usr/bin/env pizx
const reviews = await Φ`type-check and review every file`
await Π`apply all TypeScript fixes: ${reviews.text}`

Answer: full codebase type audit + auto-fix in 4 lines.
```

### Post E3: Community — "What pattern should I build next?"

```
Current pizx patterns:

Agent: Ralph Loop, Fleet, Subagents, Debate, Pipeline, Critique, Orchestrator, Nu
Communication: Thread, Memory, Broadcast
Topologies: Adaptive, Graph, Chi, Tau

What pattern is missing? What agent workflow do you find yourself wiring up manually?

I'll build the most requested one.
```

---

## Posting Schedule (Week 1)

| Day | Post | Type |
|-----|------|------|
| Mon | #1: I was wrong about shell scripting | Awareness |
| Tue | #4: 4 lines, 3 agents | Value |
| Wed | #6: Stop using LangChain for shell scripts | Contrarian |
| Thu | #7: Ralph Loop | Educational |
| Fri | #3: Why Greek letters | Behind-the-scenes |
| Sat | E1: Poll | Engagement |
| Sun | #8: Unix pipes with AI | Educational |
