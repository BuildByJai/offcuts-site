// Two-pass Anthropic pipeline for the Post-Match Moments tool.
//
// Pass 1 (generateMoments): raw fixture data (events, stats, lineups, player
// ratings) -> 4-8 talking-point moments with a headline/script/subtitle and
// a prose `shape_description` of the illustrative positioning.
// Pass 2 (generateDots): a narrowly-scoped pass per moment that converts
// `shape_description` + the real lineup into ~10-15 before/after dot
// coordinates, in the coordinate system Track A's renderer expects (see the
// contract comment at the top of tools/post-match-moments/index.html):
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
  description: "Record the talking-point moments extracted from this match.",
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
            minute: { type: "integer", description: "Minute the moment happened" },
            headline: { type: "string", description: "Short, caps-style headline for an on-grass overlay, under 40 characters" },
            script: { type: "string", description: "1-2 sentence voiceover line" },
            subtitle: { type: "string", description: "Shorter version of the script for an on-screen subtitle, under 60 characters" },
            focal_players: {
              type: "array",
              items: { type: "object", properties: { number: { type: "integer" }, team: { type: "string", enum: ["home", "away"] }, name: { type: "string" } }, required: ["number", "team"] },
            },
            shape_description: {
              type: "string",
              description: "Prose description of the illustrative before/after positioning for this moment — which players, roughly where on the pitch, and how they move. Always framed as illustrative, never as tracked positional fact.",
            },
          },
          required: ["minute", "headline", "script", "subtitle", "focal_players", "shape_description"],
        },
      },
    },
    required: ["moments"],
  },
};

function summarizeForPrompt(fixtureData) {
  const { fixture, events, statistics, players, lineups } = fixtureData;
  return {
    fixture,
    events: events.map((e) => ({
      minute: e.time.elapsed,
      type: e.type,
      detail: e.detail,
      team: e.team?.name,
      player: e.player?.name,
      assist: e.assist?.name,
    })),
    statistics: statistics.map((s) => ({
      team: s.team.name,
      stats: Object.fromEntries((s.statistics || []).map((row) => [row.type, row.value])),
    })),
    ratings: players.flatMap((teamBlock) =>
      (teamBlock.players || []).map((p) => ({
        team: teamBlock.team.name,
        number: p.player.number,
        name: p.player.name,
        rating: p.statistics?.[0]?.games?.rating,
      }))
    ),
    lineups: lineups.map((l) => ({
      team: l.team.name,
      formation: l.formation,
      startXI: (l.startXI || []).map((s) => ({ number: s.player.number, name: s.player.name, position: s.player.pos })),
    })),
  };
}

export async function generateMoments(env, fixtureData) {
  const summary = summarizeForPrompt(fixtureData);
  const system = `You are a football analyst writing short, punchy talking points for a TikTok-style highlights account. You are given real match events, team statistics, player ratings, and lineups for one finished Premier League fixture. Pick 4-8 moments (goals, key chances, tactical shifts, defensive lapses, substitution impacts, momentum swings) that make good short-form talking points.

Every moment must be grounded in the given data — do not invent events, scorelines, or stats that aren't present. The "shape_description" field is an illustrative sketch of what likely happened positionally, clearly understood to be your interpretation, not tracked positional data (this API has no shot/pass coordinates). Headlines are short, punchy, caps-style. Scripts are natural spoken voiceover lines, 1-2 sentences.`;

  const messages = [
    {
      role: "user",
      content: `Match data (JSON):\n${JSON.stringify(summary)}\n\nExtract 4-8 talking-point moments and call record_moments.`,
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
            number: { type: "integer", description: "Shirt number" },
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

export async function generateDots(env, moment, fixtureData) {
  const lineups = fixtureData.lineups.map((l, i) => ({
    team: i === 0 ? "home" : "away",
    teamName: l.team.name,
    formation: l.formation,
    startXI: (l.startXI || []).map((s) => ({ number: s.player.number, position: s.player.pos })),
  }));

  const system = `You convert a prose description of illustrative football positioning into pitch coordinates. Coordinate system: x is 0-100 across the pitch width (0 = left touchline, 100 = right touchline), y is 0-100 along the pitch length (0 = top goal line, 100 = bottom goal line). Return only coordinates for 8-15 players — the ones relevant to this moment, not the full 22. Attacking direction and which end is "top" are your call to make the shape read naturally for the description given; just be internally consistent within this one moment. This is illustrative sketch data, not tracked positions — plausible relative positioning is all that's required, not tactical precision.`;

  const messages = [
    {
      role: "user",
      content: `Team lineups (JSON):\n${JSON.stringify(lineups)}\n\nMoment shape description:\n${moment.shape_description}\n\nFocal players: ${JSON.stringify(moment.focal_players)}\n\nCall record_dots with before/after coordinates for the 8-15 players involved.`,
    },
  ];

  const result = await callClaude(env, {
    system,
    messages,
    tool: DOTS_TOOL,
    maxTokens: 2048,
    effort: "low",
  });
  return result.dots;
}

// ---------- orchestration ----------

export async function generateAllMoments(env, fixtureData) {
  const moments = await generateMoments(env, fixtureData);
  return Promise.all(
    moments.map(async (m) => {
      const dots = await generateDots(env, m, fixtureData);
      return { minute: m.minute, headline: m.headline, script: m.script, subtitle: m.subtitle, dots };
    })
  );
}
