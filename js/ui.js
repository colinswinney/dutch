import { h } from './util.js';
import { hasTts, speak } from './speech.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const ICONS = {
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z',
  slow: 'M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4Zm-1 3v5.4l3.8 2.3 1-1.7-2.8-1.7V7h-2Z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7 9.5 16.2Z',
  cross: 'M18.3 7.1 16.9 5.7 12 10.6 7.1 5.7 5.7 7.1l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z',
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z',
  stop: 'M7 7h10v10H7z',
  arrow: 'M12 4 10.6 5.4l5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8-8-8Z',
  back: 'M12 20l1.4-1.4L7.8 13H20v-2H7.8l5.6-5.6L12 4l-8 8 8 8Z',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `icon icon-${name}`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

export function playRow(text, { autoLabel = 'Play' } = {}) {
  if (!hasTts()) return h('p', { class: 'note' }, 'No audio here: this device has no Dutch voice installed. See the home page for how to add one.');
  return h(
    'div',
    { class: 'play-row' },
    h('button', { type: 'button', class: 'btn btn-play', onClick: () => speak(text) }, icon('play'), autoLabel),
    h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => speak(text, { slow: true }) }, icon('slow'), 'Slow'),
  );
}

export function miniPlay(text) {
  if (!hasTts()) return null;
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Play: ${text}`, onClick: () => speak(text) }, icon('play'));
}

export function dutchLine(nl, en, who) {
  return h(
    'div',
    { class: 'line' },
    miniPlay(nl),
    h(
      'div',
      { class: 'line-text' },
      who ? h('span', { class: 'who' }, who) : null,
      h('span', { class: 'nl', lang: 'nl' }, nl),
      en ? h('span', { class: 'en' }, en) : null,
    ),
  );
}

// Swaps page content inside a view transition when the browser supports one.
export function withTransition(update) {
  if (!document.startViewTransition || reduceMotion.matches || document.hidden) {
    update();
    return;
  }
  document.startViewTransition(update);
}

// FLIP: measure, change the DOM, then animate each element from its old spot.
// Used for word tiles because a view transition would swallow fast repeated taps.
export function flip(elements, mutate) {
  if (reduceMotion.matches) {
    mutate();
    return;
  }
  const first = new Map(elements().map((el) => [el, el.getBoundingClientRect()]));
  mutate();
  for (const el of elements()) {
    const before = first.get(el);
    if (!before) continue;
    el.getAnimations().forEach((a) => a.cancel());
    const after = el.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (!dx && !dy) continue;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration: 220,
      easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
    });
  }
}

export function externalLink(url, label) {
  return h('a', { href: url, target: '_blank', rel: 'noopener' }, label, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));
}

export function furtherReading(links) {
  if (!links?.length) return null;
  return h(
    'div',
    { class: 'further' },
    h('p', { class: 'further-title' }, 'Further reading'),
    h('ul', {}, links.map((l) => h('li', {}, externalLink(l.url, l.label), l.note ? h('span', { class: 'note' }, ` · ${l.note}`) : null))),
  );
}

export function announce(message) {
  const live = document.getElementById('live');
  live.textContent = '';
  // A short delay so screen readers notice the change even when the text repeats.
  setTimeout(() => {
    live.textContent = message;
  }, 50);
}
