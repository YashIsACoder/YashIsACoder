// The research chart: running time against graph size, log scale.
// Drawn at the container's real pixel width so the text stays readable
// at any screen size; colours come from the theme's CSS variables.

const N = [64, 128, 256, 512, 1024];
const SERIES = [
  { id: 'howard', name: 'Howard’s method', ms: [7.2, 99.1, 1426.7, 21728.3, 349638.6] },
  { id: 'hybrid', name: 'hybrid', ms: [1, 7.2, 54.8, 425.4, 3536.2] },
  { id: 'cascade', name: 'cascade (ours)', ms: [0.3, 2, 15.2, 112.2, 853.6] }
];
const DECADES = { '-1': '0.1 ms', 0: '1 ms', 1: '10 ms', 2: '0.1 s', 3: '1 s', 4: '10 s', 5: '100 s', 6: '1000 s' };

function fmt(ms) {
  const s = ms / 1000;
  if (s >= 100) return `${Math.round(s)} s`;
  if (s >= 0.5) return `${+s.toPrecision(2)} s`;
  return `${+ms.toPrecision(ms < 10 ? 2 : 3)} ms`;
}

const NS = 'http://www.w3.org/2000/svg';
function el(name, attrs, text) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

function draw(box) {
  const w = Math.max(260, box.clientWidth);
  const narrow = w < 480;
  const h = narrow ? 260 : 320;
  const L = narrow ? 50 : 60, R = narrow ? 66 : 74, T = 14, B = 46;
  const lo = -1, hi = 6;
  const x = (i) => L + (i * (w - L - R)) / (N.length - 1);
  const y = (ms) => T + ((hi - Math.log10(ms)) / (hi - lo)) * (h - T - B);

  const svg = el('svg', { class: 'rchart', width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });

  // grid and y ticks: every decade on wide screens, every other on narrow ones
  for (let d = lo; d <= hi; d++) {
    const yy = T + ((hi - d) / (hi - lo)) * (h - T - B);
    svg.append(el('line', { class: d === 3 ? 'rchart__grid rchart__grid--strong' : 'rchart__grid', x1: L, x2: w - R + 8, y1: yy, y2: yy }));
    if (!narrow || d % 2 === 1) svg.append(el('text', { class: 'rchart__tick', x: L - 10, y: yy + 4, 'text-anchor': 'end' }, DECADES[d]));
  }
  // x ticks
  N.forEach((n, i) => svg.append(el('text', { class: 'rchart__tick', x: x(i), y: h - B + 22, 'text-anchor': 'middle' }, n)));
  svg.append(el('text', { class: 'rchart__axis', x: (L + w - R) / 2, y: h - 6, 'text-anchor': 'middle' }, 'states in the graph'));

  // lines, then dots, then end labels with the final value
  for (const s of SERIES) {
    svg.append(el('polyline', { class: `rchart__line rchart--${s.id}`, points: s.ms.map((v, i) => `${x(i)},${y(v)}`).join(' ') }));
  }
  for (const s of SERIES) {
    s.ms.forEach((v, i) => {
      const c = el('circle', { class: `rchart__dot rchart--${s.id}`, cx: x(i), cy: y(v), r: 4.5 });
      c.append(el('title', {}, `${s.name}, ${N[i]} states: ${fmt(v)}`));
      svg.append(c);
    });
    const last = s.ms[s.ms.length - 1];
    svg.append(el('text', { class: `rchart__end rchart--${s.id}`, x: x(N.length - 1) + 10, y: y(last) + 5 }, fmt(last)));
  }

  box.replaceChildren(svg);
}

const boxes = document.querySelectorAll('[data-rchart]');
boxes.forEach((box) => {
  draw(box);
  let last = box.clientWidth;
  new ResizeObserver(() => { if (box.clientWidth !== last) { last = box.clientWidth; draw(box); } }).observe(box);
});
