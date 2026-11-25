const KEY = 'dutch-practice:v1';
const DAY = 86400000;
// Days until a card comes back, by box. A wrong answer sends the card to box 0.
const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
export const LEARNED_BOX = 3;

const empty = () => ({
  profiles: [],
  current: null,
  progress: {},
  journal: {},
  drafts: {},
  settings: { voiceURI: null, rate: 0.95 },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return { ...empty(), ...data, settings: { ...empty().settings, ...data.settings } };
  } catch {
    return empty();
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing or full storage: progress lasts for this visit only.
  }
}

export const store = {
  get profiles() {
    return state.profiles;
  },
  get current() {
    return state.current;
  },
  get settings() {
    return state.settings;
  },
  setSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    save();
  },
  setCurrent(name) {
    if (state.profiles.includes(name)) {
      state.current = name;
      save();
    }
  },
  addProfile(raw) {
    const name = raw.trim().slice(0, 30);
    if (!name || state.profiles.includes(name)) return false;
    state.profiles.push(name);
    state.progress[name] = {};
    state.current = name;
    save();
    return true;
  },
  removeProfile(name) {
    state.profiles = state.profiles.filter((p) => p !== name);
    delete state.progress[name];
    delete state.journal[name];
    delete state.drafts[name];
    if (state.current === name) state.current = state.profiles[0] ?? null;
    save();
  },
  cardState(key) {
    return state.progress[state.current]?.[key] ?? null;
  },
  record(key, correct) {
    if (!state.current) return;
    const progress = (state.progress[state.current] ??= {});
    const s = progress[key] ?? { box: 0, due: 0, right: 0, wrong: 0 };
    const now = Date.now();
    if (correct) {
      s.box = Math.min(s.box + 1, INTERVALS.length - 1);
      s.due = now + INTERVALS[s.box] * DAY;
      s.right++;
    } else {
      s.box = 0;
      s.due = now;
      s.wrong++;
    }
    s.last = now;
    progress[key] = s;
    save();
  },
  stats(cards) {
    const now = Date.now();
    let fresh = 0;
    let due = 0;
    let learned = 0;
    for (const card of cards) {
      const s = this.cardState(card.key);
      if (!s) fresh++;
      else {
        if (s.due <= now) due++;
        if (s.box >= LEARNED_BOX) learned++;
      }
    }
    return { fresh, due, learned, total: cards.length };
  },
  entries() {
    return state.journal[state.current] ?? [];
  },
  addEntry({ prompt, text }) {
    if (!state.current) return;
    const list = (state.journal[state.current] ??= []);
    list.unshift({ id: `${Date.now()}`, date: Date.now(), prompt, text });
    delete state.drafts[state.current];
    save();
  },
  removeEntry(id) {
    const list = state.journal[state.current];
    if (!list) return;
    state.journal[state.current] = list.filter((e) => e.id !== id);
    save();
  },
  get draft() {
    return state.drafts[state.current] ?? '';
  },
  setDraft(text) {
    if (!state.current) return;
    state.drafts[state.current] = text;
    save();
  },
  exportData() {
    return JSON.stringify(state);
  },
  importData(json) {
    const data = JSON.parse(json);
    if (!Array.isArray(data.profiles) || typeof data.progress !== 'object') throw new Error('Not a progress file');
    state = { ...empty(), ...data };
    save();
  },
};
