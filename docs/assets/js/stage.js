// The homepage's stage: bond auctions learnt by a Gaussian process, the
// best-cycle game and ECM driving a solar car. Each one draws and runs by
// itself while it's showing, and pauses when it's switched away or scrolled
// off. The stage sits on the page like everything else until you hover over
// it or scroll it to the middle of the screen: then the page dims around it
// (theatre mode) and the arrows, or the arrow keys, move between the three.

import { mountCycle } from './cycle.js?v=3367876e';
import { mountBondLab } from './bondlab.js?v=3367876e';
import { mountEcmLab } from './ecmlab.js?v=3367876e';

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

  const order = tabs.map((t) => t.getAttribute('aria-controls').replace('stage-', ''));
  function select(id, focus, dir = 0) {
    const tab = tabs.find((t) => t.getAttribute('aria-controls') === `stage-${id}`);
    if (!tab) return;
    if (!dir && id !== current) dir = order.indexOf(id) > order.indexOf(current) ? 1 : -1;
    root.dataset.dir = dir > 0 ? 'next' : 'prev';
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
    t.addEventListener('click', () => select(t.getAttribute('aria-controls').replace('stage-', '')));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      const next = tabs[(k + tabs.length) % tabs.length];
      select(next.getAttribute('aria-controls').replace('stage-', ''), true);
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

  // the arrows either side, and the arrow keys while the theatre is on
  const step = (d) => select(order[(order.indexOf(current) + d + order.length) % order.length], false, d);
  root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.step))));
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-lit') || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (e.target.closest('[role="tab"]')) return;          // the tabs handle their own keys
      e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  // theatre mode: on while the pointer is over the stage, or while it fills
  // the middle of the screen; the rest of the page dims behind it
  const dim = document.createElement('div');
  dim.className = 'dimmer'; dim.setAttribute('aria-hidden', 'true');
  root.before(dim);
  let hovering = false, centred = false;
  const light = () => {
    const on = hovering || centred;
    root.classList.toggle('is-lit', on);
    document.documentElement.classList.toggle('theatre-on', on);
  };
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; light(); } });
  root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovering = false; light(); } });
  new IntersectionObserver(([e]) => { centred = e.isIntersecting; light(); }, { rootMargin: '-42% 0px -42% 0px' }).observe(root);

  part(current);
  placeInk(tabs[0], true);
  document.fonts?.ready.then(() => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
  addEventListener('resize', () => placeInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true'), true));
}
