# obsidian-plugin-collapsible-details

Obsidian plugin ("Details Markdown") that renders Markdown inside native HTML
[`<details>`/`<summary>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details)
blocks — headings, lists, tables, internal links, and embeds render as real
Markdown instead of literal text.

Requirements: see [req.md](req.md). Phase 1 + 1.5 (Reading mode, incl. blank-line
bodies) are implemented; Phase 2 (Live Preview) is next.

## Supported block shape

```
<details>
<summary>Summary text</summary>
### Any markdown body
- lists, [[internal links]], tables, embeds, code fences

blank lines in the body are supported (incl. inside code fences)
</details>
```

Tags must be on their own lines; the summary is optional and single-line.
Unsupported/malformed/unclosed blocks are left untouched (native behavior).

## Development

```bash
npm install
npm test        # unit tests (parser)
npm run build   # typecheck + bundle -> main.js
npm run dev     # watch mode
```

Install into a vault: copy `manifest.json`, `main.js` and `styles.css` into
`<vault>/.obsidian/plugins/details-markdown/`.

Manual acceptance tests: `test-vault-notes/Details Markdown Acceptance.md`.

## How it works (Phase 1 + 1.5)

Obsidian ends an HTML block at the first blank line, so a `<details>` body with
blank lines is split across several render sections and its tail "escapes" the
fold. The plugin re-assembles blocks from **raw source** (never from rendered
DOM):

- `DetailsRangeScanner` scans the full note text for supported block line ranges
  (fence-aware, nesting-aware; unclosed blocks yield no range).
- `SectionRoleClassifier` decides per rendered section: **opening** (starts a
  block) → render the whole body via `MarkdownRenderer.render` into the existing
  `<details>` element (native `<summary>` and `open` attribute preserved);
  **fragment** (escaped content inside a block) → hidden, but only once its
  block's opening actually rendered, so content can never be lost.
- A `MarkdownRenderChild` registered via `ctx.addChild` ties embeds/lifecycles to
  the note, so nothing leaks when the note closes. A registry reconciles edits:
  interior edits re-render the fold body in place; deleting a block boundary
  restores native output.

A single settings toggle disables processing and re-renders open views to
restore native behavior.
