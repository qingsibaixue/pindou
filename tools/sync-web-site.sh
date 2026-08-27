#!/bin/zsh
set -euo pipefail

source_dir="/Users/qingsi/Documents/work/pindou/build/web-mobile"
compat_dir="/Users/qingsi/Documents/work/pindou/build/web-mobile-compat"
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

# 保留一份无指纹兼容文件：老页面如果还停留在浏览器缓存中，仍能加载到
# 本次最新资源；新访问继续由 index.html 使用带指纹文件，避免版本串包。
if [[ -f "$compat_dir/index.html" ]]; then
  rsync -a --ignore-existing \
    --exclude 'index.html' \
    --exclude 'favicon.png' \
    "$compat_dir/" "$target_dir/"
fi

echo "Synced Web Mobile build to $target_dir"
