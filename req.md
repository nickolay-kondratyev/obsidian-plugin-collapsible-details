# Requirements: Obsidian "Details Markdown" plugin

## Objective

Make Markdown render correctly inside native HTML `<details>` / `<summary>` blocks in Obsidian. Today Obsidian intentionally does not parse Markdown inside raw HTML blocks, so headings, lists, tables, and internal links inside a `<details>` fold show as literal text. The plugin fixes that.

Keep it simple and robust. This is a small, focused plugin, not a framework.

## Context (so the terrain is understood, not a spec)

- Obsidian skips Markdown parsing inside HTML blocks by design (a CommonMark rule). We render the body ourselves.
- A blank line inside a `<details>` block terminates the HTML block early in Obsidian. We therefore only support blocks with no interior blank lines (see Supported input).
- A reference plugin exists (`RubiaPath/obsidian-folded-markdown-renderer`). Do not fork or copy it. It is Reading-mode only and has fidelity and lifecycle problems we explicitly want to avoid. It may be read once for orientation, nothing more.

## Scope

Two phases, each independently shippable:

- **Phase 1 (MVP): Reading mode.** The simple, robust core.
- **Phase 2: Live Preview (the editor).** The main reason the plugin exists, and the harder half. Build second.

Do not begin Phase 2 until Phase 1 meets its acceptance criteria.

## Supported input (the contract)

The plugin must handle exactly this shape, with no blank lines between the tags:

```
<details>
<summary>Summary text</summary>
### Any markdown body
- lists, [[internal links]], tables, embeds
</details>
```

- `<details>` on its own line; an `open` attribute is allowed.
- `<summary>...</summary>` optional, on a single line, immediately after `<details>`.
- Body: everything between the summary (or the opening tag if no summary) and `</details>`.
- `</details>` on its own line.
- Any block that does not match this shape (blank line inside, malformed, unclosed) is left untouched.

## Functional requirements

1. In Reading mode, the body of a supported `<details>` block renders as real Markdown, visually identical to the same content written outside the block.
2. In Live Preview, the same block renders when the cursor is outside it.
3. In Live Preview, when the cursor is inside the block, the raw source is shown so it can be edited normally. Moving the cursor out re-renders it.
4. The `<details>` fold still works: `open` state is respected, and expand/collapse behaves natively.
5. Markdown features inside the body work fully: headings, lists, tables, internal links (clickable and resolving), and embeds/transclusions.
6. Multiple `<details>` blocks in one note render independently.
7. A single setting toggles the plugin on or off. When off, Obsidian's native (literal) behavior returns with nothing left behind.

## Quality requirements (outcomes, not methods)

- **Faithful rendering.** The rendered body must preserve the original structure (line breaks, paragraphs, indentation, links). No lossy reconstruction from already-rendered text.
- **No leaks.** Anything with a lifecycle inside the body (embeds, Dataview, transclusions) must unload when the note closes. Nothing should accumulate across opens/closes.
- **No crashes.** Malformed or unsupported blocks degrade gracefully to native behavior; the plugin never throws into Obsidian's render loop.
- **Idempotent.** Re-renders, scrolling, and cursor movement never double-render or stack duplicate content.
- **Works on mobile** as well as desktop.

## Non-goals (do not build now)

- Rendering blocks that contain interior blank lines.
- Rendering Markdown inside the `<summary>` text itself.
- Settings beyond the single on/off toggle.
- Deep nested-`<details>` fidelity beyond "the outer block renders and nothing breaks".
- PDF export / print edge cases.

## Acceptance tests

Build a test note covering each case. Phase 1 verifies in Reading mode; Phase 2 re-verifies 2 through 8 in the editor.

1. Summary + heading + bullet list renders as heading and list, not literal text.
2. Same block renders in Live Preview when the cursor is elsewhere.
3. Cursor inside the block shows raw source, with no flicker; moving out re-renders.
4. `<details open>` stays open; user expand/collapse still works.
5. Body with a table, an internal link, and an embed: table renders, link resolves and is clickable, embed loads. Closing the note leaves nothing leaked or duplicated.
6. Two blocks in one note both render independently.
7. Toggling the setting off restores native behavior with no leftovers.
8. A block with an interior blank line does not crash and is left as-is.

Ship Phase 1 when 1, 4, 5, 6, 7 pass in Reading mode. Ship Phase 2 when all 8 pass in the editor.
