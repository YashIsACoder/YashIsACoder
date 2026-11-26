// /write/: write, edit and publish posts and course reviews from the site.
//
// GitHub Pages only serves files, so publishing commits the Markdown to the
// repository and the GitHub Action rebuilds the site about a minute later.
//   Publish            commits straight from this page, with a fine-grained
//                      token saved once per device (only ever sent to GitHub).
//   Publish via GitHub opens GitHub's editor with the post filled in.
// /write/?edit=content/blog/<file>.md loads an existing post to change it.
//
// The editor is CodeMirror (assets/vendor/codemirror.js): highlighted
// Markdown, undo and redo, find and replace, and a slash menu. Pasted or
// dropped images are resized here and committed to docs/assets/posts/<post>/.

import {
  EditorState, EditorView, keymap, drawSelection, highlightActiveLine, placeholder, ViewPlugin, Decoration, dropCursor,
  history, historyKeymap, defaultKeymap, undo, redo, undoDepth, redoDepth, indentWithTab,
  markdown, markdownLanguage, markdownKeymap, syntaxHighlighting, HighlightStyle, syntaxTree, LanguageDescription, indentUnit, tags,
  cpp, python, javascript, search, searchKeymap, openSearchPanel, highlightSelectionMatches,
  autocompletion, completionKeymap, startCompletion
} from '../vendor/codemirror.js';
import { marked } from '../vendor/marked.esm.js';
import katex from '../vendor/katex.mjs';
import { createRenderer, esc, slugify, readTime } from './md.js?v=fb8957ba';
import { mountWidgets } from './posts.js?v=fb8957ba';
import { renderDiagrams } from './diagrams.js?v=fb8957ba';
import { toast } from './site.js?v=fb8957ba';
import { REPO, BRANCH, TOKEN_KEY, store, ghHeaders, contentsUrl, sitePath, githubDeleteUrl, deleteFile, followBuild, refreshPages, markGone, unmarkGone } from './github.js?v=fb8957ba';

const DRAFT_KEY = 'yash-write-draft';
const VIEW_KEY = 'yash-write-view';
const $ = (s) => document.querySelector(s);
store.set('yash-owner', '1');
document.documentElement.classList.add('is-owner');

