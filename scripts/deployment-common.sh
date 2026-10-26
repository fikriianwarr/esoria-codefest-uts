#!/usr/bin/env bash
# Shared by deploy and rollback. Variables stay scoped to the caller's process.
esoria_compose() (
  local env_file="$1" compose_file="$2"
  shift 2
  unset ADMIN_EMAIL ADMIN_PASSWORD APP_PORT BIND_ADDRESS COOKIE_SECURE APP_NAME COMPOSE_FILE COMPOSE_PROJECT_NAME
  docker compose --project-name esoria-uts --env-file "$env_file" --file "$compose_file" "$@"
)

esoria_valid_image() { [[ "$1" =~ ^ghcr\.io/[a-z0-9/_.-]+@sha256:[a-f0-9]{64}$ ]]; }

esoria_snapshot() {
  local name
  for name in .env compose.yaml current-image previous-image .env.previous compose.previous.yaml; do
    if [[ -f "$deploy_dir/$name" ]]; then cp "$deploy_dir/$name" "$stage_dir/saved-$name"; fi
  done
}

esoria_restore() {
  local name
  for name in .env compose.yaml current-image previous-image .env.previous compose.previous.yaml; do
    if [[ -f "$stage_dir/saved-$name" ]]; then
      cp "$stage_dir/saved-$name" "$deploy_dir/$name" || return 1
    else
      rm -f "$deploy_dir/$name" || return 1
    fi
  done
}

esoria_check_image() {
  local expected_id container_id actual_id
  expected_id=$(docker image inspect --format '{{.Id}}' "$ESORIA_IMAGE") || return 1
  container_id=$(esoria_compose "$deploy_dir/.env" "$deploy_dir/compose.yaml" ps --quiet web) || return 1
  [[ "$expected_id" =~ ^sha256:[a-f0-9]{64}$ && "$container_id" =~ ^[a-f0-9]{12,64}$ ]] || { echo 'Identitas image/container tidak valid.' >&2; return 1; }
  actual_id=$(docker inspect --format '{{.Image}}' "$container_id") || return 1
  [[ "$actual_id" == "$expected_id" ]] || { echo 'Container memakai image yang berbeda dari digest tujuan.' >&2; return 1; }
}
