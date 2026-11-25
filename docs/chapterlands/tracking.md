# Chapterlands: anonymous event counts (Gate A)

The game sends small anonymous events to `/api/chapterlands/events`. The Worker stores them in **Cloudflare Workers Analytics Engine** (binding `CHAPTERLANDS_EVENTS`, dataset `chapterlands_events`, set in `wrangler.jsonc`). The dataset is created on the first write, so collecting needs no setup. Free plan: 100,000 events a day.

## What is sent

- the event name (`session-start`, `chapter-read`, `street-unlocked`, `vault`, …; full list in `tools/chapterlands/js/track.js`)
- a random id made on the device (`localStorage["chapterlands.anon"]`), not linked to the library-card name or anything else
- for some events: the book id, the street id and the street's position in the book
- the day number (for "came back in week 2")

Never sent: names, IP addresses (not stored), location, anything typed. Nothing is sent from `localhost` or with `?debug=1`.

## Reading the numbers

Open `https://offcuts.buildbyjai.workers.dev/api/chapterlands/stats?key=YOUR_KEY` (add `&days=7` for a shorter window). It shows the Gate A checks (street 1 → street 3, week-2 return, player count), every event's count and a per-book table.

It needs three Worker secrets (Cloudflare dashboard → Workers & Pages → offcuts-site → Settings → Variables and Secrets, type **Secret**):

| Name | Value |
|---|---|
| `CF_ACCOUNT_ID` | your Cloudflare account id (shown on the dashboard's right-hand side) |
| `CF_ANALYTICS_TOKEN` | an API token (My Profile → API Tokens → Create Token → Custom) with permission **Account → Account Analytics → Read** |
| `CHAPTERLANDS_STATS_KEY` | any password you choose; you put it in `?key=` |

Without them the page says "not set up yet". Events are still being collected either way.
