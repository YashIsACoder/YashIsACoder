// Bond auctions, learnt by a Gaussian process. Each simulated tender clears
// on the left: bids are ranked from the lowest yield up and filled until the
// offer runs out (a multiple-price tender, the way Australia's are run). Its
// result lands on the right as one observation: bid to cover against how far
// the average accepted yield came in below the market's yield. A Gaussian
// process fits those points; its band is how unsure it is, and it narrows as
// tenders accumulate. Nothing here is fitted to real data: the pattern comes
// out of the bidding itself.

import { posterior } from './gp.js?v=3367876e';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const money = (m) => (m >= 1000 ? `$${(m / 1000).toFixed(2).replace(/\.?0+$/, '')}bn` : `$${Math.round(m)}m`);

// one tender: yields in %, amounts in $m
export function tender() {
  for (;;) {
    const mid = Math.round((4.1 + Math.random() * 0.6) * 10000) / 10000;
    const offer = 600 + 50 * Math.floor(Math.random() * 13);
    const n = 10 + Math.floor(Math.random() * 20);
    const bids = Array.from({ length: n }, () => ({
      y: Math.round((mid + (gauss() * 1.1 + (Math.random() < 0.18 ? 1.6 + Math.random() * 2 : 0)) / 100) * 10000) / 10000,
      amt: 25 + 25 * Math.floor(Math.random() * 10)
    })).sort((a, b) => a.y - b.y || b.amt - a.amt);
    let left = offer, w = 0;
    const fill = bids.map((b) => { const t = Math.max(0, Math.min(b.amt, left)); left -= t; w += t * b.y; return t; });
    if (left > 0) continue;                       // undersubscribed: try again
    if (bids.reduce((s, b) => s + b.amt, 0) / offer > 6.3) continue;   // off the chart: try again
    const total = bids.reduce((s, b) => s + b.amt, 0);
    const avg = w / offer;
    return { mid, offer, bids, fill, total, cover: total / offer, avg, high: bids[fill.findLastIndex((f) => f > 0)].y, spread: (avg - mid) * 100 };
  }
}

// the GP works on [0,1] x a unit scale; these map auction terms onto it
const X0 = 1, X1 = 6.5;                  // bid to cover on the x axis
const Y_MEAN = -0.9, Y_SCALE = 0.9;      // spread in bp: prior mean and scale
const toX = (c) => (c - X0) / (X1 - X0);
const toY = (bp) => (bp - Y_MEAN) / Y_SCALE;
const fromY = (u) => u * Y_SCALE + Y_MEAN;
const ELL = 0.28, NOISE = (0.42 / Y_SCALE) ** 2;
const fit = (pts) => posterior(pts.map((p) => [toX(p.cover), toY(p.spread)]), ELL, NOISE, 160);

