import { h, marked, stripMarks, slug, localDayNumber } from './util.js';
import { store } from './store.js';
import { hasTts, hasRecordings, recordingVoiceName, loadRecordings, dutchVoices, voicesReady, onVoicesChanged, speak, stopSpeaking, lastSpeechReport } from './speech.js';
import { buildSession, renderExercise, setLessons } from './exercises.js';
import { DRILLS } from './drills.js';
import { PROMPTS, checkDutch } from './journal.js';
import { icon, playRow, miniPlay, dutchLine, withTransition, announce, furtherReading } from './ui.js';

const main = document.getElementById('main');
const lessons = [];
const lessonsById = new Map();
let allCards = [];
let firstRender = true;

async function loadLessons() {
  const index = await fetch('lessons/index.json').then((r) => r.json());
  const loaded = await Promise.all(index.lessons.map((id) => fetch(`lessons/${id}.json`).then((r) => r.json())));
  for (const lesson of loaded) {
    for (const card of lesson.cards) {
      card.id ??= slug(card.nl);
      card.key = `${lesson.id}/${card.id}`;
      card.lessonId = lesson.id;
    }
    lessons.push(lesson);
    lessonsById.set(lesson.id, lesson);
  }
  allCards = lessons.flatMap((l) => l.cards);
  setLessons(lessonsById);
}

/* ---------- Rendering helpers ---------- */
// focusSelector lets a route land on a section, such as one grammar note, instead of the page top.
function render(title, nodes, focusSelector = null) {
  stopSpeaking();
  const update = () => {
    main.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
    document.title = title ? `${title} · Dutch practice` : 'Dutch practice';
    updateHeader();
    const target = focusSelector && main.querySelector(focusSelector);
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0 });
      if (!firstRender) main.querySelector('h1')?.focus({ preventScroll: true });
    }
    firstRender = false;
  };
  if (firstRender) update();
  else withTransition(update);
}

function pageTitle(text, nl) {
  return h('h1', { tabindex: '-1', lang: nl ? 'nl' : null }, text);
}

function updateHeader() {
  const who = document.getElementById('who');
  who.replaceChildren(
    store.current ? h('span', { class: 'who-chip' }, h('span', { class: 'visually-hidden' }, 'Practising as '), store.current) : '',
  );
}

const backLink = (href, text) => h('a', { class: 'back', href }, icon('back'), text);

function requireProfile() {
  if (store.current) return true;
  render('Choose who is practising', [
    pageTitle('Who is practising?'),
    h('p', {}, 'Add your name on the home page first, so your progress is saved for you.'),
    h('p', {}, h('a', { class: 'btn', href: '#/' }, 'Go to the home page')),
  ]);
  return false;
}

/* ---------- Home ---------- */
function profileSection() {
  const list = h(
    'div',
    { class: 'profiles' },
    store.profiles.map((name) =>
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet',
          'aria-pressed': String(name === store.current),
          onClick: () => {
            store.setCurrent(name);
            announce(`Practising as ${name}`);
            showHome();
          },
        },
        name,
      ),
    ),
  );
  const input = h('input', {
    id: 'new-profile',
    class: 'input',
    type: 'text',
    autocomplete: 'given-name',
    enterkeyhint: 'done',
    maxlength: '30',
    required: true,
  });
  const form = h(
    'form',
    { class: 'add-profile' },
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'new-profile' }, store.profiles.length ? 'Add another person' : 'Your first name'),
      input,
    ),
    h('button', { type: 'submit', class: 'btn' }, 'Add'),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (store.addProfile(input.value)) {
      announce(`Added ${store.current}`);
      showHome();
    }
  });
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'who-heading' },
    h('h2', { id: 'who-heading', style: 'margin-top:0' }, 'Who is practising?'),
    store.profiles.length ? h('p', { class: 'note', style: 'margin:0' }, 'Each person has their own progress on this device.') : null,
    store.profiles.length ? list : h('p', {}, 'Add your name to start. Each person gets their own progress.'),
    form,
  );
}

function dailyPhrase() {
  const cards = allCards.filter((c) => !c.noDaily);
  const card = cards[localDayNumber() % cards.length];
  return h(
    'section',
    { class: 'card daily', 'aria-labelledby': 'daily-heading' },
    h('span', { class: 'eyebrow', id: 'daily-heading' }, 'Phrase of the day'),
    dutchLine(card.nl, card.en),
    h('p', { class: 'note', style: 'margin-bottom:0' }, 'Use it out loud today: at the shop, at the school gate, or at home.'),
  );
}

