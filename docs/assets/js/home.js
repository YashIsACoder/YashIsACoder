// The homepage: the theatre at the top (stage.js), and the projects list with its
// live labs (Payoff Lab, SolarRoute, the solver race), the solar panel
// and QuantSprint.
import { ROWS, PROJECTS } from './projects.js?v=e43c745f';
import { startMotion } from './motion.js?v=e43c745f';
import { mountStage } from './stage.js?v=e43c745f';
import { thumbSVG } from './thumbs.js?v=e43c745f';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

mountStage($('[data-stage]'));

// ------------------------------------------------------------ projects

function linksHTML(p) {
  const out = p.links.map((l) => {
    const ext = /^https?:/.test(l.href);
    return `<a class="btn${l.primary ? ' btn--primary' : ''}" href="${esc(l.href)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${esc(l.label)}</a>`;
  });
  if (p.brewing) out.push('<span class="btn" aria-disabled="true">Work in progress</span>');
  return out.join('');
}
function tapHTML(p) {
  const t = p.tap;
  if (!t) return `<div class="tap"><div class="tap__bar"><b>Run it yourself</b><span>${esc(p.lang)}</span></div><p class="tap__note">Clone it and build it with CMake; the README has the steps.</p><pre><span class="tok-f">git</span> clone ${esc((p.links[0] || {}).href || '')}</pre></div>`;
  if (t.kind === 'iframe') return `<div class="tap"><div class="tap__bar"><b>Running live</b><a href="${esc(t.src)}" target="_blank" rel="noopener">Open full screen</a></div><iframe data-src="${esc(t.src)}" title="${esc(p.name)}, running live" loading="lazy"></iframe></div>`;
  if (t.kind === 'code') return `<div class="tap"><div class="tap__bar"><b>${esc(t.title.includes('/') ? t.title : t.title.charAt(0).toUpperCase() + t.title.slice(1))}</b><span>${esc(({ cpp: 'C++', py: 'Python', ts: 'TypeScript', js: 'JavaScript' })[t.lang] || t.lang)}</span></div><pre><code>${highlight(t.code)}</code></pre></div>`;
  if (t.kind === 'solar') return '<div class="tap"><div class="tap__bar"><b>How fast should a solar car drive?</b><span>Live</span></div><div class="lab" data-solar></div></div>';
  if (t.kind === 'sprint') return '<div class="tap"><div class="tap__bar"><b>QuantSprint, the short version</b><span data-best></span></div><div class="sprint" data-sprint></div></div>';
  return '';
}
// ------------------------------------------------------------ the projects switcher
// One project at a time on a big stage: its live demo or code on the left,
// what it is on the right. Arrows (buttons, keys or a swipe) move between
// them, and the filmstrip underneath jumps straight to one.
const ORDER = ['3821-viz', 'ecm', 'solarroute', 'payoff-lab', 'dmdp', 'quantsprint', 'solar-ecm-cpp', 'event-replay', 'cpp-mlp', 'random-walk-sim'];
const LIST = [...ORDER.map((id) => PROJECTS.find((p) => p.id === id)).filter(Boolean), ...PROJECTS.filter((p) => !ORDER.includes(p.id))];
const rowName = (p) => (ROWS.find((r) => r.id === p.row) || {}).name || '';
const tagHTML = (p) => (p.ontap ? '<span class="proj__tag proj__tag--live">Live</span>' : p.brewing ? '<span class="proj__tag">In progress</span>' : '');

function slideHTML(p) {
  return `<article class="pshow__slide" aria-labelledby="ps-${esc(p.id)}">
      <div class="pshow__media" data-tap="${esc(p.id)}"></div>
      <div class="pshow__text">
        <p class="pshow__kind">${esc(rowName(p))}<span>${esc(p.lang)}</span></p>
        <h3 id="ps-${esc(p.id)}">${esc(p.name)}${tagHTML(p)}</h3>
        <p class="pshow__one">${esc(p.one)}</p>
        ${p.about[0] ? `<p class="pshow__about">${esc(p.about[0])}</p>` : ''}
        <ul class="pshow__hl">${p.highlights.slice(0, 3).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <div class="proj__links">${linksHTML(p)}</div>
      </div>
    </article>`;
}

