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
const render = createRenderer({ marked, katex });
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
    out.push({ ...data, tags: data.tags || [], kind, date: String(data.date), slug, ...render(body, `${dir}/${f}`) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

// ------------------------------------------------------------ page shell
const flavourScript = `<script>(function(){var m=null;try{m=localStorage.getItem('yash-colorscheme')}catch(e){}var h=new Date().getHours();var a=h>=6&&h<17?'latte':h>=17&&h<19?'frappe':h>=19&&h<22?'macchiato':'mocha';document.documentElement.dataset.flavor=m&&m!=='auto'?m:a})()</script>`;

export function shell({ title, description, base, url, file, active, body, scripts = ['posts.js', 'tables.js'], noindex = false }) {
  const tab = (id, label, dot, href) => `<a class="tab${active === id ? ' is-active' : ''}" href="${href}" style="--dot: var(${dot})"><i></i>${label}</a>`;
  return `<!doctype html>
<html lang="en" data-flavor="mocha">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">' : ''}
  ${url ? `<link rel="canonical" href="${esc(url)}">` : ''}
  <link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Yash Madan · blog" href="${base}feed.xml">
  ${flavourScript}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${base}assets/katex/katex.min.css">
  <link rel="stylesheet" href="${base}assets/css/site.css">
  <script type="module" src="${base}assets/js/core.js"></script>
  ${scripts.map((s) => `<script type="module" src="${base}assets/js/${s}"></script>`).join('\n  ')}
</head>
<body data-base="${base}">
  <a class="skip" href="#main">Skip to content</a>
  <header class="tabline">
    <div class="wrap tabline__in">
      <a class="tabline__logo" href="${base}"><b>~/yash</b><span class="long muted">.nvim</span></a>
      <nav class="tabs" aria-label="Sections">
        ${tab('home', 'README.md', '--blue', base)}
        ${tab('experience', 'experience.log', '--peach', `${base}#experience`)}
        ${tab('projects', 'projects/', '--green', `${base}#projects`)}
        ${tab('blog', 'blog/', '--mauve', `${base}blog/`)}
        ${tab('courses', 'courses/', '--yellow', `${base}courses/`)}
        ${tab('contact', 'contact', '--teal', `${base}#contact`)}
      </nav>
      <div class="tabline__right">
        <button class="chip" type="button" data-scheme title="Follows your clock. Click to choose a flavour."><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span data-scheme-label>mocha · auto</span></button>
        <a class="chip hide-sm" href="${base}cv.pdf">cv.pdf</a>
      </div>
    </div>
  </header>
  <main id="main" data-file="${esc(file)}">
${body}
  </main>
  <footer class="wrap foot"><span>~/yash · built by hand · no trackers</span><span>press <kbd>space</kbd> for keys · <kbd>:</kbd> for commands</span></footer>
  <div class="whichkey" role="dialog" aria-label="Keyboard shortcuts"><div class="whichkey__title">&lt;leader&gt; · press a key, or Esc</div><ul></ul></div>
  <div class="cmdline"><span>:</span><label class="sr-only" for="cmd">Command</label><input id="cmd" data-cmd-input autocomplete="off" spellcheck="false"></div>
  <div class="statusline" role="status" aria-label="Status line">
    <span class="sl sl--mode" data-mode>NORMAL</span>
    <span class="sl sl--branch sl--hide-sm">⎇ main</span>
    <span class="sl sl--file" data-sl-file>${esc(file)}</span>
    <span class="sl sl--hide-sm"><button type="button" data-run="help">:help</button></span>
    <span class="sl sl--right sl--hide-sm" data-flavor-name>catppuccin-mocha</span>
    <span class="sl sl--hide-sm" data-sl-pos>Top</span>
    <span class="sl sl--clock" data-clock>--:--</span>
  </div>
</body>
</html>
`;
}

// ------------------------------------------------------------ pieces
function meter(n, colour) {
  if (n === undefined || n === null || n === '') return '<span class="meter-none">—</span>';
  const v = Math.max(0, Math.min(10, Math.round(Number(n))));
  return `<span class="meter" role="img" aria-label="${v} out of 10" style="--c: var(${colour})">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span> <span class="mono" style="font-size:12.5px;color:var(--sub)">${v}/10</span>`;
}

function notecard(p, base) {
  return `<a class="notecard" href="${base}blog/${p.slug}/" style="--c: var(--mauve)"><div class="notecard__bar"><b>${esc(p.slug)}.md</b><span>${nice(p.date)}</span></div><div class="notecard__body"><span class="notecard__title">${esc(p.title)}</span>${p.summary ? `<span class="notecard__dek">${esc(p.summary)}</span>` : ''}${p.card_math ? `<div class="notecard__math">${inlineTex(p.card_math)}</div>` : ''}${p.toc.length ? `<ul class="notecard__toc">${p.toc.slice(0, 4).map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul>` : ''}<div class="notecard__foot"><span>${readTime(p.words)}</span>${p.tags.slice(0, 3).map((t) => `<span>#${esc(t)}</span>`).join('')}</div></div></a>`;
}

const termKey = (t) => { const m = String(t || '').match(/(\d{4})\s*T(\d)/i); return m ? Number(m[1]) * 10 + Number(m[2]) : 0; };
const STATUS = {
  reviewed: { order: 0, colour: 'var(--green)', label: 'reviewed' },
  taking: { order: 1, colour: 'var(--blue)', label: 'taking it now' },
  taken: { order: 2, colour: 'var(--yellow)', label: 'review pending' },
  planned: { order: 3, colour: 'var(--mauve)', label: 'planned' }
};

function courseTable(courses, reviews, base, { scroll = false } = {}) {
  const byCode = new Map(reviews.map((r) => [String(r.course).toUpperCase(), r]));
  const list = courses.map((c) => ({ ...c, review: byCode.get(c.code.toUpperCase()) }))
    .sort((a, b) => termKey(b.term) - termKey(a.term) || a.code.localeCompare(b.code));
  const subjects = [...new Set(list.map((c) => c.code.slice(0, 4)))];
  const main = subjects.filter((s) => list.filter((c) => c.code.startsWith(s)).length >= 3);
  let prevTerm = null;
  const rows = list.map((c) => {
    const st = c.review ? STATUS.reviewed : STATUS[c.status] || STATUS.taken;
    const key = c.review ? 'reviewed' : c.status || 'taken';
    const action = c.review ? `<a class="read" href="${base}courses/${c.review.slug}/">read →</a>`
      : key === 'taking' ? '<span class="meter-none">after exams</span>'
      : key === 'planned' ? '<span class="meter-none">—</span>' : '<span class="todo">TODO</span>';
    const subj = main.includes(c.code.slice(0, 4)) ? c.code.slice(0, 4) : 'other';
    const start = c.term !== prevTerm; prevTerm = c.term;
    return `<tr${start ? ' class="is-term-start"' : ''} data-term="${termKey(c.term)}" data-code="${esc(c.code)}" data-name="${esc(c.name.toLowerCase())}" data-status="${st.order}" data-subject="${subj}" data-state="${key}"><td class="term">${esc(c.term || '')}</td><td class="code">${esc(c.code)}</td><td class="name">${esc(c.name)}${c.note ? `<small>${esc(c.note)}</small>` : ''}</td><td><span class="status" style="--c:${st.colour}">${st.label}</span></td><td>${meter(c.review?.difficulty, '--red')}</td><td>${meter(c.review?.workload, '--peach')}</td><td>${meter(c.review?.enjoyment, '--green')}</td><td>${action}</td></tr>`;
  }).join('');
  const sortTh = (k, label) => `<th scope="col"${k === 'term' ? ' aria-sort="descending"' : ''}><button type="button" data-sort="${k}">${label}</button></th>`;
  const filters = ['all', ...main, 'other'].filter((f) => f !== 'other' || list.some((c) => !main.includes(c.code.slice(0, 4))));
  return `<div class="ctools" data-course-tools>
    <div class="filters" role="group" aria-label="Filter courses">${filters.map((f, i) => `<button type="button" data-cfilter="${f}" aria-pressed="${i === 0}">${f === 'all' ? 'all' : f === 'other' ? 'other' : f}</button>`).join('')}<button type="button" data-cfilter="state:taking" aria-pressed="false">taking now</button></div>
    <span class="ctools__count" data-course-count>${list.length} courses</span>
  </div>
  <div class="ctable-wrap${scroll ? ' ctable-wrap--scroll' : ''}"><table class="ctable" data-sortable><thead><tr>${sortTh('term', 'term')}${sortTh('code', 'course')}${sortTh('name', 'name')}${sortTh('status', 'status')}<th scope="col">difficulty</th><th scope="col">workload</th><th scope="col">enjoyment</th><th scope="col">review</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function postPage(p, older, newer, section) {
  const base = '../../';
  const url = `${SITE}${section}/${p.slug}/`;
  const isReview = p.kind === 'review';
  const kicker = isReview ? `courses/<b>${esc(p.course)}</b>` : `blog/<b>${esc(p.slug)}.md</b>`;
  const ratings = isReview ? `<div class="ratings" aria-label="Ratings"><span>difficulty</span><span>${meter(p.difficulty, '--red')}</span><span>workload</span><span>${meter(p.workload, '--peach')}</span><span>enjoyment</span><span>${meter(p.enjoyment, '--green')}</span>${p.again !== undefined ? `<span>take again?</span><span>${p.again ? 'yes' : 'no'}</span>` : ''}${p.term ? `<span>taken</span><span>${esc(p.term)}</span>` : ''}</div>` : '';
  const bib = `@misc{madan${p.date.slice(0, 4)}${slugify(p.title).split('-')[0]},\n  author = {${AUTHOR}},\n  title  = {${p.title}},\n  year   = {${p.date.slice(0, 4)}},\n  note   = {${url}}\n}`;
  const toc = p.toc.length ? `<nav class="toc" aria-label="On this page"><span class="toc__label">-- on this page</span>${p.toc.map((t) => `<a href="#${t.id}">${esc(t.text)}</a>`).join('')}</nav>` : '<div></div>';
  const body = `    <div class="wrap post-layout">
      ${toc}
      <article class="post" style="--c-text: var(${isReview ? '--t-yellow' : '--t-mauve'})">
        <span class="crumbs"><a href="${base}">~</a> / <a href="${base}${section}/">${section}</a> / ${esc(p.slug)}</span>
        <span class="post__kicker">${kicker}${p.tags.length ? ' · ' + p.tags.map((t) => '#' + esc(t)).join(' ') : ''}</span>
        <h1>${esc(p.title)}</h1>
        ${p.summary ? `<p class="post__summary">${esc(p.summary)}</p>` : ''}
        <div class="post__meta"><span>${AUTHOR}</span><time datetime="${p.date}">${nice(p.date)}</time><span>${readTime(p.words)}</span></div>
        ${ratings}
        <div class="prose">${p.html}</div>
        <div class="post__end">
          <div style="display:flex;flex-wrap:wrap;gap:10px"><a class="btn btn--primary" data-mail data-subject="${esc('Re: ' + p.title)}" href="${base}#contact">reply by email</a><a class="btn" href="${base}${section}/">all ${section === 'blog' ? 'posts' : 'reviews'}</a></div>
          <details><summary class="cmt" style="cursor:pointer">-- cite this</summary><pre>${esc(bib)}</pre></details>
          <div class="pager">${older ? `<a href="${base}${section}/${older.slug}/"><small>← older</small>${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a href="${base}${section}/${newer.slug}/"><small>newer →</small>${esc(newer.title)}</a>` : '<span></span>'}</div>
        </div>
      </article>
    </div>`;
  return shell({ title: `${p.title} · Yash Madan`, description: p.summary || p.title, base, url, file: `~/yash/${section}/${p.slug}.md`, active: section, body });
}

function blogIndex(posts) {
  const base = '../';
  const tags = [...new Set(posts.flatMap((p) => p.tags))].sort();
  const body = `    <section class="wrap section">
      <div class="win">
        <div class="win__bar"><span class="win__path">~/yash<span class="sep">›</span><b>blog/</b></span><span>${posts.length} post${posts.length === 1 ? '' : 's'} · <a class="c-blue" href="${base}feed.xml">rss</a></span></div>
        <div class="win__body">
          <h1 class="h2"><span class="hash">#</span>blog</h1>
          <p class="lede">Notes on what I’m building and what I’m learning: C++, algorithms, markets and solar cars. Maths is typeset from LaTeX.</p>
          <div class="filters" role="group" aria-label="Filter by tag" data-filters><button type="button" data-filter="all" aria-pressed="true">all</button>${tags.map((t) => `<button type="button" data-filter="${esc(t)}" aria-pressed="false">#${esc(t)}</button>`).join('')}</div>
          <ul class="postlist">${posts.map((p) => `<li data-tags="${esc(p.tags.join(' '))}"><a href="${p.slug}/"><span class="d">${p.date}</span><span class="t">${esc(p.title)}</span><span class="r">${readTime(p.words)}</span>${p.summary ? `<span class="s">${esc(p.summary)}</span>` : ''}</a></li>`).join('')}</ul>
        </div>
      </div>
    </section>`;
  return shell({ title: 'Blog · Yash Madan', description: 'Notes on C++, algorithms, markets and solar cars.', base, url: `${SITE}blog/`, file: '~/yash/blog/', active: 'blog', body });
}

function coursesIndex(courses, reviews) {
  const base = '../';
  const body = `    <section class="wrap section">
      <div class="win">
        <div class="win__bar"><span class="win__path">~/yash<span class="sep">›</span><b>courses/</b></span><span>${reviews.length} of ${courses.length} reviewed</span></div>
        <div class="win__body">
          <h1 class="h2"><span class="hash">#</span>course reviews</h1>
          <p class="lede">An honest review of every UNSW course I take: how hard it is, how much time it eats, and whether I enjoyed it. No marks, just how it felt. Written for whoever is picking courses next term.</p>
          ${courseTable(courses, reviews, base)}
          ${reviews.length ? `<ul class="postlist" style="margin-top:28px">${reviews.map((r) => `<li><a href="${r.slug}/"><span class="d">${esc(r.course)}</span><span class="t">${esc(r.title)}</span><span class="r">${readTime(r.words)}</span>${r.summary ? `<span class="s">${esc(r.summary)}</span>` : ''}</a></li>`).join('')}</ul>` : '<p class="cmt" style="margin-top:22px">-- reviews land here as I write them.</p>'}
        </div>
      </div>
    </section>`;
  return shell({ title: 'Course reviews · Yash Madan', description: 'Honest reviews of UNSW courses: difficulty, workload and enjoyment.', base, url: `${SITE}courses/`, file: '~/yash/courses/', active: 'courses', body });
}

function feed(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Yash Madan</title>
    <link>${SITE}</link>
    <description>Blog posts and course reviews from ${AUTHOR}.</description>
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

// ------------------------------------------------------------ go
function write(rel, text) { const f = path.join(DOCS, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }

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
  write('blog/index.html', blogIndex(posts));
  write('courses/index.html', coursesIndex(courses, reviews));
  write('feed.xml', feed([...posts.map((p) => ({ ...p, section: 'blog' })), ...reviews.map((r) => ({ ...r, section: 'courses' }))].sort((a, b) => b.date.localeCompare(a.date))));

  const homePath = path.join(DOCS, 'index.html');
  let home = fs.readFileSync(homePath, 'utf8');
  home = home.replace(/<!-- blog:start -->[\s\S]*?<!-- blog:end -->/, `<!-- blog:start -->\n${posts.map((p) => notecard(p, '')).join('\n')}\n<!-- blog:end -->`);
  home = home.replace(/<!-- courses:start -->[\s\S]*?<!-- courses:end -->/, `<!-- courses:start -->\n${courseTable(courses, reviews, '', { scroll: true })}\n<!-- courses:end -->`);
  fs.writeFileSync(homePath, home);
  console.log(`\n  built ${posts.length} post(s), ${reviews.length} review(s), the indexes, feed.xml and the homepage.`);
}

try { main(); } catch (e) { console.error(`\n  build failed: ${e.message}\n`); process.exit(1); }
