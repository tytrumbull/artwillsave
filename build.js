// Builds the static site into _site/.
// Stories live in stories/<slug>.<lang>.md (the format the admin dashboard writes).
// Run: npm run build

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/site.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n.json'), 'utf8'), (k, v) => (typeof v === 'string' ? v.replace(/'/g, '\u2019') : v));
const LANGS = site.languages;
const WORDS_PER_MINUTE = 220;

// ---------- helpers ----------
const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
const countWords = (text) => (text.trim().match(/\S+/g) || []).length;
const fmtNum = (n, lang) => n.toLocaleString(T[lang].html_lang);
const langName = (viewLang, code) => T[viewLang].lang_names[code] || T[viewLang].lang_names.other;

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// Curly apostrophes everywhere; curly double quotes for English. Only touches text, not tags.
function smarten(html, lang) {
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) return part;
    let s = part.replace(/&#39;/g, "'").replace(/(\w)'(\w)/g, '$1\u2019$2').replace(/(^|[\s(\[\u2014-])'/g, '$1\u2018').replace(/'/g, '\u2019');
    if (lang === 'en') s = s.replace(/&quot;/g, '"').replace(/(^|[\s(\[\u2014-])"/g, '$1\u201C').replace(/"/g, '\u201D');
    return s;
  }).join('');
}

// ---------- load stories ----------
function loadStories() {
  const dir = path.join(ROOT, 'stories');
  const bySlug = {};
  for (const file of fs.readdirSync(dir)) {
    const m = file.match(/^(.+)\.([a-z]{2})\.md$/);
    if (!m) continue;
    const [, slug, lang] = m;
    const parsed = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
    (bySlug[slug] ||= {})[lang] = parsed;
  }

  const stories = [];
  for (const [slug, files] of Object.entries(bySlug)) {
    // Shared fields: take them from whichever files have them, default language first.
    const order = [site.default_language, ...Object.keys(files).filter((l) => l !== site.default_language)];
    const meta = {};
    for (const l of order) {
      if (!files[l]) continue;
      for (const [k, v] of Object.entries(files[l].data)) {
        if (!(k in meta) && v !== '' && v !== null && v !== undefined) meta[k] = v;
      }
    }
    if (meta.draft === true) continue;

    const versions = {};
    for (const [l, f] of Object.entries(files)) {
      const body = (f.content || '').trim();
      if (!body) continue;
      versions[l] = {
        title: f.data.title || meta.working_title || slug,
        content_note: f.data.content_note || '',
        html: smarten(marked.parse(body), l),
        words: countWords(body),
      };
    }
    if (!Object.keys(versions).length) {
      console.warn(`  skipped "${slug}": no story text in any language`);
      continue;
    }
    let original = meta.original_language;
    if (!versions[original]) original = versions[site.default_language] ? site.default_language : Object.keys(versions)[0];

    stories.push({
      slug,
      author: meta.author || '',
      author_link: meta.author_link || '',
      mature: meta.mature === true || meta.mature === 'true',
      original,
      date: meta.date ? new Date(meta.date) : new Date(0),
      versions,
    });
  }
  stories.sort((a, b) => b.date - a.date);
  return stories;
}

// Which text to show for a story on a page in `lang`
function versionFor(story, lang) {
  if (story.versions[lang]) return { v: story.versions[lang], textLang: lang, fallback: false };
  return { v: story.versions[story.original], textLang: story.original, fallback: true };
}

