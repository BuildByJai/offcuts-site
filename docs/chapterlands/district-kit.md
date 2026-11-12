# Chapterlands — District Kit reference

A district is **data + art, no new code**. This is the format the engine (built in PR 1) reads.
Working example: `tools/chapterlands/content/fantasy/fan-velveteen/`.

```
tools/chapterlands/content/<quarter>/<bookId>/
  book.json        streets, templates + params, theme, Sky Run, side quest, Vault, unlock
  chapters/NN.md   the book text, one file per chapter (Reading Room — readable books ONLY)
  questions.json   3 questions per street + 5–8 Vault questions
  review.md        generated: all questions with evidence, for Jai
  art/             palette.json + README (our own art / public-domain illustrations only)
```

To switch a district on: set its `status` to `"live"` in `catalogue/books.json`. Its plot on the road unfogs, opens, and gets its sign, NPCs and side quest automatically.

## Checks before a PR

```bash
python3 docs/chapterlands/tools/check_book.py tools/chapterlands/content/<quarter>/<bookId>
```
- validates question counts, options, evidence + hints
- readable books: every `evidence` must appear word for word in the chapter it names; no Project Gutenberg text left in `chapters/`
- held-back books: no `chapters/` folder; evidence must be one short sentence
- writes `review.md`
- prints the offensive-term scan hits → **list them in the PR description; never edit the text silently**

Try any template without a book: `street/?demo=CLIMB` (also `CLIMB-down`, `CHASE`, `CHASE-flee`, `CHASE-loop`, `COLLECT`, `COLLECT-water`, `SNEAK`, `PUZZLE`, `PUZZLE-mirror`, `BUILD`, `ARCADE-rhythm|paddle|catch|golf|dodge|typeset`). Add `?debug=1` to a street/vault URL to skip the "is it open yet?" gates while testing.

## book.json

```jsonc
{
  "id": "fan-velveteen",
  "blurb": "one line for the district panel",
  "chapterWord": "Chapter",                    // or "Part", "Story", "Case"
  "source": "Text: <title> by <author> (<year>). Public domain.",   // shown under the reader; NO Gutenberg mention
  "chapterFiles": [{ "n": 1, "file": "01.md", "title": "Chapter 1: Down the Rabbit-Hole" }],   // held-back books: titles only, no files
  "theme": {
    "palette": { "ground": "#..", "ground2": "#..", "wall": "#..", "trim": "#..", "roof": "#..", "accent": "#..", "accent2": "#..",
                 "wood": "#..", "leaf": "#..", "stone": "#..", "sky": "#..", "fog": "#..", "water": "#..", "item": "#.." },
    "props": ["tree", "bush", "..."],          // see "Props" below
    "vaultProps": ["..."],
    "edge": "hedge",                           // CHASE track edges
    "hide": "bush",                            // SNEAK hiding spots
    "rafts": ["crate", "barrel", "leaf", "chest", "book", "hat"],   // COLLECT water floaters
    "building": { "wall": "#..", "trim": "#..", "roof": "#..", "style": "house", "sign": "Wonderland", "h": 6 }
  },
  "streets": [{
    "id": "rabbit-hole", "name": "Down the Rabbit-Hole", "chapters": [1],
    "template": "CLIMB", "game": "short game name", "blurb": "…", "how": "how to play",
    "params": { … }                             // template params below; any street can add "palette": {…} overrides
  }],
  "skyRun": { "id": "sky", "name": "…", "template": "CLIMB", "params": { … } },
  "npcs": [{ "id": "skin-horse", "name": "the Skin Horse", "kind": "horse", "look": {…}, "at": [-8, -6.5], "idle": "…", "thanks": "…" }],
  "sideQuest": { "id": "<bookId>-something", "title": "…", "giver": "<npc id>", "steps": [ … ], "reward": { "coins": 20, "badge": "optional-id" } },
  "vault": { … },
  "unlock": { "badges": [{ "id": "first-book", "name": "First Book", "icon": "📗", "desc": "…", "requires": ["fan-velveteen"] }] }
}
```

