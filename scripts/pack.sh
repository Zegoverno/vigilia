#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
version=$(node -p 'require("./plugin.json").version')
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
install -D mcp/dist/server.js "$stage/mcp/dist/server.js"
install -D ui/dist/index.html "$stage/ui/dist/index.html"
install -D skills/vigilia/agendar/SKILL.md "$stage/skills/vigilia/agendar/SKILL.md"
cp plugin.json LICENSE CREDITS.md README.md "$stage/"
printf '{"type":"module"}\n' > "$stage/package.json"
node scripts/notices.mjs > "$stage/THIRD-PARTY-NOTICES.txt"
tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -C "$stage" -czf "dist/vigilia-$version.tgz" plugin.json package.json LICENSE CREDITS.md README.md THIRD-PARTY-NOTICES.txt mcp ui skills
sha256sum "dist/vigilia-$version.tgz"