const params = new URLSearchParams(location.search);
const EDIT = /^content\/(blog|courses)\/[\w.-]+\.md$/.test(params.get('edit') || '') ? params.get('edit') : null;
const draftKey = () => (EDIT ? `${DRAFT_KEY}:${EDIT}` : DRAFT_KEY);
const liveUrl = (p) => `../${sitePath(p)}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Images uploaded in this session: shown from memory until the site rebuilds.
const uploads = new Map();
const render = createRenderer({ marked, katex, assetBase: '../', resolveAsset: (h) => uploads.get(h) || `../${h}` });

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

\`\`\`mermaid
flowchart LR
  A[Idea] --> B{Worth it?}
  B -->|yes| C[Build it]
  B -->|no| A
\`\`\`

A footnote looks like this.[^1] Type / on a new line for more.

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
  draft: $('#w-draft')
};

// ------------------------------------------------------------ the editor
const style = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-h1' }, { tag: tags.heading2, class: 'cm-h2' }, { tag: tags.heading3, class: 'cm-h3' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], class: 'cm-h4' },
  { tag: tags.strong, fontWeight: '700' }, { tag: tags.emphasis, fontStyle: 'italic' }, { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url, tags.labelName], class: 'cm-link' },
  { tag: tags.monospace, class: 'cm-mono' },
  { tag: tags.quote, class: 'cm-quote' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], class: 'cm-markup' },
  { tag: tags.keyword, class: 'cm-k' }, { tag: [tags.string, tags.special(tags.string)], class: 'cm-s' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], class: 'cm-c' }, { tag: [tags.number, tags.bool, tags.null], class: 'cm-n' },
  { tag: [tags.typeName, tags.className, tags.namespace], class: 'cm-t' }, { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: 'cm-f' }
]);

// Line decorations: fenced code and $$ maths blocks get their own look,
// and inline $maths$ is tinted.
const blocks = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) { if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = this.build(u.view); }
  build(view) {
    const out = [];
    const doc = view.state.doc;
    const tree = syntaxTree(view.state);
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to, enter: (n) => {
          if (n.name === 'FencedCode') {
            for (let l = doc.lineAt(n.from).number; l <= doc.lineAt(n.to).number; l++) out.push(Decoration.line({ class: 'cm-codeline' }).range(doc.line(l).from));
            return false;
          }
          if (n.name === 'InlineCode') return false;
        }
      });
      // $$ blocks: track open/close from the top of the document
      let inMath = false;
      for (let l = 1; l <= doc.lines; l++) {
        const line = doc.line(l);
        const t = line.text.trim();
        const fence = t.startsWith('$$');
        const isOne = fence && t.length > 2 && t.endsWith('$$') && t.length >= 4;
        if (line.from > to) break;
        if (inMath || fence) { if (line.to >= from) out.push(Decoration.line({ class: 'cm-mathline' }).range(line.from)); }
        if (fence && !isOne) inMath = !inMath;
      }
      const text = doc.sliceString(from, to);
      for (const m of text.matchAll(/(^|[^\\$])(\$(?!\s)[^$\n]+?(?<!\s)\$)(?!\d)/g)) {
        const s = from + m.index + m[1].length;
        out.push(Decoration.mark({ class: 'cm-math' }).range(s, s + m[2].length));
      }
    }
    return Decoration.set(out, true);
  }
}, { decorations: (v) => v.decorations });

const languages = [
  LanguageDescription.of({ name: 'cpp', alias: ['c++', 'c', 'cc', 'h', 'hpp'], support: cpp() }),
  LanguageDescription.of({ name: 'python', alias: ['py'], support: python() }),
  LanguageDescription.of({ name: 'javascript', alias: ['js', 'ts', 'typescript', 'jsx', 'tsx'], support: javascript({ typescript: true }) })
];

// The slash menu: "/" at the start of a line.
const SLASH = [
  ['heading', 'Section heading', '## ', 3],
  ['subheading', 'Smaller heading', '### ', 4],
  ['list', 'Bulleted list', '- ', 2],
  ['numbered', 'Numbered list', '1. ', 3],
  ['quote', 'Quote', '> ', 2],
  ['code', 'Code block', '```cpp\n\n```', 7],
  ['maths', 'Maths on its own lines', '$$\n\n$$', 3],
  ['diagram', 'Flowchart diagram', '```mermaid\nflowchart LR\n  A[Start] --> B{Check}\n  B -->|yes| C[Done]\n  B -->|no| A\n```', 11],
  ['sequence', 'Sequence diagram', '```mermaid\nsequenceDiagram\n  participant A as Client\n  participant B as Server\n  A->>B: Request\n  B-->>A: Response\n```', 11],
  ['table', 'Table', '| Column | Column |\n| --- | --- |\n| Cell | Cell |', 2, 6],
  ['image', 'Image from your computer', '', 0],
  ['divider', 'Divider', '---\n', 4],
  ['widget', 'Live widget', '::: widget paired-draws seed=7 trials=8', 39]
];
function slashMenu(ctx) {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const before = line.text.slice(0, ctx.pos - line.from);
  const m = before.match(/^(\s*)\/([\w-]*)$/);
  if (!m) return null;
  return {
    from: line.from + m[1].length,
    validFor: /^\/[\w-]*$/,
    options: SLASH.map(([key, label, text, at, len = 0]) => ({
      label: `/${key}`, displayLabel: label, detail: key === 'image' ? 'opens a file picker' : text.split('\n')[0], type: 'text',
      apply: (view, _c, from, to) => {
        if (key === 'image') { view.dispatch({ changes: { from, to, insert: '' } }); $('#w-image').click(); return; }
        // blocks need a blank line either side, or Markdown folds them into the paragraph or list next to them
        const st = view.state, line = st.doc.lineAt(from);
        const isBlock = !['heading', 'subheading', 'list', 'numbered', 'quote'].includes(key);
        const prev = line.number > 1 ? st.doc.line(line.number - 1).text : '';
        const next = line.number < st.doc.lines ? st.doc.line(line.number + 1).text : '';
        const pre = isBlock && prev.trim() ? '\n' : '';
        const post = isBlock && next.trim() && to === line.to ? '\n' : '';
        const at0 = from + pre.length + at;
        view.dispatch({ changes: { from, to, insert: pre + text + post }, selection: { anchor: at0, head: at0 + len }, userEvent: 'input.complete' });
      }
    }))
  };
}

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--surface)', color: 'var(--ink)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font)', lineHeight: '1.75', overflow: 'auto' },
  '.cm-content': { padding: '22px 0 120px', caretColor: 'var(--accent)', fontSize: '16.5px' },
  '.cm-line': { padding: '0 28px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { backgroundColor: 'var(--band) !important' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-activeLine': { backgroundColor: 'var(--mark)' },
  '.cm-placeholder': { color: 'var(--ink-3)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--mark)', outline: '1px solid var(--line-2)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--warm) 22%, transparent)', borderRadius: '2px' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--warm) 45%, transparent)' },
  '.cm-panels': { backgroundColor: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--line)' },
  '.cm-panel.cm-search': { padding: '10px 14px', fontSize: '14.5px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' },
  '.cm-panel.cm-search input[type=checkbox]': { accentColor: 'var(--accent)' },
  '.cm-panel.cm-search label': { fontSize: '14px', color: 'var(--ink-2)' },
  '.cm-textfield': { font: 'inherit', fontSize: '15px', padding: '6px 10px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--ink)' },
  '.cm-button': { font: 'inherit', fontSize: '14px', padding: '5px 12px', border: '1px solid var(--line-2)', borderRadius: '999px', background: 'transparent', backgroundImage: 'none', color: 'var(--ink)', cursor: 'pointer' },
  '.cm-button:hover': { borderColor: 'var(--ink)' },
  '.cm-panel.cm-search [name=close]': { position: 'static', marginLeft: 'auto', fontSize: '20px', color: 'var(--ink-2)', cursor: 'pointer', background: 'none', border: 0 },
  '.cm-tooltip': { border: '1px solid var(--line)', borderRadius: '12px', backgroundColor: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow)', overflow: 'hidden' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font) !important', maxHeight: '320px !important', padding: '6px' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '7px 12px !important', borderRadius: '8px', display: 'flex', gap: '16px', justifyContent: 'space-between' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--ink) !important', color: 'var(--bg) !important' },
  '.cm-completionLabel': { fontSize: '15px' },
  '.cm-completionDetail': { fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: '12.5px', color: 'inherit', opacity: '.65', marginLeft: '0' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '700' }
});

const extensions = [
  history(), drawSelection(), dropCursor(), highlightActiveLine(), highlightSelectionMatches(),
  EditorState.allowMultipleSelections.of(true), indentUnit.of('  '), EditorView.lineWrapping,
  EditorState.phrases.of({
    Find: 'Find', Replace: 'Replace with', next: 'Next', previous: 'Previous', all: 'Select all', 'match case': 'Match case',
    regexp: 'Regular expression', 'by word': 'Whole words', replace: 'Replace', 'replace all': 'Replace all', close: 'Close',
    'current match': 'Current match', 'replaced match on line $': 'Replaced the match on line $', 'replaced $ matches': 'Replaced $ matches',
    'on line': 'on line', 'Go to line': 'Go to line', go: 'Go'
  }),
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  syntaxHighlighting(style), blocks, theme,
  placeholder('Start writing. Type / on a new line for headings, tables, diagrams and more.'),
  search({ top: true }),
  autocompletion({ override: [slashMenu], icons: false, activateOnTyping: true, defaultKeymap: true }),
  keymap.of([
    { key: 'Mod-b', run: () => (COMMANDS.bold(), true) },
    { key: 'Mod-i', run: () => (COMMANDS.italic(), true) },
    { key: 'Mod-k', run: () => (COMMANDS.link(), true) },
    { key: 'Mod-e', run: () => (COMMANDS.code(), true) },
    { key: 'Mod-s', run: () => { saveDraft(); toast('Saved in this browser'); return true; } },
    { key: 'Mod-Shift-.', run: () => { setFocus(!document.body.classList.contains('is-focus')); return true; } },
    ...completionKeymap, ...markdownKeymap, ...historyKeymap, ...searchKeymap, ...defaultKeymap, indentWithTab
  ]),
  EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences', 'aria-label': 'Post body in Markdown' }),
  EditorView.updateListener.of((u) => {
    if (u.docChanged) update();
    if (u.docChanged || u.transactions.length) syncButtons(u.state);
  }),
  EditorView.domEventHandlers({
    paste(e, view) {
      const files = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); files.forEach(addImage); return true; }
      const text = (e.clipboardData?.getData('text/plain') || '').trim();
      const { from, to } = view.state.selection.main;
      const sel = view.state.sliceDoc(from, to);
      if (from !== to && /^https?:\/\/\S+$/.test(text) && !sel.includes('\n')) {
        e.preventDefault();
        view.dispatch({ changes: { from, to, insert: `[${sel}](${text})` }, userEvent: 'input.paste' });
        return true;
      }
      return false;
    },
    dragover(e) { if ([...(e.dataTransfer?.items || [])].some((i) => i.type.startsWith('image/'))) { e.preventDefault(); $('#w-drop').hidden = false; } return false; },
    dragleave() { $('#w-drop').hidden = true; return false; },
    drop(e, view) {
      $('#w-drop').hidden = true;
      const files = [...(e.dataTransfer?.files || [])].filter((x) => x.type.startsWith('image/'));
      if (!files.length) return false;
      e.preventDefault();
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos != null) view.dispatch({ selection: { anchor: pos } });
      files.forEach(addImage);
      return true;
    }
  })
];

const view = new EditorView({ parent: $('#w-body'), state: EditorState.create({ doc: '', extensions }) });
const doc = () => view.state.doc.toString();
function setDoc(text) { view.setState(EditorState.create({ doc: text, extensions })); syncButtons(view.state); }
function syncButtons(state) {
  $('#w-undo').disabled = undoDepth(state) === 0;
  $('#w-redo').disabled = redoDepth(state) === 0;
}

// ------------------------------------------------------------ courses list
fetch('../assets/data/courses.json').then((r) => r.json()).then((list) => {
  f.course.innerHTML = list.map((c) => `<option value="${esc(c.code)}">${esc(c.code)}, ${esc(c.name)}</option>`).join('');
  const saved = JSON.parse(store.get(draftKey()) || 'null');
  if (saved?.course) f.course.value = saved.course;
  update();
}).catch(() => { f.course.innerHTML = '<option value="">Couldn’t load the courses</option>'; });

// ------------------------------------------------------------ markdown out
function tagsList() { return f.tags.value.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w+#.-]/g, '')).filter(Boolean); }
function postSlug() {
  if (EDIT) return EDIT.split('/').pop().replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const kind = f.kind();
  return (kind === 'review' ? slugify(`${f.course.value}-${f.title.value.replace(new RegExp('^' + f.course.value + '\\s*[·:-]?\\s*', 'i'), '')}`) : slugify(f.title.value)) || 'untitled';
}
function filePath() {
  if (EDIT) return EDIT;
  return `content/${f.kind() === 'review' ? 'courses' : 'blog'}/${f.date.value || today()}-${postSlug()}.md`;
}
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
export function toMarkdown() {
  const kind = f.kind();
  const lines = ['---', `title: ${oneLine(f.title.value) || 'Untitled'}`, `date: ${f.date.value || today()}`];
  if (kind === 'review') { lines.push(`course: ${f.course.value}`); if (f.term.value.trim()) lines.push(`term: ${oneLine(f.term.value)}`); }
  const tags = tagsList(); if (tags.length) lines.push(`tags: [${tags.join(', ')}]`);
  if (f.summary.value.trim()) lines.push(`summary: ${oneLine(f.summary.value)}`);
  if (kind === 'post' && f.math.value.trim()) lines.push(`card_math: ${oneLine(f.math.value)}`);
  if (kind === 'review') lines.push(`difficulty: ${f.difficulty.value}`, `workload: ${f.workload.value}`, `enjoyment: ${f.enjoyment.value}`, `again: ${f.again.checked}`);
  if (f.draft.checked) lines.push('draft: true');
  lines.push('---', '', doc().replace(/\s+$/, '') + '\n');
  return lines.join('\n');
}

// ------------------------------------------------------------ preview
const pane = $('#w-scroll');
const meter = (n) => { const v = +n; return `<span class="meter" role="img" aria-label="${v} out of 10">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span> <span class="muted">${v}/10</span>`; };
let timer = 0;
function update() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const kind = f.kind();
    const body = doc();
    document.body.dataset.kind = kind;
    $('#w-path').textContent = filePath();
    ['difficulty', 'workload', 'enjoyment'].forEach((k) => { $(`#o-${k}`).textContent = `${f[k].value}/10`; });
    const tags = tagsList();
    showDraftState();
    $('#w-peek').textContent = [f.date.value || today(), tags.length ? tags.join(', ') : 'no tags', kind === 'review' ? f.course.value : '', f.draft.checked ? 'draft' : ''].filter(Boolean).join(', ');
    const out = $('#preview');
    try {
      const { html, words } = render(body, 'your post');
      $('#w-count').textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}, ${readTime(words)}`;
      out.innerHTML = `
        <span class="crumbs">${kind === 'review' ? `Courses / ${esc(f.course.value)}` : 'Writing'}</span>
        ${tags.length ? `<ul class="post__tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <h1>${esc(f.title.value || 'Untitled')}</h1>
        ${f.summary.value.trim() ? `<p class="post__summary">${esc(f.summary.value)}</p>` : ''}
        <div class="post__meta"><span>Yashwanth Madan</span><span>${esc(f.date.value || today())}</span><span>${readTime(words)}</span>${f.draft.checked ? '<span>Draft</span>' : ''}</div>
        ${kind === 'review' ? `<div class="ratings"><span>Difficulty</span><span>${meter(f.difficulty.value)}</span><span>Workload</span><span>${meter(f.workload.value)}</span><span>Enjoyment</span><span>${meter(f.enjoyment.value)}</span><span>Take it again?</span><span>${f.again.checked ? 'Yes' : 'No'}</span>${f.term.value.trim() ? `<span>Taken</span><span>${esc(f.term.value)}</span>` : ''}</div>` : ''}
        <div class="prose">${html}</div>`;
      mapLines(body, out.querySelector('.prose'));
      mountWidgets(out);
      renderDiagrams(out);
      $('#w-error').hidden = true;
    } catch (e) {
      $('#w-error').hidden = false;
      $('#w-error').textContent = e.message;
    }
    saveDraft();
  }, 180);
}

