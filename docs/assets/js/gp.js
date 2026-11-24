// The homepage's Gaussian process: a squared-exponential kernel, exact
// posterior by Cholesky, drawn at the plot's real pixel size so the dots
// stay round and the band stays crisp on any screen.

const NS = 'http://www.w3.org/2000/svg';
const Y_RANGE = 2.25;                      // y is drawn on [-2.25, 2.25]

export function posterior(pts, ell = 0.11, noise = 0.003, steps = 240) {
  const n = pts.length;
  const k = (a, b) => { const d = (a - b) / ell; return Math.exp(-0.5 * d * d); };
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = k(pts[i][0], pts[j][0]) + (i === j ? noise : 0);
      for (let m = 0; m < j; m++) s -= L[i][m] * L[j][m];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  }
  const fwd = (b) => { const x = new Float64Array(n); for (let r = 0; r < n; r++) { let s = b[r]; for (let c = 0; c < r; c++) s -= L[r][c] * x[c]; x[r] = s / L[r][r]; } return x; };
  const back = (b) => { const x = new Float64Array(n); for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let c = r + 1; c < n; c++) s -= L[c][r] * x[c]; x[r] = s / L[r][r]; } return x; };
  const alpha = n ? back(fwd(pts.map((p) => p[1]))) : [];
  const out = [];
  for (let g = 0; g <= steps; g++) {
    const x = g / steps;
    const ks = pts.map((p) => k(x, p[0]));
    let mu = 0; for (let i = 0; i < n; i++) mu += ks[i] * alpha[i];
    const v = n ? fwd(ks) : [];
    let vv = 1; for (let i = 0; i < n; i++) vv -= v[i] * v[i];
    out.push([x, mu, Math.sqrt(Math.max(vv, 0))]);
  }
  return out;
}

const el = (name, attrs) => { const e = document.createElementNS(NS, name); for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); return e; };

export function mountGP(box, { seed, status }) {
  let pts = [];
  let fresh = -1;                          // index of the point the reader just added
  const size = () => ({ w: Math.max(240, box.clientWidth), h: Math.max(180, box.clientHeight) });
  const pad = 10;

  function draw() {
    const { w, h } = size();
    const sx = (x) => pad + x * (w - 2 * pad);
    const sy = (y) => h / 2 - (y / Y_RANGE) * (h / 2 - pad);
    const post = posterior(pts);
    const f = (n) => n.toFixed(1);
    const up = post.map((p) => `${f(sx(p[0]))},${f(sy(p[1] + 2 * p[2]))}`);
    const lo = post.slice().reverse().map((p) => `${f(sx(p[0]))},${f(sy(p[1] - 2 * p[2]))}`);
    const svg = el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    svg.append(el('line', { class: 'gp__axis', x1: 0, x2: w, y1: h / 2, y2: h / 2 }));
    svg.append(el('path', { class: 'gp__band', d: `M${up.join(' L')} L${lo.join(' L')} Z` }));
    svg.append(el('path', { class: 'gp__mean', d: `M${post.map((p) => `${f(sx(p[0]))},${f(sy(p[1]))}`).join(' L')}` }));
    pts.forEach((p, i) => svg.append(el('circle', { class: i === fresh ? 'gp__dot gp__dot--new' : 'gp__dot', cx: f(sx(p[0])), cy: f(sy(p[1])), r: 6 })));
    box.replaceChildren(svg);
    const widest = Math.max(...post.map((p) => p[2]));
    status.textContent = pts.length
      ? `${pts.length} observation${pts.length === 1 ? '' : 's'}. The band is widest, ±${(2 * widest).toFixed(1)}, where the model has seen the least.`
      : 'No observations: the model knows nothing yet, so the band is as wide as it gets.';
  }

  function add(x, y) {
    pts = pts.concat([[Math.min(1, Math.max(0, x)), Math.max(-Y_RANGE + 0.2, Math.min(Y_RANGE - 0.2, y))]]);
    fresh = pts.length - 1;
    draw();
  }

  box.addEventListener('click', (e) => {
    const r = box.getBoundingClientRect(), { w, h } = size();
    const x = (e.clientX - r.left - pad) / (w - 2 * pad);
    const y = ((h / 2 - (e.clientY - r.top)) / (h / 2 - pad)) * Y_RANGE;
    add(x, y);
  });
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    add(Math.random(), (Math.random() * 2 - 1) * 1.6);
  });

  // One moment of motion on load: the observations arrive one by one and the
  // band closes around them. Skipped for readers who prefer less motion.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play() {
    if (reduce) { pts = seed.slice(); fresh = -1; draw(); return; }
    pts = []; fresh = -1; draw();
    seed.forEach((p, i) => setTimeout(() => { pts = seed.slice(0, i + 1); fresh = -1; draw(); }, 350 + i * 260));
  }

  new ResizeObserver(draw).observe(box);
  play();
  return {
    clear() { pts = []; fresh = -1; draw(); },
    reset() { pts = seed.slice(); fresh = -1; draw(); },
    addRandom() { add(Math.random(), (Math.random() * 2 - 1) * 1.6); }
  };
}
