# Dutch practice

A small static site for practising A1–A2 Dutch for family life in the Netherlands: the supermarket, restaurants, school, and after-school clubs. It works best on a phone.

## What it does

- **Lessons** of everyday phrases. Each lesson has grammar or culture notes and a phrase list with audio.
- **Five exercise types**, made automatically from the phrases:
  - listen and pick the meaning
  - hear a line and pick a good reply
  - build the sentence from word tiles
  - say it, record yourself, or let the browser check your Dutch
  - dictation: type what you hear
- **Spaced repetition** for each person. Phrases you miss come back sooner. Phrases you know come back less often.
- **Explain this rule:** after each grammar exercise, the rule behind it opens in place, with links to further reading.
- **Reading practice** with messages like the ones from school and the class group chat.
- **Listening drills** for numbers, prices and times, with new items every round.

Audio is recorded in advance with Google's Achernar voice (Google Cloud Text-to-Speech, Chirp 3 HD), so it sounds the same on every phone and plays even in Silent mode. Any line without a recording falls back to the device's own Dutch voice. Progress is saved in the browser, per person. To move progress between devices, use Settings → Copy progress.

## Run it locally

Any static file server works:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. The microphone only works on `localhost` or on `https`.

To try it on your phone over Wi-Fi, run the server, then open `http://<your-computer-ip>:8000`. The microphone features need https, so test those on the GitHub Pages site.

## Add lessons

See [HOW-TO-ADD-A-LESSON.md](HOW-TO-ADD-A-LESSON.md). After editing lessons, record the new lines and check everything:

```sh
node scripts/make-audio.mjs      # records only new or changed lines
node scripts/check-lessons.mjs   # checks the files and warns about lines without audio
```

## Recorded audio

`scripts/make-audio.mjs` sends each Dutch line to Google Cloud Text-to-Speech once and saves an MP3 in `audio/`, plus `audio/manifest.json`, which maps each line to its file. The script needs an API key in `GOOGLE_TTS_KEY` or in `~/.config/dutch-practice/google-tts-key`. Never commit the key.

- The whole site is about 17,000 characters. Google's free allowance for this voice is 1 million characters a month, and billing must be turned on.
- Run with `--prune` to delete recordings for lines that no longer exist.
- To change the voice, edit `VOICE` at the top of the script and run it again. Every line is recorded again in the new voice.

## Publish with GitHub Pages

1. Create a GitHub repo and push this folder to it.
2. In the repo, go to Settings → Pages.
3. Under "Build and deployment", choose "Deploy from a branch", then `main` and `/ (root)`.
4. The site appears at `https://<your-username>.github.io/<repo-name>/` after a minute or two.

The site is public. Keep personal details, like your child's school name or voice recordings, out of the lesson files.

## Browser notes

- **Audio:** recordings play everywhere. The backup device voice is only used for lines without a recording. It follows the iPhone Silent switch, and you can choose it in Settings.
- **"Check my Dutch"** uses the browser's speech recognition. It works in Chrome and Safari. Chrome sends the audio to Google to recognise it.
- **Add to home screen:** in Safari, tap Share → Add to Home Screen. The app then opens full screen.
