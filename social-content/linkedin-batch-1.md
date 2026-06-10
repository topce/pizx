# pizx — LinkedIn Content Batch 2

**Target:** IT professionals, engineering managers, developer tool enthusiasts
**Tone:** Professional, thought leadership, educational
**Frequency:** 3-4x/week
**Format:** Text posts (1,200-1,500 chars) + carousel idea
**Rule:** No external links in post body → put in first comment

---

## Post 1: The Origin Story — "I was wrong about shell scripting"

**Type:** Story / Behind-the-scenes

---

I was wrong about shell scripting.

For years I believed AI and shell commands had to live in separate worlds. You used curl and jq to hit LLM APIs. You maintained Python scripts for agent workflows. You switched contexts constantly.

Then I asked myself: what if `$` and `π` could live in the same file?

The answer turned into an open source project.

pizx is a fork of Google's zx — the tool that made shell scripting in JavaScript actually pleasant. I kept everything that makes zx great and added 15 AI template tags.

Each tag is a single Greek letter that maps to a pattern:

π → AI text generation
Π → Coding agent with tools (read, bash, edit, write)
Ρ → Analyze → Plan → Execute → Review (Ralph Loop)
Φ → Parallel agent execution (Fleet)
Δ → Multi-perspective debate → converged verdict
Λ → Pipeline: stage₁ → stage₂ → stage₃
Ω → Orchestrator: plan → dispatch → synthesize

These are not new ideas. Multi-agent patterns, self-correcting loops, parallel execution — these are well-established concepts in AI engineering.

What's new is the API. A tagged template literal. Not a class hierarchy. Not a decorator. Not a 50-line chain definition.

The result: you prototype a multi-agent workflow in the time it takes to read most frameworks' quickstart guides.

Open source. MIT. If you build dev tools or write shell scripts, I'd love your feedback.

*Link in comments →*

---

## Post 2: "Most AI agent frameworks are overengineered"

**Type:** Contrarian / Thought leadership

---

Most AI agent frameworks are solving problems you don't have.

I've spent the last year evaluating tools like LangChain, CrewAI, AutoGen, and others. They're impressive engineering. But there's a category error happening in the AI dev space.

Here's what most agent scripts actually need:

1. **Shell commands** — list files, read code, run tests
2. **LLM calls** — ask a model to analyze, summarize, generate
3. **Composable patterns** — parallel agents, debate, pipeline, orchestrator

That's it. Three primitives. Everything else is overhead.

I built pizx to strip the stack down to exactly these three things. 15 patterns as template tags. No classes. No decorators. One import. Runs as a shebang.

The design trade-off is deliberate: pizx is not for production AI systems with guardrails, streaming, observability, and human-in-the-loop. Use LangChain or similar for that.

But if you're prototyping. Experimenting. Building internal tools. Writing automation scripts. Ask yourself honestly: do you need a framework, or just a template literal?

The answer has saved me hundreds of lines of code.

---

## Post 3: The Ralph Loop — AI That Checks Its Own Work

**Type:** Educational

---

The single most useful pattern in pizx is the Ralph Loop.

It's named after the classic iterative improvement pattern: Read → Analyze → Logic → Patch → Harden. In practice, it works like this:

1. **Analyze** — AI reads your codebase and identifies what needs to change
2. **Plan** — generates a minimal, actionable implementation plan
3. **Execute** — coding agent applies changes file by file
4. **Review** — AI audits its own output for correctness
5. **Repeat** — loops until all quality criteria are met

In pizx, all five phases happen from one line:

```js
await Ρ`migrate this Express API to Hono`
```

The agent reads the entire codebase, plans the migration, rewrites every file, reviews its own output, catches its own mistakes, fixes them, and repeats until done.

This pattern is powerful because it accepts a fundamental truth: AI makes mistakes. A single-shot generation will miss edge cases, introduce subtle bugs, or produce incomplete work.

The loop doesn't try to prevent errors. It treats them as inevitable and builds correction into the process.

I use Ralph Loops for code migrations, test generation, refactoring, and documentation. One template literal per task. No orchestration code.

The pattern itself isn't new. Making it a first-class language primitive is.

---

## Post 4: Carousel — "15 AI Patterns, One npm Package"

**Type:** Carousel / Document post (10 slides)

**Slide 1 — Cover:**
Title: "15 AI Patterns in One npm Package"
Subtitle: "pizx — zx fork with native AI template tags"

**Slide 2 — The Problem:**
"AI scripting tools are complex. Heavy SDKs, boilerplate configs, separate runtimes. What if you could write agent scripts with a shebang?"

**Slide 3 — What is pizx?**
"pizx = zx + 15 AI template tags. One import. Shebang-ready. No configuration beyond authentication."

**Slide 4 — Core Tags:**
- π (Pi) → AI text generation
- Π (Capital Pi) → Coding agent with tools (read, bash, edit, write)

**Slide 5 — Agent Patterns:**
- Ρ (Rho) → Ralph Loop: analyze → plan → execute → review
- Φ (Phi) → Fleet: parallel agents
- Σ (Sigma) → Subagents: decompose → execute → synthesize
- Δ (Delta) → Debate: multi-perspective → converge

