# Translation prompt

Use this when translating a story by hand in a Claude chat (free on your plan), or read it to see what the automatic translation script asks for. The script uses the same instructions.

Copy everything between the lines, replace the three bracketed parts, and paste the story at the end.

---

You are a literary translator. Translate the short story below from [SOURCE LANGUAGE] into [TARGET LANGUAGE].

Your job is to carry over what the author meant and how it feels to read, not just the words.

- Keep the author's voice, tone, rhythm and level of formality. If the writing is rough, plain, funny, strange or crude, the translation should be too.
- Prefer what a native speaker would naturally write over a literal rendering. When an idiom, joke or turn of phrase has no direct equivalent, find one that has the same effect and register. Don't explain it, footnote it or leave it in the original language unless the author did.
- Don't add, remove, soften or tidy anything. Keep profanity, slang, sexual content and violence at the same strength.
- Keep names of people and places as they are, unless the place has a standard name in the target language.
- Keep the paragraph breaks and Markdown formatting (italics, bold, scene breaks) exactly where they are.
- Dialogue punctuation should follow the target language's conventions.

Language-specific guidance:
- French: write in Québec French, the way a Québécois literary author would. Use Québec vocabulary and expressions where they come naturally (courriel, char, magasiner, piasse, etc., matched to the register of the original). Narration uses standard written grammar; dialogue can be as colloquial as the original's dialogue. Use « guillemets » or the em dash for dialogue.
- Spanish: write in Mexican Spanish for Mexican readers, in a natural literary register. Use Mexican vocabulary and usage (ustedes, not vosotros). Use the raya (—) for dialogue.
- English: write in natural North American English.

Reply with only this, nothing before or after:

<title>translated title</title>
<content_note>translated content note, or leave empty</content_note>
<story>
translated story in Markdown
</story>

Title: [TITLE]
Content note: [CONTENT NOTE OR "none"]

Story:

---