const host = $('[data-projects]');
let cleanup = null, idx = 0;
if (host) {
  host.innerHTML = `<div class="pshow" data-pshow tabindex="-1">
      <div class="pshow__stage">
        <button type="button" class="pshow__arrow pshow__arrow--prev" data-step="-1" aria-label="Previous project"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="pshow__view" aria-live="polite"></div>
        <button type="button" class="pshow__arrow pshow__arrow--next" data-step="1" aria-label="Next project"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="pshow__foot"><p class="pshow__count" data-count></p></div>
      <div class="pshow__strip" role="tablist" aria-label="All projects">${LIST.map((p, i) => `<button type="button" role="tab" class="pthumb" data-i="${i}" aria-selected="false" aria-label="${esc(p.name)}">
          <span class="pthumb__art">${thumbSVG(p.id, p.name)}</span>
          <span class="pthumb__name">${esc(p.name)}</span>
        </button>`).join('')}</div>
    </div>`;
  const show = $('[data-pshow]', host), view = $('.pshow__view', show), strip = $('.pshow__strip', show);

  function go(i, dir = 0, { scroll = false } = {}) {
    idx = (i + LIST.length) % LIST.length;
    const p = LIST[idx];
    cleanup?.(); cleanup = null;
    view.innerHTML = slideHTML(p);
    const slide = $('.pshow__slide', view);
    if (dir) slide.dataset.dir = dir > 0 ? 'next' : 'prev';
    const slot = $('[data-tap]', slide);
    slot.innerHTML = tapHTML(p);
    const frame = $('iframe[data-src]', slot); if (frame) frame.src = frame.dataset.src;
    const solar = $('[data-solar]', slot); if (solar) mountSolar(solar);
    const sprint = $('[data-sprint]', slot); if (sprint) cleanup = mountSprint(sprint, $('[data-best]', slot));
    $('[data-count]', show).innerHTML = `<b>${idx + 1}</b> of ${LIST.length}`;
    strip.querySelectorAll('.pthumb').forEach((t, k) => { t.setAttribute('aria-selected', String(k === idx)); t.tabIndex = k === idx ? 0 : -1; });
    const t = strip.children[idx];
    strip.scrollTo({ left: t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2, behavior: dir ? 'smooth' : 'auto' });
    if (dir || scroll) history.replaceState(null, '', `#p/${p.id}`);
    if (scroll) requestAnimationFrame(() => $('#projects')?.scrollIntoView({ block: 'start' }));
  }

  show.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) return go(idx + Number(step.dataset.step), Number(step.dataset.step));
    const th = e.target.closest('.pthumb');
    if (th) { const i = Number(th.dataset.i); if (i !== idx) go(i, i > idx ? 1 : -1); }
  });
  // left and right arrows while the projects have focus (not inside a demo's inputs)
  show.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable], .sprint')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      go(idx + d, d);
      if (e.target.closest('.pshow__strip')) strip.children[idx].focus();
    }
  });
  // swipe on touch screens
  let sx = null, sy = null;
  view.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
  view.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  const fromHash = () => {
    const m = location.hash.match(/^#p\/([\w-]+)/);
    const i = m ? LIST.findIndex((p) => p.id === m[1]) : -1;
    if (i >= 0) go(i, 0, { scroll: true });
  };
  go(0);
  fromHash();
  addEventListener('hashchange', fromHash);
}
startMotion();

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
    <label><span>Cruise speed <output data-o="kmh"></output></span><input type="range" min="36" max="108" step="1" value="72" data-i="kmh"></label>
    <label><span>Sunlight <output data-o="sun"></output></span><input type="range" min="0" max="1000" step="25" value="1000" data-i="sun"></label>
    <label><span>Headwind <output data-o="wind"></output></span><input type="range" min="-5" max="8" step="0.5" value="0" data-i="wind"></label>
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
    const W = 460, H = 250, L = 44, R = 10, T = 14, B = 38;
    const X = (k) => L + (k - 36) / 72 * (W - L - R), Y = (w) => T + (hi - w) / (hi - lo) * (H - T - B);
    let g = '';
    for (let w = lo; w <= hi + 1e-9; w += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(w)}" y2="${Y(w)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(w) + 4}" text-anchor="end" font-size="12.5" fill="var(--ink-2)" font-family="Archivo, sans-serif">${w}</text>`;
    for (const k of [36, 48, 60, 72, 84, 96, 108]) g += `<text x="${X(k)}" y="${H - 16}" text-anchor="middle" font-size="12.5" fill="var(--ink-2)" font-family="Archivo, sans-serif">${k}</text>`;
    const path = xs.map((k, i) => `${i ? 'L' : 'M'}${X(k).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join(' ');
    const beL = be && be >= 36 && be <= 108 ? `<line x1="${X(be)}" x2="${X(be)}" y1="${T}" y2="${H - B}" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${X(be) + 6}" y="${T + 14}" font-size="12.5" fill="var(--accent)" font-family="Archivo, sans-serif">break-even ${be.toFixed(0)}</text>` : '';
    const px = X(kmh), py = Y(cur.net);
    root.querySelector('[data-chart]').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Battery draw against cruise speed. At ${kmh} km/h the draw is ${fmt(cur.net)}.">${g}
      <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="1.2"/>
      <text x="${W - R}" y="${Y(0) + 15}" text-anchor="end" font-size="13" fill="var(--accent)" font-family="Archivo, sans-serif">below the line: battery charges</text>
      ${beL}<path d="${path}" fill="none" stroke="var(--warm)" stroke-width="2.5"/>
      <circle cx="${px}" cy="${py}" r="5.5" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
      <text x="${kmh > 92 ? px - 10 : px + 10}" y="${py - 10}" text-anchor="${kmh > 92 ? 'end' : 'start'}" font-size="13" fill="var(--ink)" font-family="Archivo, sans-serif">${fmt(cur.net)}</text>
      <text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle" font-size="13" fill="var(--ink-2)" font-family="Archivo, sans-serif">cruise speed, km/h</text></svg>`;
    const parts = [['Aerodynamic drag', cur.drag, 'var(--warm)'], ['Rolling resistance', cur.roll, 'var(--warm)'], ['Drivetrain losses', cur.losses, 'var(--warm)'], ['Auxiliaries, 60 W', cur.aux, 'var(--warm)'], ['Solar in', -cur.solar, 'var(--accent)']];
    const mx = Math.max(...parts.map((q) => Math.abs(q[1])), 1), mins = cur.t / 60;
    root.querySelector('[data-table]').innerHTML = parts.map(([l, w, c]) => `<tr><th scope="row">${l}</th><td style="width:45%"><div class="bar" style="width:${(Math.abs(w) / mx * 100).toFixed(1)}%;background:${c}"></div></td><td class="v">${fmt(w)}</td></tr>`).join('')
      + `<tr><th scope="row">Battery draw over a ${mins >= 60 ? Math.floor(mins / 60) + ' h ' + Math.round(mins % 60) + ' min' : Math.round(mins) + ' min'} leg</th><td></td><td class="v" style="color:var(--warm);font-weight:700">${fmt(cur.net)}</td></tr>`;
  }
  root.addEventListener('input', update); update();
}