// ------------------------------------------------------------ linking the two sides
// Each top-level block in the preview gets data-line: the Markdown line it
// came from. If the counts don't line up, only headings are linked.
function mapLines(src, prose) {
  if (!prose) return;
  const tokens = marked.lexer(src);
  const starts = [];
  let off = 0;
  for (const t of tokens) {
    const at = off; off += t.raw.length;
    if (t.type === 'space' || t.type === 'def') continue;
    if (t.type === 'paragraph' && /^(\[\^[\w-]+\]:.*\n?)+$/.test(t.raw.trim())) continue;   // footnote definitions
    const lead = t.raw.length - t.raw.replace(/^\n+/, '').length;
    starts.push({ line: view.state.doc.lineAt(Math.min(at + lead, src.length)).number, heading: t.type === 'heading' });
  }
  const els = [...prose.children].filter((el) => !el.matches('section.footnotes'));
  if (els.length === starts.length) els.forEach((el, i) => { el.dataset.line = starts[i].line; });
  else {
    const hs = els.filter((el) => /^H[1-6]$/.test(el.tagName));
    starts.filter((s) => s.heading).forEach((s, i) => { if (hs[i]) hs[i].dataset.line = s.line; });
  }
}
function anchors() {
  const top = pane.getBoundingClientRect().top - pane.scrollTop;
  const list = [{ e: 0, p: 0 }];
  for (const el of pane.querySelectorAll('.prose > [data-line]')) {
    const n = Math.min(+el.dataset.line, view.state.doc.lines);
    list.push({ e: view.lineBlockAt(view.state.doc.line(n).from).top, p: el.getBoundingClientRect().top - top });
  }
  list.push({ e: view.contentHeight, p: pane.scrollHeight });
  return list.filter((a, i, all) => i === 0 || (a.e > all[i - 1].e && a.p >= all[i - 1].p));
}
const interp = (list, from, to, y) => {
  for (let i = 1; i < list.length; i++) {
    if (y <= list[i][from] || i === list.length - 1) {
      const a = list[i - 1], b = list[i];
      const t = b[from] === a[from] ? 0 : Math.max(0, Math.min(1, (y - a[from]) / (b[from] - a[from])));
      return a[to] + t * (b[to] - a[to]);
    }
  }
  return 0;
};
let quietEditor = 0, quietPane = 0;
view.scrollDOM.addEventListener('scroll', () => {
  if (document.body.dataset.view !== 'split' || performance.now() < quietEditor) return;
  quietPane = performance.now() + 120;
  pane.scrollTop = interp(anchors(), 'e', 'p', view.scrollDOM.scrollTop);
});
pane.addEventListener('scroll', () => {
  if (document.body.dataset.view !== 'split' || performance.now() < quietPane) return;
  quietEditor = performance.now() + 120;
  view.scrollDOM.scrollTop = interp(anchors(), 'p', 'e', pane.scrollTop);
});
// click a block in the preview to jump to its Markdown
pane.addEventListener('click', (e) => {
  if (e.target.closest('a, button, input, select, summary, label, details')) return;
  if (window.getSelection()?.toString()) return;                       // they were selecting text
  const el = e.target.closest('.prose > [data-line]') || [...pane.querySelectorAll('.prose > [data-line]')].filter((x) => x.getBoundingClientRect().top <= e.clientY).pop();
  if (!el) return;
  if (document.body.dataset.view === 'preview') setView('split');
  const line = view.state.doc.line(Math.min(+el.dataset.line, view.state.doc.lines));
  quietPane = performance.now() + 400;
  view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 48 }) });
  view.focus();
});

