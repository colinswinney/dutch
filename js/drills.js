import { pick, shuffle } from './util.js';

const UNITS = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'];
const TENS = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];

export function numberWord(n) {
  if (n === 1) return 'één';
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    if (!unit) return TENS[tens];
    const u = UNITS[unit];
    return u + (u.endsWith('e') ? 'ën' : 'en') + TENS[tens];
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const head = hundreds === 1 ? 'honderd' : `${UNITS[hundreds]}honderd`;
    return head + (rest ? (rest === 1 ? 'een' : numberWord(rest)) : '');
  }
  return String(n);
}

export function priceWords(euros, cents) {
  if (!cents) return `${numberWord(euros)} euro`;
  if (!euros) return `${numberWord(cents)} cent`;
  return `${numberWord(euros)} euro ${numberWord(cents)}`;
}

const hourWord = (h) => numberWord(h);

export function timeWords(h, m) {
  const next = (h % 12) + 1;
  switch (m) {
    case 0: return `${hourWord(h)} uur`;
    case 5: return `vijf over ${hourWord(h)}`;
    case 10: return `tien over ${hourWord(h)}`;
    case 15: return `kwart over ${hourWord(h)}`;
    case 20: return `tien voor half ${hourWord(next)}`;
    case 25: return `vijf voor half ${hourWord(next)}`;
    case 30: return `half ${hourWord(next)}`;
    case 35: return `vijf over half ${hourWord(next)}`;
    case 40: return `tien over half ${hourWord(next)}`;
    case 45: return `kwart voor ${hourWord(next)}`;
    case 50: return `tien voor ${hourWord(next)}`;
    case 55: return `vijf voor ${hourWord(next)}`;
    default: throw new Error(`No word form for minute ${m}`);
  }
}

// A fixed set of prices, so every one can have a recorded audio file.
const CENTS = [0, 5, 10, 15, 19, 20, 25, 29, 35, 39, 45, 49, 50, 55, 59, 65, 69, 75, 79, 85, 89, 95, 99];
const PRICES = Array.from({ length: 20 }, (_, euros) => CENTS.map((cents) => [euros, cents]))
  .flat()
  .filter(([euros, cents]) => euros || cents);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// Everything the drills can say, for the audio script.
export function allDrillSayings() {
  const numbers = Array.from({ length: 101 }, (_, n) => numberWord(n));
  const prices = PRICES.map(([euros, cents]) => priceWords(euros, cents));
  const times = Array.from({ length: 12 }, (_, i) => MINUTES.map((m) => timeWords(i + 1, m))).flat();
  return [...numbers, ...prices, ...times];
}

const clock = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
const wrapHour = (h) => ((h - 1 + 12) % 12) + 1;
const int = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export const DRILLS = {
  numbers: {
    title: 'Numbers 0–100',
    titleNl: 'Getallen',
    intro: 'Dutch says the units before the tens: 47 is zevenenveertig, “seven-and-forty”. Listen and type the number.',
    links: [{ label: 'Wikibooks Dutch, lesson 6: Numbers', url: 'https://en.wikibooks.org/wiki/Dutch/Lesson_6#Grammatica_6.1_~_Numbers' }],
    kind: 'type',
    label: 'Number you heard',
    inputmode: 'numeric',
    make() {
      const n = Math.random() < 0.75 ? int(13, 99) : int(0, 100);
      return { say: numberWord(n), answer: String(n), check: (input) => Number.parseInt(input.replace(/\D/g, ''), 10) === n };
    },
  },
  prices: {
    title: 'Prices',
    titleNl: 'Prijzen',
    intro: 'At the till you hear “vier euro vijfennegentig” for €4,95. The word cent is usually left out. Listen and type the price.',
    links: [{ label: 'Wikibooks Dutch, lesson 6: Numbers', url: 'https://en.wikibooks.org/wiki/Dutch/Lesson_6#Grammatica_6.1_~_Numbers' }],
    kind: 'type',
    label: 'Price in euros, for example 4,95',
    inputmode: 'decimal',
    make() {
      const [euros, cents] = pick(PRICES);
      const total = euros * 100 + cents;
      return {
        say: priceWords(euros, cents),
        answer: `€${euros},${String(cents).padStart(2, '0')}`,
        check(input) {
          const cleaned = input.replace(/[€\s]/g, '').replace(',', '.');
          if (!/^\d*(\.\d{1,2})?$/.test(cleaned) || cleaned === '') return false;
          return Math.round(Number.parseFloat(cleaned) * 100) === total;
        },
      };
    },
  },
  times: {
    title: 'Telling the time',
    titleNl: 'Hoe laat is het?',
    intro: '“Half drie” means half an hour before three, so 2:30, not 3:30. From 20 past the hour, Dutch counts from the next half hour. Listen and pick the clock time.',
    links: [
      { label: 'Wikibooks Dutch, lesson 3: half and kwart', url: 'https://en.wikibooks.org/wiki/Dutch/Lesson_3#Half_en_kwart' },
      { label: 'Wikibooks Dutch: What time is it?', url: 'https://en.wikibooks.org/wiki/Dutch/What_time_is_it%3F' },
    ],
    kind: 'choice',
    make() {
      const h = int(1, 12);
      const m = pick([0, 5, 10, 15, 20, 20, 25, 25, 30, 30, 30, 35, 35, 40, 40, 45, 45, 50, 55]);
      const answer = clock(h, m);
      const traps = new Set();
      if (m >= 20) traps.add(clock(wrapHour(h + 1), m));
      if (m >= 20 && m <= 40) traps.add(clock(h, 60 - m));
      if (m === 15 || m === 45) traps.add(clock(m === 15 ? wrapHour(h - 1) : h, 60 - m));
      traps.add(clock(wrapHour(h - 1), m));
      while (traps.size < 6) traps.add(clock(int(1, 12), pick([0, 15, 20, 30, 40, 45])));
      traps.delete(answer);
      const options = shuffle([answer, ...[...traps].slice(0, 3)]);
      return { say: timeWords(h, m), answer, options };
    },
  },
};
