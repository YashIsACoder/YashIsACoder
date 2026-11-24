// Shared by every page: the theme switch, the email link and a small notice.
// The theme itself is set before paint by an inline script in each page's <head>.

const KEY = 'yash-theme';
const root = document.documentElement;
const systemDark = matchMedia('(prefers-color-scheme: dark)');

function stored() { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } }
function apply(choice) {
  root.dataset.theme = choice === 'auto' ? (systemDark.matches ? 'dark' : 'light') : choice;
  document.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
  document.dispatchEvent(new CustomEvent('themechange'));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-choice]');
  if (!b) return;
  const choice = b.dataset.themeChoice;
  try { if (choice === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch { /* private mode */ }
  apply(choice);
});
systemDark.addEventListener('change', () => { if (stored() === 'auto') apply('auto'); });
apply(stored());

// Email: assembled here so the address never sits in the page source.
const MAIL = ['yashwanth.madan7070', 'gmail.com'];
export const mailto = (subject) => `mailto:${MAIL.join('@')}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
document.querySelectorAll('[data-mail]').forEach((a) => {
  a.href = mailto(a.dataset.subject);
  if ('show' in a.dataset) a.textContent = MAIL.join('@');
});

// A short notice at the bottom of the screen.
let timer = 0;
export function toast(text) {
  let el = document.querySelector('.msg');
  if (!el) { el = document.createElement('div'); el.className = 'msg'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('is-on'), 3200);
}
