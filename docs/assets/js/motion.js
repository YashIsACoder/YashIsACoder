// The homepage's scroll behaviour.
//  - Work: a line joins the logos and fills as you scroll; each logo turns
//    into its real colours once the line reaches it, and back if you scroll up.
//  - Sections, job rows, projects and posts rise in the first time you reach them.
//  - The research numbers count up when they come into view.
// With reduced motion the logos still light up, but nothing moves.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const READ = 0.62;          // the "reading line", as a fraction of the window height

function timeline() {
  const box = document.querySelector('[data-timeline]');
  if (!box) return;
  const line = box.querySelector('.jobs__line');
  const jobs = [...box.querySelectorAll('.job')];
  const marks = jobs.map((j) => j.querySelector('.mark'));
  if (!line || marks.length < 2 || marks.some((m) => !m)) return;
  let first = 0, last = 0;

  const centre = (m, b) => { const r = m.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; };
  function measure() {
    const b = box.getBoundingClientRect();
    const a = centre(marks[0], b), z = centre(marks[marks.length - 1], b);
    first = a.y; last = z.y;
    line.style.left = `${a.x - 1}px`;
    line.style.top = `${first}px`;
    line.style.height = `${last - first}px`;
  }
  function update() {
    const b = box.getBoundingClientRect();
    const reach = innerHeight * READ - b.top;          // how far down the list the reading line is
    const p = Math.max(0, Math.min(1, (reach - first) / (last - first || 1)));
    line.style.setProperty('--p', p.toFixed(4));
    jobs.forEach((j, i) => j.classList.toggle('is-lit', centre(marks[i], b).y <= reach + 1));
  }
  let queued = false;
  const tick = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; update(); }); };
  measure(); update();
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', () => { measure(); tick(); });
  document.fonts?.ready.then(() => { measure(); update(); });
  new ResizeObserver(() => { measure(); tick(); }).observe(box);
}

// Things that rise in. Siblings in a group arrive one after another.
const GROUPS = [
  ['.section', '.section__h, .section__more'],
  ['.jobs', '.job'],
  ['#research', '.rs__title, .rs__who, .rs__text, .facts li, .links'],
  ['.pgroups', '.pgroup__h, .proj'],
  ['.cards', '.card']
];

function reveal() {
  const targets = [];
  for (const [scope, sel] of GROUPS) {
    document.querySelectorAll(scope).forEach((root) => {
      [...root.querySelectorAll(sel)].forEach((el, i) => {
        if (el.hasAttribute('data-reveal')) return;
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--d', `${Math.min(i, 6) * 70}ms`);
        targets.push(el);
      });
    });
  }
  // already on screen: show at once, so nothing blinks out on load
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of targets) {
    if (el.getBoundingClientRect().top < innerHeight * 0.95) el.classList.add('is-in');
    else io.observe(el);
  }
}

function countUp() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const b = e.target, { n, suffix, grouped } = b._count;
      const t0 = performance.now(), dur = 1300;
      const fmt = (v) => (grouped ? v.toLocaleString('en-AU') : String(v)) + suffix;
      const step = (t) => {
        const k = Math.max(0, Math.min(1, (t - t0) / dur)), eased = 1 - Math.pow(1 - k, 4);
        b.textContent = fmt(Math.round(n * eased));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.facts b').forEach((b) => {
    const m = b.textContent.trim().match(/^([\d,]+)(.*)$/);
    if (!m) return;
    const n = Number(m[1].replace(/,/g, ''));
    if (!n || b.getBoundingClientRect().top < innerHeight * 0.9) return;   // nothing to count, or already seen
    b._count = { n, suffix: m[2], grouped: m[1].includes(',') };
    b.textContent = `0${m[2]}`;
    io.observe(b);
  });
}

export function startMotion() {
  timeline();
  if (reduce || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion');
  reveal();
  countUp();
}
