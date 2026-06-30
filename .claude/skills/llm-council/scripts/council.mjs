#!/usr/bin/env node
/**
 * LLM Council — multi-provider mode.
 *
 * A faithful Node port of the 3-stage orchestration from karpathy/llm-council
 * (backend/council.py + backend/openrouter.py). Queries several real models
 * via OpenRouter, has them peer-rank each other's anonymized answers, then a
 * Chairman model synthesizes a final answer.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... node council.mjs "your question here"
 *   node council.mjs --json "your question"        # machine-readable output
 *   node council.mjs --question-file path.txt       # read question from a file
 *
 * Configuration (env vars, all optional):
 *   OPENROUTER_API_KEY   required — your OpenRouter key
 *   COUNCIL_MODELS       comma-separated model ids (overrides defaults)
 *   CHAIRMAN_MODEL       model id for the final synthesis
 *   OPENROUTER_API_URL   defaults to https://openrouter.ai/api/v1/chat/completions
 */

// --- Configuration (mirrors backend/config.py) ---------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL =
  process.env.OPENROUTER_API_URL ||
  "https://openrouter.ai/api/v1/chat/completions";

const COUNCIL_MODELS = (process.env.COUNCIL_MODELS
  ? process.env.COUNCIL_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
  : [
      "openai/gpt-5.1",
      "google/gemini-3-pro-preview",
      "anthropic/claude-sonnet-4.5",
      "x-ai/grok-4",
    ]);

const CHAIRMAN_MODEL =
  process.env.CHAIRMAN_MODEL || "google/gemini-3-pro-preview";

// --- OpenRouter client (mirrors backend/openrouter.py) -------------------