// ---------- layout ----------
function layout({ lang, title, description = '', body, pagePath, alternates = {}, pageClass = '', noindex = false }) {
  const t = T[lang];
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  const switcher = LANGS.map((l) => {
    const href = alternates[l] || `/${l}/`;
    return l === lang
      ? `<a href="${href}" lang="${T[l].html_lang}" aria-current="true">${T[l].language_name}</a>`
      : `<a href="${href}" lang="${T[l].html_lang}" hreflang="${T[l].html_lang}" data-setlang="${l}">${T[l].language_name}</a>`;
  }).join('');
  const hreflangs = Object.entries(alternates)
    .map(([l, href]) => `<link rel="alternate" hreflang="${T[l].html_lang}" href="${site.url}${href}">`).join('\n  ');
  const support = site.support_url
    ? `<a href="${esc(site.support_url)}" rel="noopener">${t.support}</a>` : '';

  return `<!doctype html>
<html lang="${t.html_lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description || t.tagline)}">
  ${noindex ? '<meta name="robots" content="noindex">' : ''}
  <meta property="og:title" content="${esc(title || site.name)}">
  <meta property="og:description" content="${esc(description || t.tagline)}">
  <meta property="og:type" content="${pageClass === 'page-story' ? 'article' : 'website'}">
  <meta property="og:url" content="${site.url}${pagePath}">
  <meta name="theme-color" content="#F1F2F4" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#12152A" media="(prefers-color-scheme: dark)">
  ${hreflangs}
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">
  <link rel="stylesheet" href="/assets/styles.css">
  <script>
    (function(d){d.documentElement.classList.add('js');try{if(localStorage.getItem('aws-adult-ok')==='1')d.documentElement.classList.add('adult-ok');${noindex ? '' : `localStorage.setItem('aws-lang','${lang}');`}}catch(e){}})(document);
  </script>
  <script src="/assets/app.js" defer></script>
</head>
<body class="${pageClass}" data-lang="${lang}">
  <a class="skip" href="#main">${lang === 'fr' ? 'Aller au contenu' : lang === 'es' ? 'Ir al contenido' : 'Skip to content'}</a>
  <header class="site-head">
    <a class="sticker sticker-sm" href="/${lang}/" aria-label="${esc(t.home_link)}"><span>Art Will Save</span></a>
    <nav class="lang-switch" aria-label="${esc(t.language_label)}">${switcher}</nav>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site-foot">
    <nav>
      <a href="/r/?lang=${lang}">${t.read_story}</a>
      <a href="/${lang}/stories/">${t.all_stories}</a>
      <a href="/${lang}/submit/">${t.submit_story}</a>
      <a href="/${lang}/about/">${t.about}</a>
      ${support}
    </nav>
  </footer>
</body>
</html>
`;
}

// ---------- pages ----------
function storyPage(story, lang) {
  const t = T[lang];
  const { v, textLang, fallback } = versionFor(story, lang);
  const minutes = Math.max(1, Math.round(v.words / WORDS_PER_MINUTE));
  const author = story.author_link
    ? `<a href="${esc(story.author_link)}" rel="noopener">${esc(story.author)}</a>`
    : esc(story.author);

  let note = '';
  if (fallback) note = `<p class="note">${fill(t.not_translated, { lang: langName(lang, textLang) })}</p>`;
  else if (textLang !== story.original) note = `<p class="note">${fill(t.translated_from, { lang: langName(lang, story.original) })}</p>`;

  const gate = story.mature ? `
      <section class="gate" aria-labelledby="gate-title">
        <h2 id="gate-title">${t.gate_title}</h2>
        <p>${t.gate_text}</p>
        ${v.content_note ? `<p class="gate-note"><strong>${t.gate_note}</strong> ${esc(v.content_note)}</p>` : ''}
        <div class="gate-actions">
          <button type="button" class="btn btn-primary" data-gate-yes>${t.gate_yes}</button>
          <a class="btn btn-quiet" href="/r/?lang=${lang}&amp;from=${story.slug}">${t.gate_no}</a>
        </div>
        <label class="check"><input type="checkbox" data-skip-adult> ${t.gate_skip}</label>
      </section>` : '';

  const alternates = Object.fromEntries(LANGS.map((l) => [l, `/${l}/s/${story.slug}/`]));
  const body = `
    <article class="story${story.mature ? ' is-mature' : ''}" data-slug="${story.slug}">
      <header class="story-head">
        <h1 lang="${T[textLang].html_lang}">${esc(v.title)}</h1>
        ${story.author ? `<p class="byline">${t.by} ${author}</p>` : ''}
        <p class="meta">${fill(t.min_read, { n: minutes })}${story.mature ? `<span class="tag">${t.adult_label}</span>` : ''}</p>
        ${note}
      </header>${gate}
      <div class="story-body" lang="${T[textLang].html_lang}">
${v.html}
      </div>
      <div class="story-after">
        <span class="end-mark" aria-hidden="true"></span>
        <a class="btn btn-primary btn-big" href="/r/?lang=${lang}&amp;from=${story.slug}">${t.another_story}</a>
        <p class="after-links">
          <button type="button" class="btn-link" data-share data-copied="${esc(t.link_copied)}">${t.share}</button>
          <a href="/${lang}/submit/">${t.submit_story}</a>
        </p>
      </div>
    </article>`;
  const description = v.content_note && story.mature ? `${t.adult_label}. ${v.content_note}` : `${t.by} ${story.author}. ${fill(t.min_read, { n: minutes })}.`;
  return layout({ lang, title: v.title, description, body, pagePath: `/${lang}/s/${story.slug}/`, alternates, pageClass: 'page-story' });
}

