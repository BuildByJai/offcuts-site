import { getFullFixtureData } from "./api-football.js";
import { generateAllMoments } from "./moments-prompt.js";

const MOMENTS_TTL = 60 * 60 * 24 * 30; // a finished match's moments never change

export async function getMomentsForFixture(env, fixtureId) {
  const kv = env.POST_MATCH_CACHE;
  if (!kv) throw new Error("POST_MATCH_CACHE KV namespace is not bound");

  const cacheKey = `moments:${fixtureId}`;
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached;

  const fixtureData = await getFullFixtureData(env, fixtureId);
  const moments = await generateAllMoments(env, fixtureData);
  const payload = {
    homeTeam: fixtureData.fixture.homeTeam,
    awayTeam: fixtureData.fixture.awayTeam,
    moments,
  };
  await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: MOMENTS_TTL });
  return payload;
}
