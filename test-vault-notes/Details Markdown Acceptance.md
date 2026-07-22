# Details Markdown — acceptance tests

Copy this note (and a note named `Target Note` containing any content) into a vault
with the plugin installed. Phase 1: verify in Reading mode.

## Test 1 — summary + heading + bullet list

Expected: renders as a real heading and list, not literal text.

<details>
<summary>Test 1: heading and list</summary>
### A rendered heading
- bullet one
- bullet two
</details>

## Test 4 — open attribute

Expected: starts expanded; manual expand/collapse still works.

<details open>
<summary>Test 4: starts open</summary>
This body is visible immediately because of the open attribute.
</details>

## Test 5 — table, internal link, embed

Expected: table renders, link resolves and is clickable, embed loads. Hovering the
embed shows the "Open link" button (top-right) that opens the source note (mod-click
opens in a new tab). Close and reopen the note: nothing duplicated, nothing leaked.

<details>
<summary>Test 5: table, link, embed</summary>
| Column A | Column B |
| -------- | -------- |
| 1        | 2        |
[[Target Note]]
![[Target Note]]
</details>

## Test 6 — two independent blocks

Expected: both render independently.

<details>
<summary>Test 6a: first block</summary>
- first block content
</details>

<details>
<summary>Test 6b: second block</summary>
- second block content
</details>

## Test 7 — settings toggle

Turn the plugin's setting off: all blocks above revert to native literal text with
no leftovers. Turn it back on: they render again.

## Test 8 — blank lines in body, incl. code fence (Phase 1.5)

Expected: everything below renders INSIDE the fold — both paragraphs and the full
code fence with its blank lines. No escaped fragments visible below the fold, no
duplication. Edit a line after a blank line, switch back to Reading mode: the fold
updates (no stale body).

<details>
<summary>Test 8: blank lines and a Python fence</summary>
paragraph before blank

paragraph after blank
```python
some code

some more code, code will have empty lines
```
</details>

## Test 10 — attributes on details and summary

Expected: renders as a real heading and list (not literal text); the `class`
attributes are preserved on the rendered `<details>`/`<summary>` for CSS snippets.

<details class="bordered-when-open">
<summary class="central-thought-centered">Use goals to set direction. Rely on systems to make progress.</summary>
### Goals and Systems Simplified
- **Consistency beats intensity:** small, regular actions.
- **Enjoy the journey:** process over outcome.
</details>

## Test 11 — Open link on an embed inside a collapsed fold (lazy load)

Expected: the fold starts collapsed, so its embed loads only when expanded. After
expanding, hovering the embed shows the "Open link" button that opens the source —
proving the affordance is applied to embeds that load after the initial render.

<details>
<summary>Test 11: collapsed embed</summary>
![[Target Note]]
</details>

## Test 9 — unclosed block (malformed, must not crash)

Expected: left as-is (native behavior), no crash, and the trailing text below is
NOT hidden.

<details>
<summary>Test 9: no closing tag</summary>
this block never closes

This trailing paragraph must stay visible.
