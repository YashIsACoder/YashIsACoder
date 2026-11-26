#!/usr/bin/env node
// Builds the blog and course reviews from Markdown.
//
//   content/blog/*.md        → docs/blog/<slug>/       + docs/blog/index.html
//   content/courses/*.md     → docs/courses/<slug>/    + docs/courses/index.html
//   content/courses/courses.json   the list of courses (reviewed or not)
//   docs/index.html          blog cards + course table are refreshed between markers
//   docs/feed.xml            RSS
//
// LaTeX is typeset here with KaTeX, so pages need no maths JavaScript.
//   npm run build            (add --drafts to include drafts)

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import katex from 'katex';
import { createRenderer, frontMatter, esc, slugify, readTime } from '../docs/assets/js/md.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const CONTENT = path.join(ROOT, 'content');
const SITE = 'https://yashisacoder.github.io/YashIsACoder/';
const AUTHOR = 'Yashwanth Madan';
const DRAFTS = process.argv.includes('--drafts');
const render = createRenderer({ marked, katex, assetBase: '../../' });   // posts live at blog/<slug>/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };
const inlineTex = (src) => { const m = String(src || '').match(/^\$(.+)\$$/); return m ? katex.renderToString(m[1], { throwOnError: false }) : esc(src); };

// ------------------------------------------------------------ read content
function load(dir, kind) {
  const full = path.join(CONTENT, dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const f of fs.readdirSync(full).filter((x) => x.endsWith('.md') && !x.startsWith('_'))) {
    const { data, body } = frontMatter(fs.readFileSync(path.join(full, f), 'utf8'), `${dir}/${f}`);
    for (const req of ['title', 'date']) if (!data[req]) throw new Error(`${dir}/${f}: front matter needs "${req}"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) throw new Error(`${dir}/${f}: date must look like 2026-11-22`);
    if (kind === 'review' && !data.course) throw new Error(`${dir}/${f}: a course review needs "course: COMP1234"`);
    if (data.draft && !DRAFTS) { console.log(`  skip  ${dir}/${f} (draft)`); continue; }
    if (data.tags && !Array.isArray(data.tags)) data.tags = [data.tags];
    const slug = data.slug || f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    out.push({ ...data, tags: data.tags || [], kind, date: String(data.date), slug, source: `content/${dir}/${f}`, ...render(body, `${dir}/${f}`) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

// ------------------------------------------------------------ page shell
const themeScript = `<script>(function(){var t=null;try{t=localStorage.getItem('yash-theme')}catch(e){}var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light';try{if(localStorage.getItem('yash-owner')==='1')document.documentElement.classList.add('is-owner')}catch(e){}})()</script>`;

export function shell({ title, description, base, url, active, body, scripts = ['posts.js', 'tables.js'], noindex = false, bodyAttrs = '', mainClass = '' }) {
  const nav = [['work', 'Work', `${base}#work`], ['research', 'Research', `${base}research/`], ['projects', 'Projects', `${base}#projects`], ['blog', 'Writing', `${base}blog/`], ['courses', 'Courses', `${base}courses/`], ['cv', 'CV', `${base}cv.pdf`]];
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
  ${url ? `<link rel="canonical" href="${esc(url)}">` : ''}
  <link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Yashwanth Madan: writing" href="${base}feed.xml">
  ${themeScript}
  <link rel="preload" href="${base}assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${base}assets/katex/katex.min.css">
  <link rel="stylesheet" href="${base}assets/css/site.css">
  <script type="module" src="${base}assets/js/site.js"></script>
  ${scripts.map((s) => `<script type="module" src="${base}assets/js/${s}"></script>`).join('\n  ')}
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
  <a class="skip" href="#main">Skip to content</a>
  <header class="wrap site-head">
    <a class="site-head__name" href="${base}">Yashwanth Madan</a>
    <nav class="site-nav" aria-label="Sections">
      ${nav.map(([id, label, href]) => `<a href="${href}"${active === id ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
      <a href="${base}write/" data-owner${active === 'write' ? ' aria-current="page"' : ''}>Write</a>
    </nav>
  </header>
  <main id="main" class="wrap${mainClass ? ' ' + mainClass : ''}">
${body}
  </main>
  <footer class="wrap site-foot">
    <a data-mail data-show href="${base}">Email me</a>
    <span class="site-foot__links">
      <a href="https://github.com/YashIsACoder" rel="noopener">GitHub</a>
      <a href="https://www.linkedin.com/in/yashwanth-madan-7ab57b282" rel="noopener">LinkedIn</a>
      <a href="${base}cv.pdf">CV</a>
      <a href="${base}courses/">Courses</a>
      <a href="${base}feed.xml">RSS</a>
    </span>
    <span class="theme" role="group" aria-label="Colour theme">
      <button type="button" data-theme-choice="auto" aria-pressed="true">Auto</button>
      <button type="button" data-theme-choice="light" aria-pressed="false">Light</button>
      <button type="button" data-theme-choice="dark" aria-pressed="false">Dark</button>
    </span>
  </footer>
</body>
</html>
`;
}

// ------------------------------------------------------------ pieces
function meter(n) {
  if (n === undefined || n === null || n === '') return '<span class="meter-none" title="Not rated yet"><span aria-hidden="true">–</span><span class="sr-only">Not rated yet</span></span>';
  const v = Math.max(0, Math.min(10, Math.round(Number(n))));
  return `<span class="meter" role="img" aria-label="${v} out of 10">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span> <span class="muted">${v}/10</span>`;
}

function card(p, base) {
  return `<a class="card" href="${base}blog/${p.slug}/"><span class="card__date">${nice(p.date)}</span><span class="card__title">${esc(p.title)}</span>${p.summary ? `<span class="card__dek">${esc(p.summary)}</span>` : ''}${p.card_math ? `<span class="card__math">${inlineTex(p.card_math)}</span>` : ''}</a>`;
}

const termKey = (t) => { const m = String(t || '').match(/(\d{4})\s*T(\d)/i); return m ? Number(m[1]) * 10 + Number(m[2]) : 0; };
const STATUS = {
  reviewed: { order: 0, label: 'Reviewed' },
  taking: { order: 1, label: 'Taking now' },
  taken: { order: 2, label: 'Review to come' },
  planned: { order: 3, label: 'Planned' }
};

function courseTable(courses, reviews, base) {
  const byCode = new Map(reviews.map((r) => [String(r.course).toUpperCase(), r]));
  const list = courses.map((c) => ({ ...c, review: byCode.get(c.code.toUpperCase()) }))
    .sort((a, b) => termKey(b.term) - termKey(a.term) || a.code.localeCompare(b.code));
  const subjects = [...new Set(list.map((c) => c.code.slice(0, 4)))];
  const main = subjects.filter((s) => list.filter((c) => c.code.startsWith(s)).length >= 3);
  let prevTerm = null;
  const rows = list.map((c) => {
    const key = c.review ? 'reviewed' : c.status || 'taken';
    const st = STATUS[key] || STATUS.taken;
    const action = c.review ? `<a class="read" href="${base}courses/${c.review.slug}/">Read the review</a>` : '<span class="todo">Not yet</span>';
    const subj = main.includes(c.code.slice(0, 4)) ? c.code.slice(0, 4) : 'other';
    const start = c.term !== prevTerm; prevTerm = c.term;
    return `<tr${start ? ' class="is-term-start"' : ''} data-term="${termKey(c.term)}" data-code="${esc(c.code)}" data-name="${esc(c.name.toLowerCase())}" data-status="${st.order}" data-subject="${subj}" data-state="${key}"><td class="term">${esc(c.term || '')}</td><td class="code">${esc(c.code)}</td><td class="name">${esc(c.name)}${c.note ? `<small>${esc(c.note)}</small>` : ''}</td><td><span class="status status--${key}">${st.label}</span></td><td>${meter(c.review?.difficulty)}</td><td>${meter(c.review?.enjoyment)}</td><td>${action}</td></tr>`;
  }).join('');
  const sortTh = (k, label) => `<th scope="col"${k === 'term' ? ' aria-sort="descending"' : ''}><button type="button" data-sort="${k}">${label}</button></th>`;
  const filters = ['all', ...main, 'other'].filter((f) => f !== 'other' || list.some((c) => !main.includes(c.code.slice(0, 4))));
  const label = (f) => (f === 'all' ? 'All' : f === 'other' ? 'Other' : f);
  return `<div class="ctools" data-course-tools>
    <div class="filters" role="group" aria-label="Filter courses">${filters.map((f, i) => `<button type="button" data-cfilter="${f}" aria-pressed="${i === 0}">${label(f)}</button>`).join('')}<button type="button" data-cfilter="state:taking" aria-pressed="false">Taking now</button></div>
    <span class="ctools__count" data-course-count>${list.length} courses</span>
  </div>
  <div class="ctable-wrap"><table class="ctable" data-sortable><thead><tr>${sortTh('term', 'Term')}${sortTh('code', 'Course')}${sortTh('name', 'Name')}${sortTh('status', 'Status')}<th scope="col">Difficulty</th><th scope="col">Enjoyment</th><th scope="col">Review</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function postPage(p, older, newer, section) {
  const base = '../../';
  const url = `${SITE}${section}/${p.slug}/`;
  const isReview = p.kind === 'review';
  const sectionName = section === 'blog' ? 'Writing' : 'Courses';
  const ratings = isReview ? `<div class="ratings" aria-label="Ratings"><span>Difficulty</span><span>${meter(p.difficulty)}</span><span>Workload</span><span>${meter(p.workload)}</span><span>Enjoyment</span><span>${meter(p.enjoyment)}</span>${p.again !== undefined ? `<span>Take it again?</span><span>${p.again ? 'Yes' : 'No'}</span>` : ''}${p.term ? `<span>Taken</span><span>${esc(p.term)}</span>` : ''}</div>` : '';
  const bib = `@misc{madan${p.date.slice(0, 4)}${slugify(p.title).split('-')[0]},\n  author = {${AUTHOR}},\n  title  = {${p.title}},\n  year   = {${p.date.slice(0, 4)}},\n  note   = {${url}}\n}`;
  const toc = p.toc.length ? `<nav class="toc" aria-label="On this page"><span class="toc__label">On this page</span>${p.toc.map((t) => `<a href="#${t.id}">${esc(t.text)}</a>`).join('')}</nav>` : '<div></div>';
  const body = `    <div class="post-layout">
      ${toc}
      <article class="post">
        <span class="crumbs"><a href="${base}${section}/">${sectionName}</a>${isReview ? ` / ${esc(p.course)}` : ''}</span>
        ${p.tags.length ? `<ul class="post__tags" aria-label="Tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <h1>${esc(p.title)}</h1>
        ${p.summary ? `<p class="post__summary">${esc(p.summary)}</p>` : ''}
        <div class="post__meta"><span>${AUTHOR}</span><time datetime="${p.date}">${nice(p.date)}</time><span>${readTime(p.words)}</span></div>
        ${ratings}
        <div class="prose">${p.html}</div>
        <div class="post__end">
          <div class="btn-row"><a class="btn btn--primary" data-mail data-subject="${esc('Re: ' + p.title)}" href="${base}">Reply by email</a><a class="btn" href="${base}${section}/">All ${section === 'blog' ? 'writing' : 'reviews'}</a><a class="btn" data-owner href="${base}write/?edit=${encodeURIComponent(p.source)}">Edit this post</a></div>
          <details><summary>Cite this</summary><pre>${esc(bib)}</pre></details>
          <div class="pager">${older ? `<a href="${base}${section}/${older.slug}/"><small>Older</small>${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a href="${base}${section}/${newer.slug}/"><small>Newer</small>${esc(newer.title)}</a>` : '<span></span>'}</div>
        </div>
      </article>
    </div>`;
  return shell({ title: `${p.title}: Yashwanth Madan`, description: p.summary || p.title, base, url, active: section, body });
}

// Edit and Delete for each post, shown only on the owner's devices.
const ownerActions = (p, base) => `<div class="postlist__own" data-owner><a class="btn" href="${base}write/?edit=${encodeURIComponent(p.source)}">Edit</a><button type="button" class="btn" data-delete="${esc(p.source)}" data-title="${esc(p.title)}">Delete</button></div>`;

function blogIndex(posts) {
  const base = '../';
  const tags = [...new Set(posts.flatMap((p) => p.tags))].sort();
  const body = `    <section class="page">
      <h1 class="page__h">Writing</h1>
      <p class="page__lede">Notes on what I’m building and learning: C++, algorithms, statistics, markets and solar cars. New posts also go out by <a href="${base}feed.xml">RSS</a>.</p>
      <p class="btn-row" data-owner style="margin-top:22px"><a class="btn btn--primary" href="${base}write/">Write a post</a><a class="btn" href="${base}write/?kind=review">Write a course review</a></p>
      <div class="filters" role="group" aria-label="Filter by tag" data-filters><button type="button" data-filter="all" aria-pressed="true">All</button>${tags.map((t) => `<button type="button" data-filter="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
      <ul class="postlist">${posts.map((p) => `<li data-tags="${esc(p.tags.join(' '))}"><a href="${p.slug}/"><span class="d">${nice(p.date)}</span><span class="t">${esc(p.title)}</span><span class="r">${readTime(p.words)}</span>${p.summary ? `<span class="s">${esc(p.summary)}</span>` : ''}</a>${ownerActions(p, base)}</li>`).join('')}</ul>
    </section>`;
  return shell({ title: 'Writing: Yashwanth Madan', description: 'Notes on C++, algorithms, statistics, markets and solar cars.', base, url: `${SITE}blog/`, active: 'blog', body });
}

function coursesIndex(courses, reviews) {
  const base = '../';
  const body = `    <section class="page">
      <h1 class="page__h">Courses</h1>
      <p class="page__lede">Every UNSW course I’ve taken or am taking, newest first, with an honest review of each as I write them: how hard it is and whether I enjoyed it. Click a column to sort.</p>
      ${courseTable(courses, reviews, base)}
      ${reviews.length ? `<ul class="postlist">${reviews.map((r) => `<li><a href="${r.slug}/"><span class="d">${esc(r.course)}</span><span class="t">${esc(r.title)}</span><span class="r">${readTime(r.words)}</span>${r.summary ? `<span class="s">${esc(r.summary)}</span>` : ''}</a>${ownerActions(r, base)}</li>`).join('')}</ul>` : ''}
    </section>`;
  return shell({ title: 'Courses: Yashwanth Madan', description: 'Every UNSW course I have taken, with honest reviews.', base, url: `${SITE}courses/`, active: 'courses', body });
}

// hand-written TeX: <span class="tex [tex--display]" data-tex="..."><!--tex-->…<!--/tex--></span>
const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const typeset = (html) => html.replace(/(<span class="tex( tex--display)?" data-tex="([^"]*)">)<!--tex-->[\s\S]*?<!--\/tex-->/g,
  (_, open, display, src) => `${open}<!--tex-->${katex.renderToString(unesc(src), { displayMode: !!display, throwOnError: false })}<!--/tex-->`);

// Pages written by hand as body fragments in content/pages/<name>.html.
// The first line is a JSON comment: <!-- {"title": "...", "description": "...", ...} -->
function handPage(name) {
  const src = fs.readFileSync(path.join(CONTENT, 'pages', `${name}.html`), 'utf8');
  const m = src.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\n?/);
  if (!m) throw new Error(`content/pages/${name}.html: first line must be a JSON comment`);
  const meta = JSON.parse(m[1]);
  return shell({ ...meta, body: typeset(src.slice(m[0].length)) });
}

function feed(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Yashwanth Madan</title>
    <link>${SITE}</link>
    <description>Writing and course reviews from ${AUTHOR}.</description>
    <language>en-au</language>${items.slice(0, 30).map((p) => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}${p.section}/${p.slug}/</link>
      <guid>${SITE}${p.section}/${p.slug}/</guid>
      <pubDate>${new Date(p.date + 'T09:00:00+11:00').toUTCString()}</pubDate>
      <description>${esc(p.summary || '')}</description>
    </item>`).join('')}
  </channel>
</rss>
`;
}


// ------------------------------------------------------------ cache busting
// GitHub Pages lets browsers keep files for ten minutes, so after a deploy a
// visitor can get new HTML with an old stylesheet. Every link to our own CSS
// and JS, and every import between our modules, carries ?v=<hash of their
// contents>, so a change to any of them changes every URL that points at them.
function stampVersions() {
  const strip = (t) => t.replace(/\?v=[0-9a-f]{8}/g, '');
  const assets = [path.join(DOCS, 'assets/css/site.css'), ...fs.readdirSync(path.join(DOCS, 'assets/js')).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(DOCS, 'assets/js', f))];
  const h = createHash('sha1');
  for (const f of assets) h.update(strip(fs.readFileSync(f, 'utf8')));
  const v = h.digest('hex').slice(0, 8);
  const rewrite = (file, fn) => { const before = fs.readFileSync(file, 'utf8'); const after = fn(before); if (after !== before) fs.writeFileSync(file, after); };
  for (const f of assets.filter((f) => f.endsWith('.js'))) {
    rewrite(f, (t) => t.replace(/((?:from\s+|import\()['"]\.\/[\w-]+\.js)(\?v=[0-9a-f]{8})?(['"])/g, `$1?v=${v}$3`));
  }
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return ['labs', 'vendor', 'katex'].includes(d.name) ? [] : walk(p);
    return d.name.endsWith('.html') ? [p] : [];
  });
  for (const f of walk(DOCS)) {
    rewrite(f, (t) => t.replace(/(assets\/(?:css\/site\.css|js\/[\w-]+\.js))(\?v=[0-9a-f]{8})?/g, `$1?v=${v}`));
  }
  console.log(`  stamped assets with v=${v}`);
}

// ------------------------------------------------------------ go
function write(rel, text) { const f = path.join(DOCS, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }

// Take a deleted post's page off the site: remove generated post folders
// (a folder holding only index.html) that no longer have a Markdown file.
function prune(section, items) {
  const dir = path.join(DOCS, section);
  if (!fs.existsSync(dir)) return;
  const keep = new Set(items.map((p) => p.slug));
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory() || keep.has(d.name)) continue;
    const inside = fs.readdirSync(path.join(dir, d.name));
    if (inside.length === 1 && inside[0] === 'index.html') { fs.rmSync(path.join(dir, d.name), { recursive: true }); console.log(`  gone  ${section}/${d.name}/`); }
  }
}

function main() {
  const posts = load('blog', 'post');
  const reviews = load('courses', 'review');
  const courses = JSON.parse(fs.readFileSync(path.join(CONTENT, 'courses', 'courses.json'), 'utf8'));

  // KaTeX css + fonts, and the libraries the /write/ editor runs in the browser
  const kd = path.join(ROOT, 'node_modules', 'katex', 'dist');
  fs.mkdirSync(path.join(DOCS, 'assets', 'katex', 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(kd, 'katex.min.css'), path.join(DOCS, 'assets', 'katex', 'katex.min.css'));
  for (const f of fs.readdirSync(path.join(kd, 'fonts')).filter((x) => x.endsWith('.woff2'))) fs.copyFileSync(path.join(kd, 'fonts', f), path.join(DOCS, 'assets', 'katex', 'fonts', f));
  fs.mkdirSync(path.join(DOCS, 'assets', 'vendor'), { recursive: true });
  fs.copyFileSync(path.join(kd, 'katex.mjs'), path.join(DOCS, 'assets', 'vendor', 'katex.mjs'));
  fs.copyFileSync(path.join(ROOT, 'node_modules', 'marked', 'lib', 'marked.esm.js'), path.join(DOCS, 'assets', 'vendor', 'marked.esm.js'));
  write('assets/data/courses.json', JSON.stringify(courses, null, 2));

  posts.forEach((p, i) => { write(`blog/${p.slug}/index.html`, postPage(p, posts[i + 1], posts[i - 1], 'blog')); console.log(`  page  blog/${p.slug}/`); });
  reviews.forEach((r, i) => { write(`courses/${r.slug}/index.html`, postPage(r, reviews[i + 1], reviews[i - 1], 'courses')); console.log(`  page  courses/${r.slug}/`); });
  prune('blog', posts); prune('courses', reviews);
  write('blog/index.html', blogIndex(posts));
  write('courses/index.html', coursesIndex(courses, reviews));
  write('feed.xml', feed([...posts.map((p) => ({ ...p, section: 'blog' })), ...reviews.map((r) => ({ ...r, section: 'courses' }))].sort((a, b) => b.date.localeCompare(a.date))));

  write('research/index.html', handPage('research'));
  write('write/index.html', handPage('write'));
  write('404.html', handPage('404'));

  const homePath = path.join(DOCS, 'index.html');
  let home = fs.readFileSync(homePath, 'utf8');
  home = home.replace(/<!-- blog:start -->[\s\S]*?<!-- blog:end -->/, `<!-- blog:start -->\n${posts.slice(0, 4).map((p) => card(p, '')).join('\n')}\n<!-- blog:end -->`);
  fs.writeFileSync(homePath, typeset(home));
  stampVersions();
  console.log(`\n  built ${posts.length} post(s), ${reviews.length} review(s), the indexes, the research, write and 404 pages, feed.xml and the homepage.`);
}

try { main(); } catch (e) { console.error(`\n  build failed: ${e.message}\n`); process.exit(1); }
