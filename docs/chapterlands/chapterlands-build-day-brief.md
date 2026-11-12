# Chapterlands — Build Day brief: 15 full districts

> Repo `BuildByJai/offcuts-site`. Read `chapterlands-masterplan.md`, then do **everything in `chapterlands-a1-foundations-brief.md`** as PR 1, then the districts below.
> This compresses masterplan Stage A phases A1, A2, A4 and A5 into one build day. **Lights Out (A3) stays a separate brief.** Gate A (playtesting) still applies before anything moves to Stage B.
> **Where this brief and the A1 brief or masterplan disagree, this brief wins** (in particular the Reading Room list below).

## How to run today

One PR at a time. **Merge, play-test on a phone, then start the next PR.** Don't run PRs in parallel.

| PR | Contents |
|---|---|
| 1 | A1 Foundations + **District Kit** + **Reading Room** + The Velveteen Rabbit (proves the kit end to end) |
| 2 | Alice's Adventures in Wonderland + Through the Looking-Glass (proves the series bridge) |
| 3 | The Adventures of Sherlock Holmes + The Hound of the Baskervilles + The Thirty-Nine Steps |
| 4 | The Wonderful Wizard of Oz + Treasure Island + The Railway Children |
| 5 | The Wind in the Willows + The Jungle Book (Mowgli) + Black Beauty |
| 6 | The Lost World + The Time Machine + Franklin's Autobiography (virtues) |

Result: **16 live districts** (these 15 + the existing Atomic Habits) across all 7 roads.

| Road | Live after today |
|---|---|
| Fantasy | Velveteen Rabbit (L1), Alice (L2), Looking-Glass (L2), Wizard of Oz (L2) |
| Adventure | Treasure Island (L3) |
| Animals & Nature | Black Beauty (L2), Jungle Book (L3), Wind in the Willows (L3) |
| Friends & Family | The Railway Children (L2) |
| Mystery | Adventures of Sherlock Holmes (L3), Hound of the Baskervilles (L3), Thirty-Nine Steps (L3) |
| Sci-Fi | The Lost World (L3), The Time Machine (L3) |
| Life Skills | Atomic Habits (L3, existing), Franklin's virtues (L3) |

## Reading Room list (decided 12 Nov 2026)

**Readable in the Reading Room (12):** The Velveteen Rabbit, Alice's Adventures in Wonderland, Through the Looking-Glass, The Wonderful Wizard of Oz, Treasure Island, The Railway Children, The Wind in the Willows, The Jungle Book (**Mowgli stories only**), Black Beauty, The Hound of the Baskervilles, The Time Machine, Franklin's Autobiography (**virtues chapters only**).

**Held back from the Reading Room for now (3):** The Adventures of Sherlock Holmes, The Thirty-Nine Steps, The Lost World. Their original text contains dated, offensive language. **Their districts are still built and playable;** only the in-game reading is held back.
- In `books.json` set `readable: false` for these three (and for Atomic Habits).
- **Don't commit their full text to the repo.** The whole site is publicly served, so text in the repo can be reached by URL even if the game never shows it. Download it temporarily during the build to write the questions, then leave it out of the commit. No `chapters/` folder for these books.
- In `questions.json`, the `evidence` field for these books is limited to one short sentence, and must never be one of the offensive passages.
- In-game, where a readable book says "Read chapter 3", these books say **"Read chapter 3 in your own copy, or borrow it free from your library"**, with the library link behind the grown-up check. Then the 3 questions as normal.

**Safety net for the 12 readable books:** before committing each book's text, scan it for slurs and offensive terms and **list any hits in the PR description** so Jai can decide. Don't edit the text silently.

## Part 1 — District Kit (PR 1)

Every district is **data + art, no new code**. `content/<quarter>/<bookId>/` contains:

```
book.json          ← streets, templates, params, theme, Sky Run, side quest, Vault, unlock
chapters/01.md …   ← the book text, one file per chapter (Reading Room; readable books only)
questions.json     ← 3 questions per street + Vault questions
review.md          ← all questions with evidence, for Jai to skim
art/               ← palette, props (Kenney CC0 / own; public-domain illustrations only)
```

**Game templates** (built once, configured per street):

| Template | What it is |
|---|---|
| `CLIMB` | Vertical / high-in-the-sky obstacle course (also used for every Sky Run) |
| `CHASE` | Run, ride or flee along a path with obstacles, or chase a target |
| `COLLECT` | Explore an area and find N items or clues |
| `SNEAK` | Reach a goal without being seen (sight cones, hiding spots) |
| `PUZZLE` | Single-room logic puzzle (lightweight version of The Study engine) |
| `ARCADE` | 2D overlay mini-game. Modes: `rhythm`, `paddle`, `catch`, `golf`, `dodge`, `typeset` |
| `BUILD` | Place or arrange objects to meet a goal |
| `VAULT` | Full escape room on **The Study engine** (copy, don't modify the original) |

**Every district has:**
1. **Streets**: one per chapter or chapter group. Order: **read chapter(s) → 3 questions → street opens → play its game.** Game completion + check passed = street done.
2. **Sky Run**: a `CLIMB` course high above the district, themed to the book. Optional, for coins and a badge.
3. **Side quest**: uses the A1 side quest framework. Never needs reading.
4. **Vault**: an escape room at the end testing understanding of the **whole book**. Clues come from across the book. Passing gives the **Key** + library card stamp.
5. **Unlocks**: as listed per book. Series sequels are key-locked; everything else on the roads is open.

**Reading Room:** a library building in Library Square with one shelf per quarter, showing **only books with `readable: true`**. Readable chapter by chapter; at the end of a chapter → "Answer 3 questions to open the street". Closed during Lights Out (later). Tracks `reading{bookId: lastChapterRead}`.

## Part 2 — Book text and questions

**Text:** import each book from **Standard Ebooks** (preferred) or **Project Gutenberg**. For Gutenberg, **strip every reference to Project Gutenberg and its licence**. Split into `chapters/NN.md` (readable books only; see the Reading Room list). If the build environment can't download, stop and list the files needed so Jai can add them.

**Questions: write them from the actual text, not from memory.** For each street, 3 multiple-choice questions, 3 options each:
1. **What happened:** a plain recall question.
2. **Why:** why a character did something or why something mattered.
3. **Think:** a theme or "what would you do / what does this show" question with one clearly best answer.

Rules:
- The answer must be clearly supported by that street's chapters. Store `{ q, options[3], answer, chapter, evidence }` where `evidence` is the supporting sentence from the text (used for review, not shown to players).
- Wording matches the book's level (L1 very simple, L3 normal teen reading).
- No trick questions, no "all of the above", plausible wrong answers, no spoilers from later chapters.
- Wrong answer → show a gentle hint ("Look again at the part where…") and allow a retry. Coins can buy one hint (A1 coin rules).
- **Vault questions**: 5–8 that join ideas across the whole book.
- Produce `review.md` per book listing all questions with evidence.

**Content rules:** public-domain characters and scenes are fine; **no Disney/MGM designs**, no E. H. Shepard art. Violence in the books is shown **off-screen and non-graphic**: enemies are scared off, captured or knocked out, never killed on screen. Flagged content notes below must be followed.

## Part 3 — The 15 districts

Template params shown briefly; Claude Code designs the details within each line.

### 1. The Velveteen Rabbit · Fantasy · L1 · PR 1 · readable
Short book, split into 3 parts. Keep the tone gentle (the illness and the burning of the toys are handled softly: "the toys had to go").
| Street | Part | Game |
|---|---|---|
| The Nursery | Christmas, the Skin Horse explains "Real" | `COLLECT`: find the scattered toys, then talk to the Skin Horse |
| The Garden | Summer with the Boy, the wild rabbits | `CHASE`: follow the Boy through the garden; the wild rabbits hop away |
| The Fairy | The Boy's illness, the Fairy | `CLIMB`: rise with the Fairy through flowers to the moonlit wood |
- **Sky Run:** a tower of nursery blocks up to the toy-cupboard top.
- **Side quest:** find the Skin Horse's 5 lost tail hairs around the nursery.
- **Vault:** "What makes you Real?" Put the rabbit's moments in order and pick what really made him Real.
- **Unlock:** stamp + Key. Badge **First Book**.

### 2. Alice's Adventures in Wonderland · Fantasy · L2 · PR 2 · readable
| Street | Ch | Game |
|---|---|---|
| Down the Rabbit-Hole | 1 | `CLIMB` (inverted): fall down the hole, grab marmalade jars from the shelves |
| The Pool of Tears | 2 | `COLLECT`: cross the flood on floating objects |
| The Caucus-Race | 3 | `CHASE`: a race in circles where everyone wins |
| The Rabbit's House | 4 | `PUZZLE`: grow and shrink to get out of the house |
| The Caterpillar | 5 | `CLIMB`: one side of the mushroom makes you grow, the other shrink |
| Pig and Pepper | 6 | `ARCADE dodge`: dodge pepper and flying pans in the Duchess's kitchen |
| The Mad Tea-Party | 7 | `PUZZLE`: it's always six o'clock; work out the seat-moving pattern |
| The Croquet-Ground | 8 | `ARCADE golf`: flamingo mallets, hedgehog balls, moving soldier hoops |
| The Mock Turtle's Story | 9 | `COLLECT`: gather the odd school subjects |
| The Lobster Quadrille | 10 | `ARCADE rhythm`: the dance |
| Who Stole the Tarts? | 11 | `COLLECT`: gather evidence around the court |
- **Sky Run:** the Cheshire Cat's treetop course; platforms fade in and out like the Cat.
- **Side quest:** return the White Rabbit's gloves and fan (links to the A1 White Rabbit quest).
- **Vault (ch 12, Alice's Evidence):** the courtroom. Who stole the tarts, and is the evidence real? Ends with Alice growing and the cards flying up.
- **Unlock:** Alice Key → **builds the bridge to Through the Looking-Glass**.

### 3. Through the Looking-Glass · Fantasy · L2 · PR 2 · readable · *requires Alice Key*
| Street | Ch | Game |
|---|---|---|
| Looking-Glass House | 1 | `PUZZLE`: **mirror-reversed controls**; read the mirror-writing poem |
| The Garden of Live Flowers | 2 | `CHASE`: to reach the hill, walk *away* from it |
| Looking-Glass Insects | 3 | `ARCADE catch`: the train ride and the strange insects |
| Tweedledum and Tweedledee | 4 | `PUZZLE`: tell them apart |
| Wool and Water | 5 | `ARCADE paddle`: row with the Sheep, pick up the rushes |
| Humpty Dumpty | 6 | `CLIMB`: up the wall; meaning-of-words puzzle at the top |
| The Lion and the Unicorn | 7 | `ARCADE catch`: the plum-cake and the crowd |
| The White Knight | 8 | `CHASE`: ride with the Knight, who keeps falling off; catch his inventions |
| Queen Alice | 9 | `BUILD`: set the upside-down feast table |
- **Sky Run:** Humpty Dumpty's wall extended high above the chessboard countryside.
- **Side quest:** collect the White Knight's 6 inventions.
- **Vault (ch 10–12):** the chessboard. Move Alice from pawn to queen across the 8 squares by answering book-wide questions. Ends with the "Which dreamed it?" question.
- **Unlock:** Key + stamp. Badge **Through the Glass** for finishing both Alice books.

### 4. The Adventures of Sherlock Holmes · Mystery · L3 · PR 3 · **not readable in-game**
Each story is a street ("case"). Baker Street is the district's hub.
| Street | Story | Game |
|---|---|---|
| A Scandal in Bohemia | 1 | `PUZZLE`: the photograph's hiding place |
| The Red-Headed League | 2 | `SNEAK`: wait in the bank vault, catch the tunnellers |
| A Case of Identity | 3 | `PUZZLE`: spot the disguise from the typewriter clues |
| The Boscombe Valley Mystery | 4 | `COLLECT`: footprints at the pool |
| The Five Orange Pips | 5 | `PUZZLE`. **Content note:** the story involves the Ku Klux Klan. Name the secret society only as in the text, briefly, and keep the street to the deduction. No imagery of the group. |
| The Man with the Twisted Lip | 6 | `PUZZLE`: see through the disguise |
| The Blue Carbuncle | 7 | `CHASE`: track the goose across London |
| The Speckled Band | 8 | `SNEAK`: night watch in the dark room; spot the ventilator and bell-pull |
| The Engineer's Thumb | 9 | `CHASE`: escape the press machine room |
| The Noble Bachelor | 10 | `COLLECT`: wedding clues |
| The Beryl Coronet | 11 | `COLLECT`: footprints in the snow |
| The Copper Beeches | 12 | `SNEAK`: find the locked wing |
- **Sky Run:** a chase across London rooftops and chimney pots.
- **Side quest:** Baker Street Irregulars errands (deliver messages around the district).
- **Vault:** 221B. Match each case to the clue that cracked it, then crack a final case built from details across the stories.
- **Unlock:** Key → **builds the bridge to The Hound of the Baskervilles**.

### 5. The Hound of the Baskervilles · Mystery · L3 · PR 3 · readable · *requires Adventures of Sherlock Holmes Key*
| Street | Ch | Game |
|---|---|---|
| The Walking Stick | 1 | `PUZZLE`: deduce Dr Mortimer from his stick |
| The Curse | 2–3 | `COLLECT`: the legend and the footprints |
| The Missing Boot | 4–5 | `COLLECT`: Sir Henry's hotel and the boots |
| Baskerville Hall | 6–7 | `COLLECT`: explore the moor and the Hall |
| The Light on the Moor | 8–10 | `SNEAK`: follow the night signal |
| The Man on the Tor | 11 | `CLIMB`: find the hidden watcher's hut on the tor |
| Death on the Moor | 12–13 | `CHASE`: across the moor at night (keep non-graphic) |
- **Sky Run:** the granite tors above the mist.
- **Side quest:** find the safe path markers across Grimpen Mire.
- **Vault (ch 14–15):** who is behind the Hound, and how was it done?
- **Unlock:** Key + stamp. Badge **Consulting Detective**.

### 6. The Thirty-Nine Steps · Mystery · L3 · PR 3 · **not readable in-game**
**Content note:** chapter 1 includes antisemitic conspiracy talk from Scudder. Don't repeat it in questions, evidence or dialogue; keep street 1 to the cipher and the danger Scudder is in.
| Street | Ch | Game |
|---|---|---|
| The Man Who Died | 1 | `PUZZLE`: decode Scudder's notebook cipher |
| The Milkman | 2 | `SNEAK`: leave the flat disguised as the milkman |
| The Literary Innkeeper | 3 | `CHASE`: off the train and across the moor |
| The Radical Candidate | 4 | `ARCADE rhythm`: get through the surprise speech |
| The Spectacled Roadman | 5 | `SNEAK`: pass the searchers in disguise |
| The Bald Archaeologist | 6 | `PUZZLE`: escape the locked storeroom (no explosives shown; "find a way out") |
| The Dry-Fly Fisherman | 7–8 | `CHASE`: get to London and be believed |
- **Sky Run:** the aeroplane search over the moor: leap between rocky high points to stay out of sight.
- **Side quest:** collect the 5 pages of Scudder's notebook.
- **Vault (ch 9–10, the thirty-nine steps):** find the house with the steps and identify the spies.
- **Unlock:** Key + stamp.

### 7. The Wonderful Wizard of Oz · Fantasy · L2 · PR 4 · readable
**Silver shoes, not ruby. No film designs.**
| Street | Ch | Game |
|---|---|---|
| The Cyclone | 1–2 | `CHASE`: ride the house through the storm |
| The Scarecrow | 3 | `COLLECT`: start the yellow brick road, free the Scarecrow |
| The Tin Woodman | 4–5 | `BUILD`: oil his joints in the right order |
| The Cowardly Lion | 6–7 | `CHASE`: jump the ditch and escape the Kalidahs |
| The Deadly Poppy Field | 8–9 | `CHASE`: get through before you fall asleep; the mice help |
| The Emerald City | 10–11 | `PUZZLE`: green glasses, the Wizard's different shapes |
| The Wicked Witch of the West | 12 | `ARCADE dodge`: dodge the wolves, crows and bees (no killing shown) |
| The Winged Monkeys | 13–14 | `CLIMB`: the Golden Cap |
| The Wizard Revealed | 15–16 | `PUZZLE`: behind the screen |
| The Balloon | 17 | `CLIMB`: race to the balloon |
| The Journey South | 18–22 | `CHASE`: the fighting trees, the china country and the hammer-heads |
- **Sky Run:** fly with the Winged Monkeys over the poppy fields.
- **Side quest:** collect straw to restuff the Scarecrow.
- **Vault (ch 23–24, Glinda):** what did each friend already have all along? How do the silver shoes work?
- **Unlock:** Key + stamp. The Oz sequels stay fogged (future).

### 8. Treasure Island · Adventure · L3 · PR 4 · readable
Lots of fighting in the book: keep it off-screen and non-graphic.
| Street | Ch | Game |
|---|---|---|
| The Admiral Benbow | 1–3 | `PUZZLE`: open Billy Bones's sea chest |
| Blind Pew | 4–6 | `SNEAK`: escape the inn with the map |
| Bristol | 7–9 | `COLLECT`: crew the Hispaniola |
| The Apple Barrel | 10–12 | `SNEAK`: overhear Silver's plan |
| Ben Gunn | 13–15 | `COLLECT`: explore the island, find Ben Gunn |
| The Stockade | 16–21 | `BUILD`: hold the stockade (block the gaps) |
| The Coracle | 22–24 | `ARCADE paddle`: paddle to the ship |
| The Hispaniola | 25–27 | `CLIMB`: up the rigging (Israel Hands scene off-screen) |
| The Black Spot | 28–30 | `PUZZLE`: survive among the pirates |
| The Treasure Hunt | 31–33 | `COLLECT`: follow the map clues |
- **Sky Run:** across the masts and rigging of the Hispaniola.
- **Side quest:** Captain Flint the parrot has hidden 8 "pieces of eight" around the island.
- **Vault (ch 34):** the treasure cave. Who can be trusted? Rebuild the story of who knew what.
- **Unlock:** Key + stamp.

### 9. The Railway Children · Friends & Family · L2 · PR 4 · readable
| Street | Ch | Game |
|---|---|---|
| Three Chimneys | 1 | `COLLECT`: settle into the new house |
| Peter's Coal-Mine | 2 | `PUZZLE`: is it right to take the coal? |
| The Old Gentleman | 3 | `ARCADE catch`: wave at the 9.15; catch the parcel |
| The Russian | 4–5 | `COLLECT`: help Mr Szczepansky |
| The Landslide | 6 | `CHASE`: race to warn the train with the red petticoats |
| Bobbie's Birthday | 7–9 | `BUILD`: Perks's birthday surprise |
| The Paper Chase | 10–12 | `CLIMB`: into the tunnel to find the hurt boy |
- **Sky Run:** high along the railway cutting and over the bridge.
- **Side quest:** collect wildflowers for Mother.
- **Vault (ch 13–14):** piece together what happened to Father and how he comes home.
- **Unlock:** Key + stamp.

### 10. The Wind in the Willows · Animals & Nature · L3 · PR 5 · readable
**No E. H. Shepard designs.**
| Street | Ch | Game |
|---|---|---|
| The River Bank | 1 | `ARCADE paddle`: row with Ratty |
| The Open Road | 2 | `CHASE`: the caravan and the motor car |
| The Wild Wood | 3 | `SNEAK`: through the Wild Wood in the snow |
| Mr Badger | 4 | `COLLECT`: Badger's home |
| Dulce Domum | 5 | `PUZZLE`: find Mole's home |
| Mr Toad | 6 | `CHASE`: Toad and the car |
| The Piper at the Gates of Dawn | 7 | `COLLECT`: search the river for Portly |
| Toad's Adventures | 8 | `PUZZLE`: escape the prison as the washerwoman |
| Wayfarers All | 9 | `COLLECT`: Ratty and the travelling rat |
| The Further Adventures of Toad | 10 | `CHASE`: train, barge and horse |
| Toad's Tears | 11 | `PUZZLE`: plan the secret passage |
- **Sky Run:** the rooftops and chimneys of Toad Hall.
- **Side quest:** gather food for Ratty's picnic basket.
- **Vault (ch 12, The Return of Ulysses):** retake Toad Hall. What did Toad learn, or did he?
- **Unlock:** Key + stamp.

### 11. The Jungle Book (Mowgli stories) · Animals & Nature · L3 · PR 5 · readable (Mowgli stories only)
Only the three Mowgli stories, in the game and in the Reading Room. **No Disney designs.**
| Street | Story | Game |
|---|---|---|
| The Council Rock | Mowgli's Brothers (1st half) | `PUZZLE`: the Law of the Jungle |
| The Red Flower | Mowgli's Brothers (2nd half) | `COLLECT`: bring the fire-pot (handled safely) |
| The Bandar-log | Kaa's Hunting (1st half) | `CLIMB`: through the treetops with the monkeys |
| The Cold Lairs | Kaa's Hunting (2nd half) | `CHASE`: rescue with Baloo, Bagheera and Kaa |
| The Village | Tiger! Tiger! (1st half) | `SNEAK`: life in the man-village |
- **Sky Run:** the Bandar-log's treetop highways.
- **Side quest:** Baloo's lessons. Learn the Master Words for each kind of animal.
- **Vault (Tiger! Tiger!, 2nd half):** plan the buffalo stampede (off-screen outcome). Why does Mowgli belong to neither world?
- **Unlock:** Key + stamp.

### 12. Black Beauty · Animals & Nature · L2 · PR 5 · readable
49 short chapters, grouped. The book is about kindness to horses; show the cruelty as the book does, gently.
| Street | Ch | Game |
|---|---|---|
| My Early Home | 1–3 | `CHASE`: gallop the meadow; learn good manners |
| Birtwick Park | 4–8 | `COLLECT`: meet Ginger and Merrylegs |
| The Storm | 9–11 | `PUZZLE`: why won't Beauty cross the bridge? |
| The Fire | 12–17 | `CHASE`: lead the horses out of the stable (no injuries shown) |
| The Night Gallop | 18–21 | `CHASE`: race for the doctor |
| Earlshall | 22–25 | `PUZZLE`: the bearing rein, and why it's cruel |
| Reuben Smith | 26–29 | `PUZZLE`: what went wrong |
| London Cab Horse | 30–43 | `CHASE`: work the London streets with Jerry |
| Hard Times | 44–47 | `COLLECT`: the hard days |
| My Last Home | 48 | `COLLECT`: the farm |
- **Sky Run:** the hayloft rafters at Birtwick.
- **Side quest:** groom and feed the horses at Birtwick.
- **Vault (ch 49):** design a kind stable, matching each owner to how they treated horses.
- **Unlock:** Key + stamp.

### 13. The Lost World · Sci-Fi · L3 · PR 6 · **not readable in-game**
**Content note:** the original has dated, offensive portrayals of indigenous people and mixed-race characters. Don't repeat those descriptions; in questions, evidence and dialogue, refer to characters neutrally. Fights with the ape-men stay off-screen.
| Street | Ch | Game |
|---|---|---|
| Professor Challenger | 1–4 | `CHASE`: get out of Challenger's house (comic) |
| The Meeting | 5–6 | `ARCADE catch`: the rowdy lecture hall |
| Up the Amazon | 7–8 | `ARCADE paddle`: the river journey |
| The Plateau | 9 | `CLIMB`: the tree bridge across the chasm |
| The Pterodactyls | 10 | `CHASE`: through the swamp |
| The Iguanodons | 11 | `COLLECT`: observe and record the creatures |
| Captured | 12–14 | `SNEAK`: escape the ape-men's camp |
| The Way Down | 15 | `PUZZLE`: find the way off the plateau |
- **Sky Run:** pterodactyl rookery cliffs.
- **Side quest:** collect specimen notes for Professor Summerlee.
- **Vault (ch 16):** prove it. Present the evidence to the doubting hall (ends with the escaped pterodactyl).
- **Unlock:** Key + stamp.

### 14. The Time Machine · Sci-Fi · L3 · PR 6 · readable
| Street | Ch | Game |
|---|---|---|
| The Demonstration | 1–2 | `PUZZLE`: the model machine and time as a dimension |
| Through Time | 3 | `CHASE`: ride through the years |
| The Eloi | 4–5 | `COLLECT`: the garden world |
| The Missing Machine | 5–6 | `PUZZLE`: follow the tracks to the White Sphinx |
| Into the Wells | 7 | `CLIMB` (downwards): the Morlocks' world |
| The Palace of Green Porcelain | 8 | `COLLECT`: matches, the iron bar |
| The Forest Fire | 9–10 | `CHASE`: escape the forest (Weena's loss handled gently) |
- **Sky Run:** across the ruined towers of the far future.
- **Side quest:** gather flowers for Weena.
- **Vault (ch 11–12, the further vision and the return):** what does the Time Traveller think went wrong with humanity, and do you agree?
- **Unlock:** Key + stamp.

### 15. Franklin's Autobiography — the 13 Virtues · Life Skills · L3 · PR 6 · readable (virtues chapters only)
Only the chapters about the virtues and his plan for "moral perfection", in the game and in the Reading Room. Sits next to Atomic Habits on the Life Skills road.
| Street | Content | Game |
|---|---|---|
| The Printing Shop | Franklin as a young printer | `ARCADE typeset`: set the letters |
| The 13 Virtues | The list and why he made it | `BUILD`: one virtue per week on the chart |
| The Little Book | Marking faults with dots each day | `PUZZLE`: read his chart; which virtue was hardest? |
- **Sky Run:** Franklin's kite: climb to the storm clouds (no lightning strike shown).
- **Side quest:** deliver his newspapers around the Life Skills road.
- **Vault:** build your own 13-week virtue chart. Compare Franklin's method with Atomic Habits.
- **Unlock:** Key + stamp. Badge **Habit Historian** for finishing both Franklin and Atomic Habits.

## Done when (per PR)

- [ ] Every street in the PR is playable on desktop and phone, opens only after its chapters' check, and shows the book's theme
- [ ] Readable books: readable chapter by chapter in the Reading Room; no Project Gutenberg references remain; offensive-term scan results listed in the PR
- [ ] Held-back books (Sherlock Adventures, Thirty-Nine Steps, Lost World): **no full text committed**, not shown in the Reading Room, "read in your own copy / borrow from the library" prompt works
- [ ] `questions.json` has 3 questions per street and 5–8 Vault questions, each with `evidence`; `review.md` produced
- [ ] Sky Run, side quest and Vault work; finishing the Vault gives the Key, the stamp and the badges listed
- [ ] Series bridges: Looking-Glass opens only with the Alice Key; Hound only with the Sherlock Key
- [ ] Content notes followed (no graphic violence, no film designs, no Shepard art, flagged passages handled)
- [ ] No new engine code needed after PR 1; if any was, explain why in the PR
- [ ] Still smooth on a mid-range phone
