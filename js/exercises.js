import { h, shuffle, normalize, words, matchWords, levenshtein, stripMarks, marked } from './util.js';
import { hasTts, hasRecognition, hasRecorder, speak, recognizeOnce, startRecording } from './speech.js';
import { store } from './store.js';
import { playRow, dutchLine, miniPlay, icon, flip, announce, furtherReading } from './ui.js';

// Ordered from easiest to hardest. New cards start at the easy end.
const ORDER = ['listen', 'respond', 'build', 'speak', 'dictation'];
const DEFAULT_MODES = ['listen', 'respond', 'build', 'speak', 'dictation'];
const TITLES = {
  listen: 'What does this mean?',
  respond: 'Pick a good reply',
  build: 'Build the sentence in Dutch',
  speak: 'Say it in Dutch',
  dictation: 'Type what you hear',
};

function modesFor(card, lesson) {
  let modes = card.modes ?? lesson.modes ?? DEFAULT_MODES;
  if (!card.reply) modes = modes.filter((m) => m !== 'respond');
  if (words(card.nl).length < 2) modes = modes.filter((m) => m !== 'build');
  if (!hasTts()) modes = modes.filter((m) => m !== 'listen' && m !== 'dictation');
  const ordered = ORDER.filter((m) => modes.includes(m));
  return ordered.length ? ordered : ['speak'];
}

