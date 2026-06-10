# pizx — Discord Strategy

**Discord is a community, not a broadcast channel.** Join servers, contribute, then share. The goal is genuine conversation, not link-dropping.

---

## 🔍 Where to Post

### Tier 1: Directly Relevant Servers (highest ROI)

| Server | Channel | Strategy |
|--------|---------|----------|
| **[Pi AI / Pi Coding Agent](https://discord.gg/earendil-works)** | `#showcase` or `#projects` | **Post here first.** pizx is built on pi-ai + pi-coding-agent. This is your home community. |
| **zx (Google)** — check repo for Discord link | `#showcase` | pizx is a fork — these are your exact users. |
| **r/JavaScript** | `#projects` or `#showcase` | 100K+ JS devs. Shell scripting audience. |
| **r/TypeScript** | `#showcase` | TypeScript-first project. Perfect fit. |
| **r/Node** | `#show-and-tell` | Node.js devs who love CLI tools. |

### Tier 2: AI/LLM Developer Communities

| Server | Channel | Notes |
|--------|---------|-------|
| **LangChain Discord** | `#showcase` or `#projects` | pizx is a lightweight alternative. Be respectful — "different tool, different need." |
| **OpenAI Dev Discord** | `#showcase` | LLM devs open to simpler scripting options. |
| **Anthropic Discord** | `#showcase` | Claude users — pizx routes to Claude natively. |
| **Hugging Face Discord** | `#showcase` | Open-source AI community. |
| **LocalAI / Ollama Discord** | `#showcase` | Local model users — pizx supports them via pi-ai. |

### Tier 3: General Developer Communities

| Server | Channel | Notes |
|--------|---------|-------|
| **The Programmer's Hangout** | `#showcase` | 300K+ members. Active sharing culture. |
| **DevChat** | `#projects` | Large general dev community. |
| **Reactiflux** | `#coding-chat` or `#showcase` | React devs who also do Node/CLI. |
| **Python Discord** | `#showcase` or `#projects` | pizx is JS, but Python devs use shell scripts too. |

---

## 📝 Post Templates

### Template: Tier 1 (Directly relevant — full enthusiasm)

```
Hey everyone! I built pizx — a fork of Google's zx that adds 15 native
AI template tags.

The idea: shell commands and AI agents in the same file, one shebang.

  #!/usr/bin/env pizx
  import { $, π, Φ, Σ } from '@topce/pizx'

  const reviews = await Φ`review each file for bugs and security issues`
  const report = await Σ`synthesize all findings: ${reviews.text}`

Fleet (Φ) runs parallel reviews. Subagents (Σ) aggregates. 4 lines.

15 patterns total — Ralph Loop (self-correcting), Debate (multi-perspective),
Pipeline (stage by stage), Orchestrator (plan → dispatch → synthesize),
and more. All as tagged template literals.

• Works with any LLM provider (via pi-ai: OpenAI, Anthropic, DeepSeek, etc.)
• Per-phase model routing (plan with Claude, execute with DeepSeek)
• Shebang-ready, zero config beyond `pi auth login`
• MIT licensed, 95 unit tests, built on pi-ai + pi-coding-agent

npm install @topce/pizx
github.com/topce/pizx

Would love feedback from this community — especially on the pattern design!
```

### Template: Tier 2 (AI communities — respectful alternative)

```
Sharing a tool I've been working on for AI-assisted scripting:

pizx is a zx fork that adds 15 AI agent patterns as template tags.
The goal: multi-agent workflows as simple as shell commands.

Example — parallel code review:

  await Φ`
    security audit on auth module
    error handling review on API layer
    SQL injection check on database queries
  `

All patterns (parallel agents, debate, pipeline, orchestrator, self-correcting
loops) are template tags with the same API. One import, zero config.

Works with any LLM provider. Delegates to pi-ai under the hood — so if your
provider is supported there, it works here.

Not trying to replace full frameworks. More of a lightweight alternative for
quick scripts, automation, and prototyping.

MIT. Open source. github.com/topce/pizx

Curious what you think — especially about the pattern design approach.
```

### Template: Tier 3 (General dev communities — short and punchy)

```
Built a CLI tool that mixes shell commands and AI agents:

pizx — fork of Google's zx with 15 AI template tags.

One-liner:
  await π`explain this git diff: ${stdout}`

Multi-agent:
  await Φ`review each file in src/ for type errors`

15 patterns. One import. Shebang-ready. MIT licensed.

github.com/topce/pizx
```

---

## 📋 Server Rules Checklist

**Before posting in ANY server, always:**

1. **Read `#rules` thoroughly** — some ban self-promotion entirely
2. **Find the right channel** — `#showcase`, `#projects`, `#sharing`, or `#self-promotion`
3. **Introduce yourself first** — `#introductions` or `#general` before sharing
4. **Don't DM members** — never send unsolicited project DMs
5. **One channel per server** — don't cross-post to multiple channels

**Skip servers that:**
- Explicitly ban self-promotion
- Have only `#help` or `#support` channels (not for sharing)
- Require admin approval for sharing (ask, don't assume)

---

## 🗓️ Posting Cadence

| Day | Action |
|-----|--------|
| **Day 1** | Pi / Earendil Works Discord — your home community, most relevant |
| **Day 2** | r/JavaScript + r/TypeScript Discords |
| **Day 3** | Node.js Discord |
| **Day 4-5** | 1-2 AI community Discords (LangChain, Ollama) |
| **Day 6-7** | Broader dev Discords (Programmer's Hangout, DevChat) |
| **Ongoing** | Engage in threads, answer questions, help people get started |

**Never** post in all servers on the same day — it looks spammy and gets flagged.

---

## 💬 Common Questions & Responses

### "How is this different from calling the OpenAI API directly?"

> You can absolutely do that. pizx saves the boilerplate: API client setup, auth management, streaming, response parsing. Plus multi-agent patterns (Φ, Σ, Δ, Ω) that would take significant code to orchestrate manually. But if raw API calls work for you, that's valid too — pizx is just a shortcut for the common case.

### "Does it work with Ollama / local models?"

> Yes — pi-ai supports Ollama and other local providers. Configure via `pi auth login` with your Ollama endpoint, and pizx works the same way regardless of provider.

### "Can I use this without pi-ai?"

> Currently pizx depends on pi-ai as the provider layer. But pi-ai supports 20+ providers, so you're not locked into one. Direct provider support without the abstraction is a reasonable future feature request.

### "How can I contribute?"

> The repo is at github.com/topce/pizx. I'd love help with: additional pattern examples, documentation improvements, testing, and new pattern ideas. Issues and PRs welcome!

### "What's the catch? Why free/MIT?"

> No catch. I built this for myself — it solves a real problem I have daily. Making it MIT means others can use it, improve it, and I benefit from community contributions. Standard open source model.

---

## 🏆 Priority Order

```
1. Pi / Earendil Works Discord    ← HOME COMMUNITY — POST HERE FIRST
2. r/JavaScript Discord             ← Largest JS community
3. r/TypeScript Discord             ← Perfect audience fit
4. Node.js Discord                  ← CLI tool enthusiasts
5. AI community Discords            ← Pattern design feedback
6. General dev Discords             ← Broad awareness
```

The Pi Discord is most important — pizx is built on pi-ai and pi-coding-agent. That community already understands the ecosystem and will give the most technically valuable feedback.
