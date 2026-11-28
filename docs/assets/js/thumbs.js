// Small drawings for the projects filmstrip, one per project, in the site's
// colours. Each is a 160 × 100 SVG that says what the project is about at a
// glance: a payoff curve, a race route, a graph with its best cycle, ...

const svg = (body) => `<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false">${body}</svg>`;
const line = (pts, cls = 'th__ink', extra = '') => `<path class="${cls}" ${extra} d="M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}"/>`;

// a tiny seeded random, so the drawings are the same on every visit
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const DRAW = {
  'payoff-lab': () => {
    // long butterfly: payoff at expiry (sharp) and value today (smooth)
    const exp = [[10, 70], [55, 70], [80, 28], [105, 70], [150, 70]];
    const now = []; for (let x = 10; x <= 150; x += 4) { const d = (x - 80) / 26; now.push([x, 70 - 34 * Math.exp(-d * d)]); }
    return svg(`<line class="th__axis" x1="10" x2="150" y1="80" y2="80"/>${line(now, 'th__soft')}${line(exp, 'th__ink')}`);
  },
  'event-replay': () => {
    const r = rng(7); let bars = '';
    for (let i = 0; i < 22; i++) { const h = 8 + r() * 46 * (i % 7 === 3 ? 1.5 : 1); bars += `<rect class="th__bar" x="${12 + i * 6.4}" y="${82 - h}" width="4.4" height="${h}" rx="1"/>`; }
    return svg(`${bars}<line class="th__accent" x1="10" x2="150" y1="26" y2="26" stroke-dasharray="4 3"/><text class="th__label" x="150" y="20" text-anchor="end">p99</text>`);
  },
  quantsprint: () => svg('<text class="th__big" x="80" y="58" text-anchor="middle">47 × 8</text><rect class="th__bar" x="40" y="70" width="80" height="4" rx="2"/><rect class="th__accentfill" x="40" y="70" width="52" height="4" rx="2"/>'),
  solarroute: () => {
    // Darwin to Adelaide, roughly: north to south through the middle of the country
    const route = [[78, 12], [80, 24], [86, 34], [84, 46], [88, 58], [92, 68], [96, 80], [104, 90]];
    const dots = route.filter((_, i) => i % 2 === 1).map(([x, y]) => `<circle class="th__dot" cx="${x}" cy="${y}" r="2.6"/>`).join('');
    return svg(`<path class="th__soft" d="M40,30 C55,10 100,6 122,22 C142,36 140,70 120,86 C100,98 60,96 44,80 C30,66 30,44 40,30 Z"/>${line(route, 'th__sun')}${dots}<circle class="th__ink-fill" cx="78" cy="12" r="3.4"/><circle class="th__ink-fill" cx="104" cy="90" r="3.4"/>`);
  },
  ecm: () => {
    const p = []; for (let x = 10; x <= 150; x += 3) { const t = (x - 10) / 140; p.push([x, 52 - 30 * Math.sin(t * Math.PI * 1.6) * Math.exp(-t * 0.6)]); }
    return svg(`<line class="th__axis" x1="10" x2="150" y1="52" y2="52"/><rect class="th__band" x="46" y="52" width="40" height="26"/>${line(p, 'th__ink')}<text class="th__label" x="66" y="72" text-anchor="middle">regen cap</text>`);
  },
  'solar-ecm-cpp': () => {
    let ground = ''; for (let x = 0; x <= 160; x += 4) ground += `${x ? 'L' : 'M'}${x},${(70 + 8 * Math.sin(x / 19) + 4 * Math.sin(x / 7)).toFixed(1)}`;
    return svg(`<circle class="th__sunfill" cx="118" cy="28" r="11"/><path class="th__ink" d="${ground}"/><rect class="th__ink-fill" x="44" y="58" width="22" height="6" rx="3"/>`);
  },
  '3821-viz': () => {
    const n = [[30, 30], [80, 18], [130, 34], [112, 78], [52, 80]];
    const e = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3]];
    const best = new Set(['1-2', '2-3', '1-3']);
    return svg(e.map(([a, b]) => `<line class="${best.has(`${a}-${b}`) ? 'th__good' : 'th__soft'}" x1="${n[a][0]}" y1="${n[a][1]}" x2="${n[b][0]}" y2="${n[b][1]}"/>`).join('') +
      n.map(([x, y], i) => `<circle class="${[1, 2, 3].includes(i) ? 'th__goodfill' : 'th__node'}" cx="${x}" cy="${y}" r="7"/>`).join(''));
  },
  dmdp: () => {
    // Karp's table, filling row by row, with the cascade stopping early
    let cells = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
      const done = r < 3 || (r === 3 && c < 5);
      cells += `<rect class="${done ? 'th__cell' : 'th__cell th__cell--empty'}" x="${20 + c * 15.5}" y="${14 + r * 15}" width="12" height="12" rx="2"/>`;
    }
    return svg(`${cells}<line class="th__accent" x1="14" x2="146" y1="${14 + 3.5 * 15 - 1}" y2="${14 + 3.5 * 15 - 1}" stroke-dasharray="4 3"/>`);
  },
  'cpp-mlp': () => {
    const L = [[3, 30], [5, 80], [4, 130]].map(([k, x]) => Array.from({ length: k }, (_, i) => [x, 50 + (i - (k - 1) / 2) * 16]));
    let e = '';
    for (let l = 0; l < 2; l++) for (const a of L[l]) for (const b of L[l + 1]) e += `<line class="th__soft" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    return svg(e + L.flat().map(([x, y]) => `<circle class="th__node" cx="${x}" cy="${y}" r="5.5"/>`).join(''));
  },
  'random-walk-sim': () => {
    const r = rng(11); let out = '';
    ['th__ink', 'th__soft', 'th__accent'].forEach((cls, k) => {
      let y = 50; const p = [[10, 50]];
      for (let x = 14; x <= 150; x += 4) { y += (r() < 0.5 ? -1 : 1) * 5; y = Math.max(12, Math.min(88, y)); p.push([x, y]); }
      out += line(p, cls);
    });
    return svg(`<line class="th__axis" x1="10" x2="150" y1="50" y2="50"/>${out}`);
  }
};

export function thumbSVG(id, name = '') {
  return DRAW[id] ? DRAW[id]() : svg(`<text class="th__big" x="80" y="60" text-anchor="middle">${name.slice(0, 2)}</text>`);
}
