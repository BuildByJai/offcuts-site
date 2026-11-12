# Chapterlands — Phase A1: Foundations (build brief)

> Read `chapterlands-masterplan.md` first. Repo `BuildByJai/offcuts-site`, branch off `main`, open a PR.
> Reuse the Phase 1 modules (player controller, touch controls, save, HUD, `config.js`). Follow the existing graphics briefs for look and movement; **don't change the art style in this phase.**

## Goal

Rename the game from "Book Town" to **Chapterlands** and turn the town into the **library structure**: Library Square in the middle, with one road per **category (quarter)** leading outwards, and districts along each road under fog. **No age sections.** Difficulty is shown by a reading level and by distance from the square. Add the catalogue, the first Lookout Tower, the library card, a side quest framework and save v2. No new book content yet; districts are fogged placeholders.

## 0. Rename

- Move `tools/book-town/` → **`tools/chapterlands/`** (and its sub-folders: `study/` etc.). Update all relative paths.
- Keep the old URL working: add a redirect from `/tools/book-town/*` to `/tools/chapterlands/:splat` in a `_redirects` file at the site root. If the host doesn't support `_redirects`, leave a tiny `tools/book-town/index.html` that redirects to `../chapterlands/` (keeping any `?spawn=` query string).
- Put the display name in one place: `config.js` → `gameName: 'Chapterlands'`. Titles, start screen and toasts read from it.
- Breadcrumb becomes `offcuts / games / chapterlands`.

## 1. Catalogue (single source of truth)

`tools/chapterlands/catalogue/books.json`

```json
{
  "quarters": [
    { "id": "fantasy",   "name": "Fantasy",           "colour": "#7B4FB5", "icon": "wand"  },
    { "id": "adventure", "name": "Adventure",         "colour": "#C2562B", "icon": "map"   },
    { "id": "animals",   "name": "Animals & Nature",  "colour": "#3E8E41", "icon": "leaf"  },
    { "id": "family",    "name": "Friends & Family",  "colour": "#D9A21B", "icon": "house" },
    { "id": "mystery",   "name": "Mystery",           "colour": "#2F4A7A", "icon": "magnifier" },
    { "id": "scifi",     "name": "Sci-Fi",            "colour": "#2A9BA6", "icon": "rocket" },
    { "id": "life",      "name": "Life Skills",       "colour": "#B83A5E", "icon": "compass" }
  ],
  "books": [
    {
      "id": "fan-alice-1",
      "title": "Alice's Adventures in Wonderland",
      "author": "Lewis Carroll",
      "quarter": "fantasy",
      "level": 2,
      "series": "alice", "seriesOrder": 1,
      "size": "district", "chapters": 12,
      "rights": "pd",
      "readable": true,
      "status": "planned",
      "requiresKey": null,
      "contentPath": "content/fantasy/fan-alice-1/"
    }
  ]
}
```

- `level`: 1–4. `rights`: `pd` | `pd-uk-only` | `own-words`. `readable`: true if it will be in the Reading Room. `status`: `planned` | `building` | `live`. `size`: `streets` | `district` | `borough-part`.
- Fill `books[]` with **every title in masterplan §8**. All are `planned`, except Atomic Habits = `live` (pointing at the existing Study, `readable: false`). Set `readable` according to the **Reading Room list in the Build Day brief** (it overrides masterplan §8a).
- Quarter colours are placeholders; they're used for signs, shelves and lost-book markers.
- `js/catalogue.js`: loads the JSON once and exposes helpers (`getQuarter`, `booksInQuarter` (sorted by level, then series order), `getBook`, `nextInSeries`).
- The town map, library card and lost-books quest all read from the catalogue. Nothing about books is hard-coded anywhere else.

## 2. Town layout

- **Library Square** (the current town centre) stays as the hub: fountain, quest board spot, Secret Room door (The Study, unchanged).
- **Seven roads** lead out of the square, one per quarter, each with a gateway arch showing the quarter's name, colour and icon.
- Along each road, **one plot per book**, ordered by `booksInQuarter()`: **Level 1 nearest the square, Level 4 furthest out.** Show up to 6 plots per road for now; the rest of the road fades into "more coming".
- Each plot shows a building silhouette **under fog** (volumetric-looking fog layer or mist cards; cheap enough for mid-range phones) and a signpost with the title and level (1–4 small book icons).
- Roads can be short in A1. Layout must be **data-driven** so adding books extends the road without hand-placing.
- **Atomic Habits:** move the existing Study entrance (the Atomic Habits escape room) to the **Life Skills road** as its first live district, unfogged. The escape room itself is unchanged.
- The Phase 1 "locked building" placeholders in the square become: library noticeboards (see §6), a café and houses for side quests.

## 3. Lookout Tower (first one)

- One tower on the **Fantasy** road. Tall, visible from the square.
- A short climb (~45–90 s for a 7-year-old) using the existing movement: ledges, crates, a couple of easy jumps, checkpoint pad halfway. Generous, not punishing.
- At the top: interact with the telescope → short camera sweep along the road → fog lifts → a banner names the districts revealed ("Wonderland — coming soon").
- Save `towers["fantasy"] = true`. The fog stays lifted on reload.
- Make the tower a **reusable prefab driven by config** (height, layout preset, quarter id, `requiresKey`) so later towers are data, not code. This first tower has `requiresKey: null`.
- A gate on a tower with `requiresKey` shows: "You need the ___ Key. Finish ___ to earn it."

