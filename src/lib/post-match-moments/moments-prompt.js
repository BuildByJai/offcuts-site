// Two-pass Anthropic pipeline for the Post-Match Moments tool.
//
// v2: input is a pasted match report (prose), not API-Football data. Live
// testing showed the API-Football version produced poor/"random" player
// positions — categorical stats (shot counts, cards, subs) have no
// descriptive texture for Claude to reconstruct a scene from. A real match
// report already describes who did what, where, and how, which is what the
// shape-generation pass actually needs.
//
// Pass 1 (generateMoments): match label + report text -> 4-8 talking-point
// moments with a headline/script/subtitle and a prose `shape_description`.
// Pass 2 (generateDots): a narrowly-scoped pass per moment that converts
// `shape_description` into ~8-15 before/after dot coordinates, grounded in
// what the report specifically says — see the coordinate contract comment
// at the top of tools/post-match-moments/index.html:
//   x: 0-100 across the pitch width, y: 0-100 along the pitch length,
//   "team" is "home" or "away" for dot styling only.
//
// FLAG (manual setup needed): env.ANTHROPIC_API_KEY must be set as a Worker
// secret (`wrangler secret put ANTHROPIC_API_KEY`).

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-5";

async function callClaude(env, { system, messages, tool, maxTokens, effort }) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      output_config: { effort },
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("Anthropic API refused the request");
  }
  const toolUse = data.content.find((b) => b.type === "tool_use" && b.name === tool.name);
  if (!toolUse) throw new Error("Anthropic API did not return the expected tool call");
  return toolUse.input;
}

// ---------- pass 1: moments ----------

const MOMENTS_TOOL = {
  name: "record_moments",
  description: "Record the talking-point moments extracted from this match report.",
  input_schema: {
    type: "object",
    properties: {
      moments: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            minute: {
              type: ["integer", "null"],
              description: "Minute the moment happened. Use the exact minute if the report states one; otherwise your best approximate integer from context (e.g. 'just before half-time' ~44). Only null if there's truly no time indication.",
            },
            headline: { type: "string", description: "Short, caps-style headline for an on-grass overlay, under 40 characters" },
            script: { type: "string", description: "1-2 sentence voiceover line" },
            subtitle: { type: "string", description: "Shorter version of the script for an on-screen subtitle, under 60 characters" },
            focal_players: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  team: { type: "string", enum: ["home", "away"], description: "First club named in the match label is 'home', second is 'away' — for dot-coloring only." },
                  number: { type: "integer", description: "Shirt number — only include this field if the report actually states one; most reports won't, and that's fine." },
                },
                required: ["name", "team"],
              },
            },
            shape_description: {
              type: "string",
              description: "Prose description of the illustrative before/after positioning, grounded specifically in what the report says happened (literal movement, e.g. 'burst past two defenders down the left before cutting inside'). Always illustrative, never tracked positional fact. If the report doesn't describe enough detail for this moment, say so and describe a simple, static, generic arrangement instead of inventing movement.",
            },
          },
          required: ["minute", "headline", "script", "subtitle", "focal_players", "shape_description"],
        },
      },
    },
    required: ["moments"],
  },
};

export async function generateMoments(env, matchLabel, reportText) {
  const system = `You are a football analyst writing short, punchy talking points for a TikTok-style highlights account. You're given a match label and the full prose text of a real match report for one finished football match. Pick 4-8 moments (goals, key chances, tactical shifts, defensive lapses, big saves, momentum swings, substitution impacts) that make good short-form talking points.

Every moment must be grounded in what the report actually says — never invent events, scorelines, or stats the text doesn't support. Headlines are short, punchy, caps-style. Scripts are natural spoken voiceover lines, 1-2 sentences. See each field's schema description for specifics on minute, focal_players, and shape_description.`;

  const messages = [
    {
      role: "user",
      content: `Match: ${matchLabel}\n\nMatch report:\n${reportText}\n\nExtract 4-8 talking-point moments and call record_moments.`,
    },
  ];

  const result = await callClaude(env, {
    system,
    messages,
    tool: MOMENTS_TOOL,
    maxTokens: 4096,
    effort: "high",
  });
  return result.moments;
}

// ---------- pass 2: coordinates ----------

const DOTS_TOOL = {
  name: "record_dots",
  description: "Record before/after pitch coordinates for the players involved in this moment.",
  input_schema: {
    type: "object",
    properties: {
      dots: {
        type: "array",
        minItems: 8,
        maxItems: 15,
        items: {
          type: "object",
          properties: {
            number: { type: "integer", description: "On-pitch dot label. Use the player's real shirt number only if focal_players stated one; otherwise assign a simple sequential placeholder (1, 2, 3, ...) — it's just a marker, not a real shirt number." },
            team: { type: "string", enum: ["home", "away"] },
            before: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
            after: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
          },
          required: ["number", "team", "before", "after"],
        },
      },
    },
    required: ["dots"],
  },
};

export async function generateDots(env, moment, matchLabel) {
  const system = `You convert a prose description of illustrative football positioning into pitch coordinates for one moment. Coordinate system: x is 0-100 across the pitch width (0 = left touchline, 100 = right touchline), y is 0-100 along the pitch length (0 = top goal line, 100 = bottom goal line). Attacking direction is your call to make the shape read naturally — just be internally consistent within this one moment.

Ground every focal/named player's position in what the shape description specifically says — if it describes a literal movement (e.g. "bursts down the left and cuts inside"), their before/after coordinates should visibly show that movement, not a generic default. Only players the shape description or focal_players list actually names need deliberate, description-grounded placement.

Every other dot (fill out to 8-15 total) is an unnamed teammate — place these in a simple, neutral resting formation (a normal defensive/midfield/attacking spread for each side, facing each other) rather than scattering them or inventing individual movement the text never described. If the shape description itself is thin or vague, don't compensate by fabricating a dramatic shape — default the whole moment to a simple, mostly-static arrangement (small or no before/after difference) instead.

This is illustrative sketch data, not tracked positions — plausible, text-grounded relative positioning is all that's required, not tactical precision.`;

  const messages = [
    {
      role: "user",
      content: `Match: ${matchLabel}\n\nMoment shape description:\n${moment.shape_description}\n\nFocal players: ${JSON.stringify(moment.focal_players)}\n\nCall record_dots with before/after coordinates for 8-15 players — the named focal players placed deliberately per the description, the rest in a neutral resting formation.`,
    },
  ];

  const result = await callClaude(env, {
    system,
    messages,
    tool: DOTS_TOOL,
    maxTokens: 2048,
    effort: "medium",
  });
  return result.dots;
}

// ---------- orchestration ----------

export async function generateAllMoments(env, matchLabel, reportText) {
  const moments = await generateMoments(env, matchLabel, reportText);
  return Promise.all(
    moments.map(async (m) => {
      const dots = await generateDots(env, m, matchLabel);
      return { minute: m.minute, headline: m.headline, script: m.script, subtitle: m.subtitle, dots };
    })
  );
}
