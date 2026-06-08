# Μ (Mu) — Shared Memory

Shared blackboard pattern: agents write findings to a shared context in parallel, then a consolidator merges everything.

**Category: Communication Pattern** | **Communication: Tool-Mediated (shared blackboard)**

## Behavior

Each round, all agents write their findings to a shared "blackboard" in parallel. Each agent can see what others have already written and adds unique insights, fills gaps, or challenges existing entries. After all rounds, a consolidator synthesizes the final output.

## Usage

```js
// Default: 3 agents, 1 round
await Μ`analyze this codebase from multiple angles`

// Multiple rounds for deeper refinement
await Μ({ agents: 4, rounds: 2 })`brainstorm features for the e-commerce platform`

// Custom roles
await Μ({ roles: [
  'Performance Expert',
  'Security Analyst',
  'UX Researcher',
  'DevOps Engineer',
] })`evaluate the system architecture`

// Quiet mode
await Μ.quiet`research best practices for micro-frontends`

// Per-phase model routing
await Μ({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`comprehensively audit the authentication module`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for consolidation |
| `workerModel` | `string` | — | Model for agent writes |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `agents` | `number` | `3` | Number of agents writing |
| `rounds` | `number` | `1` | Writing/refinement rounds |
| `roles` | `string[]` | auto | Custom agent roles |

## Output

```ts
class MemoryOutput extends PatternOutput {
  text: string
  synthesis: string           // Consolidated final output
  entries: MemoryEntry[]      // All blackboard entries
  duration: number
}

class MemoryEntry {
  role: string
  round: number
  content: string
}
```

## Comparison with Θ (Thread)

| | Μ Memory | Θ Thread |
|---|---|---|
| Pattern | Shared blackboard | Direct conversation |
| Parallelism | Agents write simultaneously | Agents speak sequentially |
| Visibility | All see all entries | Agents build on thread |
| Best for | Independent research | Interactive discussion |

## When to Use

- Comprehensive analysis from multiple angles
- Research synthesis across domains
- Brainstorming where agents contribute independently
- Audits where specialists cover different areas
