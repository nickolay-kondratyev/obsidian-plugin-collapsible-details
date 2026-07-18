# obsidian-plugin-collapsible-details

Obsidian plugin ("Details Markdown") that renders Markdown inside native HTML
[`<details>`/`<summary>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details)
blocks — headings, lists, tables, internal links, and embeds render as real
Markdown instead of literal text.

Requirements: see [req.md](req.md). Phase 1 (Reading mode) is implemented;
Phase 2 (Live Preview) is next.

## Supported block shape

No blank lines inside the block (a blank line ends an HTML block in Obsidian):

```
<details>
<summary>Summary text</summary>
### Any markdown body
- lists, [[internal links]], tables, embeds
</details>
```

Unsupported/malformed blocks are left untouched (native behavior).

## Development

```bash
npm install
npm test        # unit tests (parser)
npm run build   # typecheck + bundle -> main.js
npm run dev     # watch mode
```

Install into a vault: copy `manifest.json` and `main.js` into
`<vault>/.obsidian/plugins/details-markdown/`.

Manual acceptance tests: `test-vault-notes/Details Markdown Acceptance.md`.

## How it works (Phase 1)

A Markdown post-processor detects a supported `<details>` section, re-reads the
**raw source** via `getSectionInfo` (no lossy DOM reconstruction), parses it with
`DetailsBlockParser`, and renders the body with `MarkdownRenderer.render` into the
existing `<details>` element (native `<summary>` and `open` attribute preserved).
A `MarkdownRenderChild` registered via `ctx.addChild` ties embeds/lifecycles to
the note, so nothing leaks when the note closes. A single settings toggle
disables processing and re-renders open views to restore native behavior.
