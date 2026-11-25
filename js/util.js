export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// Lesson authors wrap words in [square brackets] to highlight them in grammar examples.
export function marked(text) {
  return text.split(/(\[[^\]]+\])/).filter(Boolean).map((part) =>
    part.startsWith('[') ? h('strong', { class: 'hl' }, part.slice(1, -1)) : part,
  );
}

export const stripMarks = (text) => text.replace(/[[\]]/g, '');

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function normalize(text) {
  return stripMarks(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’`´]/g, "'")
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const words = (text) => {
  const n = normalize(text);
  return n ? n.split(' ') : [];
};

// Marks which target words appear, in order, in what the learner typed or said.
export function matchWords(target, got) {
  const a = words(target);
  const b = words(got);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      hit[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return a.map((word, index) => ({ word, hit: hit[index] }));
}

export function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export const slug = (text) => normalize(text).replace(/'/g, '').replace(/ /g, '-').slice(0, 60);

export function localDayNumber(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}

// The exact string used to look up a recorded audio file, so the app and the audio script always agree.
export const speechKey = (text) => stripMarks(text).replace(/\s+/g, ' ').trim();

export const TEST_PHRASE = 'Goedemorgen! Hoe gaat het met je?';
