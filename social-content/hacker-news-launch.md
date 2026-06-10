# Hacker News — Show HN Strategy for pizx

**HN is the highest-leverage channel** for a dev tool like pizx. One successful Show HN can drive thousands of GitHub stars and npm installs — more than weeks of social posting combined.

---

## Step 1: The Title

The title is **the single most important variable**. HN penalizes hype and rewards specificity.

**Best option:**
> Show HN: pizx – zx fork with 15 native AI template tags (π, Π, Φ, Σ, Δ, Λ, Ω)

**Alternative:**
> Show HN: pizx – multi-agent AI patterns as shell script shebangs

**Why this works:**
- "zx fork" = instant recognition (every HN reader knows zx)
- "15 native AI template tags" = specific, quantifiable, honest
- Greek letters are intriguing without being hype
- No clickbait, no "revolutionary", no "game-changing"

**Avoid these titles at all costs:**
- ❌ "I built an AI framework that will change everything" (buzzword soup)
- ❌ "The last AI scripting tool you'll ever need" (hubris — HN punishes this)
- ❌ "pizx – AI-powered agentic shell scripting" (vague, meaningless to HN)
- ❌ "15 AI patterns that make LangChain obsolete" (inflammatory, wrong)

---

## Step 2: Pre-Launch Checklist

Before submitting to HN, ensure everything is polished. HN readers will inspect your repo thoroughly.

### ✅ README (your landing page)

Add a "Why" section to the top of the README (before Quick Start):