function homePage(lang, stories) {
  const t = T[lang];
  const body = `
    <section class="home">
      <p class="sticker sticker-lg" aria-hidden="true"><span>Art Will Save</span></p>
      <h1 class="home-tagline">${t.tagline}</h1>
      <p class="lede">${t.home_intro}</p>
      <p class="home-actions">
        <a class="btn btn-primary btn-big" href="/r/?lang=${lang}">${t.read_story}</a>
        <a class="btn btn-quiet" href="/${lang}/submit/">${t.submit_story}</a>
      </p>
      ${stories.length ? `<p class="count"><a href="/${lang}/stories/">${t.all_stories}</a> (${stories.length})</p>` : ''}
    </section>`;
  const alternates = Object.fromEntries(LANGS.map((l) => [l, `/${l}/`]));
  return layout({ lang, title: '', body, pagePath: `/${lang}/`, alternates, pageClass: 'page-home' });
}

function collectionPage(lang, stories) {
  const t = T[lang];
  const items = stories.map((s) => {
    const { v } = versionFor(s, lang);
    const minutes = Math.max(1, Math.round(v.words / WORDS_PER_MINUTE));
    return `
        <li>
          <a href="/${lang}/s/${s.slug}/">${esc(v.title)}</a>
          <span class="li-meta">${s.author ? `${t.by} ${esc(s.author)}. ` : ''}${fill(t.min_read, { n: minutes })}${s.mature ? `<span class="tag">${t.adult_label}</span>` : ''}</span>
        </li>`;
  }).join('');
  const body = `
    <section class="page">
      <h1>${t.collection_title}</h1>
      <p class="lede">${t.collection_intro}</p>
      ${stories.length ? `<ul class="story-list">${items}\n      </ul>` : `<p>${t.collection_empty} <a href="/${lang}/submit/">${t.submit_story}</a></p>`}
    </section>`;
  const alternates = Object.fromEntries(LANGS.map((l) => [l, `/${l}/stories/`]));
  return layout({ lang, title: t.collection_title, body, pagePath: `/${lang}/stories/`, alternates });
}

