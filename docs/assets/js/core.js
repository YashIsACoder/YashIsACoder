// yash.nvim — shared behaviour on every page.
//   • Catppuccin flavour follows the visitor's clock (or :colorscheme)
//   • lualine-style statusline, `:` command line, which-key on <Space>
//   • j / k / gg / G scrolling, and character rain in the tmux pane

const BASE = document.body.dataset.base || '';
const FLAVORS = ['latte', 'frappe', 'macchiato', 'mocha'];
const MODES = ['auto', ...FLAVORS];
const NICE = { latte: 'latte', frappe: 'frappe', macchiato: 'macchiato', mocha: 'mocha' };
const KEY = 'yash-colorscheme';

// day → latte, dusk → frappé, evening → macchiato, night → mocha
export function flavorForHour(h) {
  if (h >= 6 && h < 17) return 'latte';
  if (h >= 17 && h < 19) return 'frappe';
  if (h >= 19 && h < 22) return 'macchiato';
  return 'mocha';
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
};

let mode = MODES.includes(store.get(KEY)) ? store.get(KEY) : 'auto';
const $$ = (s) => document.querySelectorAll(s);
const setText = (s, t) => $$(s).forEach((el) => { el.textContent = t; });

function apply() {
  const now = new Date();
  const h = now.getHours();
  const flavor = mode === 'auto' ? flavorForHour(h) : mode;
  const root = document.documentElement;
  const changed = root.dataset.flavor !== flavor;
  root.dataset.flavor = flavor;
  const hh = String(h).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  setText('[data-clock]', hh);
  setText('[data-flavor-name]', `catppuccin-${NICE[flavor]}`);
  setText('[data-scheme-label]', mode === 'auto' ? `${NICE[flavor]} · auto` : NICE[flavor]);
  setText('[data-daypart]', h < 5 ? 'late night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night');
  $$('[data-scheme]').forEach((b) => b.setAttribute('aria-label', `Colour scheme: ${NICE[flavor]}${mode === 'auto' ? ', following your clock' : ''}. Click to change.`));
  if (changed) window.dispatchEvent(new CustomEvent('flavorchange', { detail: { flavor } }));
}

export function setScheme(next) {
  const n = next === 'frappé' ? 'frappe' : next;
  if (!MODES.includes(n)) return false;
  mode = n; store.set(KEY, mode); apply();
  return true;
}
function cycleScheme() { setScheme(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); toast(`:colorscheme ${mode === 'auto' ? 'auto (follows your clock)' : 'catppuccin-' + mode}`); }

document.addEventListener('click', (e) => { if (e.target.closest('[data-scheme]')) cycleScheme(); });
apply();
setInterval(apply, 30 * 1000);

