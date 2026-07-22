# How to release & submit "Details Markdown"

Internal maintainer notes. Not part of the published plugin.

## Concepts (read once)

- The Community Plugins store installs a plugin from its **GitHub release assets**
  (`main.js`, `manifest.json`, `styles.css`) — it never clones the repo. So
  `main.js` is a build artifact: gitignored in source, uploaded to the release.
- The release **tag must equal `version` in `manifest.json`** exactly, with **no
  `v` prefix** (e.g. tag `0.1.0` for version `0.1.0`).
- `versions.json` maps each plugin version to the minimum Obsidian version. Obsidian
  uses it to serve the right release to older apps.

## 1. Cut the release (one command)

From a clean working tree on the default branch:

```bash
npm run release patch     # 0.1.0 -> 0.1.1   (bug fixes)
npm run release minor     # 0.1.0 -> 0.2.0   (new features)
npm run release major     # 0.1.0 -> 1.0.0   (breaking changes)
npm run release 1.2.3     # explicit version
```

`scripts/release.mjs` does everything:

1. Bumps and keeps the three version files in sync — `manifest.json` (`version`),
   `package.json` (`version`), `versions.json` (adds `"x.y.z": "<minAppVersion>"`).
2. Runs `npm test` and `npm run build` — a broken build never becomes a pushed tag.
3. Commits `Release x.y.z`, tags `x.y.z` (no `v` prefix), and pushes branch + tag.

To change `minAppVersion`, edit `manifest.json` first, then run the command above.

## 2. GitHub builds and publishes the release

Pushing the tag triggers `.github/workflows/release.yml`, which re-checks the tag
matches the manifest version, builds the plugin, and creates the GitHub release with
`main.js`, `manifest.json`, `styles.css` attached. **You never upload assets by
hand** — GitHub builds them from the tagged source, so they can't drift.

Watch the run:

```bash
gh run watch
```

When it finishes, verify the release has exactly `main.js`, `manifest.json`,
`styles.css` attached.

## 4. Submit to the Community Plugins directory (first release only)

One-time listing; later versions are picked up automatically from new releases.

1. Sign in at <https://community.obsidian.md> with your Obsidian account and link
   your GitHub account.
2. Plugins → **New plugin** → enter the repo URL.
3. Review and agree to the developer policies → **Submit**.
4. An automated bot validates `manifest.json` at your default branch HEAD. Address
   any feedback by pushing fixes and, if asked, cutting a new release.

Requirements checklist the bot cares about:

- Repo root has `manifest.json`, `README.md`, `LICENSE`.
- `manifest.json`: `id` has no `obsidian`; `name` has no `Obsidian`/`Plugin`;
  `description` ≤ 250 chars, ends with a period, no emoji/special chars;
  `isDesktopOnly` true only if Node/Electron APIs are used.
- A GitHub release exists whose tag equals the manifest version.

## 5. Later versions

Repeat steps 1–2 (`npm run release <patch|minor|major>`). No re-submission needed —
Obsidian detects the new release via the updated `manifest.json` + `versions.json`
on the default branch.
