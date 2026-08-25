// API-Football client for the Post-Match Moments tool.
//
// FLAG (manual setup needed):
//   - env.API_FOOTBALL_KEY must be set as a Worker secret
//     (`wrangler secret put API_FOOTBALL_KEY`). The brief says to reuse the
//     key from the Golden Boot Tracker work if still valid, but no such tool
//     exists in this repo/history — confirm a live key before shipping.
//   - env.API_FOOTBALL_HOST defaults to the direct api-sports.io host below,
//     which matches the "100 req/day, 10/min free tier" described in the
//     brief. If the reused account is a RapidAPI subscription instead, set
//     API_FOOTBALL_HOST to "api-football-v1.p.rapidapi.com" and this client
//     will send the x-rapidapi-key/x-rapidapi-host headers instead.
//   - Requires a KV namespace bound as env.POST_MATCH_CACHE, created
//     manually in the Cloudflare dashboard first (see wrangler.jsonc note).

const DEFAULT_HOST = "v3.football.api-sports.io";
const RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com";

const FIXTURES_LIST_TTL = 6 * 60 * 60; // finished-fixture lists change slowly
const FULL_MATCH_TTL = 60 * 60 * 24 * 30; // a finished match's own data never changes

async function apiFootballFetch(env, path, params) {
  if (!env.API_FOOTBALL_KEY) {
    throw new Error("API_FOOTBALL_KEY is not configured");
  }
  const host = env.API_FOOTBALL_HOST || DEFAULT_HOST;
  const url = new URL(`https://${host}${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const headers = host === RAPIDAPI_HOST
    ? { "x-rapidapi-key": env.API_FOOTBALL_KEY, "x-rapidapi-host": RAPIDAPI_HOST }
    : { "x-apisports-key": env.API_FOOTBALL_KEY };

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`API-Football ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const body = await res.json();
  if (Array.isArray(body.errors) ? body.errors.length : Object.keys(body.errors || {}).length) {
    throw new Error(`API-Football ${path} returned errors: ${JSON.stringify(body.errors)}`);
  }
  return body.response;
}

async function cached(env, key, ttlSeconds, load) {
  const kv = env.POST_MATCH_CACHE;
  if (!kv) throw new Error("POST_MATCH_CACHE KV namespace is not bound");

  const existing = await kv.get(key, "json");
  if (existing) return existing;

  const value = await load();
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  return value;
}

export async function getRecentFixturesForTeam(env, teamId, { last = 10 } = {}) {
  return cached(env, `fixtures:team:${teamId}`, FIXTURES_LIST_TTL, async () => {
    const response = await apiFootballFetch(env, "/fixtures", {
      team: teamId,
      status: "FT",
      last,
    });
    return response.map((f) => ({
      id: f.fixture.id,
      date: f.fixture.date,
      competition: f.league?.name,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      homeTeamId: f.teams.home.id,
      awayTeamId: f.teams.away.id,
      homeScore: f.goals.home,
      awayScore: f.goals.away,
    }));
  });
}

// Pulls fixture + events + statistics + players + lineups in one bundle
// (~5 API calls when uncached, 0 when this fixture has been viewed before).
export async function getFullFixtureData(env, fixtureId) {
  return cached(env, `fixture:${fixtureId}:full`, FULL_MATCH_TTL, async () => {
    const [fixtures, events, statistics, players, lineups] = await Promise.all([
      apiFootballFetch(env, "/fixtures", { id: fixtureId }),
      apiFootballFetch(env, "/fixtures/events", { fixture: fixtureId }),
      apiFootballFetch(env, "/fixtures/statistics", { fixture: fixtureId }),
      apiFootballFetch(env, "/fixtures/players", { fixture: fixtureId }),
      apiFootballFetch(env, "/fixtures/lineups", { fixture: fixtureId }),
    ]);

    const fixture = fixtures[0];
    if (!fixture) throw new Error(`Fixture ${fixtureId} not found`);

    return {
      fixture: {
        id: fixture.fixture.id,
        date: fixture.fixture.date,
        competition: fixture.league?.name,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
      },
      events,
      statistics,
      players,
      lineups,
    };
  });
}