function lessonTile(lesson) {
  const s = store.stats(lesson.cards);
  return h(
    'li',
    {},
    h(
      'a',
      { class: 'lesson-link', href: `#/lesson/${lesson.id}` },
      h('span', { class: 'eyebrow', style: 'margin:0' }, lesson.level),
      h('span', { class: 't-nl', lang: 'nl' }, lesson.titleNl),
      h('span', { class: 't-en' }, lesson.title),
      store.current
        ? [
            h('span', { class: 'meter', 'aria-hidden': 'true' }, h('span', { style: `--p:${s.learned / s.total}` })),
            h(
              'span',
              { class: 'meta' },
              h('span', {}, `${s.learned} of ${s.total} learned`),
              s.due ? h('span', { class: 'pill' }, `${s.due} to review`) : null,
            ),
          ]
        : h('span', { class: 'meta' }, `${lesson.cards.length} phrases`),
    ),
  );
}

async function voiceWarning(slot) {
  await voicesReady();
  if (hasTts()) return;
  slot.replaceChildren(
    h(
      'div',
      { class: 'card', role: 'note' },
      h('h2', { style: 'margin-top:0' }, 'Add a Dutch voice to hear the audio'),
      h('p', {}, 'This device has no Dutch voice, so listening and dictation exercises are switched off for now.'),
      h(
        'ul',
        {},
        h('li', {}, 'iPhone: Settings → Accessibility → Spoken Content → Voices → Dutch → download “Xander (Enhanced)”.'),
        h('li', {}, 'Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Dutch.'),
        h('li', {}, 'Android: Settings → search “Text-to-speech” → Speech Services by Google → install Dutch.'),
      ),
      h('p', { class: 'note' }, 'Then reload this page.'),
    ),
  );
}

// Groups keep the order of lessons/index.json: a group appears where its first lesson is listed.
function lessonGroups() {
  const groups = new Map();
  for (const lesson of lessons) {
    const group = lesson.group ?? 'Lessons';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(lesson);
  }
  return [...groups];
}

function showHome() {
  const warning = h('div');
  const stats = store.current ? store.stats(allCards) : null;
  render('', [
    h('span', { class: 'eyebrow' }, 'Nederlands · A1 → A2'),
    pageTitle('Dutch for everyday life'),
    h('p', { class: 'lede' }, 'Short daily practice for the shop, the restaurant, the school gate and after-school clubs.'),
    warning,
    profileSection(),
    store.current
      ? [
          h(
            'div',
            { class: 'stack', style: 'margin-top:1.25rem' },
            h(
              'a',
              { class: 'btn btn-big btn-block', href: '#/practice/all' },
              stats.due ? `Daily practice · ${stats.due} to review` : 'Daily practice',
              icon('arrow'),
            ),
            dailyPhrase(),
          ),
        ]
      : null,
    lessonGroups().map(([group, list]) => [
      h('h2', {}, group),
      h('ul', { class: 'lesson-list' }, list.map(lessonTile), group === 'Reading and writing' ? diaryTile() : null),
    ]),
    h('h2', {}, 'Listening drills'),
    h('p', { class: 'note' }, 'Numbers, prices and times come fast. These drills make up new ones every time.'),
    h(
      'ul',
      { class: 'lesson-list' },
      Object.entries(DRILLS).map(([id, d]) =>
        h(
          'li',
          {},
          h(
            'a',
            { class: 'lesson-link', href: `#/drill/${id}` },
            h('span', { class: 't-nl', lang: 'nl' }, d.titleNl),
            h('span', { class: 't-en' }, d.title),
          ),
        ),
      ),
    ),
  ]);
  voiceWarning(warning);
}

