// Writing prompts and a pattern checker for the diary page. The checker only knows a few
// common learner mistakes, so it prefers missing a mistake over flagging a correct sentence.

export const PROMPTS = [
  { nl: 'Wat heb je gisteren gedaan?', en: 'What did you do yesterday?', tip: 'Use heb or ben, with the past form at the end.', link: '#/lesson/past/perfect' },
  { nl: 'Wat ga je dit weekend doen?', en: 'What are you going to do this weekend?', tip: 'Use ga + a verb at the end, or the present tense with a time word.', link: '#/lesson/future/gaan' },
  { nl: 'Hoe ziet jouw ochtend eruit?', en: 'What does your morning look like?', tip: 'Split verbs: ik sta op, ik kleed me aan.', link: '#/lesson/split-verbs/present' },
  { nl: 'Wat heeft je kind vandaag op school gedaan?', en: 'What did your child do at school today?', tip: 'Ze heeft, not ze heb.', link: '#/lesson/verb-forms/zijn-hebben' },
  { nl: 'Schrijf over je laatste keer sporten.', en: 'Write about the last time you exercised.', tip: 'Hardlopen splits: ik loop hard. Past: ik heb hardgelopen.', link: '#/lesson/running/hardlopen' },
  { nl: 'Welke muziek vind je leuk, en waarom?', en: 'What music do you like, and why?', tip: 'After omdat the verb goes to the end.', link: '#/lesson/linking-words/omdat-doordat' },
  { nl: 'Wat zou je doen als je een dag vrij had?', en: 'What would you do if you had a day off?', tip: 'Als ik … had, zou ik …', link: '#/lesson/zou/als' },
  { nl: 'Waar staan, liggen en hangen de dingen in je woonkamer?', en: 'Where are the things in your living room?', tip: 'Upright things staan, flat things liggen.', link: '#/lesson/staan-zitten-liggen/staan' },
  { nl: 'Wat doe je om je Nederlands te verbeteren?', en: 'What do you do to improve your Dutch?', tip: 'om … te, with the verb at the end.', link: '#/lesson/om-te/om-te' },
  { nl: 'Schrijf een bericht aan de juf: je kind is ziek.', en: 'Write a message to the teacher: your child is ill.', tip: 'Start with Beste juf, and end with Met vriendelijke groet.', link: '#/lesson/school' },
  { nl: 'Wat heb je deze week in de supermarkt gekocht?', en: 'What did you buy at the supermarket this week?', tip: 'kopen becomes gekocht.', link: '#/lesson/past/irregular' },
  { nl: 'Wat was leuk deze week, en wat was moeilijk?', en: 'What was fun this week, and what was hard?', tip: 'Try hoewel or maar to join two ideas.', link: '#/lesson/linking-words/contrast' },
  { nl: 'Wat moet je kind doen voordat jullie ’s ochtends weggaan?', en: 'What does your child have to do before you leave in the morning?', tip: 'After moet, the verb goes to the end in one piece.', link: '#/lesson/split-verbs/together' },
  { nl: 'Hoe was het weer vandaag, en wat heb je gedaan?', en: 'What was the weather like today, and what did you do?', tip: 'Start with vandaag and the verb still comes second.', link: '#/lesson/sentence-structure/verb-second' },
  { nl: 'Wat deed je vroeger, voordat je naar Nederland kwam?', en: 'What did you do before you came to the Netherlands?', tip: 'One-word past forms: ik werkte, ik woonde, ik ging.', link: '#/lesson/past/was-had' },
  { nl: 'Vertel over een restaurant waar je laatst was.', en: 'Tell about a restaurant you went to recently.', tip: 'Het was lekker. We hebben … gegeten.', link: '#/lesson/restaurant' },
];