async function queryModel(model, messages, timeout = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    const message = data.choices[0].message;
    return {
      content: message.content,
      reasoning_details: message.reasoning_details ?? null,
    };
  } catch (e) {
    console.error(`Error querying model ${model}: ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryModelsParallel(models, messages) {
  const responses = await Promise.all(
    models.map((model) => queryModel(model, messages)),
  );
  const out = {};
  models.forEach((model, i) => {
    out[model] = responses[i];
  });
  return out;
}

// --- Stages (mirror backend/council.py) ----------------------------------

async function stage1CollectResponses(userQuery) {
  const messages = [{ role: "user", content: userQuery }];
  const responses = await queryModelsParallel(COUNCIL_MODELS, messages);
  const results = [];
  for (const [model, response] of Object.entries(responses)) {
    if (response !== null) {
      results.push({ model, response: response.content ?? "" });
    }
  }
  return results;
}

async function stage2CollectRankings(userQuery, stage1Results) {
  // Anonymized labels: Response A, Response B, ...
  const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i));
  const labelToModel = {};
  stage1Results.forEach((result, i) => {
    labelToModel[`Response ${labels[i]}`] = result.model;
  });

  const responsesText = stage1Results
    .map((result, i) => `Response ${labels[i]}:\n${result.response}`)
    .join("\n\n");

  // NOTE: This prompt is copied verbatim from karpathy/llm-council.
  const rankingPrompt = `You are evaluating different responses to the following question:

Question: ${userQuery}

Here are the responses from different models (anonymized):

${responsesText}

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

Now provide your evaluation and ranking:`;

  const messages = [{ role: "user", content: rankingPrompt }];
  const responses = await queryModelsParallel(COUNCIL_MODELS, messages);

  const results = [];
  for (const [model, response] of Object.entries(responses)) {
    if (response !== null) {
      const fullText = response.content ?? "";
      results.push({
        model,
        ranking: fullText,
        parsed_ranking: parseRankingFromText(fullText),
      });
    }
  }
  return { stage2Results: results, labelToModel };
}

async function stage3SynthesizeFinal(userQuery, stage1Results, stage2Results) {
  const stage1Text = stage1Results
    .map((r) => `Model: ${r.model}\nResponse: ${r.response}`)
    .join("\n\n");
  const stage2Text = stage2Results
    .map((r) => `Model: ${r.model}\nRanking: ${r.ranking}`)
    .join("\n\n");

  // NOTE: This prompt is copied verbatim from karpathy/llm-council.
  const chairmanPrompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${userQuery}

STAGE 1 - Individual Responses:
${stage1Text}

STAGE 2 - Peer Rankings:
${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;

  const response = await queryModel(CHAIRMAN_MODEL, [
    { role: "user", content: chairmanPrompt },
  ]);
  if (response === null) {
    return {
      model: CHAIRMAN_MODEL,
      response: "Error: Unable to generate final synthesis.",
    };
  }
  return { model: CHAIRMAN_MODEL, response: response.content ?? "" };
}

function parseRankingFromText(rankingText) {
  if (rankingText.includes("FINAL RANKING:")) {
    const section = rankingText.split("FINAL RANKING:")[1] ?? "";
    const numbered = section.match(/\d+\.\s*Response [A-Z]/g);
    if (numbered) {
      return numbered.map((m) => m.match(/Response [A-Z]/)[0]);
    }
    const matches = section.match(/Response [A-Z]/g);
    if (matches) return matches;
  }
  return rankingText.match(/Response [A-Z]/g) ?? [];
}

function calculateAggregateRankings(stage2Results, labelToModel) {
  const positions = {};
  for (const ranking of stage2Results) {
    const parsed = parseRankingFromText(ranking.ranking);
    parsed.forEach((label, idx) => {
      const model = labelToModel[label];
      if (model) {
        (positions[model] ||= []).push(idx + 1);
      }
    });
  }
  const aggregate = Object.entries(positions)
    .filter(([, p]) => p.length > 0)
    .map(([model, p]) => ({
      model,
      average_rank: Math.round((p.reduce((a, b) => a + b, 0) / p.length) * 100) / 100,
      rankings_count: p.length,
    }));
  aggregate.sort((a, b) => a.average_rank - b.average_rank);
  return aggregate;
}

async function runFullCouncil(userQuery) {
  const stage1Results = await stage1CollectResponses(userQuery);
  if (stage1Results.length === 0) {
    return {
      stage1Results: [],
      stage2Results: [],
      stage3Result: {
        model: "error",
        response: "All models failed to respond. Please try again.",
      },
      metadata: {},
    };
  }
  const { stage2Results, labelToModel } = await stage2CollectRankings(
    userQuery,
    stage1Results,
  );
  const aggregateRankings = calculateAggregateRankings(
    stage2Results,
    labelToModel,
  );
  const stage3Result = await stage3SynthesizeFinal(
    userQuery,
    stage1Results,
    stage2Results,
  );
  return {
    stage1Results,
    stage2Results,
    stage3Result,
    metadata: { label_to_model: labelToModel, aggregate_rankings: aggregateRankings },
  };
}

// --- CLI -----------------------------------------------------------------

function parseArgs(argv) {
  const opts = { json: false, question: null, questionFile: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--question-file") opts.questionFile = argv[++i];
    else rest.push(a);
  }
  if (!opts.questionFile) opts.question = rest.join(" ").trim();
  return opts;
}

function renderMarkdown({ stage1Results, stage2Results, stage3Result, metadata }) {
  const lines = [];
  lines.push("# LLM Council\n");
  lines.push("## Stage 1 — Individual responses\n");
  for (const r of stage1Results) {
    lines.push(`### ${r.model}\n\n${r.response}\n`);
  }
  lines.push("## Stage 2 — Peer rankings (anonymized)\n");
  for (const r of stage2Results) {
    lines.push(`### ${r.model}\n\n${r.ranking}\n`);
  }
  lines.push("## Aggregate ranking\n");
  const map = metadata.label_to_model || {};
  if (Object.keys(map).length) {
    lines.push(
      "Label → model: " +
        Object.entries(map)
          .map(([k, v]) => `${k} = ${v}`)
          .join(", ") +
        "\n",
    );
  }
  for (const a of metadata.aggregate_rankings || []) {
    lines.push(`- ${a.model} — avg rank ${a.average_rank} (${a.rankings_count} votes)`);
  }
  lines.push("\n## Stage 3 — Chairman synthesis\n");
  lines.push(`**Chairman: ${stage3Result.model}**\n\n${stage3Result.response}\n`);
  return lines.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!OPENROUTER_API_KEY) {
    console.error(
      "Error: OPENROUTER_API_KEY is not set. Export it before running, e.g.\n" +
        "  OPENROUTER_API_KEY=sk-... node council.mjs \"your question\"",
    );
    process.exit(2);
  }
  let question = opts.question;
  if (opts.questionFile) {
    const fs = await import("node:fs/promises");
    question = (await fs.readFile(opts.questionFile, "utf8")).trim();
  }
  if (!question) {
    console.error('Error: no question provided. Usage: node council.mjs "your question"');
    process.exit(2);
  }

  const result = await runFullCouncil(question);
  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(renderMarkdown(result) + "\n");
  }
}

// Only run when invoked directly (allows importing the functions for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export {
  queryModel,
  queryModelsParallel,
  stage1CollectResponses,
  stage2CollectRankings,
  stage3SynthesizeFinal,
  parseRankingFromText,
  calculateAggregateRankings,
  runFullCouncil,
  COUNCIL_MODELS,
  CHAIRMAN_MODEL,
};
