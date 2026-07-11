#!/usr/bin/env bash
#
# Fetch the vocabulary artifact for the INS-001 API.
#
# Runs at Railway build time (wired into railway.json). Downloads the static
# embeddings the API memory-maps at startup — the replacement for the
# vocabulary_embeddings pgvector table. Hosted as a public GitHub Release asset,
# so no token is required.
#
# Idempotent: if the file already exists with the right checksum (local dev,
# cached build) it skips the download.
#
# Usage: bash scripts/fetch_vocab_artifact.sh
set -euo pipefail

REPO="phronos-2025/phronos-instruments"
TAG="vocab-artifact-v1"
BASE="https://github.com/${REPO}/releases/download/${TAG}"

# sha256 of vocab_embeddings.npy (matches vocab_meta.json; the integrity anchor).
EXPECTED_NPY_SHA="95b350675eb78d55895d2de39412ed8767df3cad6fe9ff185ae1f3089fd0e792"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${SCRIPT_DIR}/../data"   # ins-001/api/data — the pool's default artifact dir
mkdir -p "$DEST"

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

npy="${DEST}/vocab_embeddings.npy"
if [ -f "$npy" ] && [ "$(sha256 "$npy")" = "$EXPECTED_NPY_SHA" ]; then
  echo "vocab artifact already present and verified — skipping download"
  exit 0
fi

echo "Downloading vocabulary artifact from ${BASE} ..."
curl -fSL --retry 3 "${BASE}/vocab_embeddings.npy" -o "$npy"
curl -fSL --retry 3 "${BASE}/vocab_words.json"     -o "${DEST}/vocab_words.json"
curl -fSL --retry 3 "${BASE}/vocab_meta.json"      -o "${DEST}/vocab_meta.json"

got="$(sha256 "$npy")"
if [ "$got" != "$EXPECTED_NPY_SHA" ]; then
  echo "ERROR: checksum mismatch for vocab_embeddings.npy" >&2
  echo "  expected $EXPECTED_NPY_SHA" >&2
  echo "  got      $got" >&2
  exit 1
fi

echo "vocab artifact downloaded and verified ($(du -h "$npy" | awk '{print $1}'))"