/* ---------- Lesson ---------- */
function showLesson(id, noteId) {
  const lesson = lessonsById.get(id);
  if (!lesson) return showNotFound();
  const s = store.current ? store.stats(lesson.cards) : null;
  render(
    lesson.titleNl,
    [
      backLink('#/', 'All lessons'),
      h('span', { class: 'eyebrow' }, `${lesson.level} · ${lesson.cards.length} phrases`),
      pageTitle(lesson.titleNl, true),
      h('p', { class: 'lede' }, lesson.title),
      h('p', {}, lesson.intro),
      h(
        'div',
        { class: 'stack' },
        h('a', { class: 'btn btn-big btn-block', href: `#/practice/${lesson.id}` }, 'Practise this lesson', icon('arrow')),
        s ? h('p', { class: 'note', style: 'margin:0.5rem 0 0' }, `${s.learned} learned · ${s.due} to review · ${s.fresh} new`) : null,
      ),
      lesson.readings?.length
        ? [
            h('h2', {}, 'Reading practice'),
            h(
              'ul',
              { class: 'lesson-list' },
              lesson.readings.map((r) =>
                h(
                  'li',
                  {},
                  h(
                    'a',
                    { class: 'lesson-link', href: `#/read/${lesson.id}/${r.id}` },
                    h('span', { class: 'eyebrow', style: 'margin:0' }, r.kind),
                    h('span', { class: 't-nl', lang: 'nl' }, r.title),
                    h('span', { class: 't-en' }, `${r.questions.length} questions`),
                  ),
                ),
              ),
            ),
          ]
        : null,
      lesson.notes?.length
        ? [
            h('h2', {}, 'How it works'),
            lesson.notes.map((note) =>
              h(
                'section',
                { class: 'card', id: note.id ? `note-${note.id}` : null },
                h('h3', { tabindex: '-1' }, note.title),
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
                          h(
                            'div',
                            { class: 'line-text' },
                            h('span', { class: 'nl', lang: 'nl' }, marked(ex.nl)),
                            h('span', { class: 'en' }, ex.en),
                          ),
                        ),
                      ),
                    )
                  : null,
                furtherReading(note.links),
              ),
            ),
          ]
        : null,
      h('h2', {}, 'Phrases'),
      h(
        'section',
        { class: 'card', 'aria-label': 'Phrases in this lesson' },
        h(
          'ul',
          { class: 'phrase-list' },
          lesson.cards.map((card) =>
            h(
              'li',
              {},
              dutchLine(card.nl, card.en, card.who),
              card.reply ? h('div', { class: 'reply' }, dutchLine(card.reply.nl, card.reply.en, 'Reply')) : null,
            ),
          ),
        ),
      ),
    ],
    noteId ? `#note-${CSS.escape(noteId)} h3` : null,
  );
}

