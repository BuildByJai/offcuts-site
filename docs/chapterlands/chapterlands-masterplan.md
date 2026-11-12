# Chapterlands — Masterplan (locked 12 Nov 2026)

> **Name: Chapterlands** (formerly the working title "Book Town"). Subject to trademark, domain and app store checks; see §10.
> Build order for today is in `chapterlands-build-day-brief.md`, which **overrides this doc where they differ** (notably the Reading Room list).

## 1. What Chapterlands is

A game where kids **read books to unlock the world**. Each book is a district of the town. Reading chapters opens its streets; short games and missions check the player understood what they read. Points help you play. **Only reading opens doors.**

- **Audience:** ages **7–14**. Under 7 = screen-free. Adults get a separate world/site later, never mixed with kids.
- **Customer:** parents first, schools later.
- **What parents pay for:** proof their child actually read and understood a book. The game is the delivery.

## 2. The library structure (game world = file structure)

**Organised by category (genre) only. No age sections in the game.** Difficulty is shown by a **reading level** tag and by **distance from the square**, not by age.

| Library | Chapterlands | Example |
|---|---|---|
| Section | **Quarter** (category) | Fantasy · Adventure · Animals & Nature · Friends & Family · Mystery · Sci-Fi · Life Skills |
| Book | District | Alice's Adventures in Wonderland |
| Series | Borough (districts joined by bridges) | Alice → Through the Looking-Glass |
| Chapter (or group) | Street / building | "The Mad Tea-Party" |
| Library card | Player progress | One stamp per finished book, Keys held |

**Reading levels** (a rough guide, to be refined with teachers and playtests):

| Level | Feels like | Example |
|---|---|---|
| 1 | Short, simple language, quick wins | The Velveteen Rabbit |
| 2 | A full children's novel | Alice, Wizard of Oz, The Railway Children |
| 3 | Longer, richer or older language | Treasure Island, Sherlock Holmes, The Wind in the Willows |
| 4 | Challenging | The Sign of Four, The War of the Worlds, Meditations |

- **The map does the sorting:** each quarter is a road leading out from Library Square. **Level 1 books sit nearest the square, Level 4 at the far end.** Nobody is shut out of anything.
- **Level shown on every district sign and library card slot** (1–4 book icons). Stage B: parents can set an optional maximum level.
- **District size follows the book.** Short book = a few streets. Novel = full district. Series = borough.
- **Streets unlock as you read** (chapter checkpoints with a quick check), so rewards arrive along the way and the game never spoils chapters not yet read.
- **Finishing a book** = the district's **Key** + a library card stamp. Finishing book 1 of a series builds the **bridge** to book 2.
- **Lookout Towers:** one per quarter. The whole town is visible from the start, under fog. Climbing a tower lifts the fog and reveals that road's districts.
- **Side quests** never need reading: escaped characters, lost books, errands, collectibles, rooftops, the Secret Room (The Study).
- **Coins** buy help on skill games and **hints** on reading checks. They never buy answers.

## 3. The District Kit

A new district = **a data file + reskinned art, no new code.** Reusable game templates (see Build Day brief). Per book: streets, templates, questions, Sky Run, side quest, Vault (escape room on The Study engine). The kit later becomes the **creator tool** for authors, publishers and teachers.

## 4. Lights Out (bedtime) — separate brief, later

- **Stage A:** fixed **21:00–07:00** by the **device's own clock**, both values in `config.js`. No location, no time zone, nothing sent anywhere.
- 20:55 wind-down warning → save → Lights Out screen: *"Read tonight, and you'll wake up rested."* Next morning: a quick check gives the **Rested bonus**. Reading Room closed during Lights Out.
- **Stage B:** parents can change the times. Honour system, a nudge, not a lock.

## 4b. Reading Room

- Public-domain books readable in-game, chapter by chapter. The end of a chapter leads to its check, which unlocks the street.
- Sources: Standard Ebooks first; Project Gutenberg as fallback **with all Project Gutenberg references and the licence stripped**. Check UK status too; translators must have died 70+ years ago.
- Books can be readable before their district is built; reading data decides what to build next.
- **Not readable in-game:** copyrighted books (Atomic Habits) and books held back for offensive language (see Build Day brief). These link to the local library (BorrowBox / Libby) behind the grown-up check.

## 5. Hard rules (the "we won't" list)