## 4. Library card

- New tab in the pause menu, plus a small card icon in the HUD.
- Shows the player's (generated) name, then **one section per quarter**: one slot per catalogue book, in road order, with its level icons. A stamp for finished books, an empty slot for others (title visible, so it doubles as a reading wishlist), a Key icon for keys held.
- Atomic Habits gets its stamp and Key if the save already shows the escape room was completed (Habit Breaker badge).
- **Generated name:** on first play, pick one from adjective + book-ish noun lists (e.g. "Brave Lantern", "Swift Inkwell"). Show a "re-roll" button. **No free text entry.**

## 5. Side quest framework

`js/sidequests.js`: data-driven, quests defined in `config.js`:
```js
{ id, title, giver, steps: [{ type, params, text }], reward: { coins, badge? } }
```
Step types for A1: `talk` (interact with an NPC), `collect` (pick up items by id), `deliver` (bring item to target), `reach` (go to a location).

Ship **two side quests**:
1. **Lost Books**: 7 books scattered around the square and roads, one per quarter, each showing its quarter's colour and icon. Return each to the right quarter's shelf (a small shelf under each gateway arch). Reward: coins + **Shelver** badge. Teaches how the library is organised.
2. **The White Rabbit** (escaped character tease): a white rabbit with a pocket watch hurries through the square. Chase and catch it (`reach` a few points as it hops off) → it says it's late and has lost its way home → leads you along the Fantasy road to the fogged Wonderland plot → "Come back when the way opens!" Reward: coins + **Rabbit Chaser** badge. Use only the book's description of the rabbit; nothing that looks like the Disney design.

Quest log in the pause menu. Toast on step and quest completion.

## 6. Grown-ups and ads

- Replace the Phase 1 third-party ad placeholders with **library noticeboards** showing our own content (district coming-soon posters). The config structure stays (`adSlots[]`) so sponsor placements can come back later, but no external links in this phase.
- Move the escape room's "Get Atomic Habits" affiliate button into a **"For grown-ups" panel** behind a simple parent gate (e.g. "Ask a grown-up: type seventy-four in numbers"). Keep the disclosure line. The same grown-up check guards every link that leaves the game (library links etc.).

## 7. Save v2

- New key **`chapterlands.save.v2`**, migrated once from `bookTown.save.v1` (keep coins, badges, best times). Leave the old key in place (don't delete it) in case of rollback.
- Shape adds: `profile.name`, `libraryCard.stamps[]`, `libraryCard.keys[]`, `towers{}`, `sideQuests{ id: { step, done } }`, `streets{ bookId: [unlockedStreetIds] }`, `reading{ bookId: lastChapterRead }`.
- Wrap storage in try/catch with in-memory fallback (as before).

## 8. Event tracking stub

`js/track.js` with `track(eventName, data)`. For now it only logs to the console behind `?debug=1`. **No network calls, no personal data.** Call it for: tower climbed, fog lifted, side quest step/complete, library card opened, chapter read, street unlocked, check passed/failed.

## 9. Coins and hints

- Coins come from the existing pickups, side quests and Sky Runs.
- Coins buy help on skill games (an extra life, a short speed boost) and **one hint per reading-check question**. **Coins never buy an answer.** Costs live in `config.js`.

## 10. Offcuts conventions

Breadcrumb `offcuts / games / chapterlands`, footer `offcuts.buildbyjai.workers.dev`, no buildbyjai.co.uk links. Update the homepage `tools[]` entry: name **Chapterlands**, href `tools/chapterlands/`, description *"A world that grows as you read. Climb lookout towers, find lost books and unlock new districts."*

## Done when

- [ ] Game lives at `tools/chapterlands/`; old `book-town` URLs redirect; name comes from `config.gameName`
- [ ] `books.json` contains every masterplan §8 title with quarter and level; town signs and library card read from it
- [ ] Library Square → 7 category roads → plots ordered by level, under fog; works on desktop, phone and tablet
- [ ] Adding a book to the catalogue adds a plot to its road with no code change
- [ ] Atomic Habits Study entered from the Life Skills road and still fully works; The Study (Secret Room) unchanged
- [ ] Fantasy Lookout Tower is climbable by a young player; fog lift persists after reload
- [ ] Tower prefab is config-driven; a `requiresKey` gate message works (test with a dummy tower)
- [ ] Library card shows quarters, levels, stamps, empty slots and keys; generated name with re-roll, no typing
- [ ] Lost Books and White Rabbit quests complete end to end; quest log and toasts work
- [ ] Affiliate button and all outbound links only behind the grown-up check; no external ad links
- [ ] `bookTown.save.v1` saves migrate to `chapterlands.save.v2` without losing progress
- [ ] `track()` stub logs only in debug mode; no network requests
- [ ] Still smooth on a mid-range phone
