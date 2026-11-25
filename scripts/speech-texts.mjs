// Every Dutch string the app can speak, built the same way the app builds it.
import { readFile } from 'node:fs/promises';
import { speechKey, TEST_PHRASE } from '../js/util.js';
import { allDrillSayings } from '../js/drills.js';

export async function collectSpeechTexts() {
  const root = new URL('../lessons/', import.meta.url);
  const index = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
  const texts = new Set([TEST_PHRASE, ...allDrillSayings()]);
  for (const id of index.lessons) {
    const lesson = JSON.parse(await readFile(new URL(`${id}.json`, root), 'utf8'));
    for (const card of lesson.cards) {
      texts.add(card.nl);
      if (card.reply) texts.add(card.reply.nl);
    }
    for (const note of lesson.notes ?? []) for (const ex of note.examples ?? []) texts.add(ex.nl);
    for (const reading of lesson.readings ?? []) texts.add(reading.text.join('\n'));
  }
  return [...new Set([...texts].map(speechKey))].filter(Boolean);
}
