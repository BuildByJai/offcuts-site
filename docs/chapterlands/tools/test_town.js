// node test_town.js <bookId> — district side quest end to end in the town, plus the series bridge.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = '/home/user/offcuts-site/tools/chapterlands/';
// three.js r160 is loaded from unpkg in the pages; point THREE_DIR at a local copy (npm i three@0.160.0) when unpkg is unreachable.
const THREE_DIR = process.env.THREE_DIR || path.join(__dirname, 'three/node_modules/three');
const id = process.argv[2];
const cat = JSON.parse(fs.readFileSync(ROOT + 'catalogue/books.json'));
const meta = cat.books.find((b) => b.id === id);
const kit = JSON.parse(fs.readFileSync(ROOT + meta.contentPath + 'book.json'));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  async function open(sv) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
    const page = await ctx.newPage(); page.setDefaultTimeout(240000);
    await page.route(/unpkg\.com\/three@0\.160\.0\/(.*)/, (route) => { const f = path.join(THREE_DIR, route.request().url().split('three@0.160.0/')[1]); fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'application/javascript' }) : route.abort(); });
    await page.route(/fonts\.googleapis|fonts\.gstatic/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.addInitScript((s) => { localStorage.setItem('chapterlands.save.v2', s); }, JSON.stringify(sv));
    await page.goto('http://localhost:8765/tools/chapterlands/', { waitUntil: 'load' });
    await page.waitForSelector('#start-screen:not([hidden])', { timeout: 90000 });
    await page.click('#btn-play');
    return { page, ctx, errs };
  }
  const keys = meta.requiresKey ? [meta.requiresKey] : [];
  // side quest
  if (kit.sideQuest) {
    const { page, ctx, errs } = await open({ v: 4, libraryCard: { stamps: keys, keys }, sideQuests: { 'white-rabbit': { step: 4, done: true, got: {}, gave: {} } } });
    const r = await page.evaluate(async (qid) => {
      const C = window.__chapterlands, Q = C.quests, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const until = async (f, ms = 15000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(60); return f(); };
      const q = Q.quests.find((x) => x.id === qid);
      if (!q) return { err: 'quest not registered' };
      const log = [];
      for (let guard = 0; guard < 20 && !C.Save.quest(qid).done; guard++) {
        const st = { step: C.Save.quest(qid).step }, s = q.steps[st.step];
        if (s.type === 'talk') { Q.talk(s.params.npc); await wait(60); document.getElementById('btn-say-close').click(); await wait(100); }
        else if (s.type === 'collect') { for (const it of s.params.items) { const I = Q.items[it.id]; C.player.teleport(I.x, I.base + 0.05, I.z, 0); if (!(await until(() => C.Save.quest(qid).got[it.id]))) log.push('missed ' + it.id + ' at ' + [I.x, I.z].map(Math.round)); } }
        else if (s.type === 'deliver') { for (const T of Q.targets.filter((t) => t.q.id === qid)) Q.deliver(T); await wait(100); }
        else if (s.type === 'reach') { const n = s.params.actor && Q.npcs[s.params.actor]; const t0 = Date.now(); while (C.Save.quest(qid).step === st.step && Date.now() - t0 < 120000) { const p = n ? n.g.position : null; if (p) C.player.teleport(p.x + 0.4, 0.05, p.z, 0); await wait(200); } }
        log.push(`step ${st.step}→${C.Save.quest(qid).step}`);
        if (C.Save.quest(qid).step === st.step && !C.Save.quest(qid).done) { log.push('STUCK on ' + s.type); break; }
      }
      return { done: C.Save.quest(qid).done, log };
    }, kit.sideQuest.id);
    out.push(`${r.done && !errs.length ? 'PASS' : 'FAIL'} side quest ${kit.sideQuest.id}: ${JSON.stringify(r).slice(0, 300)} ${errs.join(' / ')}`);
    await ctx.close();
  }
  // bridge
  if (meta.requiresKey) {
    for (const has of [false, true]) {
      const { page, ctx, errs } = await open({ v: 4, libraryCard: { stamps: has ? keys : [], keys: has ? keys : [] } });
      await page.evaluate((id) => window.__chapterlands.enterDistrict(window.__chapterlands.Catalogue.getBook(id)), id);
      await page.waitForTimeout(1500);
      const panel = await page.isVisible('#district');
      const toast = await page.textContent('#toasts');
      const ok = has ? panel : (!panel && /Key/.test(toast));
      out.push(`${ok ? 'PASS' : 'FAIL'} bridge (${has ? 'with' : 'without'} ${meta.requiresKey} Key): panel=${panel} toast="${toast.slice(0, 90)}"`);
      await ctx.close();
    }
  }
  console.log(out.join('\n'));
  await browser.close();
})();
