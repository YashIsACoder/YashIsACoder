// yash.nvim — homepage: the projects matrix, floating windows,
// the solar-leg explorable, QuantSprint lite and the blog shelf.
import { ROWS, COLS, PROJECTS } from './projects.js';
import { command, map, setMode } from './core.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rowOf = (id) => ROWS.find((r) => r.id === id);

// ------------------------------------------------------------ matrix
function tile(p) {
  const r = rowOf(p.row);
  const foot = [p.ontap ? '<span class="live">● live</span>' : '', p.brewing ? '<span class="wip">◌ in progress</span>' : '', p.private ? '<span>private</span>' : '', `<span>${esc(p.lang)}</span>`].join('');
  return `<button type="button" class="tile${p.brewing ? ' tile--wip' : ''}" data-project="${p.id}" aria-haspopup="dialog" style="--row: var(${r.colour})">
    <span class="tile__name">${esc(p.name)}</span>
    <span class="tile__one">${esc(p.one)}</span>
    <span class="tile__foot">${foot}</span>
  </button>`;
}
function renderMatrix() {
  const host = $('#matrix');
  if (!host) return;
  let html = '<div class="matrix__corner" aria-hidden="true">domain ↓ · kind →</div>';
  html += COLS.map((c) => `<div class="matrix__col" role="columnheader"><b>${esc(c.name)}</b><span>${esc(c.note)}</span></div>`).join('');
  for (const r of ROWS) {
    html += `<div class="matrix__row" role="rowheader" style="--row: var(${r.colour}); --row-text: var(${r.colour.replace('--', '--t-')})"><b>${esc(r.name)}</b><span>${esc(r.note)}</span></div>`;
    for (const c of COLS) {
      const items = PROJECTS.filter((p) => p.row === r.id && p.col === c.id);
      html += items.length
        ? `<div class="matrix__cell" role="cell" data-col="${esc(c.name)}">${items.map(tile).join('')}</div>`
        : `<div class="matrix__cell matrix__cell--empty" role="cell" data-col="${esc(c.name)}">-- empty</div>`;
    }
  }
  host.innerHTML = html;
}

// ------------------------------------------------------------ floating window
const fl = $('#float');
const win = fl && $('.float__win', fl);
const body = fl && $('#float-body', fl);
let openId = null, lastTile = null, cleanup = [];

