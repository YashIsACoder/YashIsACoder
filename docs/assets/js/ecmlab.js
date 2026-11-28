// ECM, driven. A solar car runs a 240 km stage through hills, starting at
// 9 am. Power at the wheels and from the array use the same equations and
// inputs as solar-ecm-cpp (drag, rolling resistance, drivetrain efficiency,
// capped regeneration, auxiliaries, array output), plus climbing. The sky,
// the road, the battery and a ledger of where the energy went are drawn as
// the car goes. Until someone takes over, it drives at a few speeds in turn
// and keeps the earlier battery traces, so the cost of speed is plain.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// solar-ecm-cpp's synthetic car
const CAR = { m: 200, cda: 0.14, crr: 0.005, eta: 0.9, regen: 0.55, regenW: 100, aux: 60, area: 4, cell: 0.2, sys: 0.9, rho: 1.2, g: 9.80665, packWh: 5000 };
const ROUTE_KM = 240, START_H = 9, STEP_M = 500;

// a fixed, smooth road: elevation in metres at distance x km
const height = (x) => 140 + 70 * Math.sin(x / 23 + 0.4) + 38 * Math.sin(x / 9.5 + 1.7) + 16 * Math.sin(x / 4.1) + 0.35 * x;
// clear-sky irradiance in W/m², through the day
const sunAt = (hour) => 1000 * Math.pow(Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)), 1.25);

// drive the whole stage at one speed; returns per-step samples and totals (Wh)
export function drive(kmh, sky) {
  const v = kmh / 3.6, dt = STEP_M / v;
  let soc = CAR.packWh, hour = START_H;
  const tot = { drag: 0, roll: 0, climb: 0, hills: 0, losses: 0, aux: 0, solar: 0 };
  const steps = [{ x: 0, soc, hour, sun: sunAt(hour) * sky }];
  for (let s = 0; s < (ROUTE_KM * 1000) / STEP_M; s++) {
    const x0 = (s * STEP_M) / 1000, x1 = ((s + 1) * STEP_M) / 1000;
    const grade = (height(x1) - height(x0)) / STEP_M;
    const drag = 0.5 * CAR.rho * CAR.cda * v ** 3, roll = CAR.crr * CAR.m * CAR.g * v, climb = CAR.m * CAR.g * v * grade;
    const wheel = drag + roll + climb;
    const traction = wheel >= 0 ? wheel / CAR.eta : Math.max(wheel * CAR.regen, -CAR.regenW);
    const sun = sunAt(hour + dt / 7200) * sky;
    const solar = CAR.area * CAR.cell * CAR.sys * sun;
    const wh = (p) => (p * dt) / 3600;
    tot.drag += wh(drag); tot.roll += wh(roll); tot.climb += wh(Math.max(0, climb)); tot.hills += wh(Math.max(0, -climb)); tot.losses += wh(traction - wheel); tot.aux += wh(CAR.aux); tot.solar += wh(solar);
    soc += wh(solar - traction - CAR.aux);
    hour += dt / 3600;
    steps.push({ x: x1, soc, hour, sun, tot: { ...tot } });
  }
  return { kmh, sky, steps, tot, end: steps[steps.length - 1] };
}

const clock = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const kwh = (wh) => `${(wh / 1000).toFixed(2)} kWh`;

