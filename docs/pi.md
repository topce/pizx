# π (Pi) — AI Text Generation

Small pi: call pi-ai for text generation as a zx-style template tag.

## Behavior

Sends a prompt to a configured AI model via [pi-ai](https://github.com/earendil-works/pi) and streams the response to stdout/stderr. Returns a `PiOutput` with the full text, model used, timing, and token stats.

## Usage

```js
// Basic template literal
const answer = await π`what is 7! + 5?`
console.log(answer.text)  // "5045"

// Options via chaining
const explanation = await π({ model: 'anthropic/claude-sonnet-4-5' })`explain async/await`

// Quiet mode — suppress stdout streaming
const json = await π.quiet()`generate a JSON array of 5 colors`

// Streaming iterator
for await (const chunk of π.stream`tell me a short story`) {
  process.stdout.write(chunk)
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | Pi default | Model ID (e.g. `'deepseek/deepseek-chat'`) |
| `thinkingLevel` | `ThinkingLevel` | `'medium'` | Reasoning depth: `'low'`, `'medium'`, `'high'` |
| `quiet` | `boolean` | `false` | Suppress stdout output |
| `system` | `string` | — | System prompt |
| `maxTokens` | `number` | `4096` | Maximum tokens per call |

## Output

```ts
class PiOutput {
  text: string           // The full response text
  modelId: string        // Model used
  tokens: TokenUsage[]   // Token usage stats
  startTime: number      // ms timestamp
  endTime: number        // ms timestamp
  duration: number       // ms
  toString(): string     // Returns text
  valueOf(): string      // Returns text
}
```

## Global Configuration

```js
import { configurePi } from 'pizx'
configurePi({ model: 'anthropic/claude-sonnet-4-5', maxTokens: 8000 })
```

## When to Use

- Simple question-and-answer tasks
- Text generation, summarization, translation
- Any task that needs AI but doesn't need code tools (filesystem, bash, editing)
