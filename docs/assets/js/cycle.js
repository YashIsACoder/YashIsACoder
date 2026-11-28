// Best cycle: a small minigame from the research. A weighted directed graph;
// find the loop whose edges have the highest average weight. The answer is
// found exactly (every simple cycle is checked; Karp's algorithm gets the
// same value in O(nm)). Until someone plays, it demonstrates itself: a greedy
// walk that always takes the heaviest arrow, then the true best loop.

const NS = 'http://www.w3.org/2000/svg';
const LETTERS = 'ABCDEFG';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const fmt = (x) => (Math.round(x * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeGraph(n) {
  const edges = [];
  const has = (a, b) => edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const w = () => 1 + Math.floor(Math.random() * 9);
  for (let i = 0; i < n; i++) edges.push({ a: i, b: (i + 1) % n, w: w(), ring: true });
  let tries = 0;
  while (edges.length < n + n - 1 && tries++ < 200) {
    const a = Math.floor(Math.random() * n), b = Math.floor(Math.random() * n);
    if (a === b || has(a, b)) continue;
    edges.push({ a, b, w: w(), ring: false });
  }
  return { n, edges };
}

// every simple cycle, keeping the best by mean weight
export function bestCycle({ n, edges }) {
  const out = Array.from({ length: n }, () => []);
  edges.forEach((e) => out[e.a].push(e));
  let best = { mean: -Infinity, nodes: [] };
  for (let s = 0; s < n; s++) {
    const path = [s], used = new Set([s]);
    const dfs = (v, sum) => {
      for (const e of out[v]) {
        if (e.b === s) {
          const mean = (sum + e.w) / path.length;
          if (mean > best.mean + 1e-9 || (Math.abs(mean - best.mean) < 1e-9 && path.length < best.nodes.length)) best = { mean, nodes: [...path] };
        } else if (e.b > s && !used.has(e.b)) {
          used.add(e.b); path.push(e.b);
          dfs(e.b, sum + e.w);
          path.pop(); used.delete(e.b);
        }
      }
    };
    dfs(s, 0);
  }
  return best;
}

// Karp's characterisation of the maximum cycle mean, as a cross-check
export function karp({ n, edges }) {
  const D = Array.from({ length: n + 1 }, () => new Array(n).fill(-Infinity));
  D[0].fill(0);
  for (let k = 1; k <= n; k++) for (const e of edges) if (D[k - 1][e.a] > -Infinity) D[k][e.b] = Math.max(D[k][e.b], D[k - 1][e.a] + e.w);
  let lam = -Infinity;
  for (let v = 0; v < n; v++) {
    if (D[n][v] === -Infinity) continue;
    let m = Infinity;
    for (let k = 0; k < n; k++) if (D[k][v] > -Infinity) m = Math.min(m, (D[n][v] - D[k][v]) / (n - k));
    lam = Math.max(lam, m);
  }
  return lam;
}

export function mountCycle(box, { status, onPlay } = {}) {
  let g, best, pos = [], centre = { x: 0, y: 0 }, svg, layers = {}, path = [], done = false, playing = false, demoRun = 0, visible = false, size = { w: 0, h: 0 };
  const say = (html) => { if (status) status.innerHTML = html; };
  const readout = document.createElement('p');
  readout.className = 'cyc__read';
  readout.setAttribute('aria-live', 'polite');
  box.before(readout);
  const read = (html) => { readout.innerHTML = html; };

  function layout() {
    const w = Math.max(280, box.clientWidth), h = Math.max(200, box.clientHeight);
    size = { w, h };
    const cx = w / 2, cy = h / 2, rx = Math.min(w * 0.38, h * 1.25), ry = h * 0.39;
    centre = { x: cx, y: cy };
    const off = -Math.PI / 2 + g.spin;
    pos = Array.from({ length: g.n }, (_, i) => {
      const t = off + (i / g.n) * Math.PI * 2;
      return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
    });
  }

  const R = () => (size.w < 520 ? 17 : 21);
  function curve(e) {
    const p = pos[e.a], q = pos[e.b];
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    const bend = (e.ring ? 0.12 : 0.2) * d;
    // ring edges bow outward, chords bow toward the middle, so no arrow runs through a node
    let nx = dy / d, ny = -dx / d;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const towardCentre = (centre.x - mx) * nx + (centre.y - my) * ny > 0;
    if (towardCentre === e.ring) { nx = -nx; ny = -ny; }
    const c = { x: mx + nx * bend, y: my + ny * bend };
    // trim both ends to the node circles
    const trim = (from, to, r) => { const vx = to.x - from.x, vy = to.y - from.y, L = Math.hypot(vx, vy) || 1; return { x: from.x + (vx / L) * r, y: from.y + (vy / L) * r }; };
    const s = trim(p, c, R() + 2), t = trim(q, c, R() + 7);
    const at = (k) => ({ x: (1 - k) * (1 - k) * s.x + 2 * k * (1 - k) * c.x + k * k * t.x, y: (1 - k) * (1 - k) * s.y + 2 * k * (1 - k) * c.y + k * k * t.y });
    return { d: `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`, at };
  }

  function draw() {
    box.querySelector('svg')?.remove();
    layout();
    const { w, h } = size;
    svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'cyc' });
    const defs = el('defs', {}, svg);
    for (const [id, cls] of [['cyc-arrow', 'cyc__head'], ['cyc-arrow-on', 'cyc__head cyc__head--on'], ['cyc-arrow-best', 'cyc__head cyc__head--best']]) {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }, m);
    }
    layers.edges = el('g', {}, svg);
    layers.labels = el('g', {}, svg);
    layers.nodes = el('g', {}, svg);
    const placed = [];
    const clear = (q) => placed.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > 27) && pos.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > R() + 14);
    g.edges.forEach((e, i) => {
      const c = curve(e);
      // put the weight at the middle of the arrow, or slide it along until it has room
      let mid = c.at(0.5);
      for (const k of [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75]) { const q = c.at(k); if (clear(q)) { mid = q; break; } }
      placed.push(mid);
      e.el = el('path', { d: c.d, class: 'cyc__edge', 'marker-end': 'url(#cyc-arrow)' }, layers.edges);
      const lg = el('g', { class: 'cyc__w', transform: `translate(${mid.x.toFixed(1)},${mid.y.toFixed(1)})` }, layers.labels);
      el('circle', { r: size.w < 520 ? 10 : 12 }, lg);
      const t = el('text', { 'text-anchor': 'middle', dy: '0.35em' }, lg);
      t.textContent = e.w;
      e.lab = lg;
      e.el.style.setProperty('--i', i);
    });
    g.nodes = pos.map((p, i) => {
      const ng = el('g', { class: 'cyc__node', transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`, tabindex: 0, role: 'button', 'aria-label': `Node ${LETTERS[i]}` }, layers.nodes);
      el('circle', { r: R() }, ng);
      const t = el('text', { 'text-anchor': 'middle', dy: '0.36em' }, ng);
      t.textContent = LETTERS[i];
      ng.style.setProperty('--i', i);
      ng.addEventListener('click', () => pick(i));
      ng.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(i); } });
      return ng;
    });
    box.prepend(svg);
    paint();
  }

  const edge = (a, b) => g.edges.find((e) => e.a === a && e.b === b);
  function paint(bestNodes = null, ghost = false) {
    const onPath = new Set();
    for (let i = 1; i < path.length; i++) onPath.add(edge(path[i - 1], path[i]));
    const onBest = new Set();
    if (bestNodes) bestNodes.forEach((v, i) => onBest.add(edge(v, bestNodes[(i + 1) % bestNodes.length])));
    g.edges.forEach((e) => {
      const b = onBest.has(e), p = onPath.has(e);
      e.el.classList.toggle('is-on', p && !b);
      e.el.classList.toggle('is-ghost', p && ghost && !b);
      e.el.classList.toggle('is-best', b);
      e.el.setAttribute('marker-end', b ? 'url(#cyc-arrow-best)' : p ? 'url(#cyc-arrow-on)' : 'url(#cyc-arrow)');
      e.lab.classList.toggle('is-on', p || b);
    });
    const last = path[path.length - 1];
    const next = !done && path.length ? new Set(g.edges.filter((e) => e.a === last).map((e) => e.b)) : new Set();
    g.nodes.forEach((ng, i) => {
      ng.classList.toggle('is-on', path.includes(i));
      ng.classList.toggle('is-here', i === last && !done);
      ng.classList.toggle('is-next', next.has(i));
      ng.classList.toggle('is-best', !!bestNodes && bestNodes.includes(i));
    });
  }

  const loopText = (nodes) => [...nodes, nodes[0]].map((v) => LETTERS[v]).join(' → ');
  function newGraph() {
    g = makeGraph(size.w && size.w < 520 ? 5 : 6);
    g.spin = (Math.random() - 0.5) * 0.5;
    best = bestCycle(g);
    best.karp = karp(g);
    path = []; done = false;
    draw();
    read(playing ? 'Pick a starting node.' : 'Click any node to start a loop.');
  }

  function pick(i) {
    if (!playing) { playing = true; demoRun++; path = []; done = false; onPlay?.(); }
    if (done) { path = []; done = false; }
    if (!path.length) { path = [i]; paint(); read(`Start at ${LETTERS[i]}. Follow an arrow.`); return; }
    const last = path[path.length - 1];
    const e = edge(last, i);
    if (!e) {
      read(`There’s no arrow from ${LETTERS[last]} to ${LETTERS[i]}. Try one of the highlighted nodes.`);
      g.nodes[i].classList.remove('is-nope'); void g.nodes[i].getBBox(); g.nodes[i].classList.add('is-nope');
      return;
    }
    const at = path.indexOf(i);
    path.push(i);
    if (at === -1) {
      const sum = path.slice(1).reduce((s, v, k) => s + edge(path[k], v).w, 0);
      paint(); read(`${path.map((v) => LETTERS[v]).join(' → ')}   <span class="muted">total ${sum}</span>`);
      return;
    }
    // the walk closed a loop
    done = true;
    const loop = path.slice(at, -1);
    const mean = loop.reduce((s, v, k) => s + edge(v, loop[(k + 1) % loop.length]).w, 0) / loop.length;
    path = [...loop, loop[0]];
    if (mean >= best.mean - 1e-9) {
      paint(best.nodes);
      read(`<b>${loopText(loop)}</b> averages <b>${fmt(mean)}</b>. That’s the best loop in this graph.`);
      say('You found the best loop. Press New graph for another.');
    } else {
      paint(best.nodes);
      read(`Your loop averages <b>${fmt(mean)}</b>. The best, ${loopText(best.nodes)}, averages <b>${fmt(best.mean)}</b>.`);
      say('Close. Click any node to try again, or press New graph.');
    }
  }

  function reveal() {
    if (!playing) { playing = true; demoRun++; onPlay?.(); }
    path = [...best.nodes, best.nodes[0]]; done = true;
    paint(best.nodes);
    read(`Best loop: <b>${loopText(best.nodes)}</b>, averaging <b>${fmt(best.mean)}</b>. Karp’s algorithm gets ${fmt(best.karp)} too.`);
  }

  // the demonstration: greedy first, then the true answer, then a new graph
  async function demo() {
    const run = ++demoRun;
    const alive = () => run === demoRun && visible && !playing;
    while (alive()) {
      await sleep(900); if (!alive()) return;
      let v = Math.floor(Math.random() * g.n);
      path = [v]; done = false; paint(null, true);
      read('Greedy: always take the heaviest arrow…');
      const seen = new Map([[v, 0]]);
      while (alive()) {
        await sleep(520); if (!alive()) return;
        const nxt = g.edges.filter((e) => e.a === v).sort((a, b) => b.w - a.w)[0];
        v = nxt.b; path.push(v); paint(null, true);
        if (seen.has(v)) break;
        seen.set(v, path.length - 1);
      }
      if (!alive()) return;
      const loop = path.slice(seen.get(v), -1);
      const gm = loop.reduce((s, u, k) => s + edge(u, loop[(k + 1) % loop.length]).w, 0) / loop.length;
      path = [...loop, loop[0]]; paint(null, true);
      read(`Greedy’s loop averages <b>${fmt(gm)}</b>.`);
      await sleep(1400); if (!alive()) return;
      path = [...best.nodes, best.nodes[0]]; done = true; paint(best.nodes);
      read(gm >= best.mean - 1e-9
        ? `Greedy got lucky: <b>${fmt(best.mean)}</b> is the best here. Your turn: click a node.`
        : `The best loop averages <b>${fmt(best.mean)}</b>. Greedy missed it. Your turn: click a node.`);
      await sleep(3600); if (!alive()) return;
      newGraph();
    }
  }

  size = { w: box.clientWidth, h: box.clientHeight };
  newGraph();
  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (box.clientWidth && Math.abs(box.clientWidth - size.w) > 2) { draw(); if (done && path.length) paint(best.nodes); } }); }).observe(box);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    show() { visible = true; if (box.clientWidth !== size.w) draw(); if (!playing && !reduce) demo(); },
    hide() { visible = false; demoRun++; },
    newGraph() { if (!playing) { playing = true; demoRun++; onPlay?.(); } newGraph(); say('Find the loop with the highest average weight.'); },
    reveal
  };
}