// ------------------------------------------------------------ drafts
function saveDraft() {
  const d = { kind: f.kind(), title: f.title.value, date: f.date.value, tags: f.tags.value, summary: f.summary.value, math: f.math.value, course: f.course.value, term: f.term.value, difficulty: f.difficulty.value, workload: f.workload.value, enjoyment: f.enjoyment.value, again: f.again.checked, draft: f.draft.checked, body: doc() };
  store.set(draftKey(), JSON.stringify(d));
  const t = new Date();
  $('#w-saved').textContent = `Saved in this browser at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
function loadDraft(d) {
  document.querySelector(`input[name="kind"][value="${d.kind || 'post'}"]`).checked = true;
  for (const k of ['title', 'date', 'tags', 'summary', 'math', 'term', 'difficulty', 'workload', 'enjoyment']) if (d[k] !== undefined) f[k].value = d[k];
  if (d.course) f.course.value = d.course;
  f.again.checked = d.again !== false; f.draft.checked = !!d.draft;
  if (d.body !== undefined) setDoc(d.body);
}
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
const saved = JSON.parse(store.get(draftKey()) || 'null');
if (saved) loadDraft(saved);
else if (!EDIT) {
  const k = params.get('kind') === 'review' ? 'review' : 'post';
  loadDraft({ kind: k, date: today(), body: STARTER[k] });
}

// ------------------------------------------------------------ editing a published post
if (EDIT) {
  $('#w-mode').textContent = 'Editing a published post. Press Publish to update it.';
  document.querySelectorAll('input[name="kind"]').forEach((r) => { r.disabled = true; });
  if (!saved) {
    $('#w-saved').textContent = 'Loading the post…';
    fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${EDIT}?t=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error(r.status === 404 ? 'that post isn’t in the repository' : `GitHub answered ${r.status}`); return r.text(); })
      .then((text) => { loadDraft(parseMd(text)); update(); $('#w-saved').textContent = 'Loaded from GitHub'; })
      .catch((e) => { $('#w-saved').textContent = `Couldn’t load the post: ${e.message}`; });
  }
} else if (params.get('kind') === 'review') {
  $('#w-mode').textContent = 'A new course review. It saves in this browser as you type.';
}

// ------------------------------------------------------------ open a published post
(async () => {
  const sel = $('#w-open');
  const token = store.get(TOKEN_KEY);
  const pretty = (name) => { const m = name.replace(/\.md$/, '').match(/^(\d{4}-\d{2}-\d{2})-(.*)$/); const t = (m ? m[2] : name).replace(/-/g, ' '); return `${t.charAt(0).toUpperCase()}${t.slice(1)}${m ? ` (${m[1]})` : ''}`; };
  try {
    const groups = [];
    for (const [dir, label] of [['blog', 'Posts'], ['courses', 'Course reviews']]) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/content/${dir}?ref=${BRANCH}`, { headers: ghHeaders(token) });
      if (r.status === 404) continue;
      if (!r.ok) throw new Error(r.status);
      const files = (await r.json()).filter((x) => x.type === 'file' && x.name.endsWith('.md') && !x.name.startsWith('_')).sort((a, b) => b.name.localeCompare(a.name));
      if (files.length) groups.push(`<optgroup label="${label}">${files.map((x) => `<option value="${esc(x.path)}"${x.path === EDIT ? ' selected' : ''}>${esc(pretty(x.name))}</option>`).join('')}</optgroup>`);
    }
    sel.insertAdjacentHTML('beforeend', groups.join('') || '<option disabled>Nothing published yet</option>');
  } catch {
    sel.insertAdjacentHTML('beforeend', '<option disabled>Couldn’t load the list from GitHub</option>');
  }
  sel.addEventListener('change', () => { if (sel.value) location.href = `./?edit=${encodeURIComponent(sel.value)}`; });
})();