// [full verb, stem, past singular, past plural]. The stem is the ik form.
const VERBS = [
  ['werken', 'werk', 'werkte', 'werkten'], ['spelen', 'speel', 'speelde', 'speelden'], ['maken', 'maak', 'maakte', 'maakten'],
  ['wonen', 'woon', 'woonde', 'woonden'], ['koken', 'kook', 'kookte', 'kookten'], ['fietsen', 'fiets', 'fietste', 'fietsten'],
  ['wachten', 'wacht', 'wachtte', 'wachtten'], ['praten', 'praat', 'praatte', 'praatten'], ['leren', 'leer', 'leerde', 'leerden'],
  ['halen', 'haal', 'haalde', 'haalden'], ['kijken', 'kijk', 'keek', 'keken'], ['lopen', 'loop', 'liep', 'liepen'],
  ['zwemmen', 'zwem', 'zwom', 'zwommen'], ['kopen', 'koop', 'kocht', 'kochten'], ['lezen', 'lees', 'las', 'lazen'],
  ['schrijven', 'schrijf', 'schreef', 'schreven'], ['eten', 'eet', 'at', 'aten'], ['drinken', 'drink', 'dronk', 'dronken'],
  ['slapen', 'slaap', 'sliep', 'sliepen'], ['denken', 'denk', 'dacht', 'dachten'], ['weten', 'weet', 'wist', 'wisten'],
  ['zitten', 'zit', 'zat', 'zaten'], ['liggen', 'lig', 'lag', 'lagen'], ['zeggen', 'zeg', 'zei', 'zeiden'],
  ['spreken', 'spreek', 'sprak', 'spraken'], ['begrijpen', 'begrijp', 'begreep', 'begrepen'], ['helpen', 'help', 'hielp', 'hielpen'],
  ['komen', 'kom', 'kwam', 'kwamen'], ['gaan', 'ga', 'ging', 'gingen'], ['doen', 'doe', 'deed', 'deden'],
  ['zien', 'zie', 'zag', 'zagen'], ['staan', 'sta', 'stond', 'stonden'], ['geven', 'geef', 'gaf', 'gaven'],
  ['nemen', 'neem', 'nam', 'namen'], ['krijgen', 'krijg', 'kreeg', 'kregen'], ['vinden', 'vind', 'vond', 'vonden'],
  ['blijven', 'blijf', 'bleef', 'bleven'], ['moeten', 'moet', 'moest', 'moesten'], ['willen', 'wil', 'wilde', 'wilden'],
  ['kunnen', 'kan', 'kon', 'konden'], ['mogen', 'mag', 'mocht', 'mochten'], ['zullen', 'zal', 'zou', 'zouden'],
  ['hebben', 'heb', 'had', 'hadden'], ['zijn', 'ben', 'was', 'waren'], ['rijden', 'rijd', 'reed', 'reden'],
  ['vragen', 'vraag', 'vroeg', 'vroegen'], ['brengen', 'breng', 'bracht', 'brachten'], ['bezoeken', 'bezoek', 'bezocht', 'bezochten'],
];
const THIRD = { heb: 'heeft', ben: 'is', kan: 'kan', wil: 'wil', mag: 'mag', zal: 'zal', ga: 'gaat', doe: 'doet', zie: 'ziet', sta: 'staat' };
const JIJ = { heb: 'hebt', ben: 'bent', kan: 'kunt', ga: 'gaat', doe: 'doet', zie: 'ziet', sta: 'staat' };
const thirdOf = (stem) => THIRD[stem] ?? (stem.endsWith('t') ? stem : `${stem}t`);
const jijOf = (stem) => JIJ[stem] ?? thirdOf(stem);

const byForm = new Map();
const FINITE = new Set(['kun', 'kunt', 'wilt', 'zult', 'hebt', 'bent']);
for (const [inf, stem, pastSg, pastPl] of VERBS) {
  const verb = { inf, stem, third: thirdOf(stem), jij: jijOf(stem), pastSg, pastPl };
  for (const form of [stem, verb.third, verb.jij, inf, pastSg, pastPl]) {
    FINITE.add(form);
    if (!byForm.has(form)) byForm.set(form, verb);
  }
}
byForm.set('hebt', byForm.get('heb'));
byForm.set('bent', byForm.get('ben'));
byForm.set('is', byForm.get('ben'));
byForm.set('kun', byForm.get('kan'));
byForm.set('kunt', byForm.get('kan'));

const SUBJECTS = new Set(['ik', 'jij', 'je', 'hij', 'ze', 'zij', 'wij', 'we', 'jullie', 'het', 'u']);
const SIDE = new Set(['omdat', 'dat', 'als', 'wanneer', 'toen', 'terwijl', 'zodat', 'hoewel', 'tenzij', 'totdat', 'voordat', 'nadat', 'zodra', 'doordat', 'zolang', 'alsof', 'of']);
const NORMAL = new Set(['en', 'maar', 'want', 'dus', 'of']);
const QUESTION = new Set(['wat', 'waar', 'wie', 'hoe', 'waarom', 'welke', 'wanneer']);
const RELATIVE = new Set(['waar', 'die', 'wie', 'wat', 'waarin', 'welke']);
const SPELLING = {
  waroom: 'waarom', schol: 'school', todat: 'totdat', makken: 'maken', speletjes: 'spelletjes', spelertjes: 'spelletjes',
  woondsdag: 'woensdag', vaandag: 'vandaag', sprechen: 'spreken', apartment: 'appartement', theatre: 'theater',
};

