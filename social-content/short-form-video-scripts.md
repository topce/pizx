# pizx — Short-Form Video Scripts (Reels / TikTok / Shorts)

**Target:** IT Developers
**Platform:** TikTok, Instagram Reels, YouTube Shorts (9:16, 15-60 sec)
**Goal:** Awareness → GitHub stars → npm installs
**Format:** Screen recording + captions (most dev content is watched without sound)

---

## Video 1: "The 4-Line Script That Audits Your Entire Codebase"

**Length:** 30 sec
**Format:** Screen recording (VSCode + terminal)
**Audio:** No voice — captions only with upbeat instrumental
**Hook:** Curiosity / Value

```
[0-3s] VISUAL: Dark terminal, cursor blinking
        TEXT OVERLAY (bold, center): "4 lines. 3 agents. 0 config."
        ACTION: Type `#!/usr/bin/env pizx` with fast keystrokes

[3-10s] VISUAL: Continue typing in VSCode
         TEXT: "Import nothing. Just write."
         ACTION: Speed-type these lines:
           const bugs = await Φ`find all bugs and security issues`
           const fixed = await Π`fix everything: bugs, types, tests, docs: ${bugs.text}`

[10-18s] VISUAL: Terminal — run the script
         TEXT: "Fleet (Φ) reviews in parallel"
         ACTION: Show terminal output scrolling — file by file review results
         TEXT (overlay): "Fleet (Φ) = parallel AI review"
         TEXT (overlay): "Capital Pi (Π) = coding agent auto-fix"

[18-25s] VISUAL: Show diff in VSCode — red lines removed, green lines added
         TEXT: "Bugs found. Fixed. All automatic."
         ACTION: Scroll through a diff showing real changes

[25-30s] VISUAL: Black screen, white text
         TEXT: "npm install @topce/pizx"
         TEXT: "github.com/topce/pizx"
```

---

## Video 2: "I Stopped Using LangChain for Scripts"

**Length:** 45 sec
**Format:** Split screen — talking head (left) + screen recording (right)
**Audio:** Voice with background music (-20dB)
**Hook:** Contrarian

```
[0-3s] VISUAL: Dev looking at camera, calm not angry
        TEXT: "I stopped using LangChain for scripts"
        AUDIO: "Unpopular opinion..."

[3-8s] VISUAL: Screen shows npm install langchain output — scrolling 300+ packages
        TEXT: "300+ dependencies"
        AUDIO: "...LangChain is overkill for most agent scripts."

[8-15s] VISUAL: Screen shows the 3 things you actually need
         TEXT (one at a time): "1. Shell commands ($)" → "2. LLM calls (π)" → "3. Patterns (Φ Σ Δ Ω)"
         AUDIO: "You need three things. That's it."

[15-25s] VISUAL: Side-by-side comparison
         LEFT: LangChain code — 50+ lines, verbose
         RIGHT: Same result in pizx — 4 lines
         TEXT: "50 lines → 4 lines"
         AUDIO: "Same workflow. 50 lines versus 4. Your call."

[25-35s] VISUAL: Show the pizx code in detail
         TEXT: "import { $, π, Φ, Σ } from '@topce/pizx'"
         AUDIO: "One import. Template tags. Shebang-ready. Zero config."

[35-45s] VISUAL: Dev looking at camera
         TEXT: "Try it. Free. MIT. Open source."
         AUDIO: "npm install @topce/pizx"
         TEXT: "github.com/topce/pizx"
```

---

## Video 3: "The Greek Alphabet of AI Patterns"

**Length:** 30 sec
**Format:** Fast-cut animated slideshow
**Audio:** High-energy trending instrumental, no voice
**Hook:** Visual curiosity

```
[0-2s] VISUAL: Large "π" on black screen
        TEXT: "π = ask AI anything" → fade out
        AUDIO: Beat drop

[2-4s] VISUAL: "Π" appears
        TEXT: "Π = coding agent (read, bash, edit, write)"

[4-6s] VISUAL: "Φ" appears
        TEXT: "Φ = parallel agents (Fleet)"

[6-8s] VISUAL: "Σ" appears
        TEXT: "Σ = decompose → execute → synthesize"

[8-10s] VISUAL: "Δ" appears
         TEXT: "Δ = multi-perspective debate → converge"

[10-12s] VISUAL: "Λ" appears
         TEXT: "Λ = pipeline: stage₁ → stage₂ → stage₃"

[12-14s] VISUAL: "Ω" appears
         TEXT: "Ω = orchestrator: plan → dispatch → synthesize"

[14-17s] VISUAL: All letters cascade in rapid succession
         TEXT: "Ρ Ψ Ν Θ Μ Β Α Γ Χ Τ"
         TEXT: "15 patterns total"

[17-22s] VISUAL: Zoom to code example
         TEXT: "import { π, Π, Φ, Δ, Λ, Ω } from '@topce/pizx'"

[22-28s] VISUAL: Terminal output showing real results
         TEXT: "All patterns = template tags. One import."

[28-30s] VISUAL: Black screen, white text
         TEXT: "github.com/topce/pizx"
```

---

## Video 4: "The Ralph Loop — AI That Finds and Fixes Its Own Bugs"

**Length:** 45 sec
**Format:** Screen recording only
**Audio:** Calm instrumental + captions
**Hook:** Value / "This is genuinely useful"

```
[0-3s] VISUAL: Terminal with cursor blinking
        TEXT: "What if your AI agent could catch its own mistakes?"
        AUDIO: Soft keyboard typing

[3-8s] VISUAL: Type slowly, deliberately
        ACTION: `await Ρ({ model: 'anthropic/claude-sonnet-4-5' })`migrate Express to Hono``
        TEXT: "One line. Ralph Loop pattern."

[8-18s] VISUAL: Terminal — Ralph Loop phase by phase
         SHOW (with labeled overlays):
           "🔍 ANALYZE" — agent reads the Express codebase
           "📋 PLAN" — maps every route, middleware, and dependency
           "⚡ EXECUTE" — rewrites files one by one
           "✅ REVIEW" — audits its own output
           "🔄 LOOP" — finds a missed edge case, fixes it

[18-28s] VISUAL: VSCode split — before/after view
         TEXT: "Express → Hono. 47 files migrated."
         SHOW: Side-by-side diff of a migrated route

[28-38s] VISUAL: Terminal — loop summary
         TEXT: "3 iterations. 2 self-caught bugs. 1 final pass."
         TEXT: "Zero manual intervention."

[38-45s] VISUAL: Black screen, white text
         TEXT: "npm install @topce/pizx"
         TEXT: "15 patterns. One import. MIT."
```

---

## Production Notes

**Visual style (all videos):**
- Dark mode terminal + VSCode (dev aesthetic is mandatory)
- Font: JetBrains Mono or SF Mono, 14-16pt for code
- Captions: bold white sans-serif with 2px black stroke
- Keyword highlights in cyan (#58A6FF) or green (#7EE787)
- End screen: repo URL visible for 3+ seconds, readable on mobile

**Audio guidelines:**
- Voice-over: clear, conversational, not rushed
- Background music: instrumental, electronic/lo-fi, -20dB under voice
- No music with lyrics — distracts from captions and code visuals

**Recommended production tools:**
- **CapCut** — free, excellent auto-captions, trending sounds
- **Descript** — AI-powered captions with fine timing control
- **Screen Studio** — beautiful screen recordings with auto-zoom
- **OBS** — free, full control over screen + camera recording