function links(p) {
  const out = p.links.map((l) => {
    const ext = /^https?:/.test(l.href);
    return `<a class="btn${l.primary ? ' btn--primary' : ''}" href="${esc(l.href)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${esc(l.label)}${ext ? ' ↗' : ''}</a>`;
  });
  if (p.private) out.push('<span class="btn" aria-disabled="true">private repo · ask me for a demo</span>');
  if (p.brewing) out.push('<span class="btn" aria-disabled="true">in progress · 2027</span>');
  return out.join('');
}
function tapHTML(p) {
  const t = p.tap;
  if (!t) return `<div class="tap"><div class="tap__bar"><span>${esc(p.id)}/README.md</span><span>${esc(p.lang)}</span></div>
      <div class="lab"><p class="lab__fine" style="font-size:15.5px">${p.private ? 'This one lives in a private repo. I’m happy to walk you through the code on a call.' : 'Clone it, build it with CMake or npm, and run it locally. The README has the steps.'}</p>
      <pre class="mono" style="margin:0;padding:14px;border-radius:8px;background:var(--crust);font-size:13.5px;overflow-x:auto">${p.private ? '<span class="tok-c">// private · demo on request</span>' : `<span class="tok-f">git</span> clone ${esc((p.links[0] || {}).href || '')}`}</pre></div></div>`;
  if (t.kind === 'iframe') return `<div class="tap"><div class="tap__bar"><b>● ${esc(t.label)}</b><a href="${esc(t.src)}" target="_blank" rel="noopener">open full screen ↗</a></div><iframe data-src="${esc(t.src)}" title="${esc(p.name)}, running live" loading="lazy"></iframe></div>`;
  if (t.kind === 'code') return `<div class="tap"><div class="tap__bar"><span>${esc(t.title)}</span><span>${esc(t.lang)}</span></div><pre><code>${highlight(t.code)}</code></pre></div>`;
  if (t.kind === 'solar') return '<div class="tap"><div class="tap__bar"><b>● how fast should a solar car drive?</b><span>live</span></div><div class="lab" data-solar></div></div>';
  if (t.kind === 'sprint') return '<div class="tap"><div class="tap__bar"><b>● quantsprint lite</b><span data-best></span></div><div class="sprint" data-sprint></div></div>';
  return '';
}
function projectHTML(p) {
  const r = rowOf(p.row);
  const i = PROJECTS.indexOf(p);
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(i + 1) % PROJECTS.length];
  return `
    <div class="proj__head">
      <span class="proj__kicker">projects/<b>${esc(r.id)}</b>/${esc(p.id)} · ${esc(p.lang)}</span>
      <h2 class="proj__title" id="float-title" tabindex="-1">${esc(p.name)}</h2>
      <p class="proj__one">${esc(p.one)}</p>
      <div class="proj__links">${links(p)}</div>
    </div>
    <div class="proj__body">
      <div class="proj__about">
        ${p.about.map((t) => `<p>${esc(t)}</p>`).join('')}
        <h3>highlights</h3>
        <ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <h3>stack</h3>
        <div class="chips">${p.stack.map((s) => `<span class="tagc">${esc(s)}</span>`).join('')}</div>
      </div>
      <div>${tapHTML(p)}</div>
    </div>
    <nav class="proj__nav" aria-label="More projects">
      <button type="button" data-goto="${prev.id}"><small>← h · previous</small><b>${esc(prev.name)}</b></button>
      <button type="button" data-goto="${next.id}"><small>next · l →</small><b>${esc(next.name)}</b></button>
    </nav>`;
}
function fill(p) {
  win.style.setProperty('--row', `var(${rowOf(p.row).colour})`);
  win.style.setProperty('--row-text', `var(${rowOf(p.row).colour.replace('--', '--t-')})`);
  $('[data-float-name]', fl).textContent = p.id;
  body.innerHTML = projectHTML(p);
  body.scrollTop = 0;
  cleanup.forEach((f) => f()); cleanup = [];
  const frame = $('iframe[data-src]', body); if (frame) frame.src = frame.dataset.src;
  const solar = $('[data-solar]', body); if (solar) mountSolar(solar);
  const sprint = $('[data-sprint]', body); if (sprint) cleanup.push(mountSprint(sprint, $('[data-best]', body)));
}
function openUI(id, from) {
  const p = PROJECTS.find((x) => x.id === id);
  if (!p || !fl) return false;
  const was = !!openId;
  openId = id; if (from) lastTile = from;
  fill(p);
  fl.classList.add('is-open'); document.body.classList.add('is-floating'); setMode('FLOAT');
  if (!reduce()) {
    if (!was && from) {
      const a = from.getBoundingClientRect(), b = win.getBoundingClientRect();
      win.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.85,.25,1)' });
      body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 200, fill: 'backwards' });
      $('.float__dim', fl).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    } else if (was) body.animate([{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  $('#float-title', fl).focus({ preventScroll: true });
  return true;
}
function closeUI() {
  if (!openId) return;
  cleanup.forEach((f) => f()); cleanup = [];
  const t = document.querySelector(`.tile[data-project="${openId}"]`) || lastTile;
  openId = null;
  const done = () => { fl.classList.remove('is-open'); document.body.classList.remove('is-floating'); body.innerHTML = ''; setMode('NORMAL'); t?.focus({ preventScroll: true }); };
  if (reduce() || !t) return done();
  const a = t.getBoundingClientRect(), b = win.getBoundingClientRect();
  $('.float__dim', fl).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
  const an = win.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, opacity: 0.3 }], { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)' });
  an.onfinish = () => { $('.float__dim', fl).getAnimations().forEach((x) => x.cancel()); done(); };
}
function requestClose() {
  if (history.state && history.state.p) history.back();
  else { closeUI(); history.replaceState(null, '', '#projects'); }
}
export function openProject(id, from) {
  const t = from || document.querySelector(`.tile[data-project="${id}"]`);
  if (openId) { if (!openUI(id)) return false; history.replaceState({ p: id }, '', `#p/${id}`); return true; }
  if (!openUI(id, t)) return false;
  history.pushState({ p: id }, '', `#p/${id}`);
  return true;
}
function fromHash() {
  const m = location.hash.match(/^#p\/([\w-]+)/);
  if (m) { if (openId !== m[1]) openUI(m[1], openId ? null : document.querySelector(`.tile[data-project="${m[1]}"]`)); }
  else if (openId) closeUI();
}
function step(d) { const i = PROJECTS.findIndex((p) => p.id === openId); openProject(PROJECTS[(i + d + PROJECTS.length) % PROJECTS.length].id); }

if (fl) {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tile[data-project]'); if (t) return openProject(t.dataset.project, t);
    const g = e.target.closest('[data-goto]'); if (g && fl.contains(g)) return openProject(g.dataset.goto);
    if (e.target.closest('[data-float-close]') || e.target.classList.contains('float__dim')) return requestClose();
    const s = e.target.closest('[data-float-step]'); if (s) step(+s.dataset.floatStep);
  });
  addEventListener('popstate', fromHash);
  document.addEventListener('keydown', (e) => {
    if (!openId) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape' || (!typing && e.key === 'q')) { e.preventDefault(); return requestClose(); }
    if (!typing && (e.key === 'l' || e.key === 'ArrowRight')) step(1);
    if (!typing && (e.key === 'h' || e.key === 'ArrowLeft')) step(-1);
    if (!typing && e.key === 'o') { const a = $('.proj__links a', body); if (a) a.click(); }
    if (e.key === 'Tab') {
      const f = [...win.querySelectorAll('a[href], button:not([disabled]), input, iframe, [tabindex="0"]')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && (document.activeElement === f[0] || !win.contains(document.activeElement))) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
}

// ------------------------------------------------------------ code colour
function highlight(src) {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\[\[\w+\]\])|\b(namespace|struct|class|public|private|const|constexpr|noexcept|void|bool|double|auto|for|while|if|else|return|template|typename|using|static|inline)\b|(std::[\w:]+|Interval95|PairedOutcomes)|\b(\d+(?:\.\d+)?)\b|\b([a-z_]\w*)(?=\()/gm;
  let html = '', last = 0;
  src.replace(re, (m, c, s, at, k, t, n, f, off) => {
    html += esc(src.slice(last, off));
    const cls = c ? 'tok-c' : s ? 'tok-s' : (at || k) ? 'tok-k' : t ? 'tok-t' : n ? 'tok-n' : 'tok-f';
    html += `<span class="${cls}">${esc(m)}</span>`; last = off + m.length; return m;
  });
  return html + esc(src.slice(last));
}

// ------------------------------------------------------------ solar explorable
// Same equations and inputs as solar-ecm-cpp's drive_energy() / solar_energy_wh().
const CAR = { m: 200, cda: 0.14, crr: 0.005, eta: 0.9, regen: 0.55, regenW: 100, aux: 60, area: 4, cell: 0.2, sys: 0.9, rho: 1.2, d: 36000, g: 9.80665 };
export function leg(v, sun, wind) {
  const t = CAR.d / v, air = v + wind;
  const drag = 0.5 * CAR.rho * CAR.cda * air * Math.abs(air) * CAR.d / 3600;
  const roll = CAR.crr * CAR.m * CAR.g * CAR.d / 3600;
  const wheel = drag + roll;
  const traction = wheel >= 0 ? wheel / CAR.eta : Math.max(wheel * CAR.regen, -CAR.regenW * t / 3600);
  const aux = CAR.aux * t / 3600, solar = CAR.area * CAR.cell * CAR.sys * sun * t / 3600;
  return { t, drag, roll, losses: traction - wheel, aux, solar, net: traction + aux - solar };
}
function mountSolar(root) {
  root.innerHTML = `
    <p class="lab__sentence" aria-live="polite" data-s></p>
    <label><span>cruise_speed <output data-o="kmh"></output></span><input type="range" min="36" max="108" step="1" value="72" data-i="kmh"></label>
    <label><span>irradiance <output data-o="sun"></output></span><input type="range" min="0" max="1000" step="25" value="1000" data-i="sun"></label>
    <label><span>headwind <output data-o="wind"></output></span><input type="range" min="-5" max="8" step="0.5" value="0" data-i="wind"></label>
    <div data-chart></div>
    <table><caption class="sr-only">Where the energy goes</caption><tbody data-table></tbody></table>
    <p class="lab__fine">Synthetic car: 200 kg, C<sub>d</sub>A 0.14 m², C<sub>rr</sub> 0.005, 90% drivetrain, 60 W auxiliaries, 4 m² array at 20% × 90%, on a 36 km leg. Drag grows with the square of speed, and the sun pays you for every hour on the road, so going faster costs you twice.</p>`;
  const val = (k) => +root.querySelector(`[data-i="${k}"]`).value;
  const fmt = (n) => (n < 0 ? '−' : '') + Math.abs(n).toFixed(0) + ' Wh';
  function update() {
    const kmh = val('kmh'), sun = val('sun'), wind = val('wind');
    const cur = leg(kmh / 3.6, sun, wind);
    root.querySelector('[data-o="kmh"]').textContent = kmh + ' km/h';
    root.querySelector('[data-o="sun"]').textContent = sun + ' W/m²';
    root.querySelector('[data-o="wind"]').textContent = wind === 0 ? 'calm' : wind > 0 ? `${wind} m/s head` : `${-wind} m/s tail`;
    const solarW = CAR.area * CAR.cell * CAR.sys * sun;
    let be = null, tail;
    if (solarW <= CAR.aux) tail = 'At this light the array can’t even cover the 60 W of auxiliaries.';
    else if (leg(80, sun, wind).net < 0) tail = 'The sun covers any speed you could legally drive.';
    else { let lo = 0.5, hi = 80; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (leg(m, sun, wind).net > 0) hi = m; else lo = m; } be = (lo + hi) / 2 * 3.6; tail = `Below <b>${be.toFixed(0)} km/h</b> the sun pays for the whole leg.`; }
    const word = sun >= 850 ? 'full sun' : sun >= 500 ? 'light cloud' : sun >= 150 ? 'heavy cloud' : 'near darkness';
    root.querySelector('[data-s]').innerHTML = `At <b>${kmh} km/h</b> in ${word}, the battery ${cur.net >= 0 ? 'spends' : 'gains'} <b>${Math.abs(cur.net).toFixed(1)} Wh</b> over the leg. ${tail}`;
    const xs = []; for (let k = 36; k <= 108; k++) xs.push(k);
    const ys = xs.map((k) => leg(k / 3.6, sun, wind).net);
    let lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
    const st = [25, 50, 100, 200, 250, 500, 1000].find((s) => (hi - lo) / s <= 5) || 1000;
    lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
    const W = 640, H = 270, L = 52, R = 14, T = 14, B = 36;
    const X = (k) => L + (k - 36) / 72 * (W - L - R), Y = (w) => T + (hi - w) / (hi - lo) * (H - T - B);
    let g = '';
    for (let w = lo; w <= hi + 1e-9; w += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(w)}" y2="${Y(w)}" stroke="var(--s0)"/><text x="${L - 8}" y="${Y(w) + 4}" text-anchor="end" font-size="11" fill="var(--sub)" font-family="JetBrains Mono">${w}</text>`;
    for (const k of [36, 48, 60, 72, 84, 96, 108]) g += `<text x="${X(k)}" y="${H - 16}" text-anchor="middle" font-size="11" fill="var(--sub)" font-family="JetBrains Mono">${k}</text>`;
    const path = xs.map((k, i) => `${i ? 'L' : 'M'}${X(k).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join(' ');
    const beL = be && be >= 36 && be <= 108 ? `<line x1="${X(be)}" x2="${X(be)}" y1="${T}" y2="${H - B}" stroke="var(--blue)" stroke-dasharray="5 4"/><text x="${X(be) + 6}" y="${T + 14}" font-size="11" fill="var(--t-blue)" font-family="JetBrains Mono">break-even ${be.toFixed(0)}</text>` : '';
    const px = X(kmh), py = Y(cur.net);
    root.querySelector('[data-chart]').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Battery draw against cruise speed. At ${kmh} km/h the draw is ${fmt(cur.net)}.">${g}
      <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--text)" stroke-width="1.2"/>
      <text x="${W - R}" y="${Y(0) + 15}" text-anchor="end" font-size="10.5" fill="var(--t-blue)" font-family="JetBrains Mono">below the line: battery charges</text>
      ${beL}<path d="${path}" fill="none" stroke="var(--peach)" stroke-width="2.5"/>
      <circle cx="${px}" cy="${py}" r="5.5" fill="var(--base)" stroke="var(--text)" stroke-width="2"/>
      <text x="${kmh > 92 ? px - 10 : px + 10}" y="${py - 10}" text-anchor="${kmh > 92 ? 'end' : 'start'}" font-size="12" fill="var(--text)" font-family="JetBrains Mono">${fmt(cur.net)}</text>
      <text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle" font-size="10.5" fill="var(--sub)" font-family="JetBrains Mono">cruise speed, km/h</text></svg>`;
    const parts = [['Aerodynamic drag', cur.drag, 'var(--peach)'], ['Rolling resistance', cur.roll, 'var(--peach)'], ['Drivetrain losses', cur.losses, 'var(--peach)'], ['Auxiliaries, 60 W', cur.aux, 'var(--peach)'], ['Solar in', -cur.solar, 'var(--blue)']];
    const mx = Math.max(...parts.map((q) => Math.abs(q[1])), 1), mins = cur.t / 60;
    root.querySelector('[data-table]').innerHTML = parts.map(([l, w, c]) => `<tr><th scope="row">${l}</th><td style="width:45%"><div class="bar" style="width:${(Math.abs(w) / mx * 100).toFixed(1)}%;background:${c}"></div></td><td class="v">${fmt(w)}</td></tr>`).join('')
      + `<tr><th scope="row">Battery draw · ${mins >= 60 ? Math.floor(mins / 60) + ' h ' + Math.round(mins % 60) + ' min' : Math.round(mins) + ' min'} leg</th><td></td><td class="v" style="color:var(--t-peach);font-weight:700">${fmt(cur.net)}</td></tr>`;
  }
  root.addEventListener('input', update); update();
}

// ------------------------------------------------------------ quantsprint lite
function mountSprint(root, bestEl) {
  const st = { get() { try { return +localStorage.getItem('yash-sprint-best') || 0; } catch { return 0; } }, set(v) { try { localStorage.setItem('yash-sprint-best', String(v)); } catch { /* ok */ } } };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let timer = 0, endAt = 0, dur = 60, score = 0, q = null, qStart = 0, log = [];
  const best = () => { const b = st.get(); bestEl.textContent = b ? `best: ${b} / 60 s` : 'no score yet'; };
  function next() {
    const op = rnd(0, 3);
    if (op === 0) { const a = rnd(2, 100), b = rnd(2, 100); q = { text: `${a} + ${b}`, ans: a + b }; }
    else if (op === 1) { const a = rnd(2, 100), b = rnd(2, 100); q = { text: `${a + b} − ${a}`, ans: b }; }
    else if (op === 2) { const a = rnd(2, 12), b = rnd(2, 100); q = { text: `${a} × ${b}`, ans: a * b }; }
    else { const a = rnd(2, 12), b = rnd(2, 100); q = { text: `${a * b} ÷ ${a}`, ans: b }; }
    qStart = performance.now(); root.querySelector('[data-q]').textContent = q.text;
  }
  function idle() {
    root.innerHTML = `<div class="sprint__q" aria-hidden="true">47 × 23</div>
      <p style="margin:0;max-width:440px">Zetamac rules: the next question appears the moment your answer is right. No enter key.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn btn--primary" data-go="60">start · 60 s</button><button type="button" class="btn" data-go="30">30 s</button><button type="button" class="btn" data-go="120">2 min</button></div>`;
    best();
  }
  function finish() {
    clearInterval(timer); timer = 0;
    const slow = [...log].sort((a, b) => b.ms - a.ms).slice(0, 5);
    const avg = log.length ? log.reduce((s, x) => s + x.ms, 0) / log.length / 1000 : 0;
    if (dur === 60 && score > st.get()) st.set(score);
    root.innerHTML = `<div class="sprint__q">${score}</div>
      <div class="sprint__stats"><span>solved <b>${score}</b></span><span>avg <b>${avg.toFixed(2)} s</b></span><span>${dur} s</span></div>
      ${slow.length ? `<div class="sprint__slow"><div class="cmt" style="padding-bottom:4px">-- your slowest facts</div><ul>${slow.map((x) => `<li><span>${esc(x.text)} = ${x.ans}</span><span>${(x.ms / 1000).toFixed(2)} s</span></li>`).join('')}</ul></div>` : ''}
      <button type="button" class="btn btn--primary" data-go="${dur}">again</button>`;
    best(); root.querySelector('[data-go]').focus();
  }
  function start(s) {
    dur = s; score = 0; log = [];
    root.innerHTML = `<div class="sprint__clock" aria-hidden="true"><i data-clock-bar></i></div><div class="sprint__q" data-q aria-live="polite"></div>
      <label class="sr-only" for="sprint-in">Your answer</label><input id="sprint-in" type="text" inputmode="numeric" autocomplete="off" data-in>
      <div class="sprint__stats"><span>score <b data-score>0</b></span><span><b data-left>${dur}</b> s left</span></div>`;
    const input = root.querySelector('[data-in]');
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (v !== '' && Number(v) === q.ans) { log.push({ text: q.text, ans: q.ans, ms: performance.now() - qStart }); score++; root.querySelector('[data-score]').textContent = score; input.value = ''; next(); }
    });
    input.focus(); endAt = performance.now() + dur * 1000; next();
    timer = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      root.querySelector('[data-left]').textContent = Math.ceil(left / 1000);
      root.querySelector('[data-clock-bar]').style.width = (left / (dur * 1000) * 100) + '%';
      if (left <= 0) finish();
    }, 200);
  }
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) start(+b.dataset.go); });
  idle();
  return () => clearInterval(timer);
}

// ------------------------------------------------------------ blog shelf
document.querySelectorAll('[data-shelf-step]').forEach((b) => b.addEventListener('click', () => {
  const shelf = document.getElementById(b.getAttribute('aria-controls'));
  const card = shelf.firstElementChild;
  const px = card ? card.getBoundingClientRect().width + 18 : 340;
  shelf.scrollBy({ left: px * +b.dataset.shelfStep, behavior: reduce() ? 'auto' : 'smooth' });
}));

// ------------------------------------------------------------ commands
command(['open', 'o'], (arg) => {
  const p = PROJECTS.find((x) => x.id === arg || x.name.toLowerCase() === arg);
  if (!p) return `E37: no project "${arg}". try :ls`;
  openProject(p.id); return '';
}, 'open a project');
command(['ls'], () => PROJECTS.map((p) => p.id).join('  '), 'list projects');
command(['sprint'], () => { openProject('quantsprint'); return ''; }, 'play QuantSprint');
map('s', 'play QuantSprint', () => openProject('quantsprint'));

renderMatrix();
if (/^#p\//.test(location.hash)) fromHash();