function submitPage(lang) {
  const t = T[lang];
  const max = site.max_words;
  const langOptions = ['en', 'fr', 'es', 'other'].map((l) =>
    `<option value="${l}"${l === lang ? ' selected' : ''}>${l === 'other' ? cap(t.lang_names.other) : cap(t.lang_names[l])}</option>`).join('');
  const body = `
    <section class="page">
      <h1>${t.submit_title}</h1>
      <p class="lede">${fill(t.submit_intro, { max: fmtNum(max, lang) })}</p>
      <p>${t.submit_process}</p>

      <form class="submit-form" name="story-submission" method="POST" action="/${lang}/thanks/"
            data-netlify="true" netlify-honeypot="company" data-max-words="${max}">
        <input type="hidden" name="form-name" value="story-submission">
        <input type="hidden" name="site_language" value="${lang}">
        <p class="hp"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>

        <div class="field">
          <label for="f-name">${t.f_name}</label>
          <input id="f-name" name="author" required autocomplete="name" aria-describedby="f-name-hint">
          <p class="hint" id="f-name-hint">${t.f_name_hint}</p>
        </div>
        <div class="field">
          <label for="f-email">${t.f_email}</label>
          <input id="f-email" name="email" type="email" required autocomplete="email" aria-describedby="f-email-hint">
          <p class="hint" id="f-email-hint">${t.f_email_hint}</p>
        </div>
        <div class="field">
          <label for="f-link">${t.f_link} <span class="opt">(${t.f_optional})</span></label>
          <input id="f-link" name="author_link" type="url" inputmode="url" placeholder="https://" aria-describedby="f-link-hint">
          <p class="hint" id="f-link-hint">${t.f_link_hint}</p>
        </div>
        <div class="field">
          <label for="f-title">${t.f_title}</label>
          <input id="f-title" name="title" required>
        </div>
        <div class="field">
          <label for="f-lang">${t.f_language}</label>
          <select id="f-lang" name="original_language">${langOptions}</select>
        </div>
        <div class="field">
          <label for="f-story">${t.f_story}</label>
          <p class="hint" id="f-story-hint">${t.f_story_hint}</p>
          <textarea id="f-story" name="story" rows="16" required aria-describedby="f-story-hint f-count"></textarea>
          <p class="count-line" id="f-count" aria-live="polite"
             data-template="${esc(t.f_words)}" data-over="${esc(t.f_over)}" data-max="${max}" data-locale="${t.html_lang}">${fill(t.f_words, { n: 0, max: fmtNum(max, lang) })}</p>
        </div>
        <div class="field">
          <label class="check"><input type="checkbox" name="mature" value="yes" data-mature-toggle> ${t.f_adult}</label>
        </div>
        <div class="field" data-note-field>
          <label for="f-note">${t.f_note} <span class="opt">(${t.f_optional})</span></label>
          <input id="f-note" name="content_note" aria-describedby="f-note-hint">
          <p class="hint" id="f-note-hint">${t.f_note_hint}</p>
        </div>
        <div class="field">
          <label class="check"><input type="checkbox" name="rights" value="agreed" required> ${t.f_rights}</label>
        </div>
        <button class="btn btn-primary btn-big" type="submit">${t.f_send}</button>
      </form>
    </section>`;
  const alternates = Object.fromEntries(LANGS.map((l) => [l, `/${l}/submit/`]));
  return layout({ lang, title: t.submit_title, body, pagePath: `/${lang}/submit/`, alternates });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function thanksPage(lang) {
  const t = T[lang];
  const body = `
    <section class="page">
      <h1>${t.thanks_title}</h1>
      <p class="lede">${t.thanks_text}</p>
      <p><a class="btn btn-primary btn-big" href="/r/?lang=${lang}">${t.read_story}</a></p>
    </section>`;
  const alternates = Object.fromEntries(LANGS.map((l) => [l, `/${l}/thanks/`]));
  return layout({ lang, title: t.thanks_title, body, pagePath: `/${lang}/thanks/`, alternates, noindex: true });
}

function aboutPage(lang) {
  const t = T[lang];
  const paras = t.about_body.split('\n\n').map((p) => `<p>${p}</p>`).join('\n      ');
  const support = site.support_url ? `<p><a class="btn btn-primary" href="${esc(site.support_url)}" rel="noopener">${t.support}</a></p>` : '';
  const contact = site.contact_email
    ? `<p class="small">${t.about_remove.replace(/(email us|écrivez-nous|escríbannos)/, `<a href="mailto:${esc(site.contact_email)}">$1</a>`)}</p>`
    : `<p class="small">${t.about_remove}</p>`;
  const body = `
    <section class="page prose">
      <h1>${t.about_title}</h1>
      ${paras}
      ${support}
      <p><label class="check"><input type="checkbox" data-skip-adult> ${t.settings_skip}</label></p>
      ${contact}
    </section>`;
  const alternates = Object.fromEntries(LANGS.map((l) => [l, `/${l}/about/`]));
  return layout({ lang, title: t.about_title, body, pagePath: `/${lang}/about/`, alternates });
}

function randomPage() {
  // Language-neutral page that picks a story and redirects. Sticker QR codes point here.
  const t = T[site.default_language];
  const body = `
    <section class="page finding" data-random>
      <p class="sticker sticker-lg is-spinning" aria-hidden="true"><span>Art Will Save</span></p>
      <p class="lede" data-finding-text>${LANGS.map((l) => `<span lang="${T[l].html_lang}" data-l="${l}" hidden>${T[l].finding}</span>`).join('')}</p>
      <noscript><p>${LANGS.map((l) => `<a href="/${l}/stories/" lang="${T[l].html_lang}">${T[l].finding_nojs}</a>`).join('<br><br>')}</p></noscript>
    </section>`;
  return layout({ lang: site.default_language, title: t.finding, body, pagePath: '/r/', pageClass: 'page-random', noindex: true });
}

function rootPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name}</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${T[l].html_lang}" href="${site.url}/${l}/">`).join('\n  ')}
  <script>
    (function(){var L=${JSON.stringify(LANGS)},l=null;try{l=localStorage.getItem('aws-lang');}catch(e){}
    if(L.indexOf(l)<0){var n=(navigator.languages||[navigator.language||'']);for(var i=0;i<n.length;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(L.indexOf(c)>=0){l=c;break;}}}
    location.replace('/'+(L.indexOf(l)>=0?l:'${site.default_language}')+'/');})();
  </script>