**Slide 6 — More Patterns:**
- Λ (Lambda) → Pipeline: stage by stage
- Ω (Omega) → Orchestrator: plan → dispatch → synthesize
- Ψ (Psi) → Critique: generate → critique → improve
- Ν (Nu) → Negotiated roles and execution

**Slide 7 — Communication:**
- Θ (Theta) → Thread: multi-agent conversation
- Μ (Mu) → Memory: shared blackboard
- Β (Beta) → Broadcast: one-to-many messaging

**Slide 8 — Orchestration Topologies:**
- Α (Alpha) → Adaptive: self-adjusting workflows
- Γ (Gamma) → Graph: DAG-based execution
- Χ (Chi) → Trace analysis and pattern extraction
- Τ (Tau) → Schema-driven content generation

**Slide 9 — Code Example:**
```js
#!/usr/bin/env pizx

const reviews = await Φ`review every file for bugs and security issues`
echo(await Σ`synthesize findings into a report: ${reviews.text}`)
```

**Slide 10 — CTA:**
"Open source (MIT). One npm install away."
"github.com/topce/pizx"
"npm install @topce/pizx"

---

## Post 5: Multi-Model Strategy

**Type:** Technical / Educational

---

Not all AI tasks need the same model.

Planning a complex migration demands deep reasoning. Running 10 parallel code reviews benefits from high throughput at low cost. Orchestrating debate between perspectives requires broad context understanding.

In most frameworks, you'd manually route to different models. In pizx, every pattern supports per-phase model selection:

```js
await Ω({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash'
})`design a real-time notification system with fallback strategies`
```

Plan with a reasoning-focused model. Execute with a fast, cost-effective model. The routing happens automatically — you declare intent, pizx handles distribution.

This isn't a novel concept. It's how production AI systems already work. The difference is that pizx makes it a configuration option rather than an integration project.

Practical impact: better results (planning gets the best model), lower cost (execution uses cheaper models), faster iteration (no wiring required).

Same principle can be applied to any pattern — Ralph Loop, Pipeline, Debate. Plan with one model, work with another. All through an options object on a template tag.

---

## Post 6: Behind the Build — "What I learned building a multi-agent framework solo"

**Type:** Personal / Lessons learned

---

Building pizx — a multi-agent framework with 15 patterns as a solo developer — taught me four principles I'll carry into every project.

**1. Simplicity is the hardest feature to build.**

Every pattern in pizx is a tagged template literal. No class hierarchy. No decorators. No dependency injection. Just functions that receive text prompts and return structured results. This constraint forced me to solve problems differently. When a pattern got complex, I couldn't add an abstraction layer — I had to simplify the pattern itself.

**2. Consistency beats capability.**

All 15 tags share the exact same API shape: options object → template literal → structured output. If you've used one pattern, you've effectively learned them all. Users move from π to Φ to Ω without reading additional docs. That's worth more than having the most feature-rich individual pattern.

**3. Greek letters are weird — and that's exactly why they work.**

Using single Greek characters (π, Π, Φ, Δ, Ω) is unconventional. Some people hate it at first. But unconventional is memorable. After one session, nobody forgets that Φ means parallel execution. The initial friction of learning them is outweighed forever by the speed of typing them.

**4. Delegation is architecture.**

pizx doesn't integrate with 20+ LLM providers directly. It delegates to pi-ai, which handles that. It doesn't implement its own shell execution. It inherits from zx, which has years of battle-testing. Good software doesn't do everything — it composes with tools that already do their job well.

Open source is a conversation, not a product. I'm sharing pizx as MIT specifically to invite contributions I could never predict.

---

## Post 7: Quick Win — "Your first pizx script"

**Type:** Value / Tip

---

Here's your first pizx script. It's 4 lines.

```js
#!/usr/bin/env pizx

const issues = await Φ`comprehensively review every file for bugs, type errors, and security issues`
const fixed = await Π`fix each issue — write the corrected code: ${issues.text}`
```

That's it. 4 lines. 3 agents. Zero configuration.

Breaking it down:

**Line 1:** Shebang — makes the file executable with pizx
**Line 2:** Shell glob for all TypeScript files in the project
**Line 3:** Φ (Fleet) — runs parallel AI agents reviewing every file simultaneously
**Line 4:** Π (Capital Pi) — deploys a coding agent that reads, edits, and fixes code

The result: your entire codebase gets a comprehensive review, and every fix is applied automatically. Run it before every PR.

This is the sweet spot for pizx — repeating, multi-file, AI-powered workflows that are deterministic enough to trust but tedious enough to automate.

npm install @topce/pizx → ./review-and-fix.mjs → done.

*Link in comments →*

---

## Weekly Schedule (LinkedIn)

| Day | Content |
|-----|---------|
| Mon | Post 1 (Origin Story — "I was wrong about shell scripting") |
| Tue | Post 3 (Ralph Loop — educational deep-dive) |
| Wed | Post 2 (Contrarian — thought leadership, engagement bait) |
| Thu | Carousel Post 4 (visual format, high reach) |
| Fri | Post 5 or Post 7 (technical tip / quick win) |
| Sat | Engagement — reply to every comment, engage with 5 dev tool posts |
| Sun | Post 6 (Behind the build — personal, weekend reads well) |

**Daily routine (15 min):**
- Reply to every comment within 2 hours
- Comment on 5 posts from developer tools / open source accounts
- Share 1 relevant post with your own insight
