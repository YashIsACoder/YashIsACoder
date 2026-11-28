// Bond auction: a government bond tender clearing itself. Bidders name a
// yield and an amount. Bids are ranked from the lowest yield up and filled
// until the amount on offer is gone; each successful bidder gets the yield
// they bid (a multiple-price tender, the way Australia's are run). The
// results are the ones a tender announcement reports: bid to cover, the
// weighted average yield and the highest accepted yield.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const spring = (t) => 1 - Math.cos(t * Math.PI * 2.2) * Math.exp(-5 * t);
const money = (m) => (m >= 1000 ? `$${(m / 1000).toFixed(m % 1000 ? 2 : 0).replace(/\.?0+$/, '')}bn` : `$${Math.round(m)}m`);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function makeBids() {
  const mid = 4.1 + Math.random() * 0.6;                       // where the bond trades, in %
  const n = 16 + Math.floor(Math.random() * 8);
  return Array.from({ length: n }, () => {
    // most bidders sit close to the market; a few are keen, a few cautious
    const bp = gauss() * 1.1 + (Math.random() < 0.18 ? 1.6 + Math.random() * 2 : 0);
    return { y: Math.round((mid + bp / 100) * 10000) / 10000, amt: 25 + 25 * Math.floor(Math.random() * 10) };
  });
}

function clear(bids, offer) {
  const order = bids.map((b, i) => i).sort((a, b) => bids[a].y - bids[b].y || bids[b].amt - bids[a].amt);
  let left = offer, wsum = 0, filled = 0, high = null;
  const fill = new Array(bids.length).fill(0);
  for (const i of order) {
    if (left <= 0) break;
    const take = Math.min(bids[i].amt, left);
    fill[i] = take; left -= take; wsum += take * bids[i].y; filled += take; high = bids[i].y;
  }
  const total = bids.reduce((s, b) => s + b.amt, 0);
  return { order, fill, avg: filled ? wsum / filled : null, high, cover: total / offer, total, short: Math.max(0, left) };
}

