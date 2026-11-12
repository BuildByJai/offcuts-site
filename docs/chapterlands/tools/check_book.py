#!/usr/bin/env python3
"""Chapterlands book checks. Run from the repo root:

    python3 docs/chapterlands/tools/check_book.py tools/chapterlands/content/fantasy/fan-velveteen

1. questions.json: 3 questions per street, 3 options each, 5-8 Vault questions,
   every question has evidence + hint, and (for readable books) the evidence
   is found word for word in the chapter it names.
2. Writes review.md (all questions with evidence) for Jai to skim.
3. Readable books: no Project Gutenberg references left in chapters/, and an
   offensive-term scan (prints hits for the PR description; never edits text).
"""
import json, os, re, sys

TERMS = [  # whole-word, case-insensitive. Hits are listed for a human to judge.
    r'n[i1]gg\w*', r'negro\w*', r'darkie\w*', r'darky', r'coon', r'pickaninn\w*', r'savages?', r'injuns?', r'red ?skins?',
    r'squaws?', r'half[- ]?breeds?', r'half[- ]?castes?', r'mulatto\w*', r'quadroon\w*', r'coolies?', r'chinam[ae]n', r'chinks?',
    r'japs?', r'gyp\w*', r'gypsy', r'gipsy', r'gypsies', r'gipsies', r'jew(?:ed|ing)\b', r'hebrews?', r'yids?', r'kikes?', r'dagos?',
    r'wops?', r'spics?', r'wogs?', r'golliwogs?', r'hottentots?', r'kaffirs?', r'barbarians?', r'heathens?', r'natives?',
    r'cripples?', r'crippled', r'idiots?', r'imbeciles?', r'morons?', r'retard\w*', r'lunatics?', r'dwarf\w*', r'midgets?',
    r'deformed', r'disabled', r'dumb', r'lame', r'queer', r'fag\w*', r'spinsters?', r'wench\w*', r'harlots?',
]
PG = re.compile(r'gutenberg|project gutenberg|this ebook|e-?text|license|licence|www\.', re.I)

def norm(s):
    return re.sub(r'\s+', ' ', s.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")).strip()

def main(d):
    book = json.load(open(os.path.join(d, 'book.json')))
    q = json.load(open(os.path.join(d, 'questions.json')))
    cat = json.load(open(os.path.join(d, '../../../catalogue/books.json')))
    meta = next(b for b in cat['books'] if b['id'] == book['id'])
    chapters = {}
    for c in book.get('chapterFiles', []):
        p = os.path.join(d, 'chapters', c['file'])
        if os.path.exists(p):
            chapters[c['n']] = open(p, encoding='utf-8').read()
    problems = []
    for s in book['streets']:
        lst = q['streets'].get(s['id'], [])
        if len(lst) != 3: problems.append(f"street {s['id']}: {len(lst)} questions (need 3)")
    if not 5 <= len(q.get('vault', [])) <= 8: problems.append(f"vault: {len(q.get('vault', []))} questions (need 5-8)")
    allq = [(sid, x) for sid, lst in q['streets'].items() for x in lst] + [('vault', x) for x in q.get('vault', [])]
    for sid, x in allq:
        if len(x['options']) != 3: problems.append(f"{sid}: '{x['q'][:40]}' has {len(x['options'])} options")
        if not x.get('evidence'): problems.append(f"{sid}: '{x['q'][:40]}' has no evidence")
        if not x.get('hint'): problems.append(f"{sid}: '{x['q'][:40]}' has no hint")
        if meta['readable'] and chapters:
            if norm(x['evidence']) not in norm(chapters.get(x['chapter'], '')):
                problems.append(f"{sid}: evidence not found in chapter {x['chapter']}: {x['evidence'][:60]}")
        elif not meta['readable'] and len(re.findall(r'[.!?](\s|$)', x['evidence'])) > 1:
            problems.append(f"{sid}: held-back book evidence must be one short sentence")
    if not meta['readable'] and os.path.isdir(os.path.join(d, 'chapters')):
        problems.append('held-back book has a chapters/ folder: its text must not be committed')
    # review.md
    out = [f"# Review — {meta['title']}", '', f"Level {meta['level']} · {meta['quarter']} · readable in-game: {'yes' if meta['readable'] else 'no'}", '',
           'Right answer in **bold**. Evidence is the supporting sentence from the text (never shown to players).', '']
    for s in book['streets']:
        out += [f"## {s['name']} ({book.get('chapterWord', 'Chapter')} {', '.join(map(str, s['chapters']))}) · {s['template']}", '']
        for i, x in enumerate(q['streets'].get(s['id'], []), 1):
            out += [f"{i}. *{x.get('kind', '')}* — {x['q']}"]
            out += [f"   - {'**' + o + '**' if k == x['answer'] else o}" for k, o in enumerate(x['options'])]
            out += [f"   - Evidence ({book.get('chapterWord', 'Chapter').lower()} {x['chapter']}): \"{x['evidence']}\"", f"   - Hint: {x['hint']}", '']
    out += ['## Vault — the whole book', '']
    for i, x in enumerate(q.get('vault', []), 1):
        out += [f"{i}. {x['q']}"]
        out += [f"   - {'**' + o + '**' if k == x['answer'] else o}" for k, o in enumerate(x['options'])]
        out += [f"   - Evidence ({book.get('chapterWord', 'Chapter').lower()} {x['chapter']}): \"{x['evidence']}\"", f"   - Hint: {x['hint']}", '']
    v = book.get('vault', {})
    for st in v.get('stations', []):
        if st.get('solve'):
            sv = st['solve']
            out += [f"- Vault puzzle — {st['label']} ({sv['type']}): {sv.get('prompt', '')}"]
            if sv['type'] == 'order': out += [f"  - Order: {' → '.join(sv['items'])}"]
            if sv['type'] == 'choice': out += [f"  - Answer: {sv['options'][sv['answer']]}"]
    open(os.path.join(d, 'review.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    # scans
    hits = []
    for n, txt in sorted(chapters.items()):
        if PG.search(txt): problems.append(f'chapter {n}: Project Gutenberg / licence reference left in')
        for t in TERMS:
            for m in re.finditer(r'\b' + t + r'\b', txt, re.I):
                a = max(0, m.start() - 60); b = min(len(txt), m.end() + 60)
                hits.append((n, m.group(0), norm(txt[a:b])))
    print(f"{meta['title']}: {len(allq)} questions, {len(chapters)} chapter files")
    print('PROBLEMS:' if problems else 'No problems found.')
    for p in problems: print('  -', p)
    print(f'Offensive-term scan: {len(hits)} hit(s)')
    for n, w, ctx in hits: print(f'  - {book.get("chapterWord", "Chapter")} {n}: "{w}" … {ctx} …')
    return 1 if problems else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