/* ---------- Runner shared by practice sessions and drills ---------- */
function runner({ title, nl, back, items, renderItem, onFirstResult, extra = null }) {
  const queue = [...items];
  const retried = new Set();
  const firstTry = new Map();
  let index = 0;

  const bar = h('span', { style: '--p:0' });
  const progress = h('progress', { class: 'visually-hidden', max: String(items.length), value: '0' }, '');
  const count = h('span', { class: 'count' });
  const stage = h('div', { class: 'stage' });

  function updateProgress() {
    const done = firstTry.size;
    bar.style.setProperty('--p', String(done / items.length));
    progress.value = done;
    progress.textContent = `${done} of ${items.length}`;
    count.textContent = `${Math.min(done + 1, items.length)} / ${items.length}`;
  }

  function finish(item, correct, { detail = [], say = '' } = {}) {
    if (!firstTry.has(item)) {
      firstTry.set(item, correct);
      onFirstResult?.(item, correct);
    }
    const comesBack = !correct && !retried.has(item);
    if (comesBack) {
      retried.add(item);
      queue.push(item);
    }
    updateProgress();
    const nextBtn = h('button', { type: 'button', class: 'btn btn-big' }, index + 1 < queue.length ? 'Next' : 'See results', icon('arrow'));
    nextBtn.addEventListener('click', () => {
      index++;
      withTransition(show);
    });
    stage.append(
      h(
        'div',
        { class: `feedback ${correct ? 'ok' : 'bad'}` },
        h('p', { class: 'verdict' }, icon(correct ? 'check' : 'cross'), correct ? 'Goed zo!' : 'Not quite'),
        detail,
        comesBack ? h('p', { class: 'note' }, 'This one comes back at the end of the round.') : null,
      ),
      h('div', { class: 'actions' }, nextBtn),
    );
    announce(correct ? 'Correct. Goed zo!' : `Not quite. ${say}`);
    nextBtn.focus({ preventScroll: true });
    nextBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function show() {
    stopSpeaking();
    if (index >= queue.length) return summary();
    updateProgress();
    const item = queue[index];
    stage.replaceChildren(renderItem(item, (correct, info) => finish(item, correct, info)));
    stage.querySelector('h2')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function summary() {
    const right = [...firstTry.values()].filter(Boolean).length;
    const missed = items.filter((item) => firstTry.get(item) === false);
    bar.style.setProperty('--p', '1');
    stage.replaceChildren(
      h(
        'div',
        { class: 'results' },
        h('h2', { tabindex: '-1', class: 'q-title' }, right === items.length ? 'Perfect round!' : 'Round finished'),
        h('p', { class: 'result-score' }, `${right}/${items.length}`),
        h('p', {}, 'Right on the first try.'),
        missed.length
          ? h(
              'section',
              { class: 'card' },
              h('h3', {}, 'Worth another look'),
              h(
                'ul',
                { class: 'phrase-list' },
                missed.map((item) => h('li', {}, item.card ? dutchLine(item.card.nl, item.card.en) : dutchLine(item.say, item.answer))),
              ),
            )
          : h('p', {}, 'Nothing missed. Lekker bezig!'),
        h(
          'div',
          { class: 'actions' },
          h('a', { class: 'btn btn-quiet btn-big', href: back.href }, back.text),
          h('button', { type: 'button', class: 'btn btn-big', onClick: () => route() }, 'Another round'),
        ),
      ),
    );
    announce(`Round finished. ${right} of ${items.length} right on the first try.`);
    stage.querySelector('h2').focus({ preventScroll: true });
  }

  render(title, [
    backLink(back.href, back.text),
    pageTitle(title, nl),
    extra,
    h('div', { class: 'progress-wrap' }, h('div', { class: 'progress-bar', 'aria-hidden': 'true' }, bar), progress, count),
    stage,
  ]);
  show();
}

/* ---------- Practice ---------- */
function showPractice(id) {
  if (!requireProfile()) return;
  const lesson = id === 'all' ? null : lessonsById.get(id);
  if (id !== 'all' && !lesson) return showNotFound();
  const cards = lesson ? lesson.cards : allCards;
  const items = buildSession(cards, lessonsById, 10);
  runner({
    title: lesson ? lesson.titleNl : 'Daily practice',
    nl: Boolean(lesson),
    back: lesson ? { href: `#/lesson/${lesson.id}`, text: 'Back to the lesson' } : { href: '#/', text: 'Home' },
    items,
    renderItem: (item, finish) => renderExercise(item, { pool: allCards, finish, lesson: lessonsById.get(item.card.lessonId) }),
    onFirstResult: (item, correct) => store.record(item.card.key, correct),
  });
}

/* ---------- Drills ---------- */
function showDrill(id) {
  const drill = DRILLS[id];
  if (!drill) return showNotFound();
  const items = Array.from({ length: 10 }, () => drill.make());
  runner({
    title: drill.titleNl,
    extra: h('details', { class: 'drill-reading' }, h('summary', {}, 'How this works'), h('p', {}, drill.intro), furtherReading(drill.links)),
    nl: true,
    back: { href: '#/', text: 'Home' },
    items,
    renderItem: (item, finish) => {
      // Without a Dutch voice, the drill shows the Dutch words so it still works as reading practice.
      const prompt = hasTts() ? playRow(item.say) : h('p', { class: 'prompt', lang: 'nl' }, item.say);
      const reveal = () => dutchLine(item.say, item.answer);
      setTimeout(() => speak(item.say), 250);
      if (drill.kind === 'choice') {
        const buttons = item.options.map((value) =>
          h('button', { type: 'button', class: 'option', 'data-value': value }, h('span', {}, value)),
        );
        buttons.forEach((b) =>
          b.addEventListener('click', () => {
            const correct = b.dataset.value === item.answer;
            buttons.forEach((x) => {
              x.disabled = true;
              if (x.dataset.value === item.answer) x.classList.add('is-right'), x.append(icon('check'));
              else if (x === b) x.classList.add('is-wrong'), x.append(icon('cross'));
              else x.classList.add('is-faded');
            });
            finish(correct, { detail: [reveal()], say: `It was ${item.answer}` });
          }),
        );
        return h(
          'div',
          {},
          h('h2', { class: 'q-title', tabindex: '-1' }, 'What time is it?'),
          prompt,
          h('div', { class: 'options' }, buttons),
        );
      }
      const fieldId = `drill-${Math.random().toString(36).slice(2)}`;
      const input = h('input', {
        id: fieldId,
        class: 'input',
        type: 'text',
        inputmode: drill.inputmode,
        autocomplete: 'off',
        enterkeyhint: 'done',
      });
      const check = h('button', { type: 'submit', class: 'btn btn-big' }, 'Check');
      const actions = h('div', { class: 'actions' }, check);
      const form = h('form', { class: 'stack' }, h('div', { class: 'field' }, h('label', { for: fieldId }, drill.label), input), actions);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!input.value.trim()) return input.focus();
        input.readOnly = true;
        actions.remove();
        finish(item.check(input.value), { detail: [reveal()], say: `It was ${item.answer}` });
      });
      return h('div', {}, h('h2', { class: 'q-title', tabindex: '-1' }, hasTts() ? 'Type what you hear' : 'Type the number'), prompt, form);
    },
  });
}

