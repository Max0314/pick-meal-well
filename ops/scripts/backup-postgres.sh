#!/usr/bin/env bash
set -Eeuo pipefail

backup_dir="${BACKUP_DIR:-/srv/fribench/backups}"
compose_file="${COMPOSE_FILE:-/srv/fribench/apps/pick-meal-well/current/compose.prod.yml}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/pick-meal-well-${timestamp}.sql.gz"

install -d -m 0700 "${backup_dir}"
docker compose -f "${compose_file}" exec -T postgres \
  pg_dump --username pick_meal_well_owner --dbname pick_meal_well \
  --format=plain --no-owner --no-privileges \
  | gzip -9 > "${target}"
(cd "${backup_dir}" && sha256sum "$(basename "${target}")" > "$(basename "${target}").sha256")
find "${backup_dir}" -maxdepth 1 -type f \
  \( -name 'pick-meal-well-*.sql.gz' -o -name 'pick-meal-well-*.sql.gz.sha256' \) \
  -mtime +14 -delete
printf '%s\n' "${target}"