function chooseMode(card, lesson) {
  const modes = modesFor(card, lesson);
  if (lesson.preferredMode && modes.includes(lesson.preferredMode) && Math.random() < 0.6) return lesson.preferredMode;
  const box = store.cardState(card.key)?.box ?? 0;
  const pool = modes.slice(0, Math.min(modes.length, box + 2));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSession(cards, lessonsById, size = 10) {
  const now = Date.now();
  const due = [];
  const fresh = [];
  const later = [];
  for (const card of cards) {
    const s = store.cardState(card.key);
    if (!s) fresh.push(card);
    else if (s.due <= now) due.push({ card, s });
    else later.push({ card, s });
  }
  due.sort((a, b) => a.s.box - b.s.box || a.s.due - b.s.due);
  later.sort((a, b) => a.s.box - b.s.box || a.s.due - b.s.due);
  const chosen = [...due.map((x) => x.card), ...fresh, ...later.map((x) => x.card)].slice(0, size);
  return shuffle(chosen).map((card) => ({ card, mode: chooseMode(card, lessonsById.get(card.lessonId)) }));
}

function distractors(card, pool, get, count) {
  const correct = normalize(get(card));
  const seen = new Set([correct]);
  const same = shuffle(pool.filter((c) => c.lessonId === card.lessonId));
  const other = shuffle(pool.filter((c) => c.lessonId !== card.lessonId));
  const out = [];
  for (const c of [...same, ...other]) {
    const value = get(c);
    if (!value) continue;
    const key = normalize(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length === count) break;
  }
  return out;
}

// The rule behind a card, with its full grammar note folded away so the round keeps flowing.
let lessonsById = new Map();
export function setLessons(map) {
  lessonsById = map;
}

// A card's "note" is a note id in its own lesson, or "lesson-id/note-id" for a rule taught in another lesson.
function findNote(ref, lesson) {
  if (!ref) return null;
  const [lessonId, noteId] = ref.includes('/') ? ref.split('/') : [lesson?.id, ref];
  const owner = lessonId === lesson?.id ? lesson : lessonsById.get(lessonId);
  const note = owner?.notes?.find((n) => n.id === noteId);
  return note ? { note, owner } : null;
}

function ruleBlock(card, lesson) {
  const found = findNote(card.note, lesson);
  const note = found?.note;
  if (!card.rule && !note) return null;
  return h(
    'div',
    { class: 'rule' },
    card.rule ? h('p', {}, h('strong', {}, 'Rule: '), card.rule) : null,
    note
      ? h(
          'details',
          { class: 'explain' },
          h('summary', {}, 'Explain this rule'),
          h(
            'div',
            { class: 'explain-body' },
            h('p', { class: 'explain-title' }, note.title),
            (note.body ?? []).map((p) => h('p', {}, marked(p))),
            note.examples?.length
              ? h(
                  'ul',
                  { class: 'examples' },
                  note.examples.map((ex) =>
                    h(
                      'li',
                      { class: 'line' },
                      miniPlay(stripMarks(ex.nl)),
                      h('div', { class: 'line-text' }, h('span', { class: 'nl', lang: 'nl' }, marked(ex.nl)), h('span', { class: 'en' }, ex.en)),
                    ),
                  ),
                )
              : null,
            furtherReading(note.links),
            h('p', { class: 'note' }, h('a', { href: `#/lesson/${found.owner.id}/${note.id}` }, found.owner === lesson ? 'Open this rule in the lesson' : `Open this rule in “${found.owner.title}”`), ' (ends this round)'),
          ),
        )
      : null,
  );
}

function heading(mode) {
  return h('h2', { class: 'q-title', tabindex: '-1' }, TITLES[mode]);
}

function markOptions(buttons, rightText, chosen) {
  for (const b of buttons) {
    b.disabled = true;
    const isRight = b.dataset.value === rightText;
    if (isRight) {
      b.classList.add('is-right');
      b.append(icon('check'), h('span', { class: 'visually-hidden' }, ' (correct answer)'));
    } else if (b === chosen) {
      b.classList.add('is-wrong');
      b.append(icon('cross'), h('span', { class: 'visually-hidden' }, ' (your answer)'));
    } else b.classList.add('is-faded');
  }
}

function optionButtons(values, onPick, lang) {
  const buttons = values.map((value) =>
    h('button', { type: 'button', class: 'option', lang, 'data-value': value }, h('span', {}, value)),
  );
  buttons.forEach((b) => b.addEventListener('click', () => onPick(b)));
  return buttons;
}

/* ---------- Listen and choose the meaning ---------- */
function listen(card, { pool, finish, lesson }) {
  const values = shuffle([card.en, ...distractors(card, pool, (c) => c.en, 3)]);
  const buttons = optionButtons(values, (chosen) => {
    const correct = chosen.dataset.value === card.en;
    markOptions(buttons, card.en, chosen);
    finish(correct, { detail: [dutchLine(card.nl, card.en, card.who), ruleBlock(card, lesson)], say: correct ? '' : `The answer is: ${card.en}` });
  });
  setTimeout(() => speak(card.nl), 250);
  return h('div', {}, heading('listen'), playRow(card.nl), h('div', { class: 'options' }, buttons));
}

/* ---------- Hear a line, choose the reply ---------- */
function respond(card, { pool, finish }) {
  const replyPool = pool.filter((c) => c.reply);
  const values = shuffle([card.reply.nl, ...distractors(card, replyPool, (c) => c.reply?.nl, 3)]);
  const reveal = h('p', { class: 'reveal-nl', lang: 'nl', hidden: true }, card.nl);
  const showBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Show the words');
  showBtn.addEventListener('click', () => {
    reveal.hidden = false;
    showBtn.remove();
  });
  const buttons = optionButtons(values, (chosen) => {
    const correct = chosen.dataset.value === card.reply.nl;
    markOptions(buttons, card.reply.nl, chosen);
    reveal.hidden = false;
    showBtn.remove();
    finish(correct, {
      detail: [dutchLine(card.nl, card.en, card.who), dutchLine(card.reply.nl, card.reply.en, 'Reply')],
      say: correct ? '' : `A good reply is: ${card.reply.nl}`,
    });
  }, 'nl');
  setTimeout(() => speak(card.nl), 250);
  return h(
    'div',
    {},
    heading('respond'),
    h('p', { class: 'note' }, `${card.who ?? 'Someone'} says:`),
    hasTts() ? playRow(card.nl) : null,
    hasTts() ? h('div', { class: 'row' }, showBtn) : null,
    hasTts() ? reveal : h('p', { class: 'reveal-nl', lang: 'nl' }, card.nl),
    h('div', { class: 'options' }, buttons),
  );
}

/* ---------- Build the sentence from word tiles ---------- */
export function tilesFor(card) {
  const tokens = stripMarks(card.nl)
    .split(/\s+/)
    .map((w) => w.replace(/^[¿¡"“'(]+|[.,!?;:"”)]+$/g, ''))
    .filter(Boolean);
  if (!card.keepCase && tokens.length) tokens[0] = tokens[0].charAt(0).toLowerCase() + tokens[0].slice(1);
  return tokens;
}

