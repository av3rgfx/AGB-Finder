---
name: llm-council
description: Use when the user wants several independent opinions deliberated and synthesized rather than a single answer — convening a "council" or "panel", getting multiple takes that then peer-review and rank each other, pressure-testing a high-stakes or ambiguous decision, comparing answers from multiple models, or asking for a "council" / "second opinion" / "deliberation". Implements the 3-stage LLM Council (independent opinions → anonymized peer ranking → chairman synthesis). Two modes: Claude subagents (no API key) or real multi-provider models via OpenRouter.
user-invocable: true
argument-hint: "[question to put to the council]"
---

# LLM Council

A port of [karpathy/llm-council](https://github.com/karpathy/llm-council) into a
Claude Code skill. Instead of answering a hard question with one pass, you
convene a **council**: several members answer independently, then they
peer-review and rank each other's (anonymized) answers, then a **Chairman**
synthesizes the collective wisdom into one final answer.

## When to use

Use for questions where a single answer is risky or where diverse perspectives
help: architectural decisions, design trade-offs, ambiguous requirements,
strategy, judgement calls, "what am I missing?", or any time the user explicitly
asks for a council / panel / multiple opinions / a second opinion.

Don't use it for simple factual lookups, mechanical edits, or anything where one
direct answer is obviously sufficient — the council is slower and more expensive.

## Two modes

- **Subagent mode (default, no setup):** council members are independent Claude
  subagents. Diversity comes from independent reasoning. Works anywhere Claude
  Code can dispatch subagents. **Use this unless the user asks for real other
  providers.**
- **Multi-provider mode (optional):** real different models (GPT, Gemini, Claude,
  Grok, …) via OpenRouter, using `scripts/council.mjs`. Most faithful to the
  original app's cross-provider diversity. Requires `OPENROUTER_API_KEY`. See
  `reference/openrouter-mode.md`.

Pick multi-provider mode only when the user explicitly wants real other models or
sets `OPENROUTER_API_KEY`; otherwise use subagent mode.

---

## Subagent mode — procedure

Let `QUESTION` be the user's question. Default council size is **4 members**
(adjust if the user asks). Run the three stages in order.

### Stage 1 — Independent opinions

Dispatch the council members **in parallel** (one batch of subagent calls). Give
each member *only* the question, with no shared context, so answers stay
independent:

> Answer the following question as well as you can. Be specific and complete.
>
> Question: `QUESTION`

Collect each member's answer. Label them anonymously `Response A`, `Response B`,
… and keep a private mapping of label → member (member 1, member 2, …). Do not
reveal the mapping to the members.

### Stage 2 — Anonymized peer ranking

For **each** member, dispatch a review task (in parallel) that shows that member
all the anonymized responses and asks for a ranking. Use this prompt **verbatim**
(it is copied from the original project — the strict `FINAL RANKING:` format is
what makes the rankings parseable):

```
You are evaluating different responses to the following question:

Question: {QUESTION}

Here are the responses from different models (anonymized):

{RESPONSES_TEXT}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:
```

Where `{RESPONSES_TEXT}` is every Stage 1 answer formatted as:

```
Response A:
<answer A>

Response B:
<answer B>
...
```

Parse each member's `FINAL RANKING:` block into an ordered list of labels.

### Aggregate ranking

For each response label, average its position across all members' rankings
(position 1 = best). Map labels back to members. Lower average = better. Present
the aggregate so the user sees which answers the council favored. (A member
ranking its own answer is fine — it's anonymized, mirroring the original.)

### Stage 3 — Chairman synthesis

Act as the Chairman yourself (or dispatch one Chairman subagent). Use this prompt
**verbatim**:

```
You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: {QUESTION}

STAGE 1 - Individual Responses:
{STAGE1_TEXT}

STAGE 2 - Peer Rankings:
{STAGE2_TEXT}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:
```

Where `{STAGE1_TEXT}` lists each member's answer (`Model: <member>\nResponse: …`)
and `{STAGE2_TEXT}` lists each member's full ranking text
(`Model: <member>\nRanking: …`).

### Present the result

Give the user:
1. **Chairman's final answer** (the headline).
2. **Aggregate ranking** (which answers the council favored).
3. The individual Stage 1 answers and Stage 2 rankings, collapsed/secondary, so
   they can inspect the deliberation if they want.

---

## Multi-provider mode — quickstart

```bash
export OPENROUTER_API_KEY=sk-or-...
node .claude/skills/llm-council/scripts/council.mjs "your question here"
# add --json for machine-readable output
```

Configure the panel with `COUNCIL_MODELS` (comma-separated OpenRouter ids) and
`CHAIRMAN_MODEL`. The script runs the same three stages with real models and
prints Stage 1 answers, Stage 2 rankings, the aggregate, and the Chairman's final
answer. Full details and defaults are in `reference/openrouter-mode.md`.

## Credits

Concept and stage prompts: Andrej Karpathy's
[llm-council](https://github.com/karpathy/llm-council) (the prompts in this skill
are reproduced verbatim from that project).
