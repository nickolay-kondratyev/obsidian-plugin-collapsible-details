# Details Markdown

An Obsidian plugin that renders Markdown inside native HTML
[`<details>`/`<summary>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details)
blocks. Obsidian intentionally does not parse Markdown inside raw HTML blocks, so
headings, lists, tables, internal links, and embeds inside a `<details>` fold show
as literal text. This plugin fixes that: the body renders as real Markdown, visually
identical to the same content written outside the block.

> **Scope:** Rendering happens in **Reading view**. Live Preview (the editor) is not
> yet supported — there, the block shows Obsidian's native output. Support for Live
> Preview is planned for a future release.

## Supported block shape

```
<details>
<summary>Summary text</summary>
### Any markdown body
- lists, [[internal links]], tables, embeds, code fences

blank lines in the body are supported (incl. inside code fences)
</details>
```

- `<details>` on its own line; an `open` attribute is allowed.
- `<summary>...</summary>` is optional and single-line, immediately after `<details>`.
- The body is everything up to `</details>`, on its own line.
- Unsupported, malformed, or unclosed blocks are left untouched (native behavior).
- Rendering the `<summary>` text itself as Markdown is out of scope.

## Settings

A single toggle enables or disables the plugin. When off, Obsidian's native
(literal) behavior returns with nothing left behind.

## Installation

### From the Community Plugins directory

Settings → Community plugins → Browse → search for "Details Markdown" → Install →
Enable.

### Manual

Copy `manifest.json`, `main.js`, and `styles.css` into
`<vault>/.obsidian/plugins/details-markdown/`, then enable the plugin in
Settings → Community plugins.

## Development

```bash
npm install
npm test        # unit tests (parser)
npm run build   # typecheck + bundle -> main.js
npm run dev     # watch mode
```

Manual acceptance tests: `test-vault-notes/Details Markdown Acceptance.md`.

### How it works

Obsidian ends an HTML block at the first blank line, so a `<details>` body with
blank lines is split across several render sections and its tail "escapes" the
fold. The plugin re-assembles blocks from **raw source** (never from rendered DOM):

- `DetailsRangeScanner` scans the full note text for supported block line ranges
  (fence-aware, nesting-aware; unclosed blocks yield no range).
- `SectionRoleClassifier` decides per rendered section: **opening** (starts a
  block) → render the whole body via `MarkdownRenderer.render` into the existing
  `<details>` element (native `<summary>` and `open` attribute preserved);
  **fragment** (escaped content inside a block) → hidden, but only once its block's
  opening actually rendered, so content can never be lost.
- A `MarkdownRenderChild` registered via `ctx.addChild` ties embeds/lifecycles to
  the note, so nothing leaks when the note closes. A registry reconciles edits:
  interior edits re-render the fold body in place; deleting a block boundary
  restores native output.
- `MarkdownRenderer.render` is host-less, so it omits the reading-view "Open link"
  button that decorates note embeds natively. An `EmbedOpenLinkRenderChild` restores
  it: a scoped `MutationObserver` (disconnected on unload) re-applies the affordance
  as embeds load — including lazily, when a collapsed fold is expanded.

## License

[MIT](LICENSE)
