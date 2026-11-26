import { h, speechKey } from './util.js';
import { hasTts, hasRecording, speak, togglePlay, onPlayback, playback, seekTo, seekBy, setSlow } from './speech.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const ICONS = {
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  slow: 'M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4Zm-1 3v5.4l3.8 2.3 1-1.7-2.8-1.7V7h-2Z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7 9.5 16.2Z',
  cross: 'M18.3 7.1 16.9 5.7 12 10.6 7.1 5.7 5.7 7.1l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z',
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z',
  stop: 'M7 7h10v10H7z',
  arrow: 'M12 4 10.6 5.4l5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8-8-8Z',
  back: 'M12 20l1.4-1.4L7.8 13H20v-2H7.8l5.6-5.6L12 4l-8 8 8 8Z',
  // Navigation glyphs from Google's Material Icons (Apache 2.0).
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  book: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
  headphones: 'M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1a7 7 0 0 1 14 0v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z',
  pencil: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z',
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

// Every play button carries the line it plays in data-say. One listener swaps Play and Pause on all of them.
function setPlaying(button, playing) {
  if (button.dataset.playing === String(playing)) return;
  button.dataset.playing = String(playing);
  button.querySelector('.icon')?.replaceWith(icon(playing ? 'pause' : 'play'));
  const label = button.querySelector('.label');
  if (label) label.textContent = playing ? 'Pause' : button.dataset.label;
  else button.setAttribute('aria-label', playing ? 'Pause' : button.dataset.label);
}

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

onPlayback((state) => {
  for (const button of document.querySelectorAll('[data-say]')) setPlaying(button, button.dataset.say === state.key && state.playing);
  for (const box of document.querySelectorAll('[data-player]')) {
    const mine = box.dataset.player === state.key;
    const range = box.querySelector('input[type="range"]');
    const time = box.querySelector('.time');
    const duration = mine ? state.duration : 0;
    const at = mine ? state.time : 0;
    range.disabled = !duration;
    range.max = String(Math.ceil(duration) || 1);
    if (box.dataset.dragging !== 'true') range.value = String(Math.floor(at));
    range.setAttribute('aria-valuetext', duration ? `${clock(at)} of ${clock(duration)}` : 'Not started');
    time.textContent = duration ? `${clock(at)} / ${clock(duration)}` : '';
    for (const skip of box.querySelectorAll('.skip')) skip.disabled = !duration;
  }
});

export function playRow(text, { autoLabel = 'Play' } = {}) {
  if (!hasTts()) return h('p', { class: 'note' }, 'No audio here: this device has no Dutch voice installed. See the home page for how to add one.');
  return h(
    'div',
    { class: 'play-row' },
    h(
      'button',
      { type: 'button', class: 'btn btn-play', 'data-say': speechKey(text), 'data-label': autoLabel, onClick: () => togglePlay(text) },
      icon('play'),
      h('span', { class: 'label' }, autoLabel),
    ),
    h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => speak(text, { slow: true }) }, icon('slow'), 'Slow'),
  );
}

// For long recordings such as reading texts: pause, skip 5 seconds, a slow toggle and a position slider.
let playerCount = 0;
export function audioPlayer(text, { label = 'Play' } = {}) {
  if (!hasRecording(text)) return playRow(text, { autoLabel: label });
  const key = speechKey(text);
  const id = `seek-${++playerCount}`;
  const range = h('input', { type: 'range', id, min: '0', max: '1', step: '1', value: '0', disabled: true, 'aria-valuetext': 'Not started' });
  const box = h(
    'div',
    { class: 'player', 'data-player': key },
    h(
      'div',
      { class: 'player-controls' },
      h(
        'button',
        { type: 'button', class: 'btn btn-play btn-round', 'aria-label': label, 'data-say': key, 'data-label': label, onClick: () => togglePlay(text, { slow: slow.getAttribute('aria-pressed') === 'true' }) },
        icon('play'),
      ),
      h('button', { type: 'button', class: 'btn btn-quiet skip', 'aria-label': 'Back 5 seconds', disabled: true, onClick: () => seekBy(-5) }, '−5s'),
      h('button', { type: 'button', class: 'btn btn-quiet skip', 'aria-label': 'Forward 5 seconds', disabled: true, onClick: () => seekBy(5) }, '+5s'),
    ),
    h('div', { class: 'player-seek' }, h('label', { for: id, class: 'visually-hidden' }, 'Position in the recording'), range, h('span', { class: 'time', 'aria-hidden': 'true' })),
  );
  const slow = h('button', { type: 'button', class: 'btn btn-quiet', 'aria-pressed': 'false' }, icon('slow'), 'Slow');
  slow.addEventListener('click', () => {
    const on = slow.getAttribute('aria-pressed') !== 'true';
    slow.setAttribute('aria-pressed', String(on));
    if (playback().key === key) setSlow(on);
  });
  box.querySelector('.player-controls').append(slow);
  range.addEventListener('input', () => {
    box.dataset.dragging = 'true';
    seekTo(Number(range.value));
  });
  range.addEventListener('change', () => {
    box.dataset.dragging = 'false';
  });
  return box;
}

export function miniPlay(text) {
  if (!hasTts()) return null;
  const label = `Play: ${text}`;
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, 'data-say': speechKey(text), 'data-label': label, onClick: () => togglePlay(text) }, icon('play'));
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