- No free text chat, voice, direct messages, trading, or content uploaded by users. Ever, for kids.
- No ads targeted at children and no profiling. Only contextual or sponsor placements, clearly labelled.
- Affiliate "buy the book" links live in the **grown-ups' area**, not in front of kids.
- Kids never spend real money. No loot boxes, no coin packs.
- Usernames are auto-generated. Players type nothing that other players see.
- No location data, ever.
- Copyrighted books: lessons in our own words, no quotes, no cover art, no characters. Public-domain books: characters and scenes are fine, but no film designs (Disney, MGM) and no E. H. Shepard art.
- Violence from the books stays off-screen and non-graphic.
- Under-13 accounts (Stage B) are created by a parent.

## 6. Stages and gates

### Stage A — Prototype on Offcuts (free, no accounts)
Today: Build Day (Foundations + District Kit + Reading Room + 15 districts). Later: Lights Out. Content: short videos from game footage aimed at parents, teachers and teens.

**Gate A → B**
- [ ] Playtested with 10–20 real kids aged 7–14 (with parents' agreement)
- [ ] At least half of players who open street 1 go on to unlock street 3, without being nagged
- [ ] Kids come back in week 2 on their own
- [ ] At least 5 parents say a concrete "yes, I'd pay £X/month"

Measured with **anonymous event counts only**. No names, no personal data.

### Stage B — Own site, first income
Own domain, parent-created accounts, saves online, Parent Hub, **Library Pass** subscription (~£3–5/month to test; free tier = town, side quests, **all reading**, first district per quarter), prints and merch, a new district roughly every 2 weeks.

**Gate B → C:** ~100 paying families · cancellations under ~10%/month · 8+ districts live.

### Stage C — Grow
Shared town goals and ghost runs (no contact), Chapterlands multiverse video series (rented compute, no hardware purchase), school pilot, publisher-sponsored districts.

**Gate C → D:** school pilot positive · series audience growing · Online Safety Act risk assessment done before any real-time features · hardware only if renting has cost more than owning for 3 months running.

### Stage D — Social and creators
Real-life friends (parent-approved codes, emotes and preset phrases only), classrooms, District Kit for vetted authors/publishers/teachers, in-game character creator with curated cameos, adults' world on a separate site.

## 7. Income streams

| Stream | Stage | Notes |
|---|---|---|
| Parent subscription (Library Pass) | B | Main income |
| School licences | C+ | Bigger, slower |
| Publisher sponsorship of districts | C+ | Labelled, contextual |
| Prints and merch | B | Poster engine output |
| Multiverse series | C | Mainly marketing |
| Affiliate links (grown-ups' area) | B | Small, zero cost |
| In-game ads | — | Avoid |

## 8. Book catalogue by category

**Rights:** 🟢 public domain UK + US · 🟡 check · 🔴 copyrighted → own words only. **Lv** = reading level 1–4.

### Fantasy
| ID | Book | Author | Lv | Rights | Series |
|---|---|---|---|---|---|
| fan-velveteen | The Velveteen Rabbit | Margery Williams | 1 | 🟢 | |
| fan-justso | Just So Stories | Rudyard Kipling | 1 | 🟢 | |
| fan-alice-1 | Alice's Adventures in Wonderland | Lewis Carroll | 2 | 🟢 | alice 1 |
| fan-alice-2 | Through the Looking-Glass | Lewis Carroll | 2 | 🟢 | alice 2 |
| fan-oz-1 | The Wonderful Wizard of Oz | L. Frank Baum | 2 | 🟢 | oz 1 |
| fan-oz-2 | The Marvelous Land of Oz | L. Frank Baum | 2 | 🟢 | oz 2 |
| fan-oz-3 | Ozma of Oz | L. Frank Baum | 2 | 🟢 | oz 3 |
| fan-psam-1 | Five Children and It | E. Nesbit | 2 | 🟢 | psammead 1 |
| fan-psam-2 | The Phoenix and the Carpet | E. Nesbit | 2 | 🟢 | psammead 2 |
| fan-psam-3 | The Story of the Amulet | E. Nesbit | 3 | 🟢 | psammead 3 |
| fan-gob-1 | The Princess and the Goblin | George MacDonald | 2 | 🟢 | princess 1 |
| fan-gob-2 | The Princess and Curdie | George MacDonald | 3 | 🟢 | princess 2 |
| fan-pinocchio | The Adventures of Pinocchio | Carlo Collodi | 2 | 🟢 | |

### Adventure
| ID | Book | Author | Lv | Rights |
|---|---|---|---|---|
| adv-swiss | The Swiss Family Robinson | Johann David Wyss | 3 | 🟢 |
| adv-treasure | Treasure Island | Robert Louis Stevenson | 3 | 🟢 |
| adv-80days | Around the World in Eighty Days | Jules Verne | 3 | 🟢 |
| adv-kidnapped | Kidnapped | Robert Louis Stevenson | 4 | 🟢 |
| adv-musketeers | The Three Musketeers | Alexandre Dumas | 4 | 🟢 |

### Animals & Nature
| ID | Book | Author | Lv | Rights |
|---|---|---|---|---|
| ani-beauty | Black Beauty | Anna Sewell | 2 | 🟢 |
| ani-jungle | The Jungle Book (Mowgli stories) | Rudyard Kipling | 3 | 🟢 |
| ani-willows | The Wind in the Willows | Kenneth Grahame | 3 | 🟢 |
| ani-wild | The Call of the Wild | Jack London | 3 | 🟢 |

### Friends & Family
| ID | Book | Author | Lv | Rights |
|---|---|---|---|---|
| fam-railway | The Railway Children | E. Nesbit | 2 | 🟢 |
| fam-heidi | Heidi | Johanna Spyri | 2 | 🟢 |
| fam-garden | The Secret Garden | Frances Hodgson Burnett | 2 | 🟢 |

### Mystery
| ID | Book | Author | Lv | Rights | Series |
|---|---|---|---|---|---|
| mys-holmes-3 | The Adventures of Sherlock Holmes | Arthur Conan Doyle | 3 | 🟢 | sherlock 1 |
| mys-holmes-4 | The Hound of the Baskervilles | Arthur Conan Doyle | 3 | 🟢 | sherlock 2 |
| mys-39steps | The Thirty-Nine Steps | John Buchan | 3 | 🟢 | |
| mys-holmes-1 | A Study in Scarlet | Arthur Conan Doyle | 4 | 🟢 | |
| mys-holmes-2 | The Sign of Four | Arthur Conan Doyle | 4 | 🟢 | |
| mys-brown | The Innocence of Father Brown | G. K. Chesterton | 4 | 🟢 | |
| mys-moonstone | The Moonstone | Wilkie Collins | 4 | 🟢 | |

### Sci-Fi
| ID | Book | Author | Lv | Rights |
|---|---|---|---|---|
| sci-lostworld | The Lost World | Arthur Conan Doyle | 3 | 🟢 |
| sci-time | The Time Machine | H. G. Wells | 3 | 🟢 |
| sci-centre | Journey to the Centre of the Earth | Jules Verne | 3 | 🟢 |
| sci-worlds | The War of the Worlds | H. G. Wells | 4 | 🟢 |
| sci-20k | Twenty Thousand Leagues Under the Seas | Jules Verne | 4 | 🟢 |

### Life Skills
| ID | Book | Author | Lv | Rights |
|---|---|---|---|---|
| life-atomic | Atomic Habits | James Clear | 3 | 🔴 (live: existing escape room) |
| life-7habits | The 7 Habits of Highly Effective Teens | Sean Covey | 3 | 🔴 |
| life-franklin | Franklin's Autobiography (13 virtues chapters) | Benjamin Franklin | 3 | 🟢 |
| life-thinketh | As a Man Thinketh | James Allen | 3 | 🟢 |
| life-friends | How to Win Friends and Influence People (1936) | Dale Carnegie | 3 | 🟡 treat as own words |
| life-mindset | Mindset | Carol Dweck | 4 | 🔴 |
| life-meditations | Meditations | Marcus Aurelius | 4 | 🟢 |

**Held back entirely:** Peter Pan (Great Ormond Street royalty right), Winnie-the-Pooh (UK text free from 2027; illustrations protected), Doctor Dolittle, King Solomon's Mines, Huckleberry Finn (racist content).

## 10. Name: Chapterlands

Chosen 12 Nov 2026. Hub = Library Square ("Spinewick" kept in reserve). Before spending on the brand: UK IPO trademark search (classes 9, 28, 41), domains, app store names, social handles.
