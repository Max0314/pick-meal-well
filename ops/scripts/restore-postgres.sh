#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${CONFIRM_RESTORE:-}" != "RESTORE" ]]; then
  echo "Set CONFIRM_RESTORE=RESTORE to replace the current database." >&2
  exit 2
fi
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: CONFIRM_RESTORE=RESTORE $0 /path/to/backup.sql.gz" >&2
  exit 2
fi

backup="$(realpath "$1")"
compose_file="${COMPOSE_FILE:-/srv/fribench/apps/web/pick-meal-well/current/compose.prod.yml}"
grant_sql="${GRANT_SQL:-/srv/fribench/apps/web/pick-meal-well/current/ops/postgres/grant-app-role.sql}"
if [[ -f "${backup}.sha256" ]]; then
  (cd "$(dirname "${backup}")" && sha256sum --check "$(basename "${backup}").sha256")
fi

docker compose -f "${compose_file}" stop app
docker compose -f "${compose_file}" exec -T postgres \
  psql --username pick_meal_well_owner --dbname postgres --set ON_ERROR_STOP=1 \
  --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'pick_meal_well' AND pid <> pg_backend_pid();" \
  --command "DROP DATABASE IF EXISTS pick_meal_well;" \
  --command "CREATE DATABASE pick_meal_well OWNER pick_meal_well_owner;"
gzip --decompress --stdout "${backup}" \
  | docker compose -f "${compose_file}" exec -T postgres \
    psql --username pick_meal_well_owner --dbname pick_meal_well --set ON_ERROR_STOP=1
docker compose -f "${compose_file}" exec -T postgres \
  psql --username pick_meal_well_owner --dbname pick_meal_well --set ON_ERROR_STOP=1 \
  < "${grant_sql}"
docker compose -f "${compose_file}" run --rm migrate
docker compose -f "${compose_file}" up -d app