</head>
<body>
  <p>${LANGS.map((l) => `<a href="/${l}/" lang="${T[l].html_lang}">${T[l].language_name}</a>`).join(' | ')}</p>
</body>
</html>
`;
}

function notFoundPage() {
  const body = `
    <section class="page">
      ${LANGS.map((l) => `<div lang="${T[l].html_lang}" class="nf">
        <h1>${T[l].notfound_title}</h1>
        <p>${T[l].notfound_text}</p>
        <p><a class="btn btn-primary" href="/r/?lang=${l}">${T[l].read_story}</a></p>
      </div>`).join('\n')}
    </section>`;
  return layout({ lang: site.default_language, title: T.en.notfound_title, body, pagePath: '/404.html', noindex: true });
}

// ---------- build ----------
function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const stories = loadStories();
  console.log(`Building ${stories.length} stories in ${LANGS.join(', ')}`);

  for (const lang of LANGS) {
    write(`${lang}/index.html`, homePage(lang, stories));
    write(`${lang}/stories/index.html`, collectionPage(lang, stories));
    write(`${lang}/submit/index.html`, submitPage(lang));
    write(`${lang}/thanks/index.html`, thanksPage(lang));
    write(`${lang}/about/index.html`, aboutPage(lang));
    for (const s of stories) write(`${lang}/s/${s.slug}/index.html`, storyPage(s, lang));
  }
  write('index.html', rootPage());
  write('r/index.html', randomPage());
  write('404.html', notFoundPage());

  // Compact index used by the random picker
  write('stories.json', JSON.stringify(stories.map((s) => ({
    s: s.slug, m: s.mature ? 1 : 0, l: Object.keys(s.versions),
  }))));

  // Sitemap
  const urls = LANGS.flatMap((l) => [`/${l}/`, `/${l}/stories/`, `/${l}/submit/`, `/${l}/about/`, ...stories.map((s) => `/${l}/s/${s.slug}/`)]);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site.url}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nDisallow: /admin/\nSitemap: ${site.url}/sitemap.xml\n`);

  copyDir(path.join(ROOT, 'src/assets'), path.join(OUT, 'assets'));
  copyDir(path.join(ROOT, 'src/admin'), path.join(OUT, 'admin'));
  console.log('Done: _site/');
}

build();