// ------------------------------------------------------------ toolbar commands
function sel() { const { from, to } = view.state.selection.main; return { a: from, b: to, value: doc() }; }
function replace(start, end, text, selStart = start + text.length, selEnd = selStart) {
  view.dispatch({ changes: { from: start, to: end, insert: text }, selection: { anchor: selStart, head: selEnd }, scrollIntoView: true, userEvent: 'input' });
  view.focus();
}
function wrap(before, after, placeholderText) {
  const { a, b, value } = sel();
  const s = value.slice(a, b);
  if (s && value.slice(a - before.length, a) === before && value.slice(b, b + after.length) === after) {
    replace(a - before.length, b + after.length, s, a - before.length, b - before.length);       // toggle off
    return;
  }
  if (s.startsWith(before) && s.endsWith(after) && s.length >= before.length + after.length) {
    const inner = s.slice(before.length, s.length - after.length);
    replace(a, b, inner, a, a + inner.length);
    return;
  }
  const inner = s || placeholderText;
  replace(a, b, before + inner + after, a + before.length, a + before.length + inner.length);
}
function prefixLines(kind) {
  const st = view.state;
  const { from, to } = st.selection.main;
  const first = st.doc.lineAt(from), last = st.doc.lineAt(to > from && st.doc.lineAt(to).from === to ? to - 1 : to);
  const text = st.sliceDoc(first.from, last.to);
  const lines = text.split('\n');
  const pat = { heading: /^#{1,6}\s+/, ul: /^\s*[-*+]\s+/, ol: /^\s*\d+[.)]\s+/, quote: /^>\s?/ }[kind];
  const on = lines.filter((l) => l.trim()).every((l) => pat.test(l));
  const out = lines.map((l, i) => {
    if (!l.trim() && lines.length > 1) return l;
    const bare = l.replace(/^#{1,6}\s+|^\s*[-*+]\s+|^\s*\d+[.)]\s+|^>\s?/, '');
    if (on) return bare;
    return ({ heading: '## ', ul: '- ', ol: `${i + 1}. `, quote: '> ' }[kind]) + bare;
  }).join('\n');
  if (lines.length === 1) replace(first.from, last.to, out);
  else replace(first.from, last.to, out, first.from, first.from + out.length);
}
function block(text, cursorAt = text.length, selectLen = 0) {
  const { a, b, value } = sel();
  const pre = a === 0 || value.slice(0, a).endsWith('\n\n') ? '' : value.slice(0, a).endsWith('\n') ? '\n' : '\n\n';
  const post = value.slice(b).startsWith('\n\n') || b === value.length ? '' : value.slice(b).startsWith('\n') ? '\n' : '\n\n';
  const s = a + pre.length + cursorAt;
  replace(a, b, pre + text + post, s, s + selectLen);
}

const COMMANDS = {
  bold: () => wrap('**', '**', 'bold text'),
  italic: () => wrap('*', '*', 'italic text'),
  code: () => wrap('`', '`', 'code'),
  heading: () => prefixLines('heading'),
  ul: () => prefixLines('ul'),
  ol: () => prefixLines('ol'),
  quote: () => prefixLines('quote'),
  link: () => {
    const { a, b, value } = sel();
    const s = value.slice(a, b);
    if (/^https?:\/\/\S+$/.test(s)) replace(a, b, `[link text](${s})`, a + 1, a + 10);
    else { const t = s || 'link text'; replace(a, b, `[${t}](https://)`, a + t.length + 3, a + t.length + 11); }
  },
  codeblock: () => { const { a, b, value } = sel(); const s = value.slice(a, b); block('```cpp\n' + s + '\n```', 7 + s.length); },
  math: () => {
    const { a, b, value } = sel();
    const s = value.slice(a, b);
    if (s && !s.includes('\n')) wrap('$', '$', 'x');
    else block('$$\n' + (s || 'x^2') + '\n$$', 3, s ? 0 : 3);
  },
  diagram: () => block('```mermaid\nflowchart LR\n  A[Start] --> B{Check}\n  B -->|yes| C[Done]\n  B -->|no| A\n```', 11),
  table: () => block('| Column | Column |\n| --- | --- |\n| Cell | Cell |', 2, 6),
  image: () => $('#w-image').click(),
  footnote: () => {
    const used = [...doc().matchAll(/\[\^(\d+)\]/g)].map((m) => +m[1]);
    const n = used.length ? Math.max(...used) + 1 : 1;
    const at = view.state.selection.main.to;
    const marker = `[^${n}]`;
    const end = doc().replace(/\s+$/, '').length;
    const note = `\n\n[^${n}]: `;
    // the marker at the cursor and the note at the end, as one undoable step
    view.dispatch({
      changes: [{ from: at, insert: marker }, { from: end, to: view.state.doc.length, insert: note }],
      selection: { anchor: end + marker.length + note.length }, scrollIntoView: true, userEvent: 'input'
    });
    view.focus();
  },
  widget: () => block('::: widget paired-draws seed=7 trials=8'),
  find: () => { openSearchPanel(view); }
};
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => COMMANDS[b.dataset.cmd]()));
$('#w-undo').addEventListener('click', () => { undo(view); view.focus(); });
$('#w-redo').addEventListener('click', () => { redo(view); view.focus(); });
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (view.hasFocus) return;                                   // the editor has its own keymap
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft(); toast('Saved in this browser'); }
  if (mod && e.shiftKey && (e.key === '.' || e.key === '>')) { e.preventDefault(); setFocus(!document.body.classList.contains('is-focus')); }
  if (e.key === 'Escape' && document.body.classList.contains('is-focus')) setFocus(false);
});
$('#w-image').addEventListener('change', (e) => { [...e.target.files].forEach(addImage); e.target.value = ''; });
void startCompletion;