- **Positions for district NPCs / side quest items** are `[along, away]` in the plot's own frame: `along` runs with the road, `away` is away from the road (negative = road side). The building fills about ±6 along × ±4.5 away; the yard reaches ±9 × ±7.5.
- **NPC kinds:** `person` (look: skin, hair, shirt, pants, shoes), `child`, `rabbit` (coat, waistcoat or null, eyes, watch), `horse` (coat, mane, bald, rocker), `fairy` (dress, hair, glow). Colours may be `"#rrggbb"` or `"0xrrggbb"`. Our own blocky designs, built from the book's description. **No film designs.**
- **Badges** in `unlock.badges` are awarded when every book in `requires` has its Key (so "Habit Historian" can need Franklin *and* Atomic Habits).
- **Series:** a sequel's `requiresKey` (catalogue) builds the bridge automatically; finishing book 1's Vault gives its Key.

## Templates and params

| Template | Params (all optional) |
|---|---|
| `CLIMB` | `height`, `layout` (spiral · zigzag · scatter), `core` (tower · tree · wall · mast · shaft · blocks · none), `direction` (up · down), `floaty`, `fade`, `moving` (count), `collect` {item, count, need, label}, `guide` {npc} (rises with you), `finale` {npc, say}, `goalIcon`, `dark`, `objective`, `done` |
| `CHASE` | `mode` (race · follow · flee · loop), `length`, `width`, `obstacles` [hurdle, block, gap, log, low], `density`, `floor`, `target` {kind, look, name} (follow), `chaser` + `chaserSpeed` (flee), `laps` + `radius` + `racers` (loop), `collect`, `critters` [{kind, look, count}], `lives`, `time`, `finishText`, `objective`, `done` |
| `COLLECT` | `area` [w, d], `floor` (grass · floor · snow · sand · stone · water), `items` [{name, icon, colour}] or `item` + `count`, `label`, `platforms`, `rafts` (water), `finale` {npc, say}, `critters`, `time`, `objective`, `done` |
| `SNEAK` | `area`, `watchers` (count or [{path, speed}]), `watcher` {kind, look, name}, `view`, `fov`, `hides`, `cover`, `dark`, `goal` {name, icon}, `lives`, `objective`, `done` |
| `PUZZLE` | `room` {w, d, h, floor, wall}, `outdoors`, `clues` [{object, label, text}], `solve` {object, label, type (choice · order · match · code), prompt, options/answer, items, pairs, hint}, `needClues`, `invert` ('x' = mirror controls), `dark`, `objective`, `done` |
| `BUILD` | `area`, `items` [{id, name, icon}], `slots` [{id, name, accepts}], `order`, `anyItem`, `hint`, `objective`, `done` |
| `ARCADE` | `mode` (rhythm · paddle · catch · golf · dodge · typeset), `duration`, `target`, `lives`, `speed`, `good`/`bad` [{icon, name}], `icons` (rhythm), `lanes`, `bpm`, `holes`/`ball`/`club`/`hoop` (golf), `words` (typeset), `player`, `bg` (river · grass · kitchen · paper · night · sky · hall), `need`, `objective`, `done` |
| `VAULT` | in `book.json → vault`: `name`, `blurb`, `intro`, `room` {wall, floor, rug, dark}, `stations` [{object, label, text, lock, lesson, solve}], `quiz` {label, lock, lesson} (uses questions.json `vault`), `openText`, `outro` |

PUZZLE / Vault `object` icons: desk, shelf, clock, chair, box, picture, window, table, bed, chest, plant, statue, sign, mirror, book, map, note, lamp, safe, toy, board, scales, telescope, trunk, door, tree, well.

**Props:** tree, bush, flower, rock, crate, barrel, block, lamp, mushroom, fence, table, chair, bed, bookcase, cupboard, column, hedge, reeds, tent, cart, statue.

Coins buy help on skill games (`costs.extraLife`, `costs.speedBoost` in config.js) and one hint per question (`costs.hint`). **Never an answer.**

## questions.json

```jsonc
{
  "book": "<bookId>",
  "streets": { "<streetId>": [ { "kind": "what|why|think", "q": "…", "options": ["…", "…", "…"], "answer": 0, "chapter": 1, "evidence": "exact sentence", "hint": "Look again at the part where…" } ] },
  "vault": [ /* 5–8, joining ideas across the whole book */ ]
}
```
`answer` is the index of the right option (options are shuffled on screen). `evidence` is never shown to players. Held-back books (not readable): `evidence` is one short sentence and never an offensive passage.

## Held-back books (not readable in-game)

`readable: false` in the catalogue. **No `chapters/` folder, no full text in the repo** (the site is publicly served). Download the text temporarily to write the questions, then leave it out of the commit. The district panel automatically shows "Read chapter N in your own copy, or borrow it free from your library" with the library links behind the grown-up check, then the 3 questions.
