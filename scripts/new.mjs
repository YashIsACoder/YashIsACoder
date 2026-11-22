#!/usr/bin/env node
// Start a new post from a template.
//   npm run new -- "Give both cars the same weather"
//   npm run new -- "COMP3331 · Computer Networks" --kind review --course COMP3331
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const kind = flag('kind') || 'post';
const course = flag('course');
const title = args.join(' ').trim();

if (!title) { console.error('usage: npm run new -- "Post title" [--kind post|review] [--course COMP1234]'); process.exit(1); }
const tpl = path.join(ROOT, 'content', '_templates', `${kind}.md`);
if (!fs.existsSync(tpl)) { console.error(`no template for kind "${kind}" (try post or review)`); process.exit(1); }

const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const slug = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const file = path.join(ROOT, kind === 'review' ? 'content/courses' : 'content/blog', `${date}-${slug}.md`);
if (fs.existsSync(file)) { console.error(`${path.relative(ROOT, file)} already exists`); process.exit(1); }

let text = fs.readFileSync(tpl, 'utf8').replace(/^title: .*$/m, `title: ${title}`).replace(/^date: .*$/m, `date: ${date}`);
if (course) text = text.replace(/^course: .*$/m, `course: ${course}`);
fs.writeFileSync(file, text);
console.log(`created ${path.relative(ROOT, file)}  (draft: true — delete that line when it's ready)`);
