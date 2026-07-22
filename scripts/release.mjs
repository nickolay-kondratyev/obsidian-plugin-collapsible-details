// Cuts a new release: bumps the version, keeps manifest.json / package.json /
// versions.json in sync, verifies the build, commits, tags (no "v" prefix), and
// pushes. Pushing the tag triggers the "Release" GitHub Actions workflow, which
// builds and uploads the plugin assets — maintainers never upload assets by hand.
//
//   node scripts/release.mjs <patch|minor|major|x.y.z>
//
// The tag equals the manifest version exactly (no "v" prefix), as Obsidian requires.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_KINDS = ["patch", "minor", "major"];

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function readJson(name) {
  return JSON.parse(readFileSync(join(repoRoot, name), "utf8"));
}

// Preserve trailing newline so the diff is a pure version change, not a reformat.
function writeJson(name, value) {
  writeFileSync(join(repoRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

function nextVersion(current, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  if (!RELEASE_KINDS.includes(kind)) {
    fail(`expected one of ${RELEASE_KINDS.join(", ")} or an explicit x.y.z, got [${kind}]`);
  }
  const [major, minor, patch] = current.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const kind = process.argv[2];
if (!kind) fail(`usage: node scripts/release.mjs <${RELEASE_KINDS.join("|")}|x.y.z>`);

// Guard at the boundary: a dirty tree would sweep unrelated changes into the tag.
if (git("status", "--porcelain")) fail("working tree is not clean; commit or stash first");

const manifest = readJson("manifest.json");
const version = nextVersion(manifest.version, kind);

const existingTags = git("tag", "--list", version);
if (existingTags) fail(`tag [${version}] already exists`);

console.log(`Bumping ${manifest.version} -> ${version}`);

manifest.version = version;
writeJson("manifest.json", manifest);

const pkg = readJson("package.json");
pkg.version = version;
writeJson("package.json", pkg);

const versions = readJson("versions.json");
versions[version] = manifest.minAppVersion; // maps the new version to its min Obsidian version
writeJson("versions.json", versions);

// Verify locally before tagging so a broken build never becomes a pushed tag/release.
console.log("Running tests and build ...");
execFileSync("npm", ["test"], { cwd: repoRoot, stdio: "inherit" });
execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });

git("add", "manifest.json", "package.json", "versions.json");
git("commit", "-m", `Release ${version}`);
git("tag", version);

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
console.log(`Pushing ${branch} and tag ${version} ...`);
git("push", "origin", branch);
git("push", "origin", version);

console.log(`\nDone. GitHub Actions is now building and publishing release ${version}.`);
console.log(`Watch it: gh run watch  (or the repo's Actions tab)`);