export function mountAuction(box, { stats, offerInput, offerOut, onPlay } = {}) {
  let bids = [], offer = Number(offerInput?.value) || 800, res, size = { w: 0, h: 0 };
  let svg, bars = [], cutLine, cutLab, visible = false, playing = false, run = 0, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // per-bar animated state
  let st = [];

  function geometry() {
    const w = Math.max(280, box.clientWidth), h = Math.max(200, box.clientHeight);
    size = { w, h };
    const pad = { l: 2, r: 2, t: 30, b: 30 };
    const n = bids.length, gap = w < 520 ? 3 : 6;
    const bw = (w - pad.l - pad.r - gap * (n - 1)) / n;
    const maxA = Math.max(...bids.map((b) => b.amt));
    const yScale = (a) => (a / maxA) * (h - pad.t - pad.b);
    const slotX = (k) => pad.l + k * (bw + gap);
    return { w, h, pad, bw, gap, yScale, slotX, base: h - pad.b };
  }

  function build() {
    box.querySelector('svg')?.remove();
    const G = geometry();
    svg = el('svg', { viewBox: `0 0 ${G.w} ${G.h}`, width: G.w, height: G.h, class: 'auc' });
    el('line', { x1: 0, x2: G.w, y1: G.base + 0.5, y2: G.base + 0.5, class: 'auc__axis' }, svg);
    bars = bids.map(() => {
      const g = el('g', {}, svg);
      return { g, back: el('rect', { class: 'auc__bid', rx: 3 }, g), fill: el('rect', { class: 'auc__fill', rx: 3 }, g) };
    });
    cutLine = el('line', { class: 'auc__cut', y1: G.pad.t - 6, y2: G.base + 8 }, svg);
    cutLab = el('text', { class: 'auc__cutlab', y: G.pad.t - 14 }, svg);
    const lo = el('text', { class: 'auc__tick', x: G.pad.l, y: G.h - 8 }, svg); lo.textContent = 'Lower yield, filled first';
    const hi = el('text', { class: 'auc__tick', x: G.w - G.pad.r, y: G.h - 8, 'text-anchor': 'end' }, svg); hi.textContent = 'Higher yield';
    box.prepend(svg);
    render();
  }

  // draw the current animated state
  function render() {
    if (!svg) return;
    const G = geometry();
    const rank = new Array(bids.length);
    res.order.forEach((i, k) => { rank[i] = k; });
    bids.forEach((b, i) => {
      const s = st[i];
      const x = G.slotX(s.slot) ;
      const hgt = G.yScale(b.amt) * s.grow;
      bars[i].back.setAttribute('x', x.toFixed(1)); bars[i].back.setAttribute('width', G.bw.toFixed(1));
      bars[i].back.setAttribute('y', (G.base - hgt).toFixed(1)); bars[i].back.setAttribute('height', Math.max(0, hgt).toFixed(1));
      const fh = hgt * s.fill;
      bars[i].fill.setAttribute('x', x.toFixed(1)); bars[i].fill.setAttribute('width', G.bw.toFixed(1));
      bars[i].fill.setAttribute('y', (G.base - fh).toFixed(1)); bars[i].fill.setAttribute('height', Math.max(0, fh).toFixed(1));
      bars[i].back.classList.toggle('is-out', s.done && !res.fill[i]);
    });
    // cut-off: just after the last bid that was filled
    const lastK = res.order.reduce((m, i, k) => (res.fill[i] ? k : m), -1);
    const showCut = st.length && st.every((s) => s.done);
    const cx = G.slotX(lastK) + G.bw + G.gap / 2;
    cutLine.setAttribute('x1', cx.toFixed(1)); cutLine.setAttribute('x2', cx.toFixed(1));
    cutLine.style.opacity = showCut ? 1 : 0;
    cutLab.textContent = res.high != null ? `High yield ${res.high.toFixed(4)}%` : '';
    const anchorEnd = cx > G.w * 0.62;
    cutLab.setAttribute('x', (cx + (anchorEnd ? -8 : 8)).toFixed(1));
    cutLab.setAttribute('text-anchor', anchorEnd ? 'end' : 'start');
    cutLab.style.opacity = showCut ? 1 : 0;
  }

  function writeStats(final) {
    if (!stats) return;
    const r = res;
    const cells = [
      [`${bids.length} bids`, money(r.total)],
      ['Bid to cover', `${r.cover.toFixed(2)}×`],
      ['Average yield', r.avg != null ? `${r.avg.toFixed(4)}%` : '–'],
      ['High yield', r.high != null ? `${r.high.toFixed(4)}%` : '–'],
      ['High minus average', r.avg != null ? `${((r.high - r.avg) * 100).toFixed(2)} bp` : '–']
    ];
    stats.innerHTML = cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${final ? v : '…'}</dd></div>`).join('');
    if (r.short > 0 && final) stats.insertAdjacentHTML('beforeend', `<div class="auc__warn"><dt>Not covered</dt><dd>${money(r.short)} unsold</dd></div>`);
  }

  function tween(ms, fn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        fn(k); render();
        if (k < 1) raf = requestAnimationFrame(step); else resolve();
      };
      raf = requestAnimationFrame(step);
    });
  }

  // a whole tender: bids arrive, get ranked by yield, then fill
  async function play(myRun) {
    const alive = () => myRun === run;
    bids = makeBids();
    res = clear(bids, offer);
    const arrival = bids.map((_, i) => i).sort(() => Math.random() - 0.5);
    st = bids.map((_, i) => ({ slot: arrival.indexOf(i), grow: 0, fill: 0, done: false }));
    build(); writeStats(false);
    if (reduce) { finish(); return; }
    // arrive, one after another
    await tween(1400, (k) => st.forEach((s) => { const local = Math.max(0, Math.min(1, (k * 1.6 - s.slot / bids.length * 0.9) / 0.7)); s.grow = spring(local); }));
    if (!alive()) return;
    await sleep(350); if (!alive()) return;
    // rank by yield
    const from = st.map((s) => s.slot), rank = new Array(bids.length);
    res.order.forEach((i, k) => { rank[i] = k; });
    await tween(900, (k) => st.forEach((s, i) => { s.slot = from[i] + (rank[i] - from[i]) * ease(k); }));
    if (!alive()) return;
    st.forEach((s, i) => { s.slot = rank[i]; });
    await sleep(250); if (!alive()) return;
    // fill from the lowest yield until the offer is gone
    const order = res.order;
    await tween(1500, (k) => order.forEach((i, j) => {
      const local = Math.max(0, Math.min(1, k * order.length * 0.75 - j));
      st[i].fill = (res.fill[i] / bids[i].amt) * ease(local);
      if (local >= 1) st[i].done = true;
    }));
    if (!alive()) return;
    finish();
  }

  function finish() {
    const rank = new Array(bids.length);
    res.order.forEach((i, k) => { rank[i] = k; });
    st = bids.map((b, i) => ({ slot: rank[i], grow: 1, fill: res.fill[i] / b.amt, done: true }));
    render(); writeStats(true);
  }

  async function loop() {
    const myRun = ++run;
    while (myRun === run && visible) {
      await play(myRun);
      if (myRun !== run || playing || reduce) return;
      await sleep(4200);
    }
  }

  function reclear() {
    offer = Number(offerInput.value);
    if (offerOut) offerOut.textContent = money(offer);
    if (!bids.length) return;
    res = clear(bids, offer);
    finish();
  }
  offerInput?.addEventListener('input', () => {
    if (!playing) { playing = true; run++; cancelAnimationFrame(raf); onPlay?.(); }
    reclear();
  });
  if (offerOut && offerInput) offerOut.textContent = money(Number(offerInput.value));

  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (bids.length && Math.abs(box.clientWidth - size.w) > 2) build(); }); }).observe(box);

  return {
    show() { visible = true; if (!bids.length || !playing) loop(); else if (box.clientWidth !== size.w) build(); },
    hide() { visible = false; run++; cancelAnimationFrame(raf); if (bids.length && !playing) finish(); },
    rerun() { playing = true; const myRun = ++run; cancelAnimationFrame(raf); onPlay?.(); play(myRun); }
  };
}
