// Fills in missing translations for published stories using the Claude API.
//
//   ANTHROPIC_API_KEY=sk-... npm run translate              (every story missing a language)
//   ANTHROPIC_API_KEY=sk-... npm run translate -- the-meter  (one story)
//
// It never overwrites a translation that already has text, so your edits are safe.
// Output is a draft: read it before it goes live (the GitHub workflow opens a pull request for this).

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'stories');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/site.json'), 'utf8'));
const MODEL = process.env.TRANSLATE_MODEL || 'claude-sonnet-5-5';
const KEY = process.env.ANTHROPIC_API_KEY;
const NAMES = { en: 'English', fr: 'French (Québec)', es: 'Spanish (Mexico)' };

const promptFile = fs.readFileSync(path.join(ROOT, 'TRANSLATION_PROMPT.md'), 'utf8');
const INSTRUCTIONS = promptFile.split('\n---\n')[1].trim();

if (!KEY) {
  console.error('Set ANTHROPIC_API_KEY first. See README, "Translations".');
  process.exit(1);
}

function loadAll() {
  const out = {};
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(/^(.+)\.([a-z]{2})\.md$/);
    if (!m) continue;
    (out[m[1]] ||= {})[m[2]] = { file: path.join(DIR, f), ...matter(fs.readFileSync(path.join(DIR, f), 'utf8')) };
  }
  return out;
}

async function translate({ fromLang, toLang, title, note, body }) {
  const prompt = INSTRUCTIONS
    .replace('[SOURCE LANGUAGE]', NAMES[fromLang] || fromLang)
    .replace('[TARGET LANGUAGE]', NAMES[toLang])
    .replace('[TITLE]', title || '')
    .replace('[CONTENT NOTE OR "none"]', note || 'none') + '\n\n' + body;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.map((c) => c.text || '').join('');
  const pick = (tag) => (text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [, ''])[1].trim();
  const story = pick('story');
  if (!story) throw new Error('No story text came back. Raw reply:\n' + text.slice(0, 500));
  return { title: pick('title'), content_note: pick('content_note'), body: story };
}

(async () => {
  const only = process.argv[2];
  const all = loadAll();
  let done = 0;
  for (const [slug, files] of Object.entries(all)) {
    if (only && slug !== only) continue;
    const shared = Object.assign({}, ...Object.values(files).map((f) => f.data));
    let src = shared.original_language;
    if (!files[src] || !files[src].content.trim()) src = Object.keys(files).find((l) => files[l].content.trim());
    if (!src) { console.log(`- ${slug}: no story text yet, skipped`); continue; }

    for (const lang of site.languages) {
      if (lang === src) continue;
      if (files[lang] && files[lang].content.trim()) continue;
      process.stdout.write(`- ${slug}: ${src} -> ${lang} ... `);
      const t = await translate({
        fromLang: src, toLang: lang,
        title: files[src].data.title, note: files[src].data.content_note, body: files[src].content.trim(),
      });
      const data = { ...(files[lang] ? files[lang].data : {}), title: t.title, content_note: t.content_note };
      // The default-language file also carries the shared fields
      if (lang === site.default_language) {
        for (const k of ['working_title', 'author', 'author_link', 'original_language', 'mature', 'date']) {
          if (shared[k] !== undefined && data[k] === undefined) data[k] = shared[k];
        }
      }
      fs.writeFileSync(path.join(DIR, `${slug}.${lang}.md`), matter.stringify(t.body + '\n', data));
      console.log('done');
      done++;
    }
  }
  console.log(done ? `\n${done} translation(s) written. Read them before publishing.` : 'Nothing to translate.');
})().catch((e) => { console.error(e.message); process.exit(1); });
