#!/bin/bash
# Publish the public copy of yt-kanban: everything tracked except deploy/ (eva-specific),
# as a new commit on github.com/marc-alexis-com/yt-kanban (public). This repo itself is
# marc-alexis-com/yt-kanban-eva (private) and keeps its full history.
#   ./deploy/publish-public.sh "feat: what changed"
set -euo pipefail
cd "$(dirname "$0")/.."

PUBLIC=git@github.com:marc-alexis-com/yt-kanban.git
MSG=${1:-"sync from yt-kanban-eva $(git rev-parse --short HEAD)"}
[ -z "$(git status --porcelain)" ] || { echo "✗ uncommitted changes: commit first" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if git ls-remote --exit-code "$PUBLIC" main >/dev/null 2>&1; then
  git clone -q --depth 1 "$PUBLIC" "$tmp/pub"
else
  git init -q -b main "$tmp/pub" && git -C "$tmp/pub" remote add origin "$PUBLIC"
fi

# Replace the whole tree with this commit minus deploy/
git -C "$tmp/pub" rm -rq --ignore-unmatch . >/dev/null
git archive HEAD -- . ':!deploy' | tar -x -C "$tmp/pub"
git -C "$tmp/pub" add -A
if git -C "$tmp/pub" diff --cached --quiet; then
  echo "✓ public copy already up to date"
  exit 0
fi
git -C "$tmp/pub" commit -q -m "$MSG"
git -C "$tmp/pub" push -q origin main
echo "✓ published: https://github.com/marc-alexis-com/yt-kanban"
