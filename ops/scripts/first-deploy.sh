#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script through sudo on the Fribench host." >&2
  exit 2
fi

release_dir="${1:-/srv/fribench/apps/web/pick-meal-well/current}"
release_dir="$(readlink -f "${release_dir}")"
compose_file="${release_dir}/compose.prod.yml"
secret_dir="/etc/fribench"
secret_group="fribench-secrets"
secret_gid="${FRIBENCH_SECRET_GID:-1999}"
env_file="${secret_dir}/pick-meal-well.env"
nginx_available="/etc/nginx/sites-available/pick-meal-well"
nginx_enabled="/etc/nginx/sites-enabled/pick-meal-well"
legacy_nginx_enabled="/etc/nginx/sites-enabled/fribench-private-status"

if [[ ! -f "${compose_file}" || ! -f "${release_dir}/ops/nginx/pick-meal-well.conf" ]]; then
  echo "Release assets are missing under ${release_dir}." >&2
  exit 2
fi

umask 077
group_record="$(getent group "${secret_group}" || true)"
if [[ -n "${group_record}" ]]; then
  existing_gid="$(cut -d: -f3 <<<"${group_record}")"
  if [[ "${existing_gid}" != "${secret_gid}" ]]; then
    echo "${secret_group} already uses GID ${existing_gid}, expected ${secret_gid}." >&2
    exit 2
  fi
else
  gid_record="$(getent group "${secret_gid}" || true)"
  if [[ -n "${gid_record}" ]]; then
    echo "GID ${secret_gid} is already used by $(cut -d: -f1 <<<"${gid_record}")." >&2
    exit 2
  fi
  groupadd --system --gid "${secret_gid}" "${secret_group}"
fi
export FRIBENCH_SECRET_GID="${secret_gid}"
install -d -m 0750 -o root -g "${secret_group}" "${secret_dir}"

create_secret() {
  local target="$1"
  if [[ -L "${target}" ]]; then
    echo "Refusing symbolic-link secret: ${target}" >&2
    exit 2
  fi
  if [[ ! -s "${target}" ]]; then
    openssl rand -hex 32 > "${target}"
  fi
  chown root:"${secret_group}" "${target}"
  chmod 0640 "${target}"
}

create_secret "${secret_dir}/postgres_owner_password"
create_secret "${secret_dir}/postgres_app_password"
create_secret "${secret_dir}/redis_password"
create_secret "${secret_dir}/setup_token"

owner_password="$(<"${secret_dir}/postgres_owner_password")"
app_password="$(<"${secret_dir}/postgres_app_password")"
redis_password="$(<"${secret_dir}/redis_password")"

for target in \
  "${secret_dir}/database_url" \
  "${secret_dir}/migration_database_url" \
  "${secret_dir}/redis_url" \
  "${env_file}"; do
  if [[ -L "${target}" ]]; then
    echo "Refusing symbolic-link configuration: ${target}" >&2
    exit 2
  fi
done

if [[ ! -s "${secret_dir}/database_url" ]]; then
  printf 'postgresql://pick_meal_well_app:%s@postgres:5432/pick_meal_well\n' \
    "${app_password}" > "${secret_dir}/database_url"
fi
if [[ ! -s "${secret_dir}/migration_database_url" ]]; then
  printf 'postgresql://pick_meal_well_owner:%s@postgres:5432/pick_meal_well\n' \
    "${owner_password}" > "${secret_dir}/migration_database_url"
fi
if [[ ! -s "${secret_dir}/redis_url" ]]; then
  printf 'redis://:%s@redis:6379/0\n' "${redis_password}" > "${secret_dir}/redis_url"
fi
chown root:"${secret_group}" \
  "${secret_dir}/database_url" \
  "${secret_dir}/migration_database_url" \
  "${secret_dir}/redis_url"
chmod 0640 \
  "${secret_dir}/database_url" \
  "${secret_dir}/migration_database_url" \
  "${secret_dir}/redis_url"
unset owner_password app_password redis_password

if [[ ! -e "${env_file}" ]]; then
  install -m 0644 -o root -g root \
    "${release_dir}/ops/config/pick-meal-well.env.example" \
    "${env_file}"
fi

docker compose -f "${compose_file}" config --quiet
docker compose -f "${compose_file}" build --pull

verify_secret_access() {
  local service="$1"
  shift
  docker compose -f "${compose_file}" run --rm --no-deps "${service}" \
    node --input-type=commonjs -e '
      const { readFileSync } = require("node:fs");
      if (process.getuid() === 0) {
        throw new Error("Secret access preflight unexpectedly ran as root.");
      }
      for (const path of process.argv.slice(1)) {
        if (!readFileSync(path, "utf8").trim()) {
          throw new Error(`Secret is empty: ${path}`);
        }
      }
      console.log(JSON.stringify({ level: "info", event: "secret_access_ok" }));
    ' "$@"
}

verify_secret_access migrate \
  /run/secrets/migration_database_url \
  /run/secrets/postgres_app_password
verify_secret_access app \
  /run/secrets/database_url \
  /run/secrets/redis_url \
  /run/secrets/setup_token

docker compose -f "${compose_file}" up -d

for _ in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:21001/api/health/ready >/dev/null; then
    break
  fi
  sleep 2
done
curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:21001/api/health/ready >/dev/null

install -m 0644 -o root -g root \
  "${release_dir}/ops/nginx/pick-meal-well.conf" \
  "${nginx_available}"
ln -sfn "${nginx_available}" "${nginx_enabled}"
rm -f "${legacy_nginx_enabled}"

if ! nginx -t; then
  rm -f "${nginx_enabled}"
  if [[ -f /etc/nginx/sites-available/fribench-private-status ]]; then
    ln -sfn /etc/nginx/sites-available/fribench-private-status \
      "${legacy_nginx_enabled}"
  fi
  nginx -t
  echo "Nginx validation failed; restored the private status site." >&2
  exit 1
fi
systemctl reload nginx
curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:8080/api/health/ready >/dev/null

install -m 0644 -o root -g root \
  "${release_dir}/ops/systemd/pick-meal-well-backup.service" \
  "${release_dir}/ops/systemd/pick-meal-well-backup.timer" \
  /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pick-meal-well-backup.timer
systemctl start pick-meal-well-backup.service

docker compose -f "${compose_file}" ps
systemctl --no-pager --full status pick-meal-well-backup.timer
echo "Pick Meal Well first deployment completed."
