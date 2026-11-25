# How to add a lesson

Each lesson is one JSON file in `lessons/`. The app builds every exercise from it. You do not write quiz questions by hand.

## Quickest way: ask Claude

Open this folder in Claude Code and describe the situation. For example:

> Add a lesson for taekwondo class: talking to the instructor, belt exams, what to bring. A1 level.

> Add a reading to the school lesson: a message about the class party before the Christmas holiday.

Claude writes the file, adds it to `lessons/index.json`, records the audio, and runs the checker.

## Doing it yourself

1. Copy `lessons/swimming.json` to a new file, such as `lessons/dance.json`.
2. Change `"id"` to match the file name: `"dance"`.
3. Add the id to the list in `lessons/index.json`. The order there is the order on the home page.
4. Run `node scripts/make-audio.mjs` to record the new lines in the Google voice.
5. Run `node scripts/check-lessons.mjs` to catch mistakes.

## The fields

```jsonc
{
  "id": "dance",                    // must match the file name
  "title": "Dance class",           // English title
  "titleNl": "Dansles",             // Dutch title, shown big
  "level": "A1",
  "intro": "One or two sentences about the lesson.",
  "modes": ["listen", "build"],     // optional: limit the exercise types
  "preferredMode": "build",         // optional: use this type more often
  "notes": [                        // optional grammar or culture notes
    {
      "id": "likes",                  // optional: lets cards point to this note
      "title": "Short heading",
      "body": ["Paragraph one.", "Paragraph two."],
      "examples": [{ "nl": "Ze [danst] graag.", "en": "She likes dancing." }],
      "links": [                      // optional: "Further reading" under the note
        { "label": "Wikibooks Dutch, lesson 11: Word order", "url": "https://en.wikibooks.org/wiki/Dutch/Lesson_11#Word_order" }
      ]
    }
  ],
  "cards": [
    {
      "id": "uitvoering",                      // optional but recommended: keeps progress if you edit the sentence
      "nl": "Wanneer is de uitvoering?",
      "en": "When is the show?",
      "who": "You",                            // optional: who says it
      "reply": { "nl": "In juni.", "en": "In June." },  // optional: enables the "pick a reply" exercise
      "alts": [],                               // optional: other correct word orders, same words only
      "rule": "Question word first, verb second.",  // optional: shown after the answer
      "note": "questions"                        // optional: the note id behind the rule, shown as "Explain this rule"
    }
  ],
  "readings": [                     // optional: texts with comprehension questions
    {
      "id": "show",
      "kind": "Message from the dance school",
      "title": "De uitvoering",
      "text": ["Paragraph in Dutch.", "Another paragraph."],
      "translation": ["English paragraph.", "Another one."],
      "glossary": [{ "nl": "de uitvoering", "en": "the show, recital" }],
      "questions": [
        { "q": "When is the show?", "options": ["May", "June", "July"], "answer": 1 }
      ]
    }
  ]
}
```

## Tips

- In `notes`, put `[square brackets]` around words you want highlighted. The brackets are removed for audio and checking.
- Keep each card to one sentence. Short cards are better for listening and word tiles.
- Only link pages you have opened and checked. The free Wikibooks Dutch course (https://en.wikibooks.org/wiki/Dutch) has stable section links.
- Give a card an `id` once people have practised it. Without one, editing the Dutch text resets its progress.
- Exercise types: `listen` (hear Dutch, pick the meaning), `respond` (hear a line, pick a reply; needs `reply`), `build` (word tiles), `speak` (say it, record yourself), `dictation` (type what you hear).
