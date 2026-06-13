# Π (Capital Pi) — Pi Coding Agent

Capital pi: run pi-coding-agent with file/browser tools as a zx-style template tag.

## Behavior

Sends a prompt to an AI coding agent that can read files, run bash commands, edit files, write files, grep code, and list directories. The agent autonomously decides which tools to use, executes them, and iterates until the task is done or `maxTurns` is reached.

Uses a shared session — subsequent calls reuse the same agent context.

## Usage

```js
// Fix TypeScript errors across the project
await Π`fix the TypeScript errors in src/`

// Limit tools available
await Π({ tools: ['read', 'bash', 'edit'] })`refactor the auth module`

// Quiet mode
await Π.quiet()`update import paths to use .js extensions`

// Close the shared agent session
import { closeAgent } from 'pizx'
await closeAgent()
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Working directory for the agent |
| `model` | `string` | Pi default | Model ID |
| `thinkingLevel` | `ThinkingLevel` | — | Reasoning depth |
| `thinkingBudgets` | `ThinkingBudgets` | — | Token budgets per thinking level (token-based providers only) |
| `quiet` | `boolean` | `false` | Suppress stderr output |
| `maxTurns` | `number` | `10` | Maximum tool-use turns the agent can take |
| `tools` | `string[]` | all | Specific tools to enable |
| `excludeTools` | `string[]` | — | Tools to disable |
| `system` | `string` | — | Custom system prompt (replaces Pi default) |
| `appendSystemPrompt` | `string` | — | Text appended after the system prompt |
| `skills` | `string[]` | — | Skill names to load (e.g. `['code-simplification']`) |

## Output

```ts
class AgentOutput {
  text: string           // Final assistant response
  turnCount: number      // Number of assistant turns taken
  startTime: number      // ms timestamp
  endTime: number        // ms timestamp
  duration: number       // ms
  toString(): string
  valueOf(): string
}
```

## Global Configuration

```js
import { configureAgent, closeAgent } from 'pizx'

// Set global defaults for all Π calls
configureAgent({ maxTurns: 5, tools: ['read', 'bash', 'edit'] })

// Close the shared agent session between calls
await closeAgent()
```

## When to Use

- Tasks requiring file reads, edits, or bash commands
- Code refactoring with tool use
- Autonomous multi-step coding tasks
- When you need the agent to see and modify project files
