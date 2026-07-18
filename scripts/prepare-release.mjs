// Builds the plugin and stages the three Obsidian release assets
// (main.js, manifest.json, styles.css) into a gitignored .out/release/v<version>/
// folder, ready to attach to a GitHub release. Version is read from manifest.json,
// so it can never drift from what the store validates.
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_ASSETS = ["main.js", "manifest.json", "styles.css"];

const manifest = JSON.parse(readFileSync(join(repoRoot, "manifest.json"), "utf8"));
const version = manifest.version;

console.log(`Building plugin for v${version} ...`);
execSync("npm run build", { cwd: repoRoot, stdio: "inherit" });

const outDir = join(repoRoot, ".out", "release", `v${version}`);
mkdirSync(outDir, { recursive: true });
for (const asset of RELEASE_ASSETS) {
  copyFileSync(join(repoRoot, asset), join(outDir, asset));
}

console.log(`\nStaged ${RELEASE_ASSETS.length} assets in .out/release/v${version}/`);
console.log(`Next: create the GitHub release (tag must equal the manifest version, no "v" prefix):\n`);
console.log(`  gh release create ${version} .out/release/v${version}/* --title ${version} --notes "..."`);