const LINK = {
  verbSecond: '#/lesson/sentence-structure/verb-second',
  sideFirst: '#/lesson/sentence-structure/side-sentences',
  forms: '#/lesson/verb-forms/regular',
  zijnHebben: '#/lesson/verb-forms/zijn-hebben',
  pastForms: '#/lesson/past/was-had',
  benHeb: '#/lesson/past/zijn',
  liggen: '#/lesson/staan-zitten-liggen/leggen',
  omTe: '#/lesson/om-te/om-te',
  modals: '#/lesson/verb-forms/modals',
};

const WORD = /[\p{L}’']+/gu;
const words = (text) => [...text.matchAll(WORD)].map((m) => ({ word: m[0].toLowerCase(), raw: m[0], index: m.index }));
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// What a subject should be followed by, if the next word is a form of a known verb in the wrong person.
function agreement(subject, next) {
  const verb = byForm.get(next);
  if (!verb) return null;
  const isPastSg = next === verb.pastSg && next !== verb.pastPl;
  const isPastPl = next === verb.pastPl && next !== verb.pastSg;
  const isPresent = !isPastSg && !isPastPl;
  if (verb.inf === 'zijn' && next === 'zijn' && subject !== 'wij' && subject !== 'we' && subject !== 'jullie') return null; // zijn is also “his”.
  switch (subject) {
    case 'ik':
      if (isPastPl) return verb.pastSg;
      if (isPresent && next !== verb.stem && next !== 'kun') return verb.stem;
      return null;
    case 'jij':
      if (isPastPl) return verb.pastSg;
      if (isPresent && next !== verb.jij && next !== verb.third && !(verb.inf === 'kunnen' && next === 'kan') && !(verb.inf === 'willen' && next === 'wilt')) return verb.jij;
      return null;
    case 'hij':
      if (isPastPl) return verb.pastSg;
      if (isPresent && next !== verb.third) return verb.third;
      return null;
    case 'ze':
    case 'zij':
      // ze can be “she” or “they”, so only forms that fit neither are flagged.
      if (isPresent && next !== verb.third && next !== verb.inf) return `${verb.third} (she) or ${subject} ${verb.inf} (they)`;
      return null;
    case 'wij':
    case 'we':
    case 'jullie':
      if (isPastSg) return verb.pastPl;
      if (isPresent && next !== verb.inf) return verb.inf;
      return null;
    default:
      return null;
  }
}

function linkForVerb(next) {
  const verb = byForm.get(next);
  if (verb?.inf === 'hebben' || verb?.inf === 'zijn') return LINK.zijnHebben;
  if (['kunnen', 'willen', 'mogen', 'zullen'].includes(verb?.inf)) return LINK.modals;
  if (verb && (next === verb.pastSg || next === verb.pastPl)) return LINK.pastForms;
  return LINK.forms;
}

export function checkDutch(text) {
  const findings = [];
  const seen = new Set();
  const add = (finding) => {
    const key = `${finding.kind}|${finding.sentence}|${finding.match}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
  };
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const clauses = sentence.split(/[,;:]/);
    let previousStart = null;
    for (const clause of clauses) {
      const w = words(clause);
      if (!w.length) continue;
      const first = w[0].word;

      // Verb second: a subject + verb pair that comes after something else at the start of the clause.
      if (!SIDE.has(first) && !NORMAL.has(first) && !QUESTION.has(first)) {
        // Only the first few words: a subject further on is usually inside a part this checker can't parse.
        for (let i = 1; i < Math.min(w.length - 1, 5); i++) {
          const before = w.slice(0, i).map((x) => x.word);
          if (before.some((x) => FINITE.has(x) || SIDE.has(x) || RELATIVE.has(x))) break;
          if (SUBJECTS.has(w[i].word) && FINITE.has(w[i + 1].word) && !['en', 'of'].includes(w[i - 1].word)) {
            const start = clause.slice(0, w[i].index).trim();
            const fix = agreement(w[i].word, w[i + 1].word);
            const verb = fix ? fix.split(' (')[0] : w[i + 1].raw;
            add({
              kind: 'verb-second',
              sentence,
              match: `${w[i].raw} ${w[i + 1].raw}`,
              title: 'Put the verb before the subject',
              explain: `The sentence starts with “${start}”, so the verb comes second: “${start} ${verb} ${w[i].raw} …”.`,
              link: LINK.verbSecond,
            });
            break;
          }
        }
      }

      // Verb, comma, verb: after a side sentence, the main part starts with its verb.
      if (previousStart && SIDE.has(previousStart) && previousStart !== 'dat' && previousStart !== 'of' && w.length > 1 && SUBJECTS.has(first) && FINITE.has(w[1].word)) {
        add({
          kind: 'side-first',
          sentence,
          match: `${w[0].raw} ${w[1].raw}`,
          title: 'Verb, comma, verb',
          explain: `After a part that starts with “${previousStart}”, the next part starts with its verb: “…, ${w[1].raw} ${w[0].raw} …”.`,
          link: LINK.sideFirst,
        });
      }
      previousStart = first;

      // Subject and verb that don't match. After a verb, a full verb can be the one at the end (wat zou jij doen), so it is skipped.
      for (let i = 0; i < w.length - 1; i++) {
        const subject = w[i].word;
        if (!['ik', 'jij', 'hij', 'ze', 'zij', 'wij', 'we', 'jullie'].includes(subject)) continue;
        const next = w[i + 1].word;
        if (i > 0 && FINITE.has(w[i - 1].word) && byForm.get(next)?.inf === next) continue;
        const fix = agreement(subject, next);
        if (!fix) continue;
        add({
          kind: 'agreement',
          sentence,
          match: `${w[i].raw} ${w[i + 1].raw}`,
          title: 'Check the verb form',
          explain: fix.includes('(') ? `Write ${subject} ${fix}.` : `With ${subject}, write “${subject} ${fix}”.`,
          link: linkForVerb(next),
        });
      }

      // Verb before the subject (werkt ik). jij and je are left out because the -t drops there, and ze can be plural.
      for (let i = 1; i < w.length; i++) {
        const subject = w[i].word;
        if (!['ik', 'hij', 'wij', 'we', 'jullie'].includes(subject)) continue;
        const verb = w[i - 1].word;
        if (!FINITE.has(verb) || (i > 1 && FINITE.has(w[i - 2].word))) continue;
        const fix = agreement(subject, verb);
        if (!fix) continue;
        add({
          kind: 'agreement',
          sentence,
          match: `${w[i - 1].raw} ${w[i].raw}`,
          title: 'Check the verb form',
          explain: `With ${subject}, write “${fix} ${subject}”.`,
          link: linkForVerb(verb),
        });
      }
    }

    const lower = sentence.toLowerCase();
    const leg = lower.match(/(?<![\p{L}])(leg|legt|leggen)\s+(te|in bed|op bed|op de bank|in de zon)(?![\p{L}])/u);
    if (leg) {
      add({
        kind: 'liggen',
        sentence,
        match: leg[0],
        title: 'liggen, not leggen',
        explain: 'Lying somewhere is liggen: ik lig, ze ligt. Leggen means putting something down.',
        link: LINK.liggen,
      });
    }

    const to = lower.match(/(?<![\p{L}])to(?![\p{L}])/u);
    if (to) {
      add({ kind: 'to', sentence, match: 'to', title: 'te, not to', explain: '“to” is English. Dutch uses te: om … te …', link: LINK.omTe });
    }

    const benHeb = lower.match(/(?<![\p{L}])(heb|hebt|heeft|hebben)(?![\p{L}])[^.!?,]*?(?<![\p{L}])(gegaan|gekomen|geworden|gebleven|gebeurd|vertrokken|begonnen)(?![\p{L}])/u);
    if (benHeb) {
      add({
        kind: 'ben-heb',
        sentence,
        match: benHeb[2],
        title: 'ben or is, not heb',
        explain: `${capital(benHeb[2])} goes with zijn: ik ben, ze is, wij zijn ${benHeb[2]}.`,
        link: LINK.benHeb,
      });
    }

    for (const { word, raw } of words(sentence)) {
      if (SPELLING[word]) {
        add({ kind: 'spelling', sentence, match: raw, title: 'Spelling', explain: `${raw} is written ${SPELLING[word]}.`, link: null });
      }
    }
  }
  return findings;
}
