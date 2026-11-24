// yash.nvim — /write/: write a blog post or a course review in the browser.
//
// GitHub Pages only serves files, so publishing hands the Markdown to GitHub:
//   1. "Publish on GitHub" opens GitHub's new-file page, pre-filled. Sign in, commit.
//   2. "Commit directly" uses a fine-grained token you paste once. It never leaves
//      this browser except to talk to api.github.com.
// Either way the GitHub Action rebuilds the site about a minute later.

import { marked } from '../vendor/marked.esm.js';
import katex from '../vendor/katex.mjs';
import { createRenderer, esc, slugify, readTime } from './md.js?v=5a60447d';
import { mountWidgets } from './posts.js?v=5a60447d';
import { toast } from './site.js?v=5a60447d';

const REPO = 'YashIsACoder/YashIsACoder';
const BRANCH = 'main';
const DRAFT_KEY = 'yash-write-draft';
const TOKEN_KEY = 'yash-write-token';
const render = createRenderer({ marked, katex });
const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const STARTER = {
  post: `Open with the problem in plain words.

## The idea

Inline maths looks like $x^2$. Display maths goes on its own lines:

$$
\\mathbb{E}[X] = \\sum_x x \\, p(x)
$$

\`\`\`cpp
int main() { return 0; }
\`\`\`

A footnote looks like this.[^1]

[^1]: And the note itself goes at the bottom.
`,
  review: `What the course is actually about, in your own words.

## The good

## The hard parts

## How I'd approach it

## Who should take it
`
};

const f = {
  kind: () => document.querySelector('input[name="kind"]:checked').value,
  title: $('#w-title'), date: $('#w-date'), tags: $('#w-tags'), summary: $('#w-summary'), math: $('#w-math'),
  course: $('#w-course'), term: $('#w-term'), difficulty: $('#w-difficulty'), workload: $('#w-workload'), enjoyment: $('#w-enjoyment'), again: $('#w-again'),
  draft: $('#w-draft'), body: $('#w-body')
};

// ------------------------------------------------------------ courses list
fetch('../assets/data/courses.json').then((r) => r.json()).then((list) => {
  f.course.innerHTML = list.map((c) => `<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.name)}</option>`).join('');
  const saved = JSON.parse(store.get(DRAFT_KEY) || 'null');
  if (saved?.course) f.course.value = saved.course;
  update();
}).catch(() => { f.course.innerHTML = '<option value="">(could not load courses)</option>'; });

// ------------------------------------------------------------ markdown out
function tagsList() { return f.tags.value.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w+#.-]/g, '')).filter(Boolean); }
function filePath() {
  const kind = f.kind();
  const slug = kind === 'review' ? slugify(`${f.course.value}-${f.title.value.replace(new RegExp('^' + f.course.value + '\\s*[·:-]?\\s*', 'i'), '')}`) : slugify(f.title.value);
  return `content/${kind === 'review' ? 'courses' : 'blog'}/${f.date.value || today()}-${slug || 'untitled'}.md`;
}
function oneLine(s) { return String(s).replace(/\s+/g, ' ').trim(); }
export function toMarkdown() {
  const kind = f.kind();
  const lines = ['---', `title: ${oneLine(f.title.value) || 'Untitled'}`, `date: ${f.date.value || today()}`];
  if (kind === 'review') { lines.push(`course: ${f.course.value}`); if (f.term.value.trim()) lines.push(`term: ${oneLine(f.term.value)}`); }
  const tags = tagsList(); if (tags.length) lines.push(`tags: [${tags.join(', ')}]`);
  if (f.summary.value.trim()) lines.push(`summary: ${oneLine(f.summary.value)}`);
  if (kind === 'post' && f.math.value.trim()) lines.push(`card_math: ${oneLine(f.math.value)}`);
  if (kind === 'review') lines.push(`difficulty: ${f.difficulty.value}`, `workload: ${f.workload.value}`, `enjoyment: ${f.enjoyment.value}`, `again: ${f.again.checked}`);
  if (f.draft.checked) lines.push('draft: true');
  lines.push('---', '', f.body.value.replace(/\s+$/, '') + '\n');
  return lines.join('\n');
}

// ------------------------------------------------------------ preview
function meter(n, c) { const v = +n; return `<span class="meter" style="--c: var(${c})">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span> <span class="mono" style="font-size:12.5px;color:var(--sub)">${v}/10</span>`; }
let timer = 0;
function update() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const kind = f.kind();
    document.body.dataset.kind = kind;
    $('#w-path').textContent = filePath();
    ['difficulty', 'workload', 'enjoyment'].forEach((k) => { $(`#o-${k}`).textContent = `${f[k].value}/10`; });
    const out = $('#preview');
    try {
      const { html, words } = render(f.body.value, 'your post');
      const tags = tagsList();
      out.innerHTML = `
        <span class="post__kicker">${kind === 'review' ? `courses/<b>${esc(f.course.value)}</b>` : `blog/<b>${esc(slugify(f.title.value) || 'untitled')}.md</b>`}${tags.length ? ' · ' + tags.map((t) => '#' + esc(t)).join(' ') : ''}</span>
        <h1>${esc(f.title.value || 'Untitled')}</h1>
        ${f.summary.value.trim() ? `<p class="post__summary">${esc(f.summary.value)}</p>` : ''}
        <div class="post__meta"><span>Yashwanth Madan</span><span>${esc(f.date.value || today())}</span><span>${readTime(words)}</span>${f.draft.checked ? '<span class="todo">DRAFT</span>' : ''}</div>
        ${kind === 'review' ? `<div class="ratings"><span>difficulty</span><span>${meter(f.difficulty.value, '--red')}</span><span>workload</span><span>${meter(f.workload.value, '--peach')}</span><span>enjoyment</span><span>${meter(f.enjoyment.value, '--green')}</span><span>take again?</span><span>${f.again.checked ? 'yes' : 'no'}</span></div>` : ''}
        <div class="prose">${html}</div>`;
      mountWidgets(out);
      $('#w-error').hidden = true;
    } catch (e) {
      $('#w-error').hidden = false;
      $('#w-error').textContent = e.message;
    }
    saveDraft();
  }, 160);
}

