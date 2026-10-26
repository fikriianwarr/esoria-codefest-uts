#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
source_root=$(cd "$(dirname "$0")/.." && pwd)
source "$source_root/scripts/deployment-common.sh"
deploy_dir="${ESORIA_DEPLOY_DIR:-${HOME}/.local/share/esoria-uts}"
: "${ESORIA_IMAGE:?Image digest hasil CI wajib diisi}"
: "${ESORIA_EXPECTED_SHA:?Commit pipeline wajib diisi}"
esoria_valid_image "$ESORIA_IMAGE" || { echo 'Image harus menggunakan digest GHCR.' >&2; exit 1; }
[[ "$ESORIA_EXPECTED_SHA" =~ ^([a-f0-9]{40}|[a-f0-9]{64})$ ]] || { echo 'Commit pipeline tidak valid.' >&2; exit 1; }
node "$source_root/scripts/deploy-config.mjs" check
docker info >/dev/null
docker compose version
mkdir -p "$deploy_dir"
deploy_dir=$(cd "$deploy_dir" && pwd)
stage_dir=$(mktemp -d "$deploy_dir/.stage-XXXXXX")
previous=''
[[ ! -f "$deploy_dir/current-image" ]] || previous=$(<"$deploy_dir/current-image")
if [[ -n "$previous" ]]; then
  esoria_valid_image "$previous" || { rm -rf "$stage_dir"; echo 'Catatan image sebelumnya tidak valid.' >&2; exit 1; }
  [[ -f "$deploy_dir/.env" && -f "$deploy_dir/compose.yaml" ]] || { rm -rf "$stage_dir"; echo 'Konfigurasi deployment sebelumnya tidak lengkap.' >&2; exit 1; }
fi
esoria_snapshot
installed=0
activation_attempted=0
finish() {
  local status=$?
  trap - EXIT
  set +e
  if (( status != 0 && installed == 1 )); then
    if esoria_restore; then
      if [[ -n "$previous" ]] && (( activation_attempted == 1 )); then
        echo 'Deployment gagal; memulihkan konfigurasi dan image sebelumnya.' >&2
        ESORIA_IMAGE="$previous" esoria_compose "$deploy_dir/.env" "$deploy_dir/compose.yaml" up -d --wait --wait-timeout 100 || echo 'Pemulihan container gagal; periksa log pada mesin deployment.' >&2
      elif [[ -z "$previous" ]]; then
        echo 'Deployment pertama gagal; belum ada image sukses sebelumnya untuk rollback.' >&2
      fi
    else
      echo 'Pemulihan file konfigurasi gagal. Periksa direktori deployment sebelum melanjutkan.' >&2
    fi
  fi
  rm -rf "$stage_dir"
  exit "$status"
}
trap finish EXIT

# Validate and pull using temporary configuration before replacing live files.
node "$source_root/scripts/deploy-config.mjs" write "$stage_dir/candidate.env"
cp "$source_root/compose.deploy.yaml" "$stage_dir/candidate.compose.yaml"
esoria_compose "$stage_dir/candidate.env" "$stage_dir/candidate.compose.yaml" config --quiet
esoria_compose "$stage_dir/candidate.env" "$stage_dir/candidate.compose.yaml" pull
installed=1
cp "$stage_dir/candidate.env" "$deploy_dir/.env"
chmod 600 "$deploy_dir/.env"
cp "$stage_dir/candidate.compose.yaml" "$deploy_dir/compose.yaml"
cd "$deploy_dir"
activation_attempted=1
esoria_compose "$deploy_dir/.env" "$deploy_dir/compose.yaml" up -d --wait --wait-timeout 100
esoria_check_image
node "$source_root/scripts/verify-release.mjs" "$(node "$source_root/scripts/deploy-config.mjs" port)"

# History is committed only after the running image, HTTP, database and SHA match.
if [[ -n "$previous" ]]; then
  cp "$stage_dir/saved-.env" "$deploy_dir/.env.previous"
  cp "$stage_dir/saved-compose.yaml" "$deploy_dir/compose.previous.yaml"
  printf '%s\n' "$previous" > "$deploy_dir/previous-image"
fi
printf '%s\n' "$ESORIA_IMAGE" > "$deploy_dir/current-image"
printf 'Deployment berhasil: %s\n' "$ESORIA_IMAGE"
echo 'Data tetap berada pada volume esoria_uts_data. Konfigurasi pribadi tidak dicetak.'