```markdown
## Why pizx?

pizx is a fork of [zx](https://github.com/google/zx), Google's shell scripting
tool for JavaScript/TypeScript. I added 15 AI-powered template tags because
existing AI scripting tools required heavy setup, SDKs, or separate runtimes.

pizx runs as a shebang (`#!/usr/bin/env pizx`), requires one `npm install`,
and needs no configuration beyond `pi auth login`. Each pattern is a single
tagged template literal — learn one, learn them all.
```

### ✅ Documentation check

Ensure every `docs/*.md` renders cleanly:

```bash
cd docs/ && for f in *.md; do echo "=== $f ==="; head -5 "$f"; done
```

### ✅ Installation flow (test fresh)

```bash
# Test globally
npm install -g @topce/pizx
pi auth login
pizx -p "hello world"

# Test locally
npm install @topce/pizx
pizx examples/hello-pizx.mjs
```

### ✅ All examples run

```bash
npm run example:all
```

### ✅ CI status badge

Add a GitHub Actions badge if CI is set up. Add stars badge for social proof.

### ✅ License file

MIT LICENSE file must be in the repo root. HN readers check this.

---

## Step 3: The First Comment

**Immediately** after submitting, post this comment. It's your one chance to provide context. No links — just substantive explanation.

```markdown
Built pizx because I wanted shell commands and AI agents to live
in the same file without switching tools.

What it is:
- Fork of Google's zx (shell scripting in JS/TS)
- 15 template tags (Greek letters) — each = one AI pattern
- Patterns: text gen, coding agent, parallel agents, debate,
  pipeline, orchestrator, self-correcting loops, and more
- Per-phase model routing (plan with Claude, execute with DeepSeek)
- Shebang-ready: #!/usr/bin/env pizx
- Under the hood: delegates to pi-ai (20+ LLM providers supported)
  and inherits shell execution from zx

Example that shows the idea:

  #!/usr/bin/env pizx
  import { $, π, Φ, Σ } from '@topce/pizx'

  const reviews = await Φ`review each file for bugs and security issues`
  const report = await Σ`synthesize findings: ${reviews.text}`

Fleet (Φ) runs parallel AI reviews. Subagents (Σ) aggregate results.
4 lines. 3 agents. One shebang.

Design philosophy: patterns as tagged template literals, not class
hierarchies. Every tag has the same API shape — if you know one,
you know all 15. Using Greek letters was deliberate — single chars,
visually distinct from identifiers, fast to type and read.

Under the hood, pizx delegates to pi-ai (provider layer, 20+ models
supported) and zx (shell execution). It's composition over integration.

Happy to answer questions about the architecture, pattern design,
trade-offs, or anything else. HN's community is the exact audience
I'd love to learn from.
```

---

## Step 4: Q&A Preparation

HN commenters are technical, skeptical, and thorough. Have answers ready.

### Q: "How is this different from zx + OpenAI SDK?"

> Raw approach requires:
> ```js
> const { $ } = require('zx')
> const OpenAI = require('openai')
> const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY })
> const files = (await $`ls src/`).stdout
> const review = await openai.chat.completions.create({
>   model: 'gpt-4', messages: [{ role: 'user', content: files }]
> })
> ```
> pizx collapses this to:
> ```js
> const review = await π`review these files: ${files}`
> ```
> And goes beyond single queries with multi-agent patterns — parallel
> execution, debate, pipeline, self-correcting loops — that require
> significant manual orchestration. Each pattern handles agent
> communication, iteration limits, error handling, and result
> aggregation internally.

### Q: "Why Greek letters? Seems like a gimmick."

> Fair question. Reasoning: these tags get used extremely frequently,
> so single characters reduce visual noise. Greek letters are visually
> distinct from standard identifiers — π reads as "AI call" at a
> glance where `ai()` wouldn't. That said, you can alias on import:
> ```js
> import { π as ai, Φ as parallel, Σ as pipeline } from '@topce/pizx'
> ```
> It's unconventional, but unconventional is memorable. After one
> session you don't forget that Φ means parallel execution.

### Q: "Does this lock me into pi-ai?"

> pi-ai is a provider abstraction that supports 20+ providers:
> OpenAI, Anthropic, DeepSeek, Google, Groq, local models via
> Ollama, and more. You configure once with `pi auth login` or
> set per-call:
> ```js
> await π({ model: 'anthropic/claude-sonnet-4-5' })`...`
> ```
> pizx doesn't care which provider you use — it delegates everything.

### Q: "Is this production-ready?"

> 0.1.0. Core patterns work and are tested (95 unit tests). I use it
> daily for code review, migration, and refactoring. But it's early —
> expect rough edges in complex error scenarios. The architecture is
> deliberately simple (pattern delegation, not monolithic orchestration),
> which makes debugging tractable. Contributions welcome.

### Q: "How does this compare to LangChain / CrewAI / AutoGen?"

> Different scope. Those are full AI application frameworks with
> guardrails, streaming, observability, complex chain composition,
> and human-in-the-loop. pizx is a lightweight scripting tool for the
> 80% case: quick scripts, automation, internal tools, prototyping.
> If you need production guardrails, use the heavy tools. If you want
> to review your codebase in 4 lines, try pizx.

### Q: "Does every example actually run?"

> Yes — every file in examples/ is runnable. `npm run example:all`
> runs them all. The examples demonstrate each pattern in isolation
> with real output. No mockups, no stubs.

### Q: "Why not Python?"

> zx/pizx targets the JS/TS ecosystem. If you live in Python, great
> options exist (Instructor, LangChain, etc.). pizx is for devs who
> already write shell scripts in JavaScript/TypeScript — zx has a
> strong, established community there.

### Q: "What's the architecture? How do patterns work?"

> Each tag is a function that receives a template literal and options.
> It parses the prompt, optionally plans with pi-ai, dispatches to
> pi-coding-agent (which has read/bash/edit/write tools) or pi-ai
> for text-only patterns, aggregates results, and returns structured
> output. All patterns share the same handler interface — the
> difference is in coordination logic: parallel dispatch (Φ), sequential
> pipeline (Λ), iterative loop (Ρ), multi-perspective synthesis (Δ), etc.

---

## Step 5: Timing

| Factor | Recommendation |
|--------|---------------|
| **Day** | Monday–Thursday (best), Friday (ok), Weekend (avoid) |
| **Time** | 6:00–8:00 AM Eastern Time (US) |
| **Why** | Maximizes front-page rotation during US waking hours |
| **Duration** | Monitor actively for 3+ hours, check periodically for 12 hours |

---

## Step 6: During the Launch

### First 30 minutes (critical):
- Submit post → immediately post first comment
- Watch first 5-10 comments — they set the thread's tone
- Reply to everything within minutes — speed matters
- Upvote quality replies from others (genuine engagement)

### First 2 hours:
- Keep thread active — every reply signals engagement
- Legitimate criticism? Acknowledge it honestly, thank them, don't defend
- Good suggestion? Say "that's a great idea, I'll add it"
- HN rewards humility and technical depth, punishes defensiveness

### If it hits the front page:
- Expect 100-300+ comments
- Prioritize substantive questions over "cool project" comments
- Take breaks — the thread will keep going
- Traffic spike lasts 12-24 hours

---

## Step 7: Post-Launch Follow-up

Within 24-48 hours:

1. **Fix bugs** reported in comments — ship fast
2. **Implement suggestions** that make sense — update README
3. **Post "Thank you" follow-up** — summarize top takeaways and what you fixed
4. **Cross-post** to Bluesky/X/LinkedIn: "pizx hit HN front page — here's what I learned"
5. **Update docs** if common questions revealed gaps

---

## Quick Reference: HN Do and Don't

| ✅ Do | ❌ Don't |
|-------|---------|
| Honest, descriptive titles | Clickbait, hype, buzzwords |
| Code examples in comments | Marketing speak, "revolutionary" |
| Acknowledge limitations openly | Pretend it's perfect |
| Thank critics, implement feedback | Argue with every commenter |
| Open source (MIT, confirmed) | "Freemium" or bait-and-switch |
| Working, runnable examples | "Coming soon" or vaporware |
| Trade-off discussions with nuance | Feature comparisons without context |
| "Show HN" prefix | "Launch HN" (unless YC-backed) |
