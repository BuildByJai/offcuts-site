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

// API-Football league id for the Premier League. Like the team ids in
// teams.js, this is the commonly-published value, not verified live here —
// a wrong id would show up as an empty/mismatched fixture list rather than
// fail silently, so it'll be obvious if it's off.
const PREMIER_LEAGUE_ID = 39;

const FIXTURES_LIST_TTL = 6 * 60 * 60; // finished-fixture lists change slowly
const FULL_MATCH_TTL = 60 * 60 * 24 * 30; // a finished match's own data never changes

// API-Football's `season` param is the year a season starts; the Premier
// League season runs roughly Aug-May, so before July still belongs to the
// season that started the previous calendar year.
function currentSeasonStartYear(date = new Date()) {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 6 ? year : year - 1; // getUTCMonth() is 0-indexed; 6 = July
}

function mapFixtures(raw) {
  return raw.map((f) => ({
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
}

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

// Free-tier API-Football has no `last`/`next` param (Pro-only), so this
// pulls the current season's finished fixtures for the team and sorts/slices
// client-side. Early in a season there may not be `last` finished matches
// yet, so it falls back to also pulling the previous season when short.
export async function getRecentFixturesForTeam(env, teamId, { last = 10 } = {}) {
  return cached(env, `fixtures:team:${teamId}`, FIXTURES_LIST_TTL, async () => {
    const season = currentSeasonStartYear();
    let raw = await apiFootballFetch(env, "/fixtures", {
      team: teamId,
      league: PREMIER_LEAGUE_ID,
      season,
      status: "FT",
    });

    if (raw.length < last) {
      const prevRaw = await apiFootballFetch(env, "/fixtures", {
        team: teamId,
        league: PREMIER_LEAGUE_ID,
        season: season - 1,
        status: "FT",
      });
      raw = raw.concat(prevRaw);
    }

    return mapFixtures(raw)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, last);
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
