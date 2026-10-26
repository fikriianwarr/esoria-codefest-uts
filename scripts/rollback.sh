#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
source_root=$(cd "$(dirname "$0")/.." && pwd)
source "$source_root/scripts/deployment-common.sh"
deploy_dir="${ESORIA_DEPLOY_DIR:-${HOME}/.local/share/esoria-uts}"
cd "$deploy_dir"
deploy_dir=$PWD
[[ -f previous-image && -f current-image && -f .env.previous && -f compose.previous.yaml ]] || { echo 'Riwayat image dan konfigurasi rollback belum lengkap. Jalankan deployment sukses memakai revisi ini dahulu.' >&2; exit 1; }
target=$(<previous-image)
current=$(<current-image)
esoria_valid_image "$target" && esoria_valid_image "$current" || { echo 'Digest riwayat tidak valid.' >&2; exit 1; }
stage_dir=$(mktemp -d "$deploy_dir/.rollback-XXXXXX")
esoria_snapshot
installed=0
finish() {
  local status=$?
  trap - EXIT
  set +e
  if (( status != 0 && installed == 1 )); then
    if esoria_restore; then
      echo 'Rollback gagal; memulihkan deployment yang semula aktif.' >&2
      ESORIA_IMAGE="$current" esoria_compose "$deploy_dir/.env" "$deploy_dir/compose.yaml" up -d --wait --wait-timeout 100 || echo 'Pemulihan container gagal; periksa mesin deployment.' >&2
    fi
  fi
  rm -rf "$stage_dir"
  exit "$status"
}
trap finish EXIT
installed=1
cp .env.previous .env
cp compose.previous.yaml compose.yaml
export ESORIA_IMAGE="$target"
esoria_compose "$deploy_dir/.env" "$deploy_dir/compose.yaml" up -d --wait --wait-timeout 100
esoria_check_image
cp "$stage_dir/saved-.env" .env.previous
cp "$stage_dir/saved-compose.yaml" compose.previous.yaml
printf '%s\n' "$current" > previous-image
printf '%s\n' "$target" > current-image
echo "Rollback image dan konfigurasi berhasil; container healthy: $target"