function build(card, { finish, lesson }) {
  const tokens = tilesFor(card);
  let order = shuffle(tokens.map((word, id) => ({ word, id })));
  // Never start with the tiles already in the right order.
  for (let tries = 0; tries < 5 && order.map((t) => t.word).join(' ') === tokens.join(' ') && tokens.length > 1; tries++) {
    order = shuffle(order);
  }
  const answer = h('div', { class: 'answer-row', role: 'group', 'aria-label': 'Your sentence' });
  const bank = h('div', { class: 'bank', role: 'group', 'aria-label': 'Words to use' });
  const hint = h('p', { class: 'note', 'aria-live': 'polite' });
  const allTiles = () => [...answer.children, ...bank.children];

  const makeTile = ({ word, id }) => {
    const tile = h('button', { type: 'button', class: 'tile', lang: 'nl', 'data-id': id }, word);
    tile.addEventListener('click', () => moveTile(tile));
    return tile;
  };

  function moveTile(tile) {
    if (checked) return;
    const from = tile.parentElement;
    const to = from === bank ? answer : bank;
    const siblings = [...from.children];
    const index = siblings.indexOf(tile);
    flip(allTiles, () => to.append(tile));
    hint.textContent = '';
    const nextFocus = from.children[index] ?? from.children[index - 1] ?? (from === bank ? checkBtn : bank.lastElementChild);
    nextFocus?.focus();
  }

  order.forEach((t) => bank.append(makeTile(t)));

  let checked = false;
  const checkBtn = h('button', { type: 'button', class: 'btn btn-big' }, 'Check');
  const clearBtn = h('button', { type: 'button', class: 'btn btn-quiet btn-big' }, 'Start over');
  clearBtn.addEventListener('click', () => {
    flip(allTiles, () => [...answer.children].forEach((t) => bank.append(t)));
    bank.firstElementChild?.focus();
  });
  checkBtn.addEventListener('click', () => {
    if (bank.children.length) {
      hint.textContent = 'Use all the words first.';
      return;
    }
    checked = true;
    const built = [...answer.children].map((t) => t.textContent).join(' ');
    const targets = [card.nl, ...(card.alts ?? [])].map(normalize);
    const correct = targets.includes(normalize(built));
    allTiles().forEach((t) => (t.disabled = true));
    actions.remove();
    speak(card.nl);
    const detail = [];
    if (!correct) detail.push(h('p', {}, 'You built: ', h('span', { lang: 'nl' }, built)));
    detail.push(dutchLine(card.nl, card.en));
    if (card.alts?.length) detail.push(h('p', { class: 'note' }, 'Also correct: ', h('span', { lang: 'nl' }, card.alts.join(' / '))));
    detail.push(ruleBlock(card, lesson));
    finish(correct, { detail, say: correct ? '' : `The answer is: ${card.nl}` });
  });
  const actions = h('div', { class: 'actions' }, clearBtn, checkBtn);

  return h(
    'div',
    {},
    heading('build'),
    h('p', { class: 'prompt' }, card.en),
    h('p', { class: 'tiles-label', 'aria-hidden': 'true' }, 'Your sentence'),
    answer,
    h('p', { class: 'tiles-label', 'aria-hidden': 'true' }, 'Words'),
    bank,
    hint,
    actions,
  );
}

/* ---------- Dictation ---------- */
function diffLine(target, typed) {
  const parts = matchWords(target, typed);
  const original = stripMarks(target).split(/\s+/);
  return h(
    'p',
    { class: 'diff', lang: 'nl' },
    original.flatMap((word, i) => {
      const miss = parts[i] && !parts[i].hit;
      const node = miss ? h('mark', { class: 'miss' }, word, h('span', { class: 'visually-hidden' }, ' (missed)')) : word;
      return i ? [' ', node] : [node];
    }),
  );
}

function dictation(card, { finish, lesson }) {
  const id = `dict-${Math.random().toString(36).slice(2)}`;
  const input = h('input', {
    id,
    class: 'input',
    type: 'text',
    lang: 'nl',
    autocomplete: 'off',
    autocapitalize: 'sentences',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  });
  const form = h('form', { class: 'stack' });
  const giveUp = h('button', { type: 'button', class: 'btn btn-quiet btn-big' }, 'Show me');
  const check = h('button', { type: 'submit', class: 'btn btn-big' }, 'Check');
  const actions = h('div', { class: 'actions' }, giveUp, check);

  function done(typed) {
    input.readOnly = true;
    actions.remove();
    const a = normalize(typed);
    const b = normalize(card.nl);
    const exact = a === b;
    const close = !exact && a.length > 6 && levenshtein(a, b) <= Math.max(1, Math.floor(b.length / 25));
    const correct = exact || close;
    const detail = [];
    if (close) detail.push(h('p', {}, 'Almost perfect. Check the spelling:'));
    if (!exact && typed.trim()) detail.push(h('p', {}, 'You typed: ', h('span', { lang: 'nl' }, typed)));
    detail.push(typed.trim() && !exact ? diffLine(card.nl, typed) : null, dutchLine(card.nl, card.en), ruleBlock(card, lesson));
    finish(correct, { detail, say: correct ? '' : `The sentence was: ${card.nl}` });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.focus();
      return;
    }
    done(input.value);
  });
  giveUp.addEventListener('click', () => done(''));
  form.append(h('div', { class: 'field' }, h('label', { for: id }, 'Dutch sentence'), input), actions);
  setTimeout(() => speak(card.nl), 250);
  return h('div', {}, heading('dictation'), playRow(card.nl), form);
}

