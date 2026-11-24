// /write/: write, edit and publish posts and course reviews from the site.
//
// GitHub Pages only serves files, so publishing commits the Markdown to the
// repository and the GitHub Action rebuilds the site about a minute later.
//   Publish            commits straight from this page, with a fine-grained
//                      token saved once per device (only ever sent to GitHub).
//   Publish via GitHub opens GitHub's editor with the post filled in.
// /write/?edit=content/blog/<file>.md loads an existing post to change it.

import { marked } from '../vendor/marked.esm.js';
import katex from '../vendor/katex.mjs';
import { createRenderer, esc, slugify, readTime } from './md.js?v=30be2d68';
import { mountWidgets } from './posts.js?v=30be2d68';
import { toast } from './site.js?v=30be2d68';

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
try { localStorage.setItem('yash-owner', '1'); document.documentElement.classList.add('is-owner'); } catch { /* private mode */ }
const params = new URLSearchParams(location.search);
const EDIT = /^content\/(blog|courses)\/[\w.-]+\.md$/.test(params.get('edit') || '') ? params.get('edit') : null;
const draftKey = () => (EDIT ? `${DRAFT_KEY}:${EDIT}` : DRAFT_KEY);
const liveUrl = (p) => `../${p.startsWith('content/courses/') ? 'courses' : 'blog'}/${p.split('/').pop().replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')}/`;
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
  const saved = JSON.parse(store.get(draftKey()) || 'null');
  if (saved?.course) f.course.value = saved.course;
  update();
}).catch(() => { f.course.innerHTML = '<option value="">(could not load courses)</option>'; });

// ------------------------------------------------------------ markdown out
function tagsList() { return f.tags.value.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w+#.-]/g, '')).filter(Boolean); }
function filePath() {
  if (EDIT) return EDIT;
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
function meter(n) { const v = +n; return `<span class="meter" role="img" aria-label="${v} out of 10">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span> <span class="muted">${v}/10</span>`; }
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
        <span class="crumbs">${kind === 'review' ? `Courses / ${esc(f.course.value)}` : 'Writing'}</span>
        ${tags.length ? `<ul class="post__tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <h1>${esc(f.title.value || 'Untitled')}</h1>
        ${f.summary.value.trim() ? `<p class="post__summary">${esc(f.summary.value)}</p>` : ''}
        <div class="post__meta"><span>Yashwanth Madan</span><span>${esc(f.date.value || today())}</span><span>${readTime(words)}</span>${f.draft.checked ? '<span>Draft</span>' : ''}</div>
        ${kind === 'review' ? `<div class="ratings"><span>Difficulty</span><span>${meter(f.difficulty.value)}</span><span>Workload</span><span>${meter(f.workload.value)}</span><span>Enjoyment</span><span>${meter(f.enjoyment.value)}</span><span>Take it again?</span><span>${f.again.checked ? 'Yes' : 'No'}</span>${f.term.value.trim() ? `<span>Taken</span><span>${esc(f.term.value)}</span>` : ''}</div>` : ''}
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
  store.set(draftKey(), JSON.stringify(d));
  const t = new Date();
  $('#w-saved').textContent = `Draft saved at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
function loadDraft(d) {
  document.querySelector(`input[name="kind"][value="${d.kind || 'post'}"]`).checked = true;
  for (const k of ['title', 'date', 'tags', 'summary', 'math', 'term', 'difficulty', 'workload', 'enjoyment', 'body']) if (d[k] !== undefined) f[k].value = d[k];
  if (d.course) f.course.value = d.course;
  f.again.checked = d.again !== false; f.draft.checked = !!d.draft;
}
const saved = JSON.parse(store.get(draftKey()) || 'null');
if (saved) loadDraft(saved);
else if (!EDIT) {
  const k = params.get('kind') === 'review' ? 'review' : 'post';
  loadDraft({ kind: k, date: today(), body: STARTER[k] });
}

// ------------------------------------------------------------ import a .md file
function parseMd(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^([\w-]+):\s*(.*)$/); if (kv) data[kv[1]] = kv[2].trim(); }
  return {
    kind: data.course ? 'review' : 'post', title: data.title || '', date: data.date || today(),
    tags: (data.tags || '').replace(/^\[|\]$/g, ''), summary: data.summary || '', math: data.card_math || '', course: data.course, term: data.term || '',
    difficulty: data.difficulty || 5, workload: data.workload || 5, enjoyment: data.enjoyment || 5, again: data.again !== 'false', draft: data.draft === 'true',
    body: (m ? text.slice(m[0].length) : text).replace(/^\n+/, '')
  };
}
$('#w-import').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  loadDraft(parseMd(await file.text()));
  update(); toast(`Loaded ${file.name}`);
});