/* ---------- Reading ---------- */
function showReading(lessonId, readingId) {
  const lesson = lessonsById.get(lessonId);
  const reading = lesson?.readings?.find((r) => r.id === readingId);
  if (!reading) return showNotFound();
  const fullText = reading.text.join('\n');
  const groups = reading.questions.map((q, qi) => {
    const name = `q${qi}`;
    const result = h('p', { class: 'q-result', 'aria-live': 'polite' });
    const choices = q.options.map((opt, oi) =>
      h('label', { class: 'choice' }, h('input', { type: 'radio', name, value: String(oi) }), h('span', {}, opt)),
    );
    return { q, result, choices, el: h('fieldset', {}, h('legend', {}, `${qi + 1}. ${q.q}`), choices, result) };
  });
  const form = h(
    'form',
    {},
    groups.map((g) => g.el),
  );
  const submit = h('button', { type: 'submit', class: 'btn btn-big' }, 'Check my answers');
  const score = h('p', { class: 'result-score', hidden: true });
  form.append(h('div', { class: 'actions' }, submit));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let right = 0;
    for (const g of groups) {
      const chosen = form.querySelector(`input[name="${g.choices[0].querySelector('input').name}"]:checked`);
      const ok = chosen && Number(chosen.value) === g.q.answer;
      if (ok) right++;
      g.choices.forEach((label, i) => {
        label.classList.toggle('is-right', i === g.q.answer);
        label.classList.toggle('is-wrong', Boolean(chosen) && Number(chosen.value) === i && !ok);
      });
      g.result.textContent = ok ? '✓ Correct' : `✗ The answer is: ${g.q.options[g.q.answer]}`;
    }
    score.hidden = false;
    score.textContent = `${right}/${groups.length}`;
    announce(`${right} of ${groups.length} correct.`);
  });

  render(reading.title, [
    backLink(`#/lesson/${lesson.id}`, lesson.titleNl),
    h('span', { class: 'eyebrow' }, reading.kind),
    pageTitle(reading.title, true),
    h(
      'section',
      { class: 'card' },
      hasTts() ? playRow(fullText, { autoLabel: 'Read it to me' }) : null,
      h(
        'div',
        { class: 'reading-text', lang: 'nl' },
        reading.text.map((p) => h('p', {}, p)),
      ),
      reading.glossary?.length
        ? h(
            'details',
            {},
            h('summary', {}, 'Word list'),
            h(
              'dl',
              { class: 'glossary' },
              reading.glossary.flatMap((g) => [h('dt', { lang: 'nl' }, g.nl), h('dd', {}, g.en)]),
            ),
          )
        : null,
      reading.translation?.length
        ? h(
            'details',
            {},
            h('summary', {}, 'English translation'),
            reading.translation.map((p) => h('p', {}, p)),
          )
        : null,
    ),
    h('h2', {}, 'Questions'),
    score,
    form,
  ]);
}

/* ---------- Diary ---------- */
function diaryTile() {
  const count = store.current ? store.entries().length : 0;
  return h(
    'li',
    {},
    h(
      'a',
      { class: 'lesson-link', href: '#/write' },
      h('span', { class: 'eyebrow', style: 'margin:0' }, 'Writing'),
      h('span', { class: 't-nl', lang: 'nl' }, 'Dagboek'),
      h('span', { class: 't-en' }, 'Write a few sentences, then check them'),
      count ? h('span', { class: 'meta' }, `${count} ${count === 1 ? 'entry' : 'entries'}`) : null,
    ),
  );
}

