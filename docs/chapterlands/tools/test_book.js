// node test_book.js <bookId>  — loads every street + Sky Run, plays the Sky Run to the end,
// solves the Vault through its own UI, checks Key + stamp + badges.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
// The game folder, found from this script's own location (docs/chapterlands/tools → tools/chapterlands).
const ROOT = process.env.CHAPTERLANDS_ROOT || path.join(__dirname, '../../../tools/chapterlands') + '/';
const THREE_DIR = process.env.THREE_DIR || path.join(__dirname, 'three/node_modules/three');
const id = process.argv[2];
const cat = JSON.parse(fs.readFileSync(ROOT + 'catalogue/books.json'));
const meta = cat.books.find((b) => b.id === id);
const kit = JSON.parse(fs.readFileSync(ROOT + meta.contentPath + 'book.json'));
const qs = JSON.parse(fs.readFileSync(ROOT + meta.contentPath + 'questions.json'));
const only = process.argv[3];
const save = (extra = {}) => JSON.stringify(Object.assign({ v: 4, wallet: 100, earned: 100, profile: { name: 'Test Reader' },
  streets: { [id]: kit.streets.map((s) => s.id) }, streetGames: { [id]: kit.streets.map((s) => s.id) }, reading: { [id]: 99 },
  libraryCard: { stamps: [], keys: (meta.requiresKey ? [meta.requiresKey] : []).concat((process.env.KEYS || '').split(',').filter(Boolean)) } }, extra));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  async function open(url, sv) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.route(/unpkg\.com\/three@0\.160\.0\/(.*)/, (route) => { const f = path.join(THREE_DIR, route.request().url().split('three@0.160.0/')[1]); fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'application/javascript' }) : route.abort(); });
    await page.route(/fonts\.googleapis|fonts\.gstatic/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('chapterlands.save.v2', s); sessionStorage.setItem('seeded', '1'); } }, sv);
    await page.goto('http://localhost:8765/tools/chapterlands/' + url, { waitUntil: 'load' });
    await page.waitForSelector('#start-screen:not([hidden]), #locked:not([hidden])', { timeout: 60000 });
    return { page, ctx, errs };
  }
  const streets = kit.streets.map((s) => s.id).concat(kit.skyRun ? ['sky'] : []);
  for (const sid of streets) {
    if (only && only !== sid && only !== 'streets') continue;
    const { page, ctx, errs } = await open(`street/?book=${id}&street=${sid}`, save());
    let ok = false, info = '';
    try {
      const locked = await page.isVisible('#locked');
      if (locked) info = 'LOCKED: ' + await page.textContent('#locked-title');
      else {
        await page.click('#btn-start');
        await page.waitForTimeout(1500);
        const arcade = await page.isVisible('#arcade');
        info = arcade ? 'arcade' : (await page.textContent('#ob-text'));
        ok = errs.length === 0;
        if (sid === 'sky') {
          // play the Sky Run to the end: collect what's needed, then stand on the goal
          const r = await page.evaluate(async () => {
            const { A, player } = window.__street; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const gems = [], rings = [];
            A.scene.traverse((o) => { if (o.userData && o.userData.gem && o.parent === A.scene) gems.push(o); if (o.geometry && o.geometry.type === 'TorusGeometry') rings.push(o.parent); });
            for (const g of gems) { player.teleport(g.position.x, g.position.y + 0.05, g.position.z, 0); await wait(400); }
            const goal = rings[0];
            for (let i = 0; i < 40 && !document.querySelector('#finish:not([hidden])'); i++) { player.teleport(goal.position.x + 0.3, goal.position.y + 0.1, goal.position.z, 0); await wait(300); }
            return !!document.querySelector('#finish:not([hidden])');
          });
          const sv = JSON.parse(await page.evaluate(() => localStorage.getItem('chapterlands.save.v2')));
          info += ` | finished=${r}`;
          info += ` skyRuns=${JSON.stringify(sv.skyRuns)}`;
          ok = ok && r && !!(sv.skyRuns || {})[process.argv[2]];
        }
      }
    } catch (e) { ok = false; info += ' ERR ' + e.message.split('\n')[0]; }
    results.push(`${ok && !errs.length ? 'PASS' : 'FAIL'} street ${sid}: ${info.trim().slice(0, 110)} ${errs.slice(0, 2).join(' / ')}`);
    await ctx.close();
  }
  // vault
  if (!only || only === 'vault') {
    const { page, ctx, errs } = await open(`vault/?book=${id}`, save());
    let info = '';
    try {
      await page.click('#btn-start');
      await page.waitForTimeout(800);
      const n = await page.evaluate(() => window.__vault.LOCKS.length);
      const locks = await page.evaluate(() => window.__vault.LOCKS.map((L) => ({ kind: L.kind, type: L.s.solve && L.s.solve.type })));
      const stations = kit.vault.stations || [];
      for (let li = 0; li < n; li++) {
        const L = locks[li];
        // index of the station in the room (stations + quiz)
        const si = await page.evaluate((li) => { const L = window.__vault.LOCKS[li]; return window.__vault.stationIndex(L.s); }, li);
        await page.evaluate((si) => window.__vault.interact(si), si);
        await page.waitForTimeout(400);
        if (L.kind === 'quiz') {
          for (let k = 0; k < qs.vault.length; k++) { await page.click('.quiz-opt[data-k="' + qs.vault[k].answer + '"]'); await page.waitForTimeout(650); }
        } else {
          const sv = (await page.evaluate((si) => window.__vault.stationSolve(si), si));
          if (sv.type === 'choice') await page.click(`#clue-extra [data-i="${sv.answer}"]`);
          else if (sv.type === 'order') { await page.evaluate(() => { const b = document.getElementById('clue-extra'); b._order = b._order.map((_, i) => i); }); await page.click('#clue-extra [data-check]'); }
          else if (sv.type === 'match') { for (let r = 0; r < sv.pairs.length; r++) await page.click(`#clue-extra [data-row="${r}"][data-v="${sv.pairs[r][1].replace(/"/g, '\\"')}"]`); await page.click('#clue-extra [data-check]'); }
          else if (sv.type === 'code') { for (const ch of String(sv.answer)) await page.click(`#clue-extra [data-k="${ch}"]`); }
        }
        await page.waitForTimeout(900);
        if (await page.isVisible('#btn-lesson-close')) await page.click('#btn-lesson-close');
        await page.waitForTimeout(200);
      }
      info += 'locks ' + await page.textContent('#hud-locks');
      await page.evaluate(() => window.__vault.player.teleport(0, 0.05, 7.6, 0));
      await page.waitForTimeout(1500);
      const sv = JSON.parse(await page.evaluate(() => localStorage.getItem('chapterlands.save.v2')));
      const won = await page.isVisible('#win');
      const stamp = sv.libraryCard.stamps.includes(id), key = sv.libraryCard.keys.includes(id);
      info += ` | won=${won} stamp=${stamp} key=${key} badges=${Object.keys(sv.badges).join(',')}`;
      results.push(`${won && stamp && key && !errs.length ? 'PASS' : 'FAIL'} vault: ${info} ${errs.slice(0, 2).join(' / ')}`);
    } catch (e) { results.push('FAIL vault: ' + info + ' ERR ' + e.message.split('\n')[0] + ' ' + errs.join(' / ')); }
    await ctx.close();
  }
  console.log(results.join('\n'));
  await browser.close();
})();
