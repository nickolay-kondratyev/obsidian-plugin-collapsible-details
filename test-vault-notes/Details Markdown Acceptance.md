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

Expected: table renders, link resolves and is clickable, embed loads.
Close and reopen the note: nothing duplicated, nothing leaked.

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

## Test 8 — interior blank line (unsupported, must not crash)

Expected: left as-is (native behavior), no crash.

<details>
<summary>Test 8: blank line inside</summary>
line before blank

line after blank
</details>
