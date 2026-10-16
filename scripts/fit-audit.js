// Fit-to-screen guard. Paste into the browser console (or the Browser pane) on a signed-in game page at narrow
// widths such as 300px, 375px and 450px, then run `await fitAudit()`. It opens every phone app, page, tray,
// sheet and object menu in turn and lists anything that scrolls sideways or sticks out past the screen edge.
// An empty `problems` list is a pass. It only opens screens; it never buys, starts or posts anything.
window.fitAudit = async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const W = () => document.documentElement.clientWidth;
  // Fire a game action the way a tap on a button would (the game listens for clicks on [data-action]).
  const fire = (action, data = {}) => { const b = document.createElement('button'); b.dataset.action = action; Object.assign(b.dataset, data); b.hidden = true; document.body.append(b); b.click(); b.remove(); };
  const tap = sel => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
  function check(label) {
    const out = [], w = W();
    if (document.documentElement.scrollWidth > w + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${w})`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[hidden]') || el.closest('canvas')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const name = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
      if (['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${name} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
      // Sticking out past the screen edge, unless a parent that fits the screen clips it on purpose.
      if ((r.right > w + 1 || r.left < -1) && !el.closest('#world3dWrap,.reward-burst,.home-skyline')) {
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= w + 1 && pr.left >= -1) { clipped = true; break; } } }
        if (!clipped) out.push(`${name} sticks out (${Math.round(r.left)}..${Math.round(r.right)} of ${w})`);
      }
    }
    return [...new Set(out)].map(p => `${label}: ${p}`);
  }
  const problems = [], close = async () => { tap('#closeModal'); tap('[data-action=closeTray]'); tap('[data-action=closeTip]'); await wait(250); };
  const run = async (label, open) => { await close(); if (await open() === false) return; await wait(700); problems.push(...check(label)); };
  problems.push(...check('screen'));
  for (const tray of ['prepare', 'practice', 'emotes', 'ambience']) await run(`tray ${tray}`, () => fire(tray));
  await run('socialise tray', () => fire('recover', {need: 'social'}));
  await run('phone home', () => fire('openPhone'));
  const apps = [...document.querySelectorAll('#modal [data-action=app]')].map(b => b.dataset.app).filter(a => !['logout', 'camera'].includes(a));
  for (const app of apps) await run(`app ${app}`, async () => { fire('openPhone'); await wait(300); return tap(`#modal [data-action=app][data-app="${app}"]`); });
  for (const page of ['estate', 'barber', 'tattoo', 'tailor', 'phones', 'shop', 'vip', 'inventory', 'wardrobe', 'career', 'profile', 'tips', 'phone']) await run(`page ${page}`, () => fire('page', {page}));
  await run('work options', () => fire('prepareDetails', {kind: 'produce'}));
  await run('my life', () => fire('lifePanel'));
  await run('collabs', () => fire('phoneTab', {tab: 'collabs'}));
  await run('friend sheet', async () => { fire('app', {app: 'friends'}); await wait(500); return tap('[data-action=friendMenu]'); });
  await run('chat thread', async () => { fire('app', {app: 'chat'}); await wait(500); return tap('[data-action=openThread]'); });
  for (const key of [...document.querySelectorAll('#objects .object-button')].map(b => b.dataset.key).slice(0, 30)) await run(`menu ${key}`, () => fire('object', {key}));
  await close();
  console.log(problems.length ? problems.join('\n') : `Fits at ${W()}px: nothing scrolls sideways.`);
  return {width: W(), problems};
};