// ------------------------------------------------------------ messages
let toastTimer = 0;
export function toast(text) {
  let el = document.querySelector('.msg');
  if (!el) { el = document.createElement('div'); el.className = 'msg'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

// ------------------------------------------------------------ email, assembled here so scrapers don't see it
const MAIL = ['yashwanth.madan7070', 'gmail.com'];
export const mailto = (subject) => `mailto:${MAIL.join('@')}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
$$('[data-mail]').forEach((a) => { a.href = mailto(a.dataset.subject); if ('show' in a.dataset) a.textContent = MAIL.join('@'); });

// ------------------------------------------------------------ statusline mode + file
const MODE_COLOURS = { NORMAL: 'var(--blue)', COMMAND: 'var(--peach)', LEADER: 'var(--mauve)', INSERT: 'var(--green)', FLOAT: 'var(--lav)' };
export function setMode(name) {
  setText('[data-mode]', name);
  document.querySelector('.statusline')?.style.setProperty('--mode', MODE_COLOURS[name] || 'var(--blue)');
}
document.addEventListener('focusin', (e) => { if (e.target.matches('input:not([data-cmd-input]), textarea')) setMode('INSERT'); });
document.addEventListener('focusout', (e) => { if (e.target.matches('input:not([data-cmd-input]), textarea')) setMode('NORMAL'); });

const files = [...$$('[data-file]')];
if (files.length && 'IntersectionObserver' in window) {
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => seen.set(en.target, en.intersectionRatio));
    let best = null, ratio = 0;
    seen.forEach((r, el) => { if (r > ratio) { ratio = r; best = el; } });
    if (!best) return;
    setText('[data-sl-file]', best.dataset.file);
    $$('.tab[data-tab]').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === best.id));
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.75], rootMargin: '-60px 0px -35% 0px' });
  files.forEach((f) => io.observe(f));
}
function updateLn() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const pct = max > 0 ? Math.round(scrollY / max * 100) : 100;
  setText('[data-sl-pos]', pct <= 0 ? 'Top' : pct >= 100 ? 'Bot' : pct + '%');
}
addEventListener('scroll', updateLn, { passive: true }); updateLn();

// ------------------------------------------------------------ command line
const commands = new Map();
export function command(names, fn, help) { (Array.isArray(names) ? names : [names]).forEach((n) => commands.set(n, { fn, help })); }

function go(sectionId, file) {
  const el = document.getElementById(sectionId);
  if (el) { el.scrollIntoView(); return `"${file}" opened`; }
  location.href = `${BASE}#${sectionId}`; return '';
}
command(['help', 'h'], () => 'try :e research · :e projects · :e blog · :e courses · :e experience · :colorscheme latte|frappe|macchiato|mocha|auto · :rain · :cv · :mail · or press <Space>', 'list commands');
command(['e', 'edit', 'cd'], (arg) => {
  const map = { readme: 'top', home: 'top', '~': 'top', projects: 'projects', research: 'research', dmdp: 'research', experience: 'experience', exp: 'experience', blog: 'blog', posts: 'blog', courses: 'courses', reviews: 'courses', contact: 'contact' };
  const id = map[(arg || '').replace(/[/.].*$/, '')];
  return id ? go(id, arg) : `E37: no such file: ${arg || '(none)'}`;
}, 'open a section');
command(['colorscheme', 'colo'], (arg) => setScheme((arg || '').replace(/^catppuccin-/, '')) ? `colorscheme ${mode === 'auto' ? 'auto (follows your clock)' : 'catppuccin-' + mode}` : 'E185: try latte, frappe, macchiato, mocha or auto', 'change theme');
command(['cv', 'resume'], () => { window.open(`${BASE}cv.pdf`, '_blank', 'noopener'); return 'opening cv.pdf'; }, 'open my CV');
command(['mail', 'email'], () => { location.href = mailto(); return 'opening your mail client'; }, 'email me');
command(['blog'], () => { location.href = `${BASE}blog/`; return ''; }, 'all posts');
command(['write', 'new'], () => { location.href = `${BASE}write/`; return ''; }, 'write a post');
command(['courses'], () => { location.href = `${BASE}courses/`; return ''; }, 'all course reviews');
command(['q', 'quit', 'wq', 'q!', 'x'], () => 'E37: No write since last change (add ! to override). Stay a while.', 'nice try');
command(['w'], () => '"yash.md" written', '');
command(['rain'], (arg) => { setRain(arg === 'off' ? false : arg === 'on' ? true : !rainOn); return rainOn ? 'rain on' : 'rain off'; }, 'toggle rain');
command(['sudo'], () => 'yash is not in the sudoers file. This incident will be reported.', '');

const cmdline = document.querySelector('.cmdline');
const cmdInput = cmdline?.querySelector('input');
let cmdHistory = [], cmdIdx = 0;
function openCmd(prefill = '') {
  if (!cmdline) return;
  cmdline.classList.add('is-open'); setMode('COMMAND');
  cmdInput.value = prefill; cmdInput.focus();
}
function closeCmd() { cmdline?.classList.remove('is-open'); setMode('NORMAL'); cmdInput?.blur(); }
export function runCommand(line) {
  const [name, ...rest] = line.trim().replace(/^:/, '').split(/\s+/);
  if (!name) return;
  const c = commands.get(name.toLowerCase());
  const out = c ? c.fn(rest.join(' ').toLowerCase()) : `E492: Not an editor command: ${name}`;
  if (out) toast(out);
}
cmdInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const v = cmdInput.value; cmdHistory.push(v); cmdIdx = cmdHistory.length; closeCmd(); runCommand(v); }
  else if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
  else if (e.key === 'ArrowUp' && cmdHistory.length) { e.preventDefault(); cmdIdx = Math.max(0, cmdIdx - 1); cmdInput.value = cmdHistory[cmdIdx]; }
  else if (e.key === 'ArrowDown' && cmdHistory.length) { e.preventDefault(); cmdIdx = Math.min(cmdHistory.length, cmdIdx + 1); cmdInput.value = cmdHistory[cmdIdx] || ''; }
});
document.addEventListener('click', (e) => { const b = e.target.closest('[data-run]'); if (b) runCommand(b.dataset.run); });

