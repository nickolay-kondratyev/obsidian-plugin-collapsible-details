# Project: Details Markdown (Obsidian plugin)

- Purpose: render Markdown inside native `<details>`/`<summary>` blocks. Requirements: `req.md` (Phase 1 + 1.5 = Reading mode incl. blank-line bodies, done; Phase 2 = Live Preview, next).
- Commands: `npm test` (vitest, pure-logic unit tests), `npm run build` (tsc typecheck + esbuild -> `main.js`), `npm run dev` (watch).
- Architecture (all rendering from **raw source** via `ctx.getSectionInfo`, never from rendered DOM):
  - `src/DetailsTagPatterns.ts` — shared line regexes (DRY between parser/scanner).
  - `src/DetailsBlockParser.ts` — pure parser of one block's source; `null` = unsupported → native.
  - `src/DetailsRangeScanner.ts` — pure scan of full note text for block line ranges (fence-aware, nesting-aware, unclosed → no range).
  - `src/SectionRoleClassifier.ts` — pure: section line-span → opening | fragment | none.
  - `src/main.ts` — orchestration: opening sections render full body (`MarkdownRenderer.render`); escaped fragment sections hidden (styles.css class) only after opening rendered; registry per path reconciles interior edits (in-place body re-render), boundary deletions (full view rerender), unhide, cleanup. Lifecycle via `MarkdownRenderChild` + `ctx.addChild`; idempotency via `data-details-markdown-rendered`.
  - `src/EmbedOpenLinkDecorator.ts` — pure DOM (deps injected, no Obsidian import; happy-dom unit-tested): adds the native "Open link" `.markdown-embed-link` button to loaded note embeds, which host-less `MarkdownRenderer.render` omits.
  - `src/EmbedOpenLinkRenderChild.ts` — the body's `MarkdownRenderChild`; runs the decorator on load and re-runs it via a scoped `MutationObserver` (disconnected on unload) as embeds load lazily (e.g. fold expand).
- Key constraint: Obsidian ends an HTML block at the first blank line — a blank-line body splits into multiple sections; plugin re-assembles them (that's the whole point of Phase 1.5). Reading mode renders sections lazily and detached-first (`isConnected` false during postprocessor).
- Manual acceptance: `test-vault-notes/Details Markdown Acceptance.md` (needs a real vault; not runnable in CI).
- Reference plugin `RubiaPath/obsidian-folded-markdown-renderer`: do NOT fork/copy (req.md).