// ------------------------------------------------------------ drafts
function saveDraft() {
  const d = { kind: f.kind(), title: f.title.value, date: f.date.value, tags: f.tags.value, summary: f.summary.value, math: f.math.value, course: f.course.value, term: f.term.value, difficulty: f.difficulty.value, workload: f.workload.value, enjoyment: f.enjoyment.value, again: f.again.checked, draft: f.draft.checked, body: f.body.value };
  store.set(DRAFT_KEY, JSON.stringify(d));
  const t = new Date();
  $('#w-saved').textContent = `Draft saved at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
function loadDraft(d) {
  document.querySelector(`input[name="kind"][value="${d.kind || 'post'}"]`).checked = true;
  for (const k of ['title', 'date', 'tags', 'summary', 'math', 'term', 'difficulty', 'workload', 'enjoyment', 'body']) if (d[k] !== undefined) f[k].value = d[k];
  if (d.course) f.course.value = d.course;
  f.again.checked = d.again !== false; f.draft.checked = !!d.draft;
}
const saved = JSON.parse(store.get(DRAFT_KEY) || 'null');
if (saved) loadDraft(saved); else { f.date.value = today(); f.body.value = STARTER.post; }

// ------------------------------------------------------------ import a .md file
$('#w-import').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^([\w-]+):\s*(.*)$/); if (kv) data[kv[1]] = kv[2].trim(); }
  loadDraft({
    kind: data.course ? 'review' : 'post', title: data.title || '', date: data.date || today(),
    tags: (data.tags || '').replace(/^\[|\]$/g, ''), summary: data.summary || '', math: data.card_math || '', course: data.course, term: data.term || '',
    difficulty: data.difficulty || 5, workload: data.workload || 5, enjoyment: data.enjoyment || 5, again: data.again !== 'false', draft: data.draft === 'true',
    body: m ? text.slice(m[0].length) : text
  });
  update(); toast(`Loaded ${file.name}`);
});

// ------------------------------------------------------------ editor niceties
document.addEventListener('input', (e) => { if (e.target.closest('.writer')) update(); });
document.addEventListener('change', (e) => {
  if (e.target.name === 'kind') {
    const k = f.kind();
    if (!f.body.value.trim() || f.body.value === STARTER.post || f.body.value === STARTER.review) f.body.value = STARTER[k];
    update();
  }
});
f.body.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); const { selectionStart: a, selectionEnd: b, value } = f.body; f.body.value = value.slice(0, a) + '    ' + value.slice(b); f.body.selectionStart = f.body.selectionEnd = a + 4; update(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveDraft(); toast('Draft saved in this browser'); }
});
document.querySelectorAll('[data-insert]').forEach((b) => b.addEventListener('click', () => {
  const snip = { math: '\n$$\n\\hat d = \\frac{n_{10} - n_{01}}{n}\n$$\n', code: '\n```cpp\n\n```\n', h2: '\n## Section\n', fn: '[^1]\n\n[^1]: \n', widget: '\n::: widget paired-draws seed=7 trials=8\n', link: '[text](https://)' }[b.dataset.insert];
  const { selectionStart: a, selectionEnd: z, value } = f.body;
  f.body.value = value.slice(0, a) + snip + value.slice(z);
  f.body.focus(); f.body.selectionStart = f.body.selectionEnd = a + snip.length; update();
}));

// ------------------------------------------------------------ publish
function check() {
  if (!f.title.value.trim()) { toast('Add a title first'); f.title.focus(); return false; }
  try { render(f.body.value, 'your post'); } catch (e) { toast(e.message); return false; }
  return true;
}
$('#w-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(toMarkdown()); toast('Copied the Markdown to your clipboard'); }
  catch { toast('Copy failed: select the text in the editor instead'); }
});
$('#w-download').addEventListener('click', () => {
  const blob = new Blob([toMarkdown()], { type: 'text/markdown' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filePath().split('/').pop() });
  a.click(); URL.revokeObjectURL(a.href);
});
$('#w-github').addEventListener('click', async () => {
  if (!check()) return;
  const md = toMarkdown();
  const base = `https://github.com/${REPO}/new/${BRANCH}?filename=${encodeURIComponent(filePath())}`;
  const url = `${base}&value=${encodeURIComponent(md)}`;
  if (url.length < 7500) { window.open(url, '_blank', 'noopener'); toast('Opened GitHub: check the post, then press Commit changes'); return; }
  try { await navigator.clipboard.writeText(md); } catch { /* fall through */ }
  window.open(base, '_blank', 'noopener');
  toast('Long post: it’s on your clipboard. Paste it into GitHub, then commit.');
});

