// Chapterlands anonymous event counts (Gate A).
//
// What is stored: an event name, a random player id made on the device (not
// linked to anything: no name, no IP, no location), and for some events the
// book, the street and the street's position in the book. That's it.
//
// Storage: Workers Analytics Engine (binding CHAPTERLANDS_EVENTS in
// wrangler.jsonc). The dataset is created automatically on the first write;
// nothing to set up in the dashboard. Free plan: 100,000 events a day.
//
// Reading the numbers: /api/chapterlands/stats?key=… needs three Worker
// secrets (see README in docs/chapterlands/tracking.md):
//   CF_ACCOUNT_ID, CF_ANALYTICS_TOKEN (an API token with "Account Analytics: Read"),
//   CHAPTERLANDS_STATS_KEY (any password you choose, used in the ?key= param).

const EVENTS = new Set([
  "session-start", "chapter-read", "check-passed", "check-failed", "street-unlocked",
  "street-played", "sky-run", "vault", "tower-climbed", "fog-lifted", "quest-step",
  "quest-complete", "library-card-opened", "lights-out", "rested", "cafe-entered",
  "matcha-bought", "matcha-free-claimed", "matcha-pickup", "guest-art-viewed",
]);
const ID_RE = /^[A-Za-z0-9]{8,16}$/;
const SLUG_RE = /^[a-z0-9-]{0,40}$/;
const DATASET = "chapterlands_events";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export async function handleChapterlandsEvents(request, env) {
  if (!env.CHAPTERLANDS_EVENTS) return new Response(null, { status: 204 });
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: "bad body" }, 400); }
  const list = Array.isArray(body && body.events) ? body.events.slice(0, 40) : [];
  const player = String((body && body.p) || "");
  if (!ID_RE.test(player)) return json({ error: "bad id" }, 400);
  let n = 0;
  for (const ev of list) {
    const e = String(ev && ev.e || "");
    if (!EVENTS.has(e)) continue;
    const book = SLUG_RE.test(String(ev.b || "")) ? String(ev.b || "") : "";
    const street = SLUG_RE.test(String(ev.s || "")) ? String(ev.s || "") : "";
    const idx = Number.isFinite(ev.i) ? Math.max(-1, Math.min(99, Math.round(ev.i))) : -1;
    const day = Number.isFinite(ev.d) ? Math.round(ev.d) : Math.floor(Date.now() / 86400000);
    env.CHAPTERLANDS_EVENTS.writeDataPoint({ indexes: [e], blobs: [e, player, book, street], doubles: [idx, day] });
    n++;
  }
  return json({ ok: n });
}

async function sql(env, query) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST", headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` }, body: query,
  });
  if (!r.ok) throw new Error(`SQL API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const out = await r.json();
  return out.data || [];
}

function page(title, inner) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.5 Inter,system-ui,sans-serif;background:#FAFAF8;color:#181818;max-width:760px;margin:30px auto;padding:0 16px}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin:10px 0 24px}td,th{border-bottom:1px solid #E3E1DA;padding:6px 8px;text-align:left}th{font:12px 'JetBrains Mono',monospace;color:#5C5C58}.big{font-size:28px;font-weight:700;color:#156534}.ok{color:#156534}.no{color:#a33}code{background:#E9F3ED;padding:1px 5px;border-radius:4px}</style>
<h1>${title}</h1>${inner}`, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function handleChapterlandsStats(request, env) {
  const url = new URL(request.url);
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN || !env.CHAPTERLANDS_STATS_KEY) {
    return page("Chapterlands stats: not set up yet", `<p>Events are being collected. To read them here, add three Worker secrets:</p>
<ul><li><code>CF_ACCOUNT_ID</code>: your Cloudflare account id</li><li><code>CF_ANALYTICS_TOKEN</code>: an API token with <b>Account Analytics: Read</b></li><li><code>CHAPTERLANDS_STATS_KEY</code>: any password; then open this page with <code>?key=yourpassword</code></li></ul>`);
  }
  if (url.searchParams.get("key") !== env.CHAPTERLANDS_STATS_KEY) return page("Chapterlands stats", "<p>Wrong or missing key.</p>");
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days")) || 30));
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  try {
    const [totals, firstStreet, thirdStreet, sessions, books] = await Promise.all([
      sql(env, `SELECT blob1 AS e, SUM(_sample_interval) AS n, COUNT(DISTINCT blob2) AS players FROM ${DATASET} WHERE ${since} GROUP BY e ORDER BY n DESC`),
      sql(env, `SELECT blob2 AS p FROM ${DATASET} WHERE ${since} AND blob1 = 'street-unlocked' AND double1 = 0 GROUP BY p`),
      sql(env, `SELECT blob2 AS p FROM ${DATASET} WHERE ${since} AND blob1 = 'street-unlocked' AND double1 >= 2 GROUP BY p`),
      sql(env, `SELECT blob2 AS p, MIN(double2) AS first, MAX(double2) AS last FROM ${DATASET} WHERE timestamp > NOW() - INTERVAL '90' DAY AND blob1 = 'session-start' GROUP BY p`),
      sql(env, `SELECT blob3 AS b, COUNT(DISTINCT blob2) AS players, SUM(IF(blob1 = 'street-unlocked', _sample_interval, 0)) AS streets, SUM(IF(blob1 = 'vault', _sample_interval, 0)) AS vaults FROM ${DATASET} WHERE ${since} AND blob3 != '' GROUP BY b ORDER BY players DESC`),
    ]);
    const s1 = new Set(firstStreet.map((r) => r.p)), s3 = thirdStreet.filter((r) => s1.has(r.p)).length;
    const funnel = s1.size ? Math.round((s3 / s1.size) * 100) : 0;
    const today = Math.floor(Date.now() / 86400000);
    const eligible = sessions.filter((r) => today - Number(r.first) >= 14);
    const back = eligible.filter((r) => Number(r.last) - Number(r.first) >= 7).length;
    const ret = eligible.length ? Math.round((back / eligible.length) * 100) : 0;
    const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    return page(`Chapterlands: last ${days} days`, `
<h2>Gate A</h2>
<table><tr><th>Check</th><th>Now</th><th>Target</th></tr>
${row([`Players who opened street 1 and went on to open street 3`, `<span class="big ${funnel >= 50 ? "ok" : "no"}">${funnel}%</span> (${s3} of ${s1.size})`, "50%+"])}
${row([`Players who came back in week 2 (first played 14+ days ago)`, `<span class="big">${ret}%</span> (${back} of ${eligible.length})`, "kids return on their own"])}
${row([`Players in total`, `<span class="big">${sessions.length}</span>`, "10–20 for the playtest"])}
</table>
<h2>Events</h2><table><tr><th>Event</th><th>Count</th><th>Players</th></tr>${totals.map((r) => row([r.e, r.n, r.players])).join("")}</table>
<h2>Books</h2><table><tr><th>Book</th><th>Players</th><th>Streets opened</th><th>Vaults cracked</th></tr>${books.map((r) => row([r.b, r.players, r.streets, r.vaults])).join("")}</table>
<p style="color:#5C5C58;font-size:13px">Anonymous counts only: a random id made on each device, no names, no IP addresses, no locations.</p>`);
  } catch (e) {
    return page("Chapterlands stats: error", `<p>${String(e.message).replace(/</g, "&lt;")}</p>`);
  }
}
