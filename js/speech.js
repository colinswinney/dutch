import { stripMarks, speechKey } from './util.js';
import { store } from './store.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const isDutch = (voice) => /^nl([-_]|$)/i.test(voice.lang ?? '');
const isGoogle = (voice) => /google/i.test(`${voice.name} ${voice.voiceURI}`);
const isNetherlands = (voice) => /^nl[-_]NL/i.test(voice.lang ?? '');
// Apple's joke voices (Grandma, Zarvox and friends) exist in many languages and are useless for learning.
const NOVELTY = /\b(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;

// Google's voice first, then Apple's higher-quality Netherlands voices, then any Netherlands voice, then Belgian Dutch.
function rank(voice) {
  if (isGoogle(voice)) return 0;
  const better = /enhanced|premium|verbeterd|siri/i.test(voice.name) ? 0 : 1;
  return isNetherlands(voice) ? 1 + better : 3 + better;
}

export const hasRecognition = () => Boolean(Recognition);
export const hasRecorder = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export function dutchVoices() {
  if (!synth) return [];
  return synth
    .getVoices()
    .filter((v) => isDutch(v) && !NOVELTY.test(v.name))
    .sort((a, b) => rank(a) - rank(b));
}

/* ---------- Recorded Google audio, made by scripts/make-audio.mjs ---------- */
let recordings = {};
let recordingVoice = '';
const player = new Audio();
player.preload = 'auto';

export async function loadRecordings() {
  try {
    const res = await fetch('audio/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    recordings = data.files ?? {};
    recordingVoice = (data.voice ?? '').split('-').pop();
  } catch {
    // No recordings published: the device voice covers everything.
  }
}

export const hasRecordings = () => Object.keys(recordings).length > 0;
export const recordingVoiceName = () => recordingVoice;
export const hasTts = () => hasRecordings() || dutchVoices().length > 0;

function playRecording(file, slow) {
  stopSpeaking();
  return new Promise((resolve) => {
    const done = () => {
      for (const type of ['ended', 'error', 'pause']) player.removeEventListener(type, done);
      resolve();
    };
    player.src = `audio/${file}`;
    // The speed setting is relative to Normal (0.95), so recordings follow it too.
    const rate = ((store.settings.rate ?? 0.95) / 0.95) * (slow ? 0.7 : 1);
    player.defaultPlaybackRate = rate;
    player.playbackRate = rate;
    player.preservesPitch = true;
    for (const type of ['ended', 'error', 'pause']) player.addEventListener(type, done);
    player
      .play()
      .then(() => {
        lastReport = `Playing the Google recording (${recordingVoice}).`;
      })
      .catch(() => {
        lastReport = 'The browser blocked the sound. Tap Play to hear it.';
        done();
      });
  });
}

// A tiny silent WAV. iOS only lets a page play sound from an audio element that first played during a tap.
function silentWavUrl() {
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

// Voices load asynchronously, and some browsers never fire voiceschanged.
export function voicesReady() {
  if (!synth) return Promise.resolve([]);
  if (dutchVoices().length) return Promise.resolve(dutchVoices());
  return new Promise((resolve) => {
    const done = () => resolve(dutchVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2000);
  });
}

export function onVoicesChanged(callback) {
  synth?.addEventListener('voiceschanged', callback);
}

// Voices that never started this session. iOS lists voices it has not downloaded yet, and those play nothing.
const silentVoices = new Set();
let lastReport = '';
export const lastSpeechReport = () => lastReport;

function voiceQueue() {
  const list = dutchVoices().filter((v) => !silentVoices.has(v.voiceURI));
  const chosen = list.find((v) => v.voiceURI === store.settings.voiceURI);
  return chosen ? [chosen, ...list.filter((v) => v !== chosen)] : list;
}

// iOS stays silent until the page plays sound once inside a tap. Questions auto-play after a delay,
// which is outside the tap, so the first tap plays silence through both the audio element and speech.
{
  const unlock = () => {
    if (synth && !synth.speaking && !synth.pending) synth.speak(new SpeechSynthesisUtterance(''));
    if (player.paused && !player.src) {
      player.src = silentWavUrl();
      player.play().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

export function stopSpeaking() {
  if (!player.paused) player.pause();
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
}

// Plays the Google recording when there is one. Otherwise speaks with the device voice,
// sentence by sentence: Chrome cuts off single utterances that run past about 15 seconds.
// If a voice does not start, the next Dutch voice gets a turn. Network voices such as Google's get longer.
export function speak(text, { slow = false } = {}) {
  const file = recordings[speechKey(text)];
  if (file) return playRecording(file, slow);
  const queue = voiceQueue();
  if (!synth || !queue.length) {
    lastReport = 'No Dutch voice could play.';
    return Promise.resolve();
  }
  // Safari can drop an utterance queued straight after cancel(), so only cancel when something is playing.
  if (synth.speaking || synth.pending) synth.cancel();
  synth.resume();
  const clean = stripMarks(text).replace(/\s*\n+\s*/g, ' ');
  const parts = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
  const rate = (store.settings.rate ?? 0.95) * (slow ? 0.65 : 1);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const attempt = (index) => {
      const voice = queue[index];
      if (!voice) {
        lastReport = 'None of the Dutch voices on this device started playing.';
        finish();
        return;
      }
      let started = false;
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part.trim());
        u.lang = voice.lang;
        u.voice = voice;
        u.rate = rate;
        u.onstart = () => {
          started = true;
          lastReport = `Playing with ${voice.name}.`;
        };
        if (i === parts.length - 1) {
          u.onend = finish;
          u.onerror = finish;
        }
        synth.speak(u);
      });
      setTimeout(() => {
        if (started) return;
        silentVoices.add(voice.voiceURI);
        lastReport = `${voice.name} did not start, so the next voice was tried.`;
        if (synth.speaking || synth.pending) synth.cancel();
        attempt(index + 1);
      }, voice.localService === false ? 4000 : 1500);
    };
    attempt(0);
  });
}

export function recognizeOnce() {
  return new Promise((resolve, reject) => {
    const r = new Recognition();
    r.lang = 'nl-NL';
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (event) => resolve(Array.from(event.results[0], (alt) => alt.transcript));
    r.onerror = (event) => reject(new Error(event.error));
    r.onend = () => resolve([]);
    r.start();
  });
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);
  const finished = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
    };
  });
  recorder.start();
  return {
    stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      return finished;
    },
  };
}
