#!/bin/zsh
set -euo pipefail

source_dir="/Users/qingsi/Documents/work/pindou/build/web-mobile"
target_dir="/Users/qingsi/Documents/work/pindou-game-site"

if [[ ! -f "$source_dir/index.html" ]]; then
  echo "Missing Web Mobile build: $source_dir/index.html" >&2
  exit 1
fi

if [[ ! -d "$target_dir/.git" || ! -f "$target_dir/wrangler.jsonc" ]]; then
  echo "Refusing to sync into unexpected target: $target_dir" >&2
  exit 1
fi

rsync -a --delete \
  --exclude '.git/' \
  --exclude '.gitignore' \
  --exclude 'wrangler.jsonc' \
  "$source_dir/" "$target_dir/"

echo "Synced Web Mobile build to $target_dir"
