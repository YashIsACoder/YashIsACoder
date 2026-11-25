// The homepage: the Gaussian process, and the projects list with its
// live labs (Payoff Lab, SolarRoute, the solver race), the solar panel
// and QuantSprint.
import { ROWS, PROJECTS } from './projects.js?v=725af973';
import { mountGP } from './gp.js?v=725af973';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------ the Gaussian process
const plot = $('[data-gp]');
if (plot) {
  const gp = mountGP(plot, {
    seed: [[0.06, -0.5], [0.2, 0.7], [0.37, 0.15], [0.5, -0.8], [0.66, -0.2], [0.84, 0.6]],
    status: $('[data-gp-status]')
  });
  $('[data-gp-clear]')?.addEventListener('click', () => gp.clear());
  $('[data-gp-reset]')?.addEventListener('click', () => gp.reset());
}

// ------------------------------------------------------------ projects
const CHEVRON = '<svg class="proj__chev" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

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
  if (t.kind === 'code') return `<div class="tap"><div class="tap__bar"><b>${esc(t.title.charAt(0).toUpperCase() + t.title.slice(1))}</b><span>${esc(({ cpp: 'C++', py: 'Python', ts: 'TypeScript', js: 'JavaScript' })[t.lang] || t.lang)}</span></div><pre><code>${highlight(t.code)}</code></pre></div>`;
  if (t.kind === 'solar') return '<div class="tap"><div class="tap__bar"><b>How fast should a solar car drive?</b><span>Live</span></div><div class="lab" data-solar></div></div>';
  if (t.kind === 'sprint') return '<div class="tap"><div class="tap__bar"><b>QuantSprint, the short version</b><span data-best></span></div><div class="sprint" data-sprint></div></div>';
  return '';
}
function projectHTML(p) {
  const tag = p.ontap ? '<span class="proj__tag proj__tag--live">Live</span>' : p.brewing ? '<span class="proj__tag">In progress</span>' : '';
  return `<li class="proj" id="p-${esc(p.id)}">
    <button type="button" class="proj__row" aria-expanded="false" aria-controls="panel-${esc(p.id)}" data-project="${esc(p.id)}">
      <span class="proj__name">${esc(p.name)}${tag}</span>
      <span class="proj__one">${esc(p.one)}</span>
      <span class="proj__lang">${esc(p.lang)}</span>
      ${CHEVRON}
    </button>
    <div class="proj__panel" id="panel-${esc(p.id)}" hidden>
      <div class="proj__about">
        ${p.about.map((t) => `<p>${esc(t)}</p>`).join('')}
        <h4>Highlights</h4>
        <ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <h4>Built with</h4>
        <p class="proj__stack">${p.stack.map(esc).join(', ')}</p>
        <div class="proj__links">${linksHTML(p)}</div>
      </div>
      <div data-tap="${esc(p.id)}"></div>
    </div>
  </li>`;
}

const host = $('[data-projects]');
let cleanup = new Map();
if (host) {
  host.innerHTML = ROWS.map((r) => {
    const items = PROJECTS.filter((p) => p.row === r.id);
    return items.length ? `<div class="pgroup"><h3 class="pgroup__h">${esc(r.name)}</h3><ul class="plist">${items.map(projectHTML).join('')}</ul></div>` : '';
  }).join('');
  host.addEventListener('click', (e) => {
    const row = e.target.closest('.proj__row');
    if (row) toggle(row.dataset.project);
  });
  const openFromHash = () => {
    const m = location.hash.match(/^#p\/([\w-]+)/);
    if (m && PROJECTS.some((p) => p.id === m[1])) { toggle(m[1], true); requestAnimationFrame(() => $(`#p-${m[1]}`)?.scrollIntoView({ block: 'start' })); }
  };
  openFromHash();
  addEventListener('hashchange', openFromHash);
}

function toggle(id, forceOpen = false) {
  const row = $(`.proj__row[data-project="${id}"]`);
  const panel = $(`#panel-${id}`);
  if (!row || !panel) return;
  const open = forceOpen || row.getAttribute('aria-expanded') !== 'true';
  row.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
  const slot = $(`[data-tap="${id}"]`, panel);
  if (open) {
    const p = PROJECTS.find((x) => x.id === id);
    slot.innerHTML = tapHTML(p);
    const frame = $('iframe[data-src]', slot); if (frame) frame.src = frame.dataset.src;
    const solar = $('[data-solar]', slot); if (solar) mountSolar(solar);
    const sprint = $('[data-sprint]', slot); if (sprint) cleanup.set(id, mountSprint(sprint, $('[data-best]', slot)));
    history.replaceState(null, '', `#p/${id}`);
  } else {
    cleanup.get(id)?.(); cleanup.delete(id);
    slot.innerHTML = '';
    if (location.hash === `#p/${id}`) history.replaceState(null, '', '#projects');
  }
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