// ------------------------------------------------------------ which-key
const wk = document.querySelector('.whichkey');
const maps = [];
export function map(key, label, action) { maps.push({ key, label, action }); renderWK(); }
function renderWK() {
  if (!wk) return;
  wk.querySelector('ul').innerHTML = maps.map((m, i) => `<li><button type="button" data-wk="${i}"><kbd>${m.key}</kbd><span class="arrow">→</span><span>${m.label}</span></button></li>`).join('');
}
function openWK() { if (!wk) return; wk.classList.add('is-open'); setMode('LEADER'); }
function closeWK() { if (!wk) return; wk.classList.remove('is-open'); setMode('NORMAL'); }
wk?.addEventListener('click', (e) => { const b = e.target.closest('[data-wk]'); if (b) { closeWK(); maps[+b.dataset.wk].action(); } });

map('p', 'projects', () => go('projects', 'projects/'));
map('e', 'experience', () => go('experience', 'experience.log'));
map('d', 'research (dmdp)', () => go('research', 'research/'));
map('b', 'blog', () => go('blog', 'blog/'));
map('c', 'course reviews', () => go('courses', 'courses/'));
map('m', 'contact', () => go('contact', ':help yash'));
map('r', 'résumé (cv.pdf)', () => runCommand('cv'));
map('t', 'cycle colorscheme', cycleScheme);
map('w', 'toggle rain', () => runCommand('rain'));
map('n', 'write a post', () => { location.href = `${BASE}write/`; });
map(':', 'command line', () => openCmd());

// ------------------------------------------------------------ keys
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
let lastG = 0;
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (wk?.classList.contains('is-open')) {
    e.preventDefault();
    if (e.key === 'Escape' || e.key === ' ') return closeWK();
    const m = maps.find((x) => x.key === e.key);
    closeWK(); if (m) m.action();
    return;
  }
  if (typing() || document.body.classList.contains('is-floating')) return;
  if (e.key === ':') { e.preventDefault(); openCmd(); }
  else if (e.key === ' ' || e.key === '?') { e.preventDefault(); openWK(); }
  else if (e.key === 'j') scrollBy({ top: 90 });
  else if (e.key === 'k') scrollBy({ top: -90 });
  else if (e.key === 'G') scrollTo({ top: document.documentElement.scrollHeight });
  else if (e.key === 'g') { if (Date.now() - lastG < 450) scrollTo({ top: 0 }); lastG = Date.now(); }
});