/* ---------- Speak: record yourself and compare ---------- */
function speakMode(card, { finish, lesson }) {
  const tools = h('div', { class: 'speak-tools' });
  const output = h('div', { class: 'stack' });
  const revealArea = h('div', { class: 'stack' });
  let recording = null;
  let audioUrl = null;

  if (hasRecorder()) {
    const recBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, icon('mic'), 'Record yourself');
    recBtn.addEventListener('click', async () => {
      if (recording) {
        const url = await recording.stop();
        recording = null;
        recBtn.classList.remove('is-recording');
        recBtn.replaceChildren(icon('mic'), 'Record again');
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = url;
        output.replaceChildren(h('p', { class: 'note' }, 'Your recording:'), h('audio', { controls: true, src: url }));
        return;
      }
      try {
        recording = await startRecording();
        recBtn.classList.add('is-recording');
        recBtn.replaceChildren(icon('stop'), 'Stop recording');
      } catch {
        output.replaceChildren(h('p', { class: 'note' }, 'Microphone access was blocked. Allow it in your browser settings to record.'));
      }
    });
    tools.append(recBtn);
  }

  if (hasRecognition()) {
    const recogBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Check my Dutch');
    recogBtn.addEventListener('click', async () => {
      recogBtn.disabled = true;
      recogBtn.textContent = 'Listening…';
      try {
        const results = await recognizeOnce();
        const best = results
          .map((text) => ({ text, parts: matchWords(card.nl, text) }))
          .sort((x, y) => y.parts.filter((p) => p.hit).length - x.parts.filter((p) => p.hit).length)[0];
        if (!best) {
          output.replaceChildren(h('p', { class: 'note' }, 'I did not catch that. Try again a bit closer to the microphone.'));
        } else {
          const hits = best.parts.filter((p) => p.hit).length;
          const ratio = hits / best.parts.length;
          const message = ratio >= 0.85 ? 'That sounds right!' : ratio >= 0.5 ? 'Close. Some words were not clear.' : 'Not quite yet. Listen to the answer and try again.';
          output.replaceChildren(
            h('p', { class: 'heard' }, 'The browser heard: ', h('span', { lang: 'nl' }, `“${best.text}”`)),
            h('p', {}, h('strong', {}, message), ` ${hits} of ${best.parts.length} words matched.`),
          );
          announce(`${message} ${hits} of ${best.parts.length} words matched.`);
        }
      } catch (error) {
        output.replaceChildren(h('p', { class: 'note' }, `Speech recognition stopped: ${error.message}.`));
      }
      recogBtn.disabled = false;
      recogBtn.textContent = 'Check my Dutch';
    });
    tools.append(recogBtn);
  }

  const showBtn = h('button', { type: 'button', class: 'btn btn-big' }, 'Show the answer');
  const actions = h('div', { class: 'actions' }, showBtn);
  showBtn.addEventListener('click', () => {
    speak(card.nl);
    const yes = h('button', { type: 'button', class: 'btn btn-big' }, icon('check'), 'I got it');
    const no = h('button', { type: 'button', class: 'btn btn-quiet btn-big' }, 'Not yet');
    revealArea.replaceChildren(h('h3', {}, 'Answer'), dutchLine(card.nl, card.en));
    actions.replaceChildren(no, yes);
    const grade = (correct) => {
      actions.remove();
      finish(correct, { detail: [ruleBlock(card, lesson)], say: '' });
    };
    yes.addEventListener('click', () => grade(true));
    no.addEventListener('click', () => grade(false));
    revealArea.querySelector('h3').setAttribute('tabindex', '-1');
    revealArea.querySelector('h3').focus();
  });

  return h(
    'div',
    {},
    heading('speak'),
    h('p', { class: 'prompt' }, card.en),
    h('p', { class: 'note' }, 'Say it out loud first. Then record yourself, or let the browser check you.'),
    tools,
    output,
    revealArea,
    actions,
  );
}

const RENDER = { listen, respond, build, speak: speakMode, dictation };

export function renderExercise(item, ctx) {
  return RENDER[item.mode](item.card, ctx);
}