export function mountEcmLab(root, { onPlay } = {}) {
  const box = root.querySelector('[data-ecm]');
  const ledger = root.querySelector('[data-ecm-ledger]');
  const read = root.querySelector('[data-ecm-read]');
  const speedIn = root.querySelector('[data-ecm-speed]'), speedOut = root.querySelector('[data-ecm-speed-out]');
  const skyIn = root.querySelector('[data-ecm-sky]'), skyOut = root.querySelector('[data-ecm-sky-out]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let L = null, ghosts = [], cur = null, visible = false, playing = false, run = 0;

  function layout() {
    const w = Math.max(260, box.clientWidth), h = Math.max(240, box.clientHeight);
    const sky = { t: 6, b: h * 0.34 }, road = { t: h * 0.36, b: h * 0.6 }, bat = { t: h * 0.68, b: h - 22 };
    const X = (km) => 4 + (km / ROUTE_KM) * (w - 8);
    const hMin = 40, hMax = 300;
    const roadY = (km) => road.b - ((height(km) - hMin) / (hMax - hMin)) * (road.b - road.t);
    const batY = (wh) => bat.b - (Math.max(0, wh) / CAR.packWh) * (bat.b - bat.t);
    // the sun's arc from 6 am to 6 pm across the width
    const sunXY = (hour) => { const a = Math.PI * ((hour - 6) / 12); return { x: 4 + ((hour - 6) / 12) * (w - 8), y: sky.b - Math.sin(a) * (sky.b - sky.t - 14) }; };
    return { w, h, sky, road, bat, X, roadY, batY, sunXY };
  }

  function build() {
    box.querySelector('svg')?.remove();
    L = layout();
    const { w, h, X, roadY, batY, bat, road, sky, sunXY } = L;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'ecm' });
    // sky: the sun's path through the day, with hour marks
    let arc = '';
    for (let hr = 6; hr <= 18.001; hr += 0.25) { const p = sunXY(hr); arc += `${arc ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }
    el('path', { d: arc, class: 'ecm__arc' }, svg);
    for (const hr of [9, 12, 15]) { const p = sunXY(hr); el('text', { x: p.x, y: p.y + 24, 'text-anchor': 'middle', class: 'ecm__tick' }, svg).textContent = `${hr > 12 ? hr - 12 : hr}${hr >= 12 ? ' pm' : ' am'}`; }
    L.sun = el('circle', { r: 11, class: 'ecm__sun' }, svg);
    L.clock = el('text', { class: 'ecm__clock', x: w - 4, y: 18, 'text-anchor': 'end' }, svg);
    // road
    let ground = `M${X(0)},${road.b + 8}`;
    for (let km = 0; km <= ROUTE_KM; km += 1) ground += ` L${X(km).toFixed(1)},${roadY(km).toFixed(1)}`;
    ground += ` L${X(ROUTE_KM)},${road.b + 8} Z`;
    el('path', { d: ground, class: 'ecm__ground' }, svg);
    let line = '';
    for (let km = 0; km <= ROUTE_KM; km += 1) line += `${line ? 'L' : 'M'}${X(km).toFixed(1)},${roadY(km).toFixed(1)}`;
    el('path', { d: line, class: 'ecm__road' }, svg);
    L.driven = el('path', { class: 'ecm__driven' }, svg);
    L.car = el('g', { class: 'ecm__car' }, svg);
    el('rect', { x: -11, y: -9, width: 22, height: 6, rx: 3 }, L.car);
    el('circle', { cx: -6, cy: -2, r: 2.6 }, L.car); el('circle', { cx: 6, cy: -2, r: 2.6 }, L.car);
    // battery
    el('line', { x1: X(0), x2: X(ROUTE_KM), y1: batY(CAR.packWh), y2: batY(CAR.packWh), class: 'ecm__grid' }, svg);
    el('line', { x1: X(0), x2: X(ROUTE_KM), y1: batY(0), y2: batY(0), class: 'ecm__axis' }, svg);
    el('text', { x: X(0), y: bat.t - 8, class: 'ecm__label' }, svg).textContent = 'Battery';
    el('text', { x: X(ROUTE_KM), y: h - 4, 'text-anchor': 'end', class: 'ecm__tick' }, svg).textContent = `${ROUTE_KM} km`;
    el('text', { x: X(0), y: h - 4, class: 'ecm__tick' }, svg).textContent = '0 km';
    L.ghostG = el('g', {}, svg);
    L.bat = el('path', { class: 'ecm__bat' }, svg);
    L.batLab = el('text', { class: 'ecm__batlab' }, svg);
    box.prepend(svg);
    drawGhosts();
  }

  const traceOf = (d, upto = d.steps.length - 1) => d.steps.slice(0, upto + 1).map((s, i) => `${i ? 'L' : 'M'}${L.X(s.x).toFixed(1)},${L.batY(s.soc).toFixed(1)}`).join('');
  function drawGhosts() {
    L.ghostG.replaceChildren();
    ghosts.forEach((g) => {
      el('path', { d: traceOf(g), class: 'ecm__ghost' }, L.ghostG);
      const e = g.end;
      el('text', { x: L.X(e.x) - 4, y: L.batY(e.soc) - 6, 'text-anchor': 'end', class: 'ecm__ghostlab' }, L.ghostG).textContent = `${g.kmh} km/h`;
    });
  }

  // draw the drive up to step i
  function frame(d, i) {
    const s = d.steps[i];
    const { X, roadY, sunXY } = L;
    const p = sunXY(Math.min(18, s.hour));
    L.sun.setAttribute('cx', p.x.toFixed(1)); L.sun.setAttribute('cy', p.y.toFixed(1));
    L.sun.style.opacity = (0.25 + 0.75 * d.sky).toFixed(2);
    L.clock.textContent = clock(s.hour);
    let dr = '';
    for (let km = 0; km <= s.x + 1e-9; km += 1) dr += `${dr ? 'L' : 'M'}${X(km).toFixed(1)},${roadY(km).toFixed(1)}`;
    L.driven.setAttribute('d', dr || `M${X(0)},${roadY(0)}`);
    const a = Math.atan2(roadY(Math.min(ROUTE_KM, s.x + 2)) - roadY(Math.max(0, s.x - 2)), X(Math.min(ROUTE_KM, s.x + 2)) - X(Math.max(0, s.x - 2)));
    L.car.setAttribute('transform', `translate(${X(s.x).toFixed(1)},${roadY(s.x).toFixed(1)}) rotate(${((a * 180) / Math.PI).toFixed(1)})`);
    L.bat.setAttribute('d', traceOf(d, i));
    const pct = Math.round((Math.max(0, s.soc) / CAR.packWh) * 100);
    L.batLab.setAttribute('x', (X(s.x) + 6).toFixed(1)); L.batLab.setAttribute('y', (L.batY(s.soc) - 6).toFixed(1));
    L.batLab.setAttribute('text-anchor', s.x > ROUTE_KM * 0.8 ? 'end' : 'start');
    if (s.x > ROUTE_KM * 0.8) L.batLab.setAttribute('x', (X(s.x) - 6).toFixed(1));
    L.batLab.textContent = `${pct}%`;
    writeLedger(s.tot || { drag: 0, roll: 0, climb: 0, hills: 0, losses: 0, aux: 0, solar: 0 }, s);
  }

  function writeLedger(t, s) {
    // battery change = sunlight + hills given back − everything spent, exactly
    const out = [['Air drag', t.drag], ['Rolling', t.roll], ['Climbing', t.climb], ['Motor and braking losses', t.losses], ['Electronics, 60 W', t.aux]];
    const mx = Math.max(...out.map(([, v]) => v), t.solar, t.hills, 1);
    const row = (label, v, cls) => `<div class="eled__row ${cls || ''}"><span>${label}</span><span class="eled__bar"><i style="width:${((Math.max(0, Math.abs(v)) / mx) * 100).toFixed(1)}%"></i></span><b>${kwh(v)}</b></div>`;
    ledger.innerHTML = '<p class="eled__h">Spent</p>' + out.map(([l, v]) => row(l, v)).join('') + '<p class="eled__h">Gained</p>' + row('Sunlight', t.solar, 'is-in') + row('Downhills', t.hills, 'is-in') +
      `<div class="eled__net"><span>Battery</span><b>${Math.round((Math.max(0, s.soc) / CAR.packWh) * 100)}%</b></div>`;
  }

  function summary(d) {
    const e = d.end, pct = Math.round((Math.max(0, e.soc) / CAR.packWh) * 100);
    const flat = e.soc <= 0;
    return flat
      ? `At <b>${d.kmh} km/h</b> the battery runs flat before the finish. Air drag grows with the cube of speed.`
      : `At <b>${d.kmh} km/h</b> the car finishes at <b>${clock(e.hour)}</b> with <b>${pct}%</b> left. ${d.tot.drag > d.tot.solar ? 'Air drag alone costs more than the sun gives.' : 'The sun covers the air drag.'}`;
  }

  async function animate(d, myRun) {
    if (!L) build();
    const n = d.steps.length - 1;
    if (reduce) { frame(d, n); return true; }
    const ms = 4200, t0 = performance.now();
    return new Promise((done) => {
      const step = (now) => {
        if (myRun !== run) return done(false);
        const k = Math.min(1, (now - t0) / ms);
        frame(d, Math.round(k * n));
        if (k < 1) requestAnimationFrame(step); else done(true);
      };
      requestAnimationFrame(step);
    });
  }

  const sky = () => Number(skyIn.value) / 100;
  function syncOut() {
    speedOut.textContent = `${speedIn.value} km/h`;
    const v = Number(skyIn.value);
    skyOut.textContent = v >= 90 ? 'clear' : v >= 60 ? 'light cloud' : v >= 30 ? 'cloudy' : 'overcast';
  }

  async function drives(myRun) {
    for (const kmh of [65, 85, 105]) {
      if (myRun !== run) return;
      speedIn.value = kmh; syncOut();
      cur = drive(kmh, sky());
      read.innerHTML = `Driving at <b>${kmh} km/h</b>…`;
      if (!(await animate(cur, myRun))) return;
      read.innerHTML = summary(cur);
      await sleep(1600); if (myRun !== run) return;
      ghosts = [...ghosts.slice(-2), cur]; drawGhosts();
    }
  }
  async function loop() {
    const myRun = ++run;
    while (myRun === run && visible && !playing) {
      await drives(myRun);
      if (myRun !== run || reduce) return;
      await sleep(1400); if (myRun !== run) return;
      ghosts = []; drawGhosts();
    }
  }
  function takeOver() { if (!playing) { playing = true; run++; onPlay?.(); } }
  async function driveNow() {
    takeOver();
    const myRun = ++run;
    if (cur) { ghosts = [...ghosts.filter((g) => !(g.kmh === cur.kmh && g.sky === cur.sky)).slice(-2), cur]; drawGhosts(); }
    cur = drive(Number(speedIn.value), sky());
    read.innerHTML = `Driving at <b>${cur.kmh} km/h</b>…`;
    if (await animate(cur, myRun)) read.innerHTML = summary(cur);
  }
  let pend = 0;
  for (const inp of [speedIn, skyIn]) inp.addEventListener('input', () => { syncOut(); clearTimeout(pend); pend = setTimeout(driveNow, 220); });

  syncOut();
  build();
  cur = drive(Number(speedIn.value), sky());
  frame(cur, 0);
  read.innerHTML = 'A solar car, a 240 km stage and a 5 kWh battery. Pick a speed.';
  let rz = 0;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (Math.abs(box.clientWidth - (L?.w || 0)) > 2 || Math.abs(box.clientHeight - (L?.h || 0)) > 2) { build(); frame(cur, cur.steps.length - 1); } }); }).observe(box);

  return {
    show() { visible = true; if (!playing) loop(); },
    hide() { visible = false; run++; },
    drive: driveNow
  };
}
