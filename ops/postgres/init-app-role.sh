#!/usr/bin/env bash
set -Eeuo pipefail

app_password="$(cat /run/secrets/postgres_app_password)"
psql \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set ON_ERROR_STOP=1 \
  --set app_password="${app_password}" <<'SQL'
CREATE ROLE pick_meal_well_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
SQL