// ------------------------------------------------------------ editing a published post
if (EDIT) {
  $('#w-mode').textContent = 'You’re editing a published post. Change anything, then press Publish to update it.';
  document.querySelectorAll('input[name="kind"]').forEach((r) => { r.disabled = true; });
  if (!saved) {
    $('#w-saved').textContent = 'Loading the post…';
    fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${EDIT}?t=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error(r.status === 404 ? 'that post isn’t in the repository' : `GitHub answered ${r.status}`); return r.text(); })
      .then((text) => { loadDraft(parseMd(text)); update(); $('#w-saved').textContent = 'Loaded from GitHub.'; })
      .catch((e) => { $('#w-saved').textContent = `Couldn’t load the post: ${e.message}.`; });
  }
}

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
  if (EDIT) {
    try { await navigator.clipboard.writeText(md); } catch { /* fall through */ }
    window.open(`https://github.com/${REPO}/edit/${BRANCH}/${EDIT}`, '_blank', 'noopener');
    toast('Your edit is on your clipboard. In GitHub, select all, paste, then press Commit changes.');
    return;
  }
  const base = `https://github.com/${REPO}/new/${BRANCH}?filename=${encodeURIComponent(filePath())}`;
  const url = `${base}&value=${encodeURIComponent(md)}`;
  if (url.length < 7500) { window.open(url, '_blank', 'noopener'); toast('Opened GitHub: check the post, then press Commit changes'); return; }
  try { await navigator.clipboard.writeText(md); } catch { /* fall through */ }
  window.open(base, '_blank', 'noopener');
  toast('Long post: it’s on your clipboard. Paste it into GitHub, then commit.');
});

// one-click publishing with a token saved on this device
const tokenIn = $('#w-token');
const setup = $('#w-setup');
function showSetupState() {
  const has = !!store.get(TOKEN_KEY);
  $('#w-setup-label').textContent = has ? 'One-click publishing is set up on this device' : 'Set up one-click publishing on this device';
  tokenIn.value = has ? store.get(TOKEN_KEY) : '';
}
showSetupState();
$('#w-save-token').addEventListener('click', () => {
  const t = tokenIn.value.trim();
  if (!/^(github_pat_|ghp_)\w+/.test(t)) { toast('That doesn’t look like a GitHub token: it should start with github_pat_'); tokenIn.focus(); return; }
  store.set(TOKEN_KEY, t); showSetupState(); setup.open = false;
  toast('Token saved on this device. Press Publish.');
});
$('#w-forget').addEventListener('click', () => { store.del(TOKEN_KEY); showSetupState(); toast('Token removed from this device'); });

const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
$('#w-publish').addEventListener('click', async () => {
  if (!check()) return;
  const token = store.get(TOKEN_KEY);
  if (!token) {
    setup.open = true; setup.scrollIntoView({ block: 'center' }); tokenIn.focus();
    toast('First, a one-time setup on this device: follow the steps below.');
    return;
  }
  const p = filePath();
  const api = `https://api.github.com/repos/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const status = $('#w-status');
  const btn = $('#w-publish');
  btn.disabled = true; btn.textContent = 'Publishing…';
  status.textContent = '';
  try {
    let sha;
    const head = await fetch(`${api}?ref=${BRANCH}`, { headers, cache: 'no-store' });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status === 401) throw new Error('GitHub didn’t accept the token. It may have expired: make a new one and save it again');
    if (sha && !EDIT) throw new Error('a post with this title and date already exists. Change the title, or open that post and use Edit this post');
    const verb = sha ? 'Update' : 'Add';
    const res = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: `${verb} ${f.kind() === 'review' ? 'review' : 'post'}: ${f.title.value.trim()}`, content: b64(toMarkdown()), branch: BRANCH, ...(sha ? { sha } : {}) }) });
    const data = await res.json();
    if (!res.ok) throw new Error(res.status === 403 || res.status === 404 ? 'the token can’t write to the repository. Check it has Contents set to Read and write' : data.message || res.status);
    const live = new URL(liveUrl(p), location.href).href;
    status.innerHTML = f.draft.checked
      ? `Saved as a draft (<a href="${esc(data.commit.html_url)}" target="_blank" rel="noopener">see the commit</a>). It won’t appear until you untick draft and publish again.`
      : `${sha ? 'Updated' : 'Published'}. The site rebuilds in about a minute, then it’s at <a href="${esc(live)}">${esc(live.replace(/^https?:\/\//, ''))}</a>. <a href="https://github.com/${REPO}/actions" target="_blank" rel="noopener">Watch the build</a>.`;
    toast(f.draft.checked ? 'Saved as a draft' : `${sha ? 'Updated' : 'Published'}: live in about a minute`);
    if (!f.draft.checked && !EDIT) store.del(DRAFT_KEY);
  } catch (e) {
    status.textContent = `Couldn’t publish: ${e.message}.`;
  } finally {
    btn.disabled = false; btn.textContent = 'Publish';
  }
});
$('#w-new').addEventListener('click', () => {
  if (EDIT) { location.href = './'; return; }
  if (!confirmClear()) return;
  store.del(draftKey());
  loadDraft({ kind: f.kind(), title: '', date: today(), tags: '', summary: '', math: '', term: '', difficulty: 5, workload: 5, enjoyment: 5, again: true, draft: false, body: STARTER[f.kind()] });
  update();
});
let armed = 0;
function confirmClear() {
  if (Date.now() - armed < 3000) return true;
  armed = Date.now(); toast('Press New again within 3 seconds to clear this draft'); return false;
}

update();
