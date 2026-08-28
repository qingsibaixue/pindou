#!/bin/zsh
set -euo pipefail

project_dir="/Users/qingsi/Documents/work/pindou"
build_dir="$project_dir/build/web-portals"
release_dir="$project_dir/release"
archive="$release_dir/beadscape-html5-v1.0.0.zip"

if [[ ! -f "$build_dir/index.html" ]]; then
  echo "Missing portal build: $build_dir/index.html" >&2
  exit 1
fi

mkdir -p "$release_dir"
rm -f "$archive"

(
  cd "$build_dir"
  zip -q -r "$archive" . -x '*.DS_Store'
)

echo "Created $archive"