// ------------------------------------------------------------ quantsprint lite
function mountSprint(root, bestEl) {
  const st = { get() { try { return +localStorage.getItem('yash-sprint-best') || 0; } catch { return 0; } }, set(v) { try { localStorage.setItem('yash-sprint-best', String(v)); } catch { /* ok */ } } };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let timer = 0, endAt = 0, dur = 60, score = 0, q = null, qStart = 0, log = [];
  const best = () => { const b = st.get(); bestEl.textContent = b ? `Best: ${b} in 60 seconds` : 'No score yet'; };
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
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn btn--primary" data-go="60">Start, 60 seconds</button><button type="button" class="btn" data-go="30">30 seconds</button><button type="button" class="btn" data-go="120">2 minutes</button></div>`;
    best();
  }
  function finish() {
    clearInterval(timer); timer = 0;
    const slow = [...log].sort((a, b) => b.ms - a.ms).slice(0, 5);
    const avg = log.length ? log.reduce((s, x) => s + x.ms, 0) / log.length / 1000 : 0;
    if (dur === 60 && score > st.get()) st.set(score);
    root.innerHTML = `<div class="sprint__q">${score}</div>
      <div class="sprint__stats"><span>Solved <b>${score}</b></span><span>Average <b>${avg.toFixed(2)} s</b></span><span>${dur} s</span></div>
      ${slow.length ? `<div class="sprint__slow"><div style="padding-bottom:4px;color:var(--ink-2)">Your slowest facts</div><ul>${slow.map((x) => `<li><span>${esc(x.text)} = ${x.ans}</span><span>${(x.ms / 1000).toFixed(2)} s</span></li>`).join('')}</ul></div>` : ''}
      <button type="button" class="btn btn--primary" data-go="${dur}">Play again</button>`;
    best(); root.querySelector('[data-go]').focus();
  }
  function start(s) {
    dur = s; score = 0; log = [];
    root.innerHTML = `<div class="sprint__clock" aria-hidden="true"><i data-clock-bar></i></div><div class="sprint__q" data-q aria-live="polite"></div>
      <label class="sr-only" for="sprint-in">Your answer</label><input id="sprint-in" type="text" inputmode="numeric" autocomplete="off" data-in>
      <div class="sprint__stats"><span>Score <b data-score>0</b></span><span><b data-left>${dur}</b> s left</span></div>`;
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

