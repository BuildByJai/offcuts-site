import { PLAYER_POOL, MAX_SQUAD, MAX_PER_TEAM, BUDGET_CAP } from "./lib/players.js";
import { generateMomentsFromReport } from "./lib/post-match-moments/pipeline.js";

const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function generateSquadId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleDraft(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const playerIds = Array.isArray(body.playerIds) ? body.playerIds : null;

  if (!displayName) return json({ error: "Display name is required" }, 400);
  if (displayName.length > 40) return json({ error: "Display name must be 40 characters or fewer" }, 400);
  if (!playerIds || playerIds.length !== MAX_SQUAD) {
    return json({ error: `Squad must have exactly ${MAX_SQUAD} players` }, 400);
  }
  if (new Set(playerIds).size !== playerIds.length) {
    return json({ error: "Duplicate players are not allowed" }, 400);
  }

  const players = playerIds.map((id) => PLAYER_POOL.find((p) => p.id === id));
  if (players.some((p) => !p)) return json({ error: "Unknown player in squad" }, 400);

  const teamCounts = {};
  let totalCost = 0;
  for (const p of players) {
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    totalCost += p.cost;
  }
  if (Object.values(teamCounts).some((c) => c > MAX_PER_TEAM)) {
    return json({ error: `Max ${MAX_PER_TEAM} players from the same team` }, 400);
  }
  if (totalCost > BUDGET_CAP) {
    return json({ error: `Squad costs ${totalCost}cr, over the ${BUDGET_CAP}cr budget` }, 400);
  }

  let squadId;
  for (let attempt = 0; attempt < 5 && !squadId; attempt++) {
    const candidate = generateSquadId();
    const existing = await env.FANTASY_SQUADS.get(candidate);
    if (!existing) squadId = candidate;
  }
  if (!squadId) return json({ error: "Couldn't generate a squad ID — try again" }, 500);

  const record = {
    displayName,
    players: players.map((p) => ({ id: p.id, name: p.name, team: p.team })),
    createdAt: new Date().toISOString(),
  };
  await env.FANTASY_SQUADS.put(squadId, JSON.stringify(record));

  return json({ squadId });
}

function scorePlayer(stats) {
  const s = stats || { goals: 0, assists: 0, yellow: 0, red: 0 };
  return s.goals * 4 + s.assists * 2 - s.yellow * 1 - s.red * 3;
}

// Falls back to this when FANTASY_LEADERBOARD_CACHE is empty, i.e. before the
// scheduled sync worker (Phase 4) exists to populate it. Once that worker is
// writing to the cache, its precomputed version is used instead (see callers).
async function computeLiveLeaderboard(env) {
  const list = await env.FANTASY_SQUADS.list();
  const squads = await Promise.all(
    list.keys.map(async (key) => {
      const raw = await env.FANTASY_SQUADS.get(key.name);
      return raw ? { squadId: key.name, ...JSON.parse(raw) } : null;
    })
  );

  const scored = await Promise.all(
    squads.filter(Boolean).map(async (squad) => {
      const statsEntries = await Promise.all(
        squad.players.map((p) => env.FANTASY_PLAYER_STATS.get(p.id, "json"))
      );
      const points = statsEntries.reduce((sum, s) => sum + scorePlayer(s), 0);
      return { squadId: squad.squadId, displayName: squad.displayName, points, createdAt: squad.createdAt };
    })
  );

  scored.sort((a, b) => b.points - a.points || new Date(a.createdAt) - new Date(b.createdAt));
  return scored.map((entry, i) => ({ squadId: entry.squadId, displayName: entry.displayName, points: entry.points, rank: i + 1 }));
}

async function getLeaderboard(env) {
  const cached = await env.FANTASY_LEADERBOARD_CACHE.get("latest", "json");
  if (cached && cached.length > 0) return cached;
  return computeLiveLeaderboard(env);
}

async function handleGetSquad(squadId, env) {
  const raw = await env.FANTASY_SQUADS.get(squadId);
  if (!raw) return json({ error: "Squad not found" }, 404);
  const squad = JSON.parse(raw);

  const statsEntries = await Promise.all(
    squad.players.map((p) => env.FANTASY_PLAYER_STATS.get(p.id, "json"))
  );

  let points = 0;
  const players = squad.players.map((p, i) => {
    const playerPoints = scorePlayer(statsEntries[i]);
    points += playerPoints;
    return { ...p, stats: statsEntries[i] || { goals: 0, assists: 0, yellow: 0, red: 0 }, points: playerPoints };
  });

  const leaderboard = await getLeaderboard(env);
  const entry = leaderboard.find((e) => e.squadId === squadId);

  return json({
    squadId,
    displayName: squad.displayName,
    createdAt: squad.createdAt,
    players,
    points,
    rank: entry ? entry.rank : null,
    totalSquads: leaderboard.length,
  });
}

async function handleLeaderboard(env) {
  return json(await getLeaderboard(env));
}

async function handlePmmMoments(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const matchLabel = typeof body.matchLabel === "string" ? body.matchLabel.trim() : "";
  const reportText = typeof body.reportText === "string" ? body.reportText.trim() : "";

  if (!matchLabel) return json({ error: "Match label is required" }, 400);
  if (matchLabel.length > 200) return json({ error: "Match label must be 200 characters or fewer" }, 400);
  if (!reportText) return json({ error: "Match report text is required" }, 400);
  if (reportText.length > 30000) return json({ error: "Match report must be 30,000 characters or fewer" }, 400);

  try {
    const data = await generateMomentsFromReport(env, matchLabel, reportText);
    return json(data);
  } catch (err) {
    return json({ error: err.message || "Could not generate moments" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/draft" && request.method === "POST") {
      return handleDraft(request, env);
    }
    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      return handleLeaderboard(env);
    }
    const squadMatch = url.pathname.match(/^\/api\/squad\/([^/]+)$/);
    if (squadMatch && request.method === "GET") {
      return handleGetSquad(decodeURIComponent(squadMatch[1]), env);
    }
    if (url.pathname === "/api/pmm/moments" && request.method === "POST") {
      return handlePmmMoments(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
