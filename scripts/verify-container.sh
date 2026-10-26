#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo 'Docker CLI belum tersedia.' >&2; exit 1; }
docker info >/dev/null
image="${CI_IMAGE:-esoria-uts:verify}"
name="esoria-verify-${RANDOM}-${RANDOM}"
volume="${name}-data"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker build --build-arg "RELEASE_SHA=${GITHUB_SHA:-local-test}" -t "$image" .
docker volume create "$volume" >/dev/null
start_container() {
  docker run -d --name "$name" --read-only --tmpfs /tmp --cap-drop ALL \
    --security-opt no-new-privileges:true --memory 256m --cpus 1 \
    -e ADMIN_EMAIL=ci-admin@example.test -e 'ADMIN_PASSWORD=Ci-Only-Container-2026!' \
    -v "$volume:/app/data" -p 127.0.0.1::3000 "$image" >/dev/null
}
read_port() { docker inspect --format '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}' "$name"; }
wait_ready() {
  for ((i=0;i<70;i++)); do
    status=$(docker inspect --format '{{.State.Health.Status}}' "$name")
    if [[ "$status" == healthy ]]; then return 0; fi
    if [[ "$status" == unhealthy ]]; then docker logs "$name"; return 1; fi
    sleep 1
  done
  docker logs "$name"; return 1
}
start_container
wait_ready
port=$(read_port)
ESORIA_SMOKE_EXPECTED_SHA="${GITHUB_SHA:-local-test}" node scripts/container-smoke.mjs "http://127.0.0.1:$port" create
docker restart "$name" >/dev/null
wait_ready
port=$(read_port)
ESORIA_SMOKE_EXPECTED_SHA="${GITHUB_SHA:-local-test}" node scripts/container-smoke.mjs "http://127.0.0.1:$port" persist
previous_id=$(docker inspect --format '{{.Id}}' "$name")
docker rm -f "$name" >/dev/null
start_container
wait_ready
current_id=$(docker inspect --format '{{.Id}}' "$name")
[[ "$previous_id" != "$current_id" ]] || { echo 'Container belum benar-benar dibuat ulang.' >&2; exit 1; }
port=$(read_port)
ESORIA_SMOKE_EXPECTED_SHA="${GITHUB_SHA:-local-test}" node scripts/container-smoke.mjs "http://127.0.0.1:$port" persist
echo 'Verifikasi image, commit, healthcheck, restart dan recreate dengan volume yang sama lulus.'
