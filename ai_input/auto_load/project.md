# Project: Details Markdown (Obsidian plugin)

- Purpose: render Markdown inside native `<details>`/`<summary>` blocks. Requirements: `req.md` (Phase 1 = Reading mode, done; Phase 2 = Live Preview, next).
- Commands: `npm test` (vitest, parser unit tests), `npm run build` (tsc typecheck + esbuild -> `main.js`), `npm run dev` (watch).
- Architecture:
  - `src/DetailsBlockParser.ts` — pure, unit-tested parser of the supported block shape; returns `null` for anything unsupported (caller leaves native rendering untouched).
  - `src/main.ts` — plugin: Markdown post-processor re-renders body from **raw source** (`ctx.getSectionInfo`, never from rendered DOM) via `MarkdownRenderer.render`; lifecycle via `MarkdownRenderChild` + `ctx.addChild`; idempotency via `data-details-markdown-rendered` attribute; single on/off setting.
- Constraint: Obsidian ends an HTML block at a blank line — blocks with interior blank lines are unsupported by design.
- Manual acceptance: `test-vault-notes/Details Markdown Acceptance.md` (needs a real vault; not runnable in CI).
- Reference plugin `RubiaPath/obsidian-folded-markdown-renderer`: do NOT fork/copy (req.md).
