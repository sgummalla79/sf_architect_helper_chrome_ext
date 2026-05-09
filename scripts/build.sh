#!/bin/bash
# Build script for Architect Companion — Mac/Linux
# Usage: ./scripts/build.sh [dev|prod]
#   dev  (default) — packages config.dev.json
#   prod           — packages config.prod.json

set -e
cd "$(dirname "$0")/.." || exit 1

ENV="${1:-dev}"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Error: env must be 'dev' or 'prod'"
  echo "Usage: ./scripts/build.sh [dev|prod]"
  exit 1
fi

CONFIG="config.${ENV}.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "Error: $CONFIG not found"
  exit 1
fi

mkdir -p dist
OUTPUT="dist/archcadence-${ENV}.zip"
rm -f "$OUTPUT"

TMP=$(mktemp -d)
trap "rm -rf '$TMP'" EXIT

# Core extension files
cp manifest.json background.js popup.html popup.js "$TMP/"

# Config for this env only
cp "$CONFIG" "$TMP/$CONFIG"

# Stamp settings.json with the target env
printf '{"env":"%s"}\n' "$ENV" > "$TMP/settings.json"

# Icons
mkdir -p "$TMP/icons"
cp icons/icon16.png icons/icon48.png icons/icon128.png "$TMP/icons/"

# Zip from inside the temp dir so all paths are at root level in the archive
(cd "$TMP" && zip -qr "${OLDPWD}/${OUTPUT}" .)

echo "Build complete: $OUTPUT"
