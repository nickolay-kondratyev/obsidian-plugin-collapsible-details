#!/usr/bin/env bash
# Bumps the patch version, tags it, and pushes the tag — which triggers the GitHub
# Actions "Release" workflow to build and publish the plugin assets.
#
#   ./release-patch.sh
#
# Thin wrapper: all the real work (sync version files, verify build, commit, tag,
# push) lives in scripts/release.mjs so there is one source of truth.
set -euo pipefail

cd "$(dirname "$0")"
exec npm run release patch
