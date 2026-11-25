// Records every Dutch line with Google Cloud Text-to-Speech and saves it under audio/.
// Only new or changed lines are sent to Google. Run: node scripts/make-audio.mjs [--prune]
// The API key comes from GOOGLE_TTS_KEY or ~/.config/dutch-practice/google-tts-key.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, unlink, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { collectSpeechTexts } from './speech-texts.mjs';

const VOICE = { languageCode: 'nl-NL', name: 'nl-NL-Chirp3-HD-Achernar' };
const dir = new URL('../audio/', import.meta.url);
const prune = process.argv.includes('--prune');

const key = (process.env.GOOGLE_TTS_KEY ?? (await readFile(`${homedir()}/.config/dutch-practice/google-tts-key`, 'utf8').catch(() => ''))).trim();
if (!key) {
  console.error('No API key. Set GOOGLE_TTS_KEY or save it to ~/.config/dutch-practice/google-tts-key.');
  process.exit(1);
}

await mkdir(dir, { recursive: true });
const fileFor = (text) => `${createHash('sha1').update(`${VOICE.name}|${text}`).digest('hex').slice(0, 16)}.mp3`;
const exists = (name) => access(new URL(name, dir)).then(() => true, () => false);

const texts = await collectSpeechTexts();
const files = {};
const todo = [];
for (const text of texts) {
  const name = fileFor(text);
  files[text] = name;
  if (!(await exists(name))) todo.push({ text, name });
}

let sent = 0;
const failed = [];
// Chirp 3 HD voices have a per-minute request quota, so requests go out at a steady pace.
const PACE_MS = 450;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function record({ text, name }) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { 'X-Goog-Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: VOICE, audioConfig: { audioEncoding: 'MP3' } }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      sent += text.length;
      await writeFile(new URL(name, dir), Buffer.from(body.audioContent, 'base64'));
      return true;
    }
    if (res.status !== 429 && res.status < 500) {
      failed.push(`"${text}": ${body.error?.message ?? res.status}`);
      return false;
    }
    await sleep(Math.min(60000, 5000 * attempt));
  }
  failed.push(`"${text}": still rate-limited after retries`);
  return false;
}

for (const [i, job] of todo.entries()) {
  const started = Date.now();
  await record(job);
  if ((i + 1) % 50 === 0) console.log(`${i + 1} of ${todo.length}…`);
  await sleep(Math.max(0, PACE_MS - (Date.now() - started)));
}

// Only list lines whose file exists, so the app never asks for audio that failed.
for (const [text, name] of Object.entries(files)) if (!(await exists(name))) delete files[text];

const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'nl')));
await writeFile(new URL('manifest.json', dir), `${JSON.stringify({ voice: VOICE.name, files: sorted })}\n`);

let removed = 0;
if (prune) {
  const keep = new Set(Object.values(files));
  for (const name of await readdir(dir)) {
    if (name.endsWith('.mp3') && !keep.has(name)) {
      await unlink(new URL(name, dir));
      removed++;
    }
  }
}

if (failed.length) console.error(`${failed.length} lines failed; run the script again to retry them:\n  ${failed.slice(0, 10).join('\n  ')}`);
console.log(`${texts.length} lines · ${todo.length - failed.length} recorded now (${sent} characters sent) · ${texts.length - todo.length} already there${prune ? ` · ${removed} old files removed` : ''}`);