// ------------------------------------------------------------ images
async function shrink(file) {
  if (/gif|svg/.test(file.type)) return { blob: file, ext: file.type.includes('svg') ? 'svg' : 'gif' };
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bmp.width);
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.86));
  if (blob && blob.type === 'image/webp' && blob.size < file.size * 1.1) return { blob, ext: 'webp' };
  return { blob: file, ext: (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg') };
}
const b64bytes = async (blob) => { const bytes = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
function findText(t) { const i = doc().indexOf(t); return i < 0 ? null : { from: i, to: i + t.length }; }
async function addImage(file) {
  const token = store.get(TOKEN_KEY);
  if (!token) { openSetup('Images upload to the repository, so they need one-click publishing set up first.'); return; }
  const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'image';
  const tag = `![Uploading ${base}…]()`;
  const { from, to } = view.state.selection.main;
  replace(from, to, tag);
  try {
    const { blob, ext } = await shrink(file);
    const rel = `assets/posts/${postSlug()}/${base}-${Date.now().toString(36).slice(-4)}.${ext}`;
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/docs/${rel}`, {
      method: 'PUT', headers: ghHeaders(token),
      body: JSON.stringify({ message: `Add image for ${f.title.value.trim() || 'a post'}`, content: await b64bytes(blob), branch: BRANCH })
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'GitHub didn’t accept the token' : (await res.json()).message || res.status);
    uploads.set(rel, URL.createObjectURL(blob));
    const alt = base.replace(/-/g, ' ');
    const at = findText(tag);
    if (at) replace(at.from, at.to, `![${alt}](${rel})`, at.from + 2, at.from + 2 + alt.length);
    toast('Image added. Type over the selected words to describe it.');
  } catch (e) {
    const at = findText(tag);
    if (at) replace(at.from, at.to, '');
    toast(`Couldn’t upload the image: ${e.message}`);
  }
}

// ------------------------------------------------------------ layout
function setView(v) {
  document.body.dataset.view = v;
  const r = document.querySelector(`input[name="view"][value="${v}"]`); if (r) r.checked = true;
  store.set(VIEW_KEY, v);
  view.requestMeasure();
}
document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener('change', () => setView(r.value)));
setView(store.get(VIEW_KEY) || (matchMedia('(max-width: 720px)').matches ? 'write' : 'split'));
function setFocus(on) {
  document.body.classList.toggle('is-focus', on);
  $('#w-focus').setAttribute('aria-pressed', String(on));
  view.requestMeasure();
  if (on) view.focus();
}
$('#w-focus').addEventListener('click', () => setFocus(!document.body.classList.contains('is-focus')));
$('#w-guide-btn').addEventListener('click', (e) => {
  const g = $('#w-guide'); g.hidden = !g.hidden; e.currentTarget.setAttribute('aria-expanded', String(!g.hidden));
});

// ------------------------------------------------------------ inputs
document.addEventListener('input', (e) => { if (e.target.closest('.wform, .ed__title, .ed__summary') || e.target.matches('.ed__title, .ed__summary')) update(); });
document.addEventListener('change', (e) => {
  if (e.target.name === 'kind') {
    const k = f.kind();
    const body = doc();
    if (!body.trim() || body === STARTER.post || body === STARTER.review) setDoc(STARTER[k]);
    update();
  }
  if (e.target.closest('.wform')) update();
});
$('#w-import').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  loadDraft(parseMd(await file.text()));
  update(); toast(`Opened ${file.name}`);
  e.target.closest('details').open = false;
});

// ------------------------------------------------------------ publish
// A ticked draft is easy to miss, so the button and a note say so plainly.
const publishLabel = () => (f.draft.checked ? 'Save draft' : 'Publish');
function showDraftState() {
  $('#w-draftnote').hidden = !f.draft.checked;
  const btn = $('#w-publish');
  if (!btn.disabled) btn.textContent = publishLabel();
}
$('#w-draftoff').addEventListener('click', () => { f.draft.checked = false; update(); showDraftState(); toast('Draft is off: Publish will put it on the site'); });
f.draft.addEventListener('change', showDraftState);
function check() {
  if (!f.title.value.trim()) { toast('Add a title first'); f.title.focus(); return false; }
  if (doc().includes('![Uploading')) { toast('Wait for the image to finish uploading'); return false; }
  try { render(doc(), 'your post'); } catch (e) { toast(e.message); return false; }
  return true;
}
$('#w-copy').addEventListener('click', async (e) => {
  e.target.closest('details').open = false;
  try { await navigator.clipboard.writeText(toMarkdown()); toast('Copied the Markdown'); }
  catch { toast('Copy failed: select the text in the editor instead'); }
});
$('#w-download').addEventListener('click', (e) => {
  e.target.closest('details').open = false;
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
function openSetup(why) { setup.open = true; setup.scrollIntoView({ block: 'center', behavior: 'smooth' }); tokenIn.focus(); toast(why); }
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
  if (!token) { openSetup('First, a one-time setup on this device: follow the steps below.'); return; }
  const p = filePath();
  const api = contentsUrl(p);
  const status = $('#w-status');
  const btn = $('#w-publish');
  btn.disabled = true; btn.textContent = f.draft.checked ? 'Saving…' : 'Publishing…';
  status.textContent = '';
  try {
    let sha;
    const head = await fetch(`${api}?ref=${BRANCH}`, { headers: ghHeaders(token), cache: 'no-store' });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status === 401) throw new Error('GitHub didn’t accept the token. It may have expired: make a new one and save it again');
    if (sha && !EDIT) throw new Error('a post with this title and date already exists. Change the title, or open that post from the list above');
    const verb = sha ? 'Update' : 'Add';
    const res = await fetch(api, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify({ message: `${verb} ${f.kind() === 'review' ? 'review' : 'post'}: ${f.title.value.trim()}`, content: b64(toMarkdown()), branch: BRANCH, ...(sha ? { sha } : {}) }) });
    const data = await res.json();
    if (!res.ok) throw new Error(res.status === 403 || res.status === 404 ? 'the token can’t write to the repository. Check it has Contents set to Read and write' : data.message || res.status);
    const live = new URL(liveUrl(p), location.href).href;
    if (f.draft.checked) {
      status.innerHTML = `Saved as a draft (<a href="${esc(data.commit.html_url)}" target="_blank" rel="noopener">see the commit</a>). It won’t appear until you turn draft off and publish again.`;
      toast('Saved as a draft');
    } else {
      if (!EDIT) store.del(DRAFT_KEY);
      unmarkGone(p);
      toast(`${sha ? 'Updated' : 'Published'}. Putting it on the site…`);
      watchDeploy(data.commit.sha, live, sha ? 'Updated' : 'Published');
    }
  } catch (e) {
    status.textContent = `Couldn’t publish: ${e.message}.`;
  } finally {
    btn.disabled = false; btn.textContent = publishLabel();
  }
});

// After publishing or deleting: follow GitHub's build until the site has
// the change, then refresh this browser's copies of the pages it touches.
let watching = 0;
async function watchDeploy(commitSha, live, verb, { deleted = false } = {}) {
  const me = ++watching;
  const status = $('#w-status');
  const say = (html) => { if (me === watching) status.innerHTML = html; };
  const busy = (t) => say(`<span class="ed__live is-busy"></span>${t}`);
  const out = await followBuild(commitSha, (phase, run, s) => {
    if (phase === 'queued') busy(`${verb}. Waiting for GitHub to start building the site…${s ? ` ${s} s` : ''}`);
    else busy(`${verb}. Building the site… ${s} s <a href="${esc(run.html_url)}" target="_blank" rel="noopener">Watch it</a>`);
  }, () => me === watching);
  if (out.state === 'stopped') return;
  if (out.state === 'failed') {
    say(`<span class="ed__live is-bad"></span>The build failed, so the site hasn’t changed yet. <a href="${esc(out.run.html_url)}" target="_blank" rel="noopener">See what went wrong</a>${deleted ? '' : ', fix it here and publish again'}.`);
    toast('The site build failed');
    return;
  }
  if (out.state === 'slow') { say(`It’s taking longer than usual. <a href="https://github.com/${REPO}/actions" target="_blank" rel="noopener">Check the build on GitHub</a>.`); return; }
  const started = Date.now() - out.seconds * 1000;
  const secs = () => `${Math.round((Date.now() - started) / 1000)} s`;
  // the deploy is done; wait for the page to answer (or to stop answering)
  for (let i = 0; i < 20; i++) {
    const r = await fetch(live, { cache: 'reload' }).catch(() => null);
    if (deleted ? r && r.status === 404 : r && r.ok) break;
    busy(deleted ? `Rebuilt. Checking the page is gone… ${secs()}` : `Built. Waiting for the page to appear… ${secs()}`);
    await new Promise((res) => setTimeout(res, 4000));
  }
  await refreshPages(new URL('../', location.href).href, [live]);
  if (deleted) {
    store.del(draftKey());
    say(`<span class="ed__live is-ok"></span>Gone from the site after ${secs()}. <a class="btn btn--primary ed__open-post" href="../${live.includes('/courses/') ? 'courses' : 'blog'}/">Back to the list</a>`);
    toast('Gone from the site');
    return;
  }
  const short = live.replace(/^https?:\/\//, '');
  say(`<span class="ed__live is-ok"></span>Live on the site after ${secs()}. <a class="btn btn--primary ed__open-post" href="${esc(live)}">Open the post</a> <span class="muted">${esc(short)}</span>`);
  toast(`${verb}: it’s live`);
}

// Delete the post being edited (only offered for published posts).
const delBtn = $('#w-delete');
const delBox = $('#w-confirmdel');
if (EDIT) {
  delBtn.hidden = false;
  delBtn.addEventListener('click', () => {
    $('.ed__more').open = false;
    $('#w-delname').textContent = f.title.value.trim() || 'this post';
    delBox.hidden = false;
    $('#w-delyes').focus();
  });
  $('#w-delno').addEventListener('click', () => { delBox.hidden = true; delBtn.focus(); });
  $('#w-delyes').addEventListener('click', async () => {
    const status = $('#w-status');
    if (!store.get(TOKEN_KEY)) {
      window.open(githubDeleteUrl(EDIT), '_blank', 'noopener');
      delBox.hidden = true;
      status.textContent = 'GitHub opened in a new tab. Press Commit changes there to delete it; the site updates about a minute later.';
      return;
    }
    const yes = $('#w-delyes');
    yes.disabled = true; yes.textContent = 'Deleting…';
    try {
      const commit = await deleteFile(EDIT, `Delete ${EDIT.startsWith('content/courses/') ? 'review' : 'post'}: ${f.title.value.trim() || EDIT}`);
      delBox.hidden = true;
      $('#w-publish').disabled = true;
      markGone(EDIT);
      toast('Deleted from the repository. Rebuilding the site…');
      watchDeploy(commit, new URL(liveUrl(EDIT), location.href).href, 'Deleted from the repository', { deleted: true });
    } catch (e) {
      status.textContent = `Couldn’t delete: ${e.message}.`;
    } finally {
      yes.disabled = false; yes.textContent = 'Delete';
    }
  });
}

$('#w-new').addEventListener('click', () => {
  if (EDIT) { location.href = './'; return; }
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
