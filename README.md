# Art Will Save

Short stories on stickers. Each sticker's QR code opens **artwillsave.com/r**, which sends the reader to a random story in their language (English, Québec French or Mexican Spanish).

Everything here runs on free tiers: GitHub for the files, Netlify for hosting and the submission form, Decap CMS for the editor dashboard. The only fixed cost is the domain.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| Stories | `stories/` folder | One file per language: `the-meter.en.md`, `the-meter.fr.md`, `the-meter.es.md` |
| Submissions | Netlify Forms | The form at `/en/submit/` (and `/fr/`, `/es/`) sends entries to your Netlify dashboard and email |
| Curation | `artwillsave.com/admin` | Editor dashboard. New stories start as drafts and only go live when you publish them |
| Translation | GitHub Actions or a Claude chat | Fills in missing languages; you review before it's published |
| Random picker | `/r/` | Picks a story the reader hasn't seen yet, preferring ones in their language |
| Adult content | Per-story "For adults" switch | Shows a warning screen with the content note; reader chooses to open it or get another story. Nothing is cut |

## One-time setup

### 1. Put the code on GitHub
1. Create a free account at github.com if you don't have one.
2. New repository, name it `artwillsave`, private or public (either works).
3. Upload every file in this folder (drag the contents of the unzipped folder onto the "upload files" page). Skip `node_modules` and `_site` if they're there.

### 2. Host it on Netlify
1. Sign up at netlify.com with your GitHub account (Free plan).
2. Add new site > Import an existing project > GitHub > pick `artwillsave`.
3. The build settings fill themselves in from `netlify.toml` (build `npm run build`, publish `_site`). Deploy.
4. You'll get a temporary address like `something.netlify.app`. Check it works.

### 3. Point artwillsave.com at Netlify (this also cuts off the old WordPress site)
1. In Netlify: Domain management > Add a domain > `artwillsave.com`.
2. Easiest route: choose **Netlify DNS**. Netlify shows four nameservers.
3. In Namecheap: Domain List > artwillsave.com > Manage > Nameservers > Custom DNS > paste the four Netlify nameservers > save.
4. Wait for it to switch (minutes to a few hours). Netlify adds the free HTTPS certificate on its own.
5. Once the site loads from Netlify, delete the old WordPress install wherever it was hosted, and change any passwords you used for it.

### 4. Turn on submission emails
Netlify > your site > Forms. The `story-submission` form appears after the first deploy. Under Form notifications, add an email notification to your address. Spam filtering and the hidden honeypot field are already on.

### 5. Let the editor dashboard log in with GitHub
1. GitHub > Settings > Developer settings > OAuth Apps > New OAuth App.
   - Homepage URL: `https://artwillsave.com`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
2. Copy the Client ID and generate a Client Secret.
3. Netlify > your site > Site configuration > Access & security > OAuth > Install provider > GitHub, paste both.
4. Go to `artwillsave.com/admin` and log in with GitHub. Only people with access to the repository can get in.

### 6. Optional: tip jar
Make a free Ko-fi (or similar) page, then put its link in `src/site.json` under `support_url`. A "Help pay for stickers" link appears in the footer and on the About page. Add your email under `contact_email` so writers can ask to have a story taken down.

## Day to day: from submission to sticker

1. **Read submissions** in Netlify > Forms (or your email).
2. **Publish one you like:** artwillsave.com/admin > New Story.
   - Working title (for your list and the web address), author, author link, original language, "For adults" if the writer ticked it.
   - Click the tab for the language it was written in (EN / FR / ES) and paste the title, content note and story there.
   - Fill the other language tabs with translations, or leave them empty for now.
   - Save. It sits in the Drafts column. Move it to Ready, then Publish. The site rebuilds in about a minute.
3. **Email the writer** to tell them it's live.

To take a story down, open it in the dashboard and delete it.

## Translations

Empty language tabs fall back to the original text with a note saying it isn't translated yet, so nothing breaks while you catch up.

**Free route:** open `TRANSLATION_PROMPT.md`, paste it into a Claude chat with the story, and paste the result into the matching tab in the dashboard. The prompt asks for Québec French and Mexican Spanish, keeps slang, profanity and tone at full strength, and swaps idioms for ones with the same effect instead of translating them word for word.

**Automatic route (costs a few cents per story):**
1. Get an API key at console.anthropic.com.
2. GitHub repo > Settings > Secrets and variables > Actions > New secret named `ANTHROPIC_API_KEY`.
3. After publishing a story, go to the repo's Actions tab > "Translate missing languages" > Run workflow.
4. It opens a pull request with the translations. Netlify adds a preview link to it. Read them, fix anything, then Merge to publish.

It never overwrites a translation that already has text.

## Stickers

- `stickers/sticker-3in.pdf` and `stickers/sticker-3in-300dpi.png`: a 3 x 3 inch print-ready sticker (rounded square die cut).
- `stickers/qr.svg`: the QR code alone, high error correction so scuffed stickers still scan.
- To tell drops apart later, make a batch code: `npm run qr -- playa01` creates a QR for `artwillsave.com/r?b=playa01`. It works the same for readers; the code only matters once you add analytics.

## Working on it on a computer

```
npm install
npm run serve      # builds and previews at http://localhost:8080
npm run build      # builds into _site/
```

Interface text for all three languages is in `src/i18n.json`. Colors and type are in `src/assets/styles.css`. The word limit (2,500) is in `src/site.json`.

The two stories in `stories/` are samples so you can see everything working (one is flagged for adults and has no French version, to show the warning screen and the fallback). Delete them once real stories are in.