// ------------------------------------------------------------ rain (characters)
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let rainOn = store.get('yash-rain') !== 'off';
let heavy = false;
const canvases = [...$$('canvas[data-rain]')];
const rainers = [];

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function rain(canvas) {
  const ctx = canvas.getContext('2d');
  const CH = 16, CW = 10;
  let w = 0, h = 0, cols = 0, drops = [], splashes = [], raf = 0, last = 0;
  let c1 = cssVar('--blue'), c2 = cssVar('--lav'), c3 = cssVar('--ov'), city = cssVar('--yellow'), bldg = cssVar('--s0');
  const GLYPHS = ['│', '|', '¦', ':', '╎'];

  function size() {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height; canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(w / CW); seed();
  }
  function seed() {
    const n = Math.round(cols * (heavy ? 2.2 : 1.1));
    drops = Array.from({ length: n }, () => newDrop(true));
  }
  function newDrop(anywhere) {
    return { c: Math.floor(Math.random() * cols), y: anywhere ? Math.random() * h : -Math.random() * 120, v: 160 + Math.random() * 220, len: 2 + Math.floor(Math.random() * 4), g: GLYPHS[Math.floor(Math.random() * GLYPHS.length)], a: 0.5 + Math.random() * 0.5 };
  }
  // a little ASCII skyline along the bottom, lit at night
  function skyline() {
    const night = ['mocha', 'macchiato'].includes(document.documentElement.dataset.flavor);
    ctx.font = `${CH - 2}px "JetBrains Mono", monospace`;
    const base = h - 6;
    const heights = [3, 5, 4, 7, 2, 6, 8, 4, 3, 6, 5, 9, 4, 2, 5, 7, 3, 6, 4, 8];
    for (let c = 0; c < cols; c++) {
      const hgt = heights[(c * 7 + (c >> 2)) % heights.length];
      for (let r = 0; r < hgt; r++) {
        const lit = night && ((c * 31 + r * 17) % 11 === 0);
        ctx.fillStyle = lit ? city : bldg;
        ctx.globalAlpha = lit ? 0.9 : 0.85;
        ctx.fillText(lit ? '▪' : '█', c * CW, base - r * (CH - 4));
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    ctx.clearRect(0, 0, w, h);
    skyline();
    if (rainOn) {
      ctx.font = `${CH}px "JetBrains Mono", monospace`;
      for (const d of drops) {
        d.y += d.v * dt;
        for (let i = 0; i < d.len; i++) {
          ctx.globalAlpha = d.a * (1 - i / d.len);
          ctx.fillStyle = i === 0 ? c2 : c1;
          ctx.fillText(d.g, d.c * CW, d.y - i * CH);
        }
        if (d.y > h - 22) { splashes.push({ x: d.c * CW, y: h - 24, life: 0.35 }); Object.assign(d, newDrop(false)); }
      }
      ctx.fillStyle = c3;
      splashes = splashes.filter((s) => (s.life -= dt) > 0);
      for (const s of splashes) { ctx.globalAlpha = s.life * 2; ctx.fillText(s.life > 0.2 ? '˙' : '.', s.x - 4, s.y); ctx.fillText('.', s.x + 6, s.y + 2); }
      ctx.globalAlpha = 1;
    }
    if (!reduce.matches) raf = requestAnimationFrame(frame);
  }
  function restart() { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); }
  new ResizeObserver(size).observe(canvas);
  addEventListener('flavorchange', () => { c1 = cssVar('--blue'); c2 = cssVar('--lav'); c3 = cssVar('--ov'); city = cssVar('--yellow'); bldg = cssVar('--s0'); restart(); });
  reduce.addEventListener('change', restart);
  size(); restart();
  return { reseed: seed, restart };
}
canvases.forEach((c) => rainers.push(rain(c)));

export function setRain(on) {
  rainOn = on; store.set('yash-rain', on ? 'on' : 'off');
  $$('[data-rain-toggle]').forEach((b) => { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'rain: on' : 'rain: off'; });
  setText('[data-rain-word]', on ? 'rain' : 'clear');
  rainers.forEach((r) => r.restart());
}
setRain(rainOn);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-rain-toggle]')) setRain(!rainOn);
  const hv = e.target.closest('[data-rain-heavy]');
  if (hv) { heavy = !heavy; hv.setAttribute('aria-pressed', String(heavy)); hv.textContent = heavy ? 'downpour' : 'drizzle'; rainers.forEach((r) => r.reseed()); }
});

// ------------------------------------------------------------ rain sounds (synthesised)
let audio = null;
function sound(on) {
  if (on && !audio) {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.04; }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(hp).connect(lp).connect(g).connect(ac.destination); src.start();
    g.gain.linearRampToValueAtTime(0.32, ac.currentTime + 1.5);
    audio = { ac, g };
  } else if (audio) {
    if (on) { audio.ac.resume(); audio.g.gain.linearRampToValueAtTime(0.32, audio.ac.currentTime + 1); }
    else audio.g.gain.linearRampToValueAtTime(0, audio.ac.currentTime + 0.6);
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sound]');
  if (!b) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'sound: on' : 'sound: off';
  sound(on);
});
