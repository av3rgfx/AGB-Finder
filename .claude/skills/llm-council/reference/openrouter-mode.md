# Multi-provider mode (OpenRouter)

This mode reproduces the original [karpathy/llm-council](https://github.com/karpathy/llm-council)
behavior: a council of **real, different models** queried through
[OpenRouter](https://openrouter.ai). Use it when the user wants genuine
cross-provider diversity rather than independent Claude subagents.

`scripts/council.mjs` is a faithful Node port of the project's
`backend/council.py` + `backend/openrouter.py`. It needs only Node 18+ (uses the
built-in `fetch`) — no Python, no extra dependencies.

## Setup

1. Get an API key from https://openrouter.ai/keys
2. Export it (or put it in a `.env` you source):

   ```bash
   export OPENROUTER_API_KEY=sk-or-...
   ```

## Run

```bash
node .claude/skills/llm-council/scripts/council.mjs "What is the best way to structure a multi-tenant database?"

# machine-readable JSON (stage1, stage2, aggregate, stage3):
node .claude/skills/llm-council/scripts/council.mjs --json "your question"

# read a long question from a file:
node .claude/skills/llm-council/scripts/council.mjs --question-file ./question.txt
```

## Configuration

All optional, via environment variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | — (required) | Your OpenRouter key |
| `COUNCIL_MODELS` | `openai/gpt-5.1,google/gemini-3-pro-preview,anthropic/claude-sonnet-4.5,x-ai/grok-4` | Comma-separated council member model ids |
| `CHAIRMAN_MODEL` | `google/gemini-3-pro-preview` | Model that synthesizes the final answer |
| `OPENROUTER_API_URL` | `https://openrouter.ai/api/v1/chat/completions` | Endpoint override |

Example with a custom panel:

```bash
export COUNCIL_MODELS="openai/gpt-5.1,anthropic/claude-sonnet-4.5,meta-llama/llama-3.3-70b-instruct"
export CHAIRMAN_MODEL="anthropic/claude-sonnet-4.5"
node .claude/skills/llm-council/scripts/council.mjs "Should we adopt event sourcing?"
```

## What it does (3 stages)

1. **Stage 1 — first opinions:** every `COUNCIL_MODELS` member answers the
   question independently (queried in parallel).
2. **Stage 2 — review:** each member is shown all answers **anonymized**
   (`Response A`, `Response B`, …) and ranks them, emitting a strict
   `FINAL RANKING:` block that the script parses. Anonymization stops models from
   favoring their own output.
3. **Stage 3 — final response:** the `CHAIRMAN_MODEL` receives all answers and all
   rankings and synthesizes one final answer.

The script also prints an **aggregate ranking** (each model's average peer-rank)
so you can see which member the council judged best.

## Notes

- Models that error or time out are skipped; the council proceeds with whoever
  responded (matching the original's behavior).
- Network egress to `openrouter.ai` must be permitted in your environment.
- The stage prompts are reproduced verbatim from the upstream project; see the
  `NOTE:` comments in `scripts/council.mjs`.
- The exported functions in `council.mjs` can be imported for testing or to build
  your own front-end around the same orchestration.