function markMatch(sentence, match) {
  const at = sentence.toLowerCase().indexOf(match.toLowerCase());
  if (at < 0) return sentence;
  return [sentence.slice(0, at), h('mark', {}, sentence.slice(at, at + match.length)), sentence.slice(at + match.length)];
}

function findingsList(text) {
  const findings = checkDutch(text);
  if (!findings.length) {
    return h(
      'p',
      {},
      'No common mistakes found. The checker only looks for a few patterns, so a teacher may still spot things.',
    );
  }
  return h(
    'ol',
    { class: 'findings' },
    findings.map((f) =>
      h(
        'li',
        {},
        h('p', { class: 'finding-title' }, f.title),
        h('p', { class: 'finding-text', lang: 'nl' }, markMatch(f.sentence, f.match)),
        h('p', {}, f.explain),
        f.link ? h('p', { class: 'note' }, h('a', { href: f.link }, 'Explain this rule')) : null,
      ),
    ),
  );
}

const dutchDate = (time) => new Date(time).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

function entryItem(entry, refresh) {
  const results = h('div', { class: 'stack' });
  const check = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Check this entry');
  check.addEventListener('click', () => {
    results.replaceChildren(findingsList(entry.text));
    announce(`${checkDutch(entry.text).length} things to check`);
  });
  const slot = h('div', { class: 'row' });
  const remove = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Delete');
  remove.addEventListener('click', () => {
    const yes = h('button', { type: 'button', class: 'btn btn-danger' }, 'Yes, delete it');
    const no = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Keep');
    yes.addEventListener('click', () => {
      store.removeEntry(entry.id);
      announce('Entry deleted');
      refresh();
    });
    no.addEventListener('click', () => {
      slot.replaceChildren(remove);
      remove.focus();
    });
    slot.replaceChildren(yes, no);
    no.focus();
  });
  slot.append(remove);
  return h(
    'li',
    {},
    h(
      'details',
      { class: 'entry' },
      h('summary', { lang: 'nl' }, dutchDate(entry.date)),
      h('div', { class: 'stack' }, h('p', { class: 'note', lang: 'nl' }, entry.prompt), h('p', { class: 'entry-text', lang: 'nl' }, entry.text), h('div', { class: 'row' }, check, slot), results),
    ),
  );
}

