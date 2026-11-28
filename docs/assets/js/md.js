// Markdown + LaTeX → HTML. Shared by the site build (Node) and the /write/
// editor (browser), so the live preview is exactly what gets published.
//
//   $inline$  $$display$$  ```cpp code```  ```mermaid diagrams```  [^footnotes]
//   ![images](assets/posts/…)  ::: widget name k=v
//
// Image paths that start with assets/ are relative to the site root; pass
// assetBase (or resolveAsset) so they work from any page.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// marked escapes heading text (it's -> it&#39;s). The table of contents
// escapes its own text, so it needs the plain characters back.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
export const unescapeHtml = (s) => String(s).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m);
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

// ------------------------------------------------------------ front matter
export function frontMatter(src, file = 'post') {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error(`${file}: missing front matter (--- … --- at the top)`);
  const data = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#\s.*$/, '');
    if (!line.trim()) continue;
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: can't read front matter line "${raw}"`);
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/^(true|false)$/.test(v)) v = v === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    else v = v.replace(/^["']|["']$/g, '');
    data[kv[1]] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

// ------------------------------------------------------------ code colour
const KW = {
  cpp: 'alignas auto bool break case catch char class const constexpr consteval continue co_await co_return decltype default delete do double else enum explicit extern false float for friend if inline int long mutable namespace new noexcept nullptr operator private protected public return short signed sizeof static static_assert struct switch template this throw true try typedef typename union unsigned using virtual void volatile while concept requires',
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
  js: 'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
  bash: 'if then else elif fi for while do done case esac function in export local return'
};
Object.assign(KW, { c: KW.cpp, 'c++': KW.cpp, hpp: KW.cpp, ts: KW.js, javascript: KW.js, typescript: KW.js, sh: KW.bash, py: KW.python });

export function highlight(code, lang) {
  const kw = KW[lang];
  if (!kw) return esc(code);
  const hash = ['python', 'py', 'bash', 'sh'].includes(lang);
  const re = new RegExp([
    hash ? '(#.*$)' : '(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)',
    '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)',
    `\\b(${kw.split(' ').join('|')})\\b`,
    '\\b(std::[\\w:]+|[A-Z][A-Za-z0-9_]*)\\b',
    '\\b(\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?[fFuUlL]*)\\b',
    '\\b([a-z_]\\w*)(?=\\()'
  ].join('|'), 'gm');
  let out = '', last = 0;
  code.replace(re, (m, c, s, k, t, n, f, off) => {
    out += esc(code.slice(last, off));
    out += `<span class="${c ? 'tok-c' : s ? 'tok-s' : k ? 'tok-k' : t ? 'tok-t' : n ? 'tok-n' : 'tok-f'}">${esc(m)}</span>`;
    last = off + m.length; return m;
  });
  return out + esc(code.slice(last));
}

const LANG_NAMES = { cpp: 'C++', 'c++': 'C++', cc: 'C++', hpp: 'C++', c: 'C', py: 'Python', python: 'Python', js: 'JavaScript', javascript: 'JavaScript', mjs: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript', rust: 'Rust', rs: 'Rust', go: 'Go', java: 'Java', sql: 'SQL', bash: 'Shell', sh: 'Shell', zsh: 'Shell', shell: 'Shell', json: 'JSON', yaml: 'YAML', yml: 'YAML', html: 'HTML', css: 'CSS', tex: 'LaTeX', latex: 'LaTeX', r: 'R', julia: 'Julia', haskell: 'Haskell', ocaml: 'OCaml', md: 'Markdown', markdown: 'Markdown', diff: 'Diff', toml: 'TOML', cmake: 'CMake', make: 'Make', makefile: 'Make' };

// ------------------------------------------------------------ the renderer
export function createRenderer({ marked, katex, assetBase = '', resolveAsset = null }) {
  const asset = (href) => (/^assets\//.test(href) ? (resolveAsset ? resolveAsset(href) : assetBase + href) : href);
  return function render(body, file = 'post') {
    const blocks = [], inlines = [];
    const hold = (arr, html, block) => { arr.push(html); return block ? `\n\nKXB${arr.length - 1}KX\n\n` : `KXI${arr.length - 1}KX`; };
    const tex = (src, display) => {
      try { return katex.renderToString(src, { displayMode: display, throwOnError: true }); }
      catch (e) { throw new Error(`${file}: LaTeX error in ${display ? '$$…$$' : '$…$'}: ${e.message.replace(/^KaTeX parse error: /, '')}`); }
    };

    // Fenced blocks, written any way GitHub accepts: ``` or ~~~, a space before
    // the language or not, any case, indented up to three spaces (inside a list).
    let text = body.replace(/^( {0,3})(`{3,}|~{3,})[ \t]*([\w+-]*)[^\n]*\n([\s\S]*?)^ {0,3}\2[`~]*[ \t]*$/gm, (_, indent, _fence, lang, code) => {
      const src = code.replace(/\n$/, '').split('\n').map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l.replace(/^ +/, ''))).join('\n');
      const lc = lang.toLowerCase();
      if (lc === 'mermaid') return hold(blocks, `<figure class="diagram" data-mermaid="${esc(src)}"><pre class="diagram__src"><code>${esc(src)}</code></pre></figure>`, true);
      const name = LANG_NAMES[lc] ?? (lc && lc !== 'text' ? lc : '');
      return hold(blocks, `<figure class="code"${name ? ` data-lang="${esc(name)}"` : ''}><pre><code class="language-${esc(lc || 'text')}">${highlight(src, lc)}</code></pre></figure>`, true);
    });
    text = text.replace(/`([^`\n]+)`/g, (_, code) => hold(inlines, `<code>${esc(code)}</code>`));
    text = text.replace(/^:::\s*widget\s+([\w-]+)(.*)$/gm, (_, name, rest) => {
      const attrs = [...rest.matchAll(/([\w-]+)=("[^"]*"|\S+)/g)].map(([, k, v]) => ` data-${esc(k)}="${esc(v.replace(/^"|"$/g, ''))}"`).join('');
      return hold(blocks, `<div data-widget="${esc(name)}"${attrs}><span class="widget__label">loading ${esc(name)}…</span></div>`, true);
    });
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => hold(blocks, `<div class="math-display">${tex(t.trim(), true)}</div>`, true));
    text = text.replace(/(^|[^\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, pre, t) => pre + hold(inlines, tex(t, false)));

    const defs = new Map(), order = [];
    text = text.replace(/^\[\^([\w-]+)\]:\s*(.+)$/gm, (_, id, t) => { defs.set(id, t); return ''; });
    text = text.replace(/\[\^([\w-]+)\]/g, (_, id) => {
      if (!order.includes(id)) order.push(id);
      const n = order.indexOf(id) + 1;
      return hold(inlines, `<a class="fnref" href="#fn-${esc(id)}" id="fnref-${esc(id)}" aria-label="Footnote ${n}">${n}</a>`);
    });

    const toc = [];
    const renderer = new marked.Renderer();
    renderer.heading = function ({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const plain = unescapeHtml(inner.replace(/<[^>]+>/g, '').replace(/KXI\d+KX/g, ''));
      const id = slugify(plain) || `section-${toc.length + 1}`;
      if (depth === 2) toc.push({ id, text: plain });
      const link = depth <= 3 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : '';
      return `<h${depth} id="${id}">${inner}${link}</h${depth}>\n`;
    };
    // > **Label:** text  becomes a labelled callout; a quote that is all bold becomes a pull quote
    renderer.blockquote = function ({ tokens }) {
      const inner = this.parser.parse(tokens);
      const m = inner.match(/^\s*<p><strong>([^<]{1,60}?)[:.]?<\/strong>[:.]?\s*/);
      const restOf = m ? inner.slice(m[0].length).replace(/^<\/p>\s*/, '') : '';
      if (m && restOf.replace(/<[^>]+>/g, '').trim()) {
        const label = m[1].replace(/[:.]\s*$/, '').trim();
        const kind = /theorem|lemma|definition|claim|corollary|proposition|axiom/i.test(label) ? 'thm'
          : /gotcha|careful|warning|caveat|pitfall|trap|beware|note|aside/i.test(label) ? 'note'
          : /puzzle|problem|question|exercise|challenge|task|try/i.test(label) ? 'q' : 'plain';
        const body = /^\s*</.test(restOf) && !/^\s*<(code|em|strong|a|span|b|i)\b/.test(restOf) ? restOf : `<p>${restOf}`;
        return `<aside class="callout callout--${kind}"><p class="callout__label">${label}</p>${body}</aside>\n`;
      }
      if (/^\s*<p><strong>[\s\S]*<\/strong>\.?<\/p>\s*$/.test(inner)) return `<blockquote class="pull">${inner.replace(/<\/?strong>/g, '')}</blockquote>\n`;
      return `<blockquote>${inner}</blockquote>\n`;
    };
    renderer.image = function ({ href, title, text }) {
      const img = `<img src="${esc(asset(href))}" alt="${esc(text)}" loading="lazy">`;
      return title ? `<figure class="pic">${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
    };
    let html = marked.parse(text, { renderer, gfm: true, async: false });
    const restore = (s) => s.replace(/<p>\s*KXB(\d+)KX\s*<\/p>/g, (_, i) => blocks[+i]).replace(/KXB(\d+)KX/g, (_, i) => blocks[+i]).replace(/KXI(\d+)KX/g, (_, i) => inlines[+i]);
    html = restore(html);
    // a diagram nested deeper than the fence pattern reaches still becomes a diagram
    html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `<figure class="diagram" data-mermaid="${code.replace(/\n$/, '')}"><pre class="diagram__src"><code>${code}</code></pre></figure>`);
    if (order.length) {
      html += `<section class="footnotes" aria-label="Footnotes"><ol>${order.map((id) =>
        `<li id="fn-${esc(id)}">${restore(marked.parseInline(defs.get(id) || '', { renderer }))} <a href="#fnref-${esc(id)}" aria-label="Back to the text">↩</a></li>`).join('')}</ol></section>`;
    }
    const words = body.replace(/(`{3,}|~{3,})[\s\S]*?\1/g, '').split(/\s+/).filter(Boolean).length;
    return { html, toc, words };
  };
}

export function readTime(words) { return `${Math.max(1, Math.round(words / 230))} min read`; }
