// The homepage's stage: tabs between the Gaussian process, the best-cycle
// game and the bond auction. Each one draws and runs by itself while it's
// showing; it pauses when another tab is picked or the stage scrolls away.

import { mountCycle } from './cycle.js?v=2fb509c6';
import { mountAuction } from './auction.js?v=2fb509c6';

export function mountStage(root) {
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = Object.fromEntries([...root.querySelectorAll('[data-panel]')].map((p) => [p.dataset.panel, p]));
  const ink = $('.stage__ink');
  const parts = {};
  let current = 'gp', onScreen = true;

  // made on first view, so a tab nobody opens costs nothing
  const make = {
    cycle: () => {
      const m = mountCycle($('[data-cycle]'), { status: $('[data-cycle-status]') });
      $('[data-cycle-best]').addEventListener('click', () => m.reveal());
      $('[data-cycle-new]').addEventListener('click', () => m.newGraph());
      return m;
    },
    auction: () => {
      const m = mountAuction($('[data-auction]'), { stats: $('[data-auction-stats]'), offerInput: $('[data-auction-offer]'), offerOut: $('[data-auction-out]') });
      $('[data-auction-new]').addEventListener('click', () => m.rerun());
      return m;
    }
  };
  const part = (id) => (parts[id] ??= make[id]?.() || null);

  function placeInk(tab, instant) {
    if (!ink) return;
    if (instant) ink.style.transition = 'none';
    ink.style.width = `${tab.offsetWidth}px`;
    ink.style.height = `${tab.offsetHeight}px`;
    ink.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
    if (instant) { void ink.offsetWidth; ink.style.transition = ''; }
  }

  function select(id, focus) {
    const tab = tabs.find((t) => t.getAttribute('aria-controls') === `panel-${id}`);
    if (!tab) return;
    if (id !== current) part(current)?.hide?.();
    current = id;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    Object.entries(panels).forEach(([k, p]) => {
      const on = k === id;
      p.classList.toggle('is-active', on);
      p.toggleAttribute('inert', !on);
    });
    placeInk(tab);
    if (focus) tab.focus();
    if (onScreen) part(id)?.show?.();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.getAttribute('aria-controls').replace('panel-', '')));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      const next = tabs[(k + tabs.length) % tabs.length];
      select(next.getAttribute('aria-controls').replace('panel-', ''), true);
    });
  });
  Object.entries(panels).forEach(([k, p]) => { if (k !== current) p.setAttribute('inert', ''); });

  // pause whatever is running when the stage is off screen or the tab is in the background
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !document.hidden) part(current)?.show?.(); else part(current)?.hide?.();
  }, { threshold: 0.15 }).observe(root);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) part(current)?.hide?.(); else if (onScreen) part(current)?.show?.();
  });

  placeInk(tabs[0], true);
  document.fonts?.ready.then(() => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
  addEventListener('resize', () => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
}