function showWrite() {
  if (!requireProfile()) return;
  let promptIndex = localDayNumber() % PROMPTS.length;
  const promptBox = h('div', { class: 'stack' });
  const showPrompt = () => {
    const p = PROMPTS[promptIndex];
    promptBox.replaceChildren(
      h('p', { class: 'prompt-nl', lang: 'nl' }, p.nl),
      h('p', { class: 'note', style: 'margin-top:0.25rem' }, p.en),
      h('p', {}, h('strong', {}, 'Tip: '), p.tip, ' ', h('a', { href: p.link }, 'See the lesson')),
    );
  };
  showPrompt();
  const another = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Another prompt');
  another.addEventListener('click', () => {
    promptIndex = (promptIndex + 1) % PROMPTS.length;
    showPrompt();
    announce(`New prompt: ${PROMPTS[promptIndex].en}`);
  });

  const textarea = h('textarea', {
    id: 'diary',
    class: 'input diary-input',
    rows: '8',
    lang: 'nl',
    spellcheck: 'true',
    autocapitalize: 'sentences',
    'aria-describedby': 'diary-hint',
  });
  textarea.value = store.draft;
  textarea.addEventListener('input', () => store.setDraft(textarea.value));

  const status = h('p', { class: 'note', 'aria-live': 'polite' });
  const resultsHeading = h('h2', { tabindex: '-1', style: 'margin-top:0' }, 'Things to check');
  const results = h('section', { class: 'card stack', 'aria-labelledby': 'results-heading', hidden: true });
  resultsHeading.id = 'results-heading';

  const check = h('button', { type: 'submit', class: 'btn btn-big' }, 'Check my Dutch');
  const saveBtn = h('button', { type: 'button', class: 'btn btn-quiet btn-big' }, 'Save entry');
  const form = h(
    'form',
    { class: 'stack' },
    h('div', { class: 'field' }, h('label', { for: 'diary' }, 'Your text in Dutch'), h('p', { id: 'diary-hint', class: 'note', style: 'margin:0' }, 'Your draft is kept on this device while you write.'), textarea),
    h('div', { class: 'row' }, check, saveBtn),
    status,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!textarea.value.trim()) {
      status.textContent = 'Write something first.';
      return;
    }
    results.replaceChildren(resultsHeading, findingsList(textarea.value));
    results.hidden = false;
    resultsHeading.focus();
  });

  const entriesSlot = h('div');
  const showEntries = () => {
    const entries = store.entries();
    entriesSlot.replaceChildren(
      h('h2', {}, entries.length ? `Your entries (${entries.length})` : 'Your entries'),
      entries.length
        ? h('ul', { class: 'entries' }, entries.map((e) => entryItem(e, showEntries)))
        : h('p', { class: 'note' }, 'Saved entries appear here. They are saved on this device, and Settings → Copy progress takes them along.'),
    );
  };
  showEntries();

  saveBtn.addEventListener('click', () => {
    if (!textarea.value.trim()) {
      status.textContent = 'Write something first.';
      return;
    }
    store.addEntry({ prompt: PROMPTS[promptIndex].nl, text: textarea.value.trim() });
    textarea.value = '';
    results.hidden = true;
    showEntries();
    status.textContent = 'Saved. Your entry is in the list below.';
  });

  const tools = [];
  if (dutchVoices().length) {
    const listen = h('button', { type: 'button', class: 'btn btn-quiet' }, icon('play'), 'Listen');
    listen.addEventListener('click', () => textarea.value.trim() && speak(textarea.value));
    tools.push(listen);
  }
  const copy = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Copy text');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      status.textContent = 'Copied. You can paste it into a message to your teacher.';
    } catch {
      status.textContent = 'Copying was blocked by the browser.';
    }
  });
  tools.push(copy);

  render('Dagboek', [
    backLink('#/', 'Home'),
    h('span', { class: 'eyebrow' }, 'Writing practice'),
    pageTitle('Dagboek', true),
    h(
      'p',
      { class: 'lede' },
      'Write a few sentences a day. The checker looks for common mistakes, like the verb in second place and heb or heeft. It can’t catch everything, so show your entries to your teacher too.',
    ),
    h('section', { class: 'card stack', 'aria-labelledby': 'prompt-heading' }, h('h2', { id: 'prompt-heading', style: 'margin-top:0' }, 'Today’s prompt'), promptBox, another),
    form,
    h('div', { class: 'row' }, tools),
    dutchVoices().length ? h('p', { class: 'note' }, 'Listen uses this device’s own Dutch voice, because your text has no recording.') : null,
    results,
    entriesSlot,
  ]);
}

/* ---------- Settings ---------- */
function voiceTest() {
  const result = h('p', { class: 'note', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'btn' }, icon('play'), 'Test the voice');
  button.addEventListener('click', async () => {
    result.textContent = 'Playing…';
    await speak('Goedemorgen! Hoe gaat het met je?');
    result.textContent = lastSpeechReport();
  });
  return h('div', { class: 'stack' }, button, result);
}

