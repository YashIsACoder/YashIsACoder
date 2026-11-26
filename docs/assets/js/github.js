// Talking to the site's GitHub repository from the browser: the saved token,
// committing and deleting files, and following the build that puts a change
// on the site. Used by /write/ and by the owner's Delete buttons on the
// Writing and course review lists. The token lives only in this browser's
// localStorage and is only ever sent to api.github.com.

export const REPO = 'YashIsACoder/YashIsACoder';
export const BRANCH = 'main';
export const TOKEN_KEY = 'yash-write-token';

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
};

export const ghHeaders = (token) => ({ ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
export const contentsUrl = (p) => `https://api.github.com/repos/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET from the repository API. The repository is public, so a refused token
// falls back to no token.
export async function ghGet(path) {
  const token = store.get(TOKEN_KEY);
  let r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers: ghHeaders(token), cache: 'no-store' }).catch(() => null);
  if (r && !r.ok && token) r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers: ghHeaders(null), cache: 'no-store' }).catch(() => null);
  return r && r.ok ? r.json() : null;
}

// Where a post's Markdown file appears on the site, relative to the site root.
export const sitePath = (source) => `${source.startsWith('content/courses/') ? 'courses' : 'blog'}/${source.split('/').pop().replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')}/`;

// GitHub's own page for deleting a file, for devices without a token.
export const githubDeleteUrl = (source) => `https://github.com/${REPO}/delete/${BRANCH}/${source}`;

// Delete a post's Markdown file. Resolves to the commit SHA.
export async function deleteFile(source, message) {
  const token = store.get(TOKEN_KEY);
  if (!token) throw Object.assign(new Error('no token on this device'), { code: 'no-token' });
  const api = contentsUrl(source);
  const head = await fetch(`${api}?ref=${BRANCH}`, { headers: ghHeaders(token), cache: 'no-store' });
  if (head.status === 401) throw new Error('GitHub didn’t accept the token. It may have expired: make a new one in the editor’s setup and save it again');
  if (head.status === 404) throw Object.assign(new Error('it’s already gone from the repository'), { code: 'gone' });
  if (!head.ok) throw new Error(`GitHub answered ${head.status}`);
  const { sha } = await head.json();
  const res = await fetch(api, { method: 'DELETE', headers: ghHeaders(token), body: JSON.stringify({ message, sha, branch: BRANCH }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 403 || res.status === 404 ? 'the token can’t write to the repository. Check it has Contents set to Read and write' : data.message || res.status);
  return data.commit.sha;
}

// Follow the GitHub Actions run for a commit until the site is rebuilt.
// progress(phase, run, seconds) is called while waiting: phase is 'queued'
// or 'building'. Resolves to { state: 'success' | 'failed' | 'slow', run }.
export async function followBuild(commitSha, progress = () => {}, isCurrent = () => true) {
  const started = Date.now();
  const secs = () => Math.round((Date.now() - started) / 1000);
  let run = null;
  progress('queued', null, 0);
  while (Date.now() - started < 10 * 60e3) {
    await sleep(4000);
    if (!isCurrent()) return { state: 'stopped', run };
    const runs = await ghGet(`actions/runs?head_sha=${commitSha}&per_page=1`);
    run = runs?.workflow_runs?.[0] || run;
    if (!run) { progress('queued', null, secs()); continue; }
    if (run.status !== 'completed') { progress('building', run, secs()); continue; }
    if (run.conclusion === 'cancelled') {
      // a newer commit started its own build, which includes this change
      const latest = await ghGet(`actions/runs?branch=${BRANCH}&per_page=1`);
      const next = latest?.workflow_runs?.[0];
      if (next && next.id !== run.id) { commitSha = next.head_sha; run = null; continue; }
    }
    return { state: run.conclusion === 'success' ? 'success' : 'failed', run, seconds: secs() };
  }
  return { state: 'slow', run, seconds: secs() };
}

// Posts deleted on this device in the last 20 minutes. site.js hides them
// on every page straight away, so the owner doesn't see a deleted post
// while GitHub rebuilds the site or while the browser holds an old copy.
const GONE_KEY = 'yash-gone';
const goneList = () => { try { return JSON.parse(store.get(GONE_KEY) || '[]'); } catch { return []; } };
export function markGone(source) {
  store.set(GONE_KEY, JSON.stringify([...goneList().filter((g) => g.source !== source && Date.now() - g.at < 20 * 60e3), { source, at: Date.now() }]));
}
export function unmarkGone(source) {
  store.set(GONE_KEY, JSON.stringify(goneList().filter((g) => g.source !== source)));
}

// Wait until a deleted post's page stops answering (GitHub's CDN can serve
// the old copy for a few seconds after a deploy). Resolves to true once it 404s.
export async function waitUntilGone(url, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { cache: 'reload' }).catch(() => null);
    if (r && r.status === 404) return true;
    await sleep(3000);
  }
  return false;
}

// GitHub Pages lets browsers keep pages for ten minutes. After a deploy,
// fetch fresh copies of the pages a post appears on so this browser shows
// the change straight away.
export function refreshPages(base, extra = []) {
  return Promise.all([base, `${base}blog/`, `${base}courses/`, `${base}feed.xml`, ...extra].map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
}
