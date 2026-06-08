# Θ (Theta) — Thread

Multi-agent conversation: agents respond to each other in turns, building on prior contributions.

**Category: Communication Pattern** | **Communication: Direct (agent-to-agent)**

## Behavior

Multiple agents engage in a structured conversation. Each turn, every agent speaks once, responding to the full thread so far. After all turns, a facilitator synthesizes the conversation into a conclusion.

## Usage

```js
// Default: 3 agents, 3 turns
await Θ`debate the best architecture for this project`

// More agents, more turns
await Θ({ agents: 4, turns: 5 })`evaluate this business decision`

// Custom roles
await Θ({ roles: ['CEO', 'CTO', 'CFO', 'VP Engineering'] })`
  should we prioritize speed or quality for this release?
`

// Quiet mode
await Θ.quiet`find the optimal solution to this resource allocation problem`

// Per-phase model routing
await Θ({
  plannerModel: 'anthropic/claude-sonnet-4-5',
  workerModel: 'deepseek/deepseek-v4-flash',
})`negotiate API contract design`
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Fallback model |
| `plannerModel` | `string` | — | Model for final synthesis |
| `workerModel` | `string` | — | Model for agent responses |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth |
| `quiet` | `boolean` | `false` | Suppress output |
| `maxTokens` | `number` | `4096` | Max tokens per call |
| `system` | `string` | — | System prompt |
| `agents` | `number` | `3` | Number of conversation agents |
| `turns` | `number` | `3` | Conversation rounds |
| `roles` | `string[]` | auto | Custom agent roles |

### Pre-built Role Sets

| Count | Roles |
|-------|-------|
| 2 | Proposer, Critic |
| 3 | Proposer, Critic, Synthesizer |
| 4 | Proposer, Critic, Pragmatist, Innovator |
| 5 | All above + Devil's Advocate |

## Output

```ts
class ThreadOutput extends PatternOutput {
  text: string
  conclusion: string               // Synthesized conclusion
  messages: ThreadMessage[]        // All conversation messages
  duration: number
}

class ThreadMessage {
  role: string
  turn: number
  content: string
}
```

## When to Use

- Design discussions and brainstorms
- Decision-making with multiple perspectives
- Architecture review by a virtual team
- Any conversation where building on previous points adds value
