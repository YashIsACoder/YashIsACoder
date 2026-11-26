// Delete buttons on the Writing and course review lists (owner's devices
// only). Delete asks once in the row, removes the Markdown file from the
// repository, then follows the rebuild until the post is off the site.

import { TOKEN_KEY, store, sitePath, githubDeleteUrl, deleteFile, followBuild, refreshPages } from './github.js?v=6938b5c2';
import { toast } from './site.js?v=6938b5c2';

const base = new URL('../../', import.meta.url).href;   // the site root

function setRow(row, html) {
  const box = row.querySelector('.postlist__own');
  box.innerHTML = html;
  return box;
}

function ask(btn) {
  const row = btn.closest('li');
  const source = btn.dataset.delete;
  const title = btn.dataset.title;
  const before = row.querySelector('.postlist__own').innerHTML;
  const box = setRow(row, `<span class="postlist__ask">Delete this ${source.startsWith('content/courses/') ? 'review' : 'post'}? It comes off the site in about a minute.</span><button type="button" class="btn btn--danger" data-yes>Delete</button><button type="button" class="btn" data-no>Keep it</button>`);
  box.querySelector('[data-yes]').focus();
  box.querySelector('[data-no]').addEventListener('click', () => {
    box.innerHTML = before;
    box.querySelector('[data-delete]').focus();
  });
  box.querySelector('[data-yes]').addEventListener('click', () => remove(row, source, title, before));
}

async function remove(row, source, title, before) {
  if (!store.get(TOKEN_KEY)) {
    window.open(githubDeleteUrl(source), '_blank', 'noopener');
    setRow(row, `<span class="postlist__ask">GitHub opened in a new tab. Press Commit changes there to delete it.</span><a class="btn" href="${base}write/">Set up one-click delete</a>`);
    return;
  }
  const say = (t, cls = 'is-busy') => setRow(row, `<span class="postlist__ask"><span class="ed__live ${cls}"></span>${t}</span>`);
  say('Deleting…');
  row.classList.add('is-going');
  let commit;
  try {
    commit = await deleteFile(source, `Delete ${source.startsWith('content/courses/') ? 'review' : 'post'}: ${title}`);
  } catch (e) {
    if (e.code !== 'gone') {
      row.classList.remove('is-going');
      const box = setRow(row, `<span class="postlist__ask">Couldn’t delete: ${e.message}.</span>`);
      box.insertAdjacentHTML('beforeend', before);
      return;
    }
  }
  if (commit) {
    toast('Deleted. Taking it off the site…');
    const out = await followBuild(commit, (phase, run, s) => say(`${phase === 'queued' ? 'Deleted. Waiting for GitHub to start building the site…' : 'Deleted. Rebuilding the site…'}${s ? ` ${s} s` : ''}`));
    if (out.state === 'failed') { say(`Deleted from the repository, but the site build failed. <a href="${out.run.html_url}" target="_blank" rel="noopener">See what went wrong</a>.`, 'is-bad'); return; }
    if (out.state === 'slow') { say('Deleted from the repository. The site is taking longer than usual to rebuild.', 'is-bad'); return; }
  }
  await refreshPages(base, [new URL(sitePath(source), base).href]);
  toast('Deleted: it’s off the site');
  row.remove();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delete]');
  if (btn) ask(btn);
});
