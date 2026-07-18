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

## 1. Bump the version (only when publishing a new version)

Keep these three in sync:

- `manifest.json` → `version` (semver `x.y.z`) and `minAppVersion`.
- `versions.json` → add `"x.y.z": "<minAppVersion>"`.
- `package.json` → `version`.

## 2. Stage the release assets

```bash
npm test              # must pass
npm run release:assets
```

This builds the plugin and copies `main.js`, `manifest.json`, `styles.css` into the
gitignored `.out/release/v<version>/` folder. Nothing to commit — these are
artifacts.

## 3. Create the GitHub release

Tag = manifest version, no `v` prefix. Push the tag first if not already pushed.

```bash
VERSION=$(node -p "require('./manifest.json').version")
gh release create "$VERSION" .out/release/v"$VERSION"/* \
  --title "$VERSION" --notes "Describe the changes."
```

Or via the GitHub web UI: Releases → Draft a new release → tag `<version>` →
upload the three files from `.out/release/v<version>/`.

Verify the release has exactly `main.js`, `manifest.json`, `styles.css` attached.

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

Repeat steps 1–3. No re-submission needed — Obsidian detects the new release via
the updated `manifest.json` + `versions.json` on the default branch.