// token commit
const tokenIn = $('#w-token');
const savedToken = store.get(TOKEN_KEY);
if (savedToken) { tokenIn.value = savedToken; $('#w-remember').checked = true; }
const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
$('#w-commit').addEventListener('click', async () => {
  if (!check()) return;
  const token = tokenIn.value.trim();
  if (!token) { toast('Paste a fine-grained token first (see the steps)'); tokenIn.focus(); return; }
  if ($('#w-remember').checked) store.set(TOKEN_KEY, token); else store.del(TOKEN_KEY);
  const p = filePath();
  const api = `https://api.github.com/repos/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const status = $('#w-status');
  status.textContent = 'Committing…';
  try {
    let sha;
    const head = await fetch(`${api}?ref=${BRANCH}`, { headers });
    if (head.ok) sha = (await head.json()).sha;
    const res = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: `${f.kind() === 'review' ? 'review' : 'blog'}: ${sha ? 'update' : 'add'} ${f.title.value.trim()}`, content: b64(toMarkdown()), branch: BRANCH, ...(sha ? { sha } : {}) }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || res.status);
    status.innerHTML = `committed <a class="c-blue" href="${esc(data.commit.html_url)}" target="_blank" rel="noopener">${esc(data.commit.sha.slice(0, 7))}</a> · the site rebuilds in about a minute (<a class="c-blue" href="https://github.com/${REPO}/actions" target="_blank" rel="noopener">watch</a>)`;
    toast(f.draft.checked ? 'Committed as a draft: it won’t show until you untick draft' : 'Published: live in about a minute');
  } catch (e) {
    status.textContent = `Commit failed: ${e.message}. Check the token can write "Contents" on ${REPO}.`;
  }
});
$('#w-forget').addEventListener('click', () => { store.del(TOKEN_KEY); tokenIn.value = ''; $('#w-remember').checked = false; toast('Token removed from this browser'); });
$('#w-new').addEventListener('click', () => {
  if (!confirmClear()) return;
  store.del(DRAFT_KEY);
  loadDraft({ kind: f.kind(), title: '', date: today(), tags: '', summary: '', math: '', term: '', difficulty: 5, workload: 5, enjoyment: 5, again: true, draft: false, body: STARTER[f.kind()] });
  update();
});
let armed = 0;
function confirmClear() {
  if (Date.now() - armed < 3000) return true;
  armed = Date.now(); toast('Press New again within 3 seconds to clear this draft'); return false;
}

update();
