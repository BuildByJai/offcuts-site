import { generateAllMoments } from "./moments-prompt.js";

// Caching is a nice-to-have now, not load-bearing: v1 needed KV to protect
// API-Football's daily quota, but v2 has no API-Football calls left. This
// just saves re-spending Anthropic tokens if the same report gets
// resubmitted (e.g. a page reload). If POST_MATCH_CACHE isn't bound, the
// pipeline still works — it just skips caching.
const MOMENTS_TTL = 60 * 60 * 24 * 30;

async function hashInput(matchLabel, reportText) {
  const data = new TextEncoder().encode(`${matchLabel}\n\n${reportText}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateMomentsFromReport(env, matchLabel, reportText) {
  const kv = env.POST_MATCH_CACHE;
  const cacheKey = kv ? `moments:report:${await hashInput(matchLabel, reportText)}` : null;

  if (cacheKey) {
    const cached = await kv.get(cacheKey, "json");
    if (cached) return cached;
  }

  const moments = await generateAllMoments(env, matchLabel, reportText);
  const payload = { matchLabel, moments };

  if (cacheKey) {
    await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: MOMENTS_TTL });
  }
  return payload;
}
