import { renderDiagrams } from './diagrams.js?v=2fb509c6';
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
      el.innerHTML = `<div class="widget__top"><span class="widget__label">${n} paired draws, weather seed ${seed}</span><button type="button" class="btn btn--primary" data-reroll>Re-roll the weather</button></div>
        <ul class="draws" style="grid-template-columns: repeat(${Math.min(n, 8)}, minmax(0, 1fr))">${cells.join('')}</ul>
        <div class="widget__sum" aria-live="polite"><span>Both finish ${n11}</span><span class="c-peach">Only A ${n10}</span><span class="c-blue">Only B ${n01}</span><span>Neither ${n00}</span><b style="margin-left:auto">d̂ = ${d < 0 ? '−' : ''}${Math.abs(d)}/${n}</b></div>`;
    }
    el.addEventListener('click', (e) => { if (e.target.closest('[data-reroll]')) { seed++; render(); } });
    render();
  }
};
export function mountWidgets(root = document) {
  root.querySelectorAll('[data-widget]').forEach((el) => {
    el.classList.add('widget');
    const make = WIDGETS[el.dataset.widget];
    if (make) make(el); else el.innerHTML = `<span class="widget__label">Unknown widget: ${esc(el.dataset.widget)}</span>`;
  });
}
mountWidgets();
if (document.querySelector('.prose figure[data-mermaid]')) renderDiagrams(document.querySelector('.prose'));

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
    const url = new URL(location.href);
    if (tag === 'all') url.searchParams.delete('tag'); else url.searchParams.set('tag', tag);
    history.replaceState(null, '', url);
  });
  // a tag link from a post (?tag=graphs) opens the list already filtered
  const want = new URLSearchParams(location.search).get('tag');
  if (want) filters.querySelector(`button[data-filter="${CSS.escape(want)}"]`)?.click();
}

// ------------------------------------------------------------ post pages
// reading progress, copy buttons on code, and copying a section's link
const article = document.querySelector('.post .prose');
if (article) {
  const bar = document.querySelector('.readbar span');
  if (bar) {
    let queued = false;
    const update = () => {
      queued = false;
      const r = article.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (innerHeight * 0.4 - r.top) / (r.height - innerHeight * 0.4)));
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }
  article.querySelectorAll('figure.code').forEach((fig) => {
    if (!fig.dataset.lang && fig.querySelector('pre').innerText.trim().split('\n').length < 3) return;   // a one-line snippet needs no toolbar
    const bar = document.createElement('div');
    bar.className = 'code__bar';
    bar.innerHTML = `<span>${fig.dataset.lang || ''}</span><button type="button" class="code__copy">Copy</button>`;
    fig.prepend(bar);
    const btn = bar.querySelector('button');
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(fig.querySelector('pre').innerText.replace(/\n$/, '')); btn.textContent = 'Copied'; }
      catch { btn.textContent = 'Press ⌘C'; getSelection().selectAllChildren(fig.querySelector('pre')); }
      setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
    });
  });
  article.addEventListener('click', async (e) => {
    const a = e.target.closest('a.anchor');
    if (!a) return;
    try { await navigator.clipboard.writeText(new URL(a.getAttribute('href'), location.href).href); a.dataset.copied = ''; setTimeout(() => delete a.dataset.copied, 1400); } catch { /* the link still works */ }
  });
}

// Edit and Delete on the Writing and course review lists, for the owner.
if (document.documentElement.classList.contains('is-owner') && document.querySelector('[data-delete]')) import('./owner.js?v=2fb509c6');
