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

rsync -a \
  --exclude '.git/' \
  --exclude '.gitignore' \
  --exclude 'wrangler.jsonc' \
  "$source_dir/" "$target_dir/"

# 不删除旧指纹文件：Cloudflare 边缘节点或浏览器仍可能短暂持有上一版入口，
# 历史启动链必须继续可用。无指纹兼容文件则为更老的缓存入口提供最新资源。
if [[ -f "$compat_dir/index.html" ]]; then
  rsync -a --ignore-existing \
    --exclude 'index.html' \
    --exclude 'favicon.png' \
    "$compat_dir/" "$target_dir/"
fi

echo "Synced Web Mobile build to $target_dir"
