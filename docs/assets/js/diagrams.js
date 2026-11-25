// Mermaid diagrams: ```mermaid blocks become <figure data-mermaid="…">.
// Mermaid is loaded only on pages that have a diagram, coloured from the
// site's own palette, and redrawn when the reader switches theme.

const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs';
let lib = null;
let count = 0;
const cache = new Map();          // theme + source -> svg

async function load() {
  if (!lib) lib = import(MERMAID).then((m) => m.default);
  return lib;
}

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k) => cs.getPropertyValue(k).trim();
  return {
    darkMode: document.documentElement.dataset.theme === 'dark',
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif',
    fontSize: '15px',
    background: v('--surface'),
    primaryColor: v('--surface'), primaryTextColor: v('--ink'), primaryBorderColor: v('--accent'),
    secondaryColor: v('--band'), secondaryTextColor: v('--ink'), secondaryBorderColor: v('--line-2'),
    tertiaryColor: v('--bg'), tertiaryTextColor: v('--ink'), tertiaryBorderColor: v('--line-2'),
    mainBkg: v('--surface'), nodeBorder: v('--accent'), nodeTextColor: v('--ink'),
    lineColor: v('--ink-2'), textColor: v('--ink'), titleColor: v('--ink'),
    clusterBkg: v('--bg'), clusterBorder: v('--line-2'), edgeLabelBackground: v('--surface'),
    noteBkgColor: v('--band'), noteTextColor: v('--ink'), noteBorderColor: v('--line-2'),
    actorBkg: v('--surface'), actorBorder: v('--accent'), actorTextColor: v('--ink'), actorLineColor: v('--line-2'),
    signalColor: v('--ink-2'), signalTextColor: v('--ink'), labelBoxBkgColor: v('--surface'), labelBoxBorderColor: v('--line-2'), labelTextColor: v('--ink'),
    loopTextColor: v('--ink'), activationBkgColor: v('--band'), activationBorderColor: v('--accent'), sequenceNumberColor: v('--accent-ink'),
    pie1: v('--accent'), pie2: v('--warm'), pie3: v('--good'), pie4: v('--ink-3'), pieStrokeColor: v('--bg'), pieTitleTextColor: v('--ink'), pieSectionTextColor: v('--accent-ink'),
    git0: v('--accent'), git1: v('--warm'), git2: v('--good'), git3: v('--ink-3')
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Draw every diagram under root. Returns the first error message, if any,
// so the editor can show it.
export async function renderDiagrams(root = document) {
  const figs = [...root.querySelectorAll('figure[data-mermaid]')];
  if (!figs.length) return null;
  let mermaid;
  try { mermaid = await load(); } catch {
    figs.forEach((f) => { if (!f.querySelector('.diagram__note')) f.insertAdjacentHTML('beforeend', '<figcaption class="diagram__note">The diagram couldn’t load, so here is its source.</figcaption>'); });
    return 'Mermaid couldn’t load. Check your connection.';
  }
  const theme = document.documentElement.dataset.theme || 'light';
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: palette(), fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif', flowchart: { useMaxWidth: true }, sequence: { useMaxWidth: true } });
  let firstError = null;
  for (const fig of figs) {
    const src = fig.dataset.mermaid;
    const key = `${theme}\n${src}`;
    try {
      let svg = cache.get(key);
      if (!svg) {
        await mermaid.parse(src);                       // throws on a syntax error, without touching the page
        svg = (await mermaid.render(`mmd-${++count}`, src)).svg;
        cache.set(key, svg);
        if (cache.size > 60) cache.delete(cache.keys().next().value);
      }
      fig.innerHTML = `<div class="diagram__svg">${svg}</div>`;
      fig.classList.remove('diagram--error');
    } catch (e) {
      const msg = String(e?.message || e).split('\n').slice(0, 3).join(' ').trim();
      firstError ??= msg;
      fig.classList.add('diagram--error');
      fig.innerHTML = `<pre class="diagram__src"><code>${esc(src)}</code></pre><figcaption class="diagram__note">This diagram has an error: ${esc(msg)}</figcaption>`;
      document.querySelectorAll('body > [id^="dmmd-"], body > [id^="mmd-"]').forEach((n) => n.remove());
    }
  }
  return firstError;
}

// Redraw on theme change.
document.addEventListener('themechange', () => { renderDiagrams(document); });
