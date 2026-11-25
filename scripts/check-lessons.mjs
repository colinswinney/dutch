// Checks every lesson file before it ships. Run: node scripts/check-lessons.mjs
import { readFile } from 'node:fs/promises';
import { collectSpeechTexts } from './speech-texts.mjs';

const root = new URL('../lessons/', import.meta.url);
const MODES = new Set(['listen', 'respond', 'build', 'speak', 'dictation']);
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const bag = (text) =>
  text
    .replace(/[[\]]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

const index = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
const lessonIds = new Set();

for (const id of index.lessons) {
  const where = `lessons/${id}.json`;
  let lesson;
  try {
    lesson = JSON.parse(await readFile(new URL(`${id}.json`, root), 'utf8'));
  } catch (error) {
    fail(where, `cannot read or parse (${error.message})`);
    continue;
  }
  if (lesson.id !== id) fail(where, `"id" is "${lesson.id}" but the file is listed as "${id}"`);
  if (lessonIds.has(id)) fail(where, 'listed twice in index.json');
  lessonIds.add(id);
  for (const field of ['title', 'titleNl', 'level', 'intro']) {
    if (typeof lesson[field] !== 'string' || !lesson[field].trim()) fail(where, `missing "${field}"`);
  }
  for (const m of lesson.modes ?? []) if (!MODES.has(m)) fail(where, `unknown mode "${m}"`);
  if (!Array.isArray(lesson.cards) || !lesson.cards.length) fail(where, 'needs at least one card');

  const noteIds = new Set();
  for (const [i, note] of (lesson.notes ?? []).entries()) {
    const at = `${where} note ${i + 1} (${note.title})`;
    if (note.id) {
      if (noteIds.has(note.id)) fail(at, `duplicate note id "${note.id}"`);
      noteIds.add(note.id);
    }
    for (const link of note.links ?? []) {
      if (!link.label || !/^https:\/\//.test(link.url ?? '')) fail(at, 'each link needs a "label" and an https "url"');
    }
  }

  const cardIds = new Set();
  for (const [i, card] of (lesson.cards ?? []).entries()) {
    const at = `${where} card ${i + 1} (${card.id ?? card.nl})`;
    if (!card.nl || !card.en) fail(at, 'needs "nl" and "en"');
    if (card.id) {
      if (cardIds.has(card.id)) fail(at, `duplicate card id "${card.id}"`);
      cardIds.add(card.id);
    }
    if (card.note && !noteIds.has(card.note)) fail(at, `"note" points to "${card.note}", but no note has that id`);
    if (card.reply && (!card.reply.nl || !card.reply.en)) fail(at, 'reply needs "nl" and "en"');
    for (const m of card.modes ?? []) if (!MODES.has(m)) fail(at, `unknown mode "${m}"`);
    for (const alt of card.alts ?? []) {
      if (bag(alt) !== bag(card.nl)) fail(at, `alt "${alt}" must use exactly the same words as "${card.nl}"`);
    }
  }

  for (const [i, reading] of (lesson.readings ?? []).entries()) {
    const at = `${where} reading ${i + 1} (${reading.id})`;
    if (!reading.id || !reading.title || !Array.isArray(reading.text)) fail(at, 'needs "id", "title" and a "text" list');
    for (const [qi, q] of (reading.questions ?? []).entries()) {
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) {
        fail(`${at} question ${qi + 1}`, '"answer" must be the index of one of the options, starting at 0');
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${lessonIds.size} lessons look good.`);

const manifest = JSON.parse(await readFile(new URL('../audio/manifest.json', import.meta.url), 'utf8').catch(() => '{"files":{}}'));
const missing = (await collectSpeechTexts()).filter((text) => !manifest.files[text]);
if (missing.length) {
  console.warn(`! ${missing.length} line(s) have no Google recording yet, so phones use their own voice. Run: node scripts/make-audio.mjs`);
}
