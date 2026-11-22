// yash.nvim — blog and course-review pages: live widgets, the scroll-aware
// table of contents and the list filters.
// A post asks for a widget with a line like:   ::: widget paired-draws seed=7 trials=8

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function lcg(seed) { let s = (seed * 2654435761) % 4294967296; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

const WIDGETS = {
  // Two pacing policies on the same weather draws: only the disagreements move d̂.
  'paired-draws'(el) {
    let seed = +(el.dataset.seed || 7);
    const n = Math.max(4, Math.min(24, +(el.dataset.trials || 8)));
    function render() {
      const r = lcg(seed); let n11 = 0, n10 = 0, n01 = 0, n00 = 0; const cells = [];
      for (let i = 0; i < n; i++) {
        const w = r(), a = w + 0.12 * r() > 0.38, b = w + 0.12 * r() > 0.45;
        if (a && b) n11++; else if (a) n10++; else if (b) n01++; else n00++;
        cells.push(`<li class="${a && !b ? 'a' : b && !a ? 'b' : ''}" aria-label="Draw ${i + 1}: A ${a ? 'finishes' : 'fails'}, B ${b ? 'finishes' : 'fails'}"><span class="${a ? '' : 'x'}">A</span><span class="${b ? '' : 'x'}">B</span></li>`);
      }
      const d = n10 - n01;
      el.innerHTML = `<div class="widget__top"><span class="widget__label">● live · ${n} paired draws · seed ${seed}</span><button type="button" class="btn btn--primary" data-reroll>re-roll the weather</button></div>
        <ul class="draws" style="grid-template-columns: repeat(${Math.min(n, 8)}, minmax(0, 1fr))">${cells.join('')}</ul>
        <div class="widget__sum" aria-live="polite"><span>both finish ${n11}</span><span class="c-peach">only A ${n10}</span><span class="c-blue">only B ${n01}</span><span>neither ${n00}</span><b style="margin-left:auto">d̂ = ${d < 0 ? '−' : ''}${Math.abs(d)}/${n}</b></div>`;
    }
    el.addEventListener('click', (e) => { if (e.target.closest('[data-reroll]')) { seed++; render(); } });
    render();
  }
};
export function mountWidgets(root = document) {
  root.querySelectorAll('[data-widget]').forEach((el) => {
    el.classList.add('widget');
    const make = WIDGETS[el.dataset.widget];
    if (make) make(el); else el.innerHTML = `<span class="widget__label">unknown widget: ${esc(el.dataset.widget)}</span>`;
  });
}
mountWidgets();

// ------------------------------------------------------------ table of contents follows the reader
const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const heads = tocLinks.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  const io = new IntersectionObserver(() => {
    const y = 140; let cur = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top - y <= 0) cur = h;
    tocLinks.forEach((a) => a.classList.toggle('is-here', a.hash.slice(1) === cur.id));
  }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
  heads.forEach((h) => io.observe(h));
  addEventListener('scroll', () => {
    const y = 140; let cur = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top - y <= 0) cur = h;
    tocLinks.forEach((a) => a.classList.toggle('is-here', a.hash.slice(1) === cur.id));
  }, { passive: true });
}

// ------------------------------------------------------------ list filters (blog index)
const filters = document.querySelector('[data-filters]');
if (filters) {
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]'); if (!btn) return;
    const tag = btn.dataset.filter;
    filters.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    document.querySelectorAll('[data-tags]').forEach((li) => { li.hidden = tag !== 'all' && !li.dataset.tags.split(' ').includes(tag); });
  });
}