export function mountBondLab(root, { onPlay } = {}) {
  const bookBox = root.querySelector('[data-book]');
  const bookNote = root.querySelector('[data-book-note]');
  const gpBox = root.querySelector('[data-bondgp]');
  const read = root.querySelector('[data-bond-read]');
  let pts = [], post = fit([]), shown = post, visible = false, playing = false, run = 0, raf = 0, cur = null;
  let lastPt = -1;

  // ---------------------------------------------------------------- the book
  let book = null;
  function drawBook(t, k = { grow: 1, fill: 1 }) {
    const w = Math.max(200, bookBox.clientWidth), h = Math.max(160, bookBox.clientHeight);
    if (!book || book.w !== w || book.h !== h || book.t !== t) {
      bookBox.querySelector('svg')?.remove();
      const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'auc' });
      const top = 28, base = h - 26, gap = w < 300 ? 2 : 4, n = t.bids.length;
      const bw = (w - gap * (n - 1)) / n, maxA = 250;
      el('line', { x1: 0, x2: w, y1: base + 0.5, y2: base + 0.5, class: 'auc__axis' }, svg);
      const bars = t.bids.map((b, i) => {
        const g = el('g', {}, svg);
        return { x: i * (bw + gap), h: ((base - top) * b.amt) / maxA, back: el('rect', { class: 'auc__bid', rx: 2 }, g), fill: el('rect', { class: 'auc__fill', rx: 2 }, g) };
      });
      const last = t.fill.findLastIndex((f) => f > 0);
      const cx = bars[last].x + bw + gap / 2;
      const cut = el('line', { class: 'auc__cut', x1: cx, x2: cx, y1: top - 6, y2: base + 6 }, svg);
      const lab = el('text', { class: 'auc__cutlab', x: cx + (cx > w * 0.55 ? -6 : 6), y: top - 12, 'text-anchor': cx > w * 0.55 ? 'end' : 'start' }, svg);
      lab.textContent = `High yield ${t.high.toFixed(4)}%`;
      el('text', { class: 'auc__tick', x: 0, y: h - 6 }, svg).textContent = 'Lowest yield, filled first';
      bookBox.prepend(svg);
      book = { w, h, t, bars, bw, base, cut, lab };
    }
    const { bars, bw, base } = book;
    const n = bars.length;
    bars.forEach((b, i) => {
      const g = Math.max(0, Math.min(1, k.grow * 1.6 - (i / n) * 0.6));
      const hh = b.h * ease(g);
      b.back.setAttribute('x', b.x.toFixed(1)); b.back.setAttribute('width', bw.toFixed(1));
      b.back.setAttribute('y', (base - hh).toFixed(1)); b.back.setAttribute('height', hh.toFixed(1));
      const f = Math.max(0, Math.min(1, k.fill * n * 0.8 - i)) * (t.fill[i] / t.bids[i].amt);
      b.fill.setAttribute('x', b.x.toFixed(1)); b.fill.setAttribute('width', bw.toFixed(1));
      b.fill.setAttribute('y', (base - hh * f).toFixed(1)); b.fill.setAttribute('height', (hh * f).toFixed(1));
      b.back.classList.toggle('is-out', k.fill >= 1 && !t.fill[i]);
    });
    const done = k.fill >= 1;
    book.cut.style.opacity = done ? 1 : 0; book.lab.style.opacity = done ? 1 : 0;
  }
  function noteFor(t, done) {
    bookNote.innerHTML = done
      ? `<span><b>${money(t.total)}</b> bid for <b>${money(t.offer)}</b>, so covered <b>${t.cover.toFixed(2)}×</b></span><span>Average <b>${t.avg.toFixed(4)}%</b> against a market yield of ${t.mid.toFixed(4)}%: <b>${t.spread >= 0 ? '+' : '−'}${Math.abs(t.spread).toFixed(2)} bp</b></span>`
      : `<span>${t.bids.length} bids for <b>${money(t.offer)}</b>, ranked by yield…</span><span>&nbsp;</span>`;
  }

  // ---------------------------------------------------------------- the GP
  let gp = null;
  function layoutGP() {
    const w = Math.max(240, gpBox.clientWidth), h = Math.max(200, gpBox.clientHeight);
    const pad = { l: w < 420 ? 36 : 46, r: 10, t: 30, b: 40 };
    const ys = [-3, 1];
    const X = (u) => pad.l + u * (w - pad.l - pad.r);
    const Y = (bp) => pad.t + ((ys[1] - bp) / (ys[1] - ys[0])) * (h - pad.t - pad.b);
    return { w, h, pad, X, Y, ys };
  }
  function drawGP() {
    const L = layoutGP();
    if (!gp || gp.w !== L.w || gp.h !== L.h) {
      gpBox.querySelector('svg')?.remove();
      const svg = el('svg', { viewBox: `0 0 ${L.w} ${L.h}`, width: L.w, height: L.h, class: 'bgp' });
      const grid = el('g', {}, svg);
      for (let bp = L.ys[0]; bp <= L.ys[1]; bp++) {
        el('line', { x1: L.pad.l, x2: L.w - L.pad.r, y1: L.Y(bp), y2: L.Y(bp), class: bp === 0 ? 'bgp__zero' : 'bgp__grid' }, grid);
        el('text', { x: L.pad.l - 8, y: L.Y(bp) + 4, 'text-anchor': 'end', class: 'bgp__tick' }, grid).textContent = bp > 0 ? `+${bp}` : bp < 0 ? `−${-bp}` : '0';
      }
      for (let c = 1; c <= 6; c++) el('text', { x: L.X(toX(c)), y: L.h - 20, 'text-anchor': 'middle', class: 'bgp__tick' }, grid).textContent = `${c}×`;
      el('text', { x: L.X(0.5), y: L.h - 2, 'text-anchor': 'middle', class: 'bgp__axis' }, grid).textContent = 'Bid to cover';
      const narrow = L.w < 520;
      el('text', { x: narrow ? L.pad.l + 4 : L.w - L.pad.r, y: L.Y(0) - 7, 'text-anchor': narrow ? 'start' : 'end', class: 'bgp__axis' }, grid).textContent = 'market yield';
      el('text', { x: 0, y: 12, class: 'bgp__axis' }, grid).textContent = 'Average yield against the market yield, bp';
      const band = el('path', { class: 'gp__band' }, svg);
      const mean = el('path', { class: 'gp__mean' }, svg);
      const dots = el('g', {}, svg);
      const ring = el('circle', { class: 'bgp__ring', r: 6 }, svg);
      svg.addEventListener('click', (e) => {
        const r = svg.getBoundingClientRect();
        const u = (e.clientX - r.left - L.pad.l) / (L.w - L.pad.l - L.pad.r);
        const bp = L.ys[1] - ((e.clientY - r.top - L.pad.t) / (L.h - L.pad.t - L.pad.b)) * (L.ys[1] - L.ys[0]);
        if (u < 0 || u > 1) return;
        stopDemo();
        addPoint({ cover: X0 + u * (X1 - X0), spread: Math.max(-3, Math.min(1, bp)), mine: true });
      });
      gpBox.prepend(svg);
      gp = { ...L, svg, band, mean, dots, ring };
    }
    const { X, Y, band, mean, dots, ring } = gp;
    const up = shown.map(([u, m, s]) => `${X(u).toFixed(1)},${Y(fromY(m + 2 * s)).toFixed(1)}`);
    const lo = shown.slice().reverse().map(([u, m, s]) => `${X(u).toFixed(1)},${Y(fromY(m - 2 * s)).toFixed(1)}`);
    band.setAttribute('d', `M${up.join(' L')} L${lo.join(' L')} Z`);
    mean.setAttribute('d', `M${shown.map(([u, m]) => `${X(u).toFixed(1)},${Y(fromY(m)).toFixed(1)}`).join(' L')}`);
    dots.replaceChildren(...pts.map((p, i) => el('circle', { cx: X(toX(p.cover)).toFixed(1), cy: Y(p.spread).toFixed(1), r: 5, class: `gp__dot${i === lastPt ? ' gp__dot--new' : ''}` })));
    const p = pts[lastPt];
    ring.style.opacity = p ? 1 : 0;
    if (p) { ring.setAttribute('cx', X(toX(p.cover)).toFixed(1)); ring.setAttribute('cy', Y(p.spread).toFixed(1)); ring.classList.remove('is-on'); void ring.getBBox(); ring.classList.add('is-on'); }
  }

  function tweenTo(next, ms = 650) {
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now();
    return new Promise((done) => {
      const step = (t) => {
        const k = ease(Math.max(0, Math.min(1, (t - t0) / ms)));
        shown = next.map(([u, m, s], i) => [u, from[i][1] + (m - from[i][1]) * k, from[i][2] + (s - from[i][2]) * k]);
        drawGP();
        if (k < 1) raf = requestAnimationFrame(step); else done();
      };
      raf = requestAnimationFrame(step);
    });
  }
  function addPoint(p) {
    pts.push(p); lastPt = pts.length - 1;
    post = fit(pts);
    const n = pts.length;
    read.textContent = `${n} tender${n === 1 ? '' : 's'} seen. ${n < 4 ? 'The band is wide: the model barely knows the curve yet.' : n < 9 ? 'The band narrows where tenders have landed.' : 'More demand, a richer price: the curve flattens past about 4×.'}`;
    return tweenTo(post);
  }

  function seed() {
    pts = []; lastPt = -1;
    for (let i = 0; i < 2; i++) { const t = tender(); pts.push({ cover: t.cover, spread: t.spread }); }
    post = fit(pts); shown = post;
    gp = null; drawGP();
    read.textContent = 'Two tenders seen. The band is wide: the model barely knows the curve yet.';
  }

  // one tender, animated, then its result goes to the model
  async function runOne(myRun) {
    const t = tender(); cur = t;
    book = null; noteFor(t, false);
    const anim = (ms, fn) => new Promise((done) => {
      const t0 = performance.now();
      const step = (now) => { if (myRun !== run) return done(false); const k = Math.max(0, Math.min(1, (now - t0) / ms)); fn(k); if (k < 1) requestAnimationFrame(step); else done(true); };
      requestAnimationFrame(step);
    });
    if (reduce) drawBook(t);
    else {
      if (!(await anim(900, (k) => drawBook(t, { grow: k, fill: 0 })))) return false;
      if (!(await anim(1100, (k) => drawBook(t, { grow: 1, fill: k })))) return false;
    }
    noteFor(t, true);
    await addPoint({ cover: t.cover, spread: t.spread });
    return myRun === run;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function loop() {
    const myRun = ++run;
    while (myRun === run && visible && !playing) {
      if (!(await runOne(myRun))) return;
      await sleep(1500);
      if (myRun !== run) return;
      if (pts.length >= 16) { await sleep(1800); if (myRun !== run) return; seed(); }
      if (reduce) return;
    }
  }
  function stopDemo() { if (!playing) { playing = true; run++; onPlay?.(); } }

  seed();
  const first = tender(); cur = first; drawBook(first); noteFor(first, true);
  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (cur) drawBook(cur); drawGP(); }); }).observe(root);

  return {
    show() { visible = true; if (!playing) loop(); },
    hide() { visible = false; run++; },
    next() { stopDemo(); const r = ++run; runOne(r); },
    reset() { stopDemo(); seed(); }
  };
}