function showSettings() {
  const voices = dutchVoices();
  const voiceSelect = h(
    'select',
    { id: 'voice', class: 'input' },
    voices.map((v) =>
      h(
        'option',
        { value: v.voiceURI, selected: v.voiceURI === store.settings.voiceURI },
        `${v.name} · ${/^nl[-_]BE/i.test(v.lang) ? 'Belgian Dutch' : 'Netherlands'}`,
      ),
    ),
  );
  voiceSelect.addEventListener('change', () => store.setSettings({ voiceURI: voiceSelect.value }));
  const rates = [
    ['0.8', 'Slower'],
    ['0.95', 'Normal'],
    ['1.1', 'Faster'],
  ];
  const rateSelect = h(
    'select',
    { id: 'rate', class: 'input' },
    rates.map(([value, label]) => h('option', { value, selected: Number(value) === store.settings.rate }, label)),
  );
  rateSelect.addEventListener('change', () => store.setSettings({ rate: Number(rateSelect.value) }));

  const profileRows = store.profiles.map((name) => {
    const slot = h('div', { class: 'row' });
    const remove = h('button', { type: 'button', class: 'btn btn-quiet' }, `Remove ${name}`);
    remove.addEventListener('click', () => {
      const yes = h('button', { type: 'button', class: 'btn btn-danger' }, `Yes, delete ${name}’s progress`);
      const no = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Keep');
      yes.addEventListener('click', () => {
        store.removeProfile(name);
        announce(`Removed ${name}`);
        showSettings();
      });
      no.addEventListener('click', () => {
        slot.replaceChildren(remove);
        remove.focus();
      });
      slot.replaceChildren(yes, no);
      no.focus();
    });
    slot.append(remove);
    return slot;
  });

  const exportStatus = h('p', { class: 'note', 'aria-live': 'polite' });
  const copyBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Copy progress');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(store.exportData());
      exportStatus.textContent = 'Copied. Paste it into the box on your other device.';
    } catch {
      exportStatus.textContent = 'Copying was blocked by the browser.';
    }
  });
  const importBox = h('textarea', { id: 'import', class: 'input', rows: '3', spellcheck: 'false' });
  const importBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Restore progress');
  importBtn.addEventListener('click', () => {
    try {
      store.importData(importBox.value);
      exportStatus.textContent = 'Progress restored.';
      updateHeader();
    } catch {
      exportStatus.textContent = 'That text is not a progress copy from this site.';
    }
  });

  render('Settings', [
    backLink('#/', 'Home'),
    pageTitle('Settings'),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { style: 'margin-top:0' }, 'Voice'),
      hasRecordings()
        ? h('p', {}, `All lessons use Google’s ${recordingVoiceName()} voice, recorded in advance. Recordings play even in Silent mode.`)
        : null,
      voices.length > 1
        ? h(
            'div',
            { class: 'field' },
            h('label', { for: 'voice' }, hasRecordings() ? 'Backup voice for lines without a recording' : 'Dutch voice'),
            voiceSelect,
          )
        : hasRecordings()
          ? null
          : h(
              'p',
              {},
              voices.length ? `Voice: ${voices[0].name}` : 'No Dutch voice found on this device. See the home page for how to add one.',
            ),
      hasTts() ? h('div', { class: 'field' }, h('label', { for: 'rate' }, 'Speaking speed'), rateSelect) : null,
      hasTts() ? voiceTest() : null,
      hasTts()
        ? h(
            'details',
            {},
            h('summary', {}, 'No sound?'),
            h(
              'ol',
              {},
              h('li', {}, 'Recordings play in Silent mode, but the backup voice does not. On iPhone, turn off Silent mode if a line is quiet.'),
              h('li', {}, 'Turn the volume up while the voice is playing.'),
              h(
                'li',
                {},
                'Make sure the voice is downloaded: Settings → Accessibility → Spoken Content → Voices → Dutch. A voice that is listed but not downloaded plays nothing.',
              ),
              h('li', {}, 'Pick another voice above and test again.'),
            ),
          )
        : null,
    ),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { style: 'margin-top:0' }, 'People'),
      profileRows.length ? profileRows : h('p', {}, 'No one added yet.'),
    ),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { style: 'margin-top:0' }, 'Move progress to another device'),
      h('p', {}, 'Progress is saved in this browser only. Copy it here, then paste it on your other phone or laptop.'),
      copyBtn,
      h('div', { class: 'field' }, h('label', { for: 'import' }, 'Paste progress from another device'), importBox),
      importBtn,
      exportStatus,
    ),
  ]);
}

function showNotFound() {
  render('Not found', [pageTitle('Page not found'), h('p', {}, h('a', { href: '#/' }, 'Go to the home page'))]);
}

/* ---------- Router ---------- */
function route() {
  const [, name = '', a, b] = location.hash.replace(/^#/, '').split('/');
  switch (name) {
    case '':
      return showHome();
    case 'lesson':
      return showLesson(a, b);
    case 'practice':
      return showPractice(a);
    case 'drill':
      return showDrill(a);
    case 'read':
      return showReading(a, b);
    case 'settings':
      return showSettings();
    case 'write':
      return showWrite();
    default:
      return showNotFound();
  }
}

window.addEventListener('hashchange', route);

// Voices can arrive late. Refresh screens that show audio, but never reset a round in progress.
let booted = false;
let audioAvailable = false;
onVoicesChanged(() => {
  if (!booted || hasTts() === audioAvailable) return;
  audioAvailable = hasTts();
  if (!/^#\/(practice|drill)\//.test(location.hash)) route();
});

Promise.all([loadLessons(), voicesReady(), loadRecordings()])
  .then(() => {
    booted = true;
    audioAvailable = hasTts();
    route();
  })
  .catch((error) => {
    main.replaceChildren(h('h1', {}, 'Something went wrong'), h('p', {}, `The lessons could not load: ${error.message}`));
  });
