// The homepage's theatre: tabs between bond auctions learnt by a Gaussian
// process, the best-cycle game and ECM driving a solar car. Each one draws
// and runs by itself while it's showing; it pauses when another tab is
// picked or the stage scrolls away. Full screen where the browser allows it.

import { mountCycle } from './cycle.js?v=dda207ea';
import { mountBondLab } from './bondlab.js?v=dda207ea';
import { mountEcmLab } from './ecmlab.js?v=dda207ea';

export function mountStage(root) {
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = Object.fromEntries([...root.querySelectorAll('[data-panel]')].map((p) => [p.dataset.panel, p]));
  const ink = $('.stage__ink');
  const parts = {};
  let current = 'bond', onScreen = true;

  // made on first view, so a tab nobody opens costs nothing
  const make = {
    cycle: () => {
      const m = mountCycle($('[data-cycle]'), { status: $('[data-cycle-status]') });
      $('[data-cycle-best]').addEventListener('click', () => m.reveal());
      $('[data-cycle-new]').addEventListener('click', () => m.newGraph());
      return m;
    },
    bond: () => {
      const m = mountBondLab(panels.bond);
      $('[data-bond-next]').addEventListener('click', () => m.next());
      $('[data-bond-reset]').addEventListener('click', () => m.reset());
      return m;
    },
    ecm: () => mountEcmLab(panels.ecm)
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

  // full screen: the whole theatre, where the browser supports it
  const full = $('[data-stage-full]');
  if (full && document.fullscreenEnabled) {
    full.hidden = false;
    full.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen()).catch(() => {}));
    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement === root;
      full.textContent = on ? 'Exit full screen' : 'Full screen';
      root.classList.toggle('is-full', on);
      requestAnimationFrame(() => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
    });
  }

  part(current);
  placeInk(tabs[0], true);
  document.fonts?.ready.then(() => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
  addEventListener('resize', () => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
}
