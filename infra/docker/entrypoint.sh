#!/usr/bin/env bash
# Arranca Postgres, API, web, Caddy y el respaldo en un solo contenedor.
# Si cualquiera termina, se detiene todo y el orquestador (Docker, Coolify) reinicia el contenedor.
set -euo pipefail

DATA_DIR=${DATA_DIR:-/data}
PGDATA="$DATA_DIR/postgres"
SECRETS_FILE="$DATA_DIR/secrets.env"
PGSOCKET=/run/postgresql

log() { echo "[entrypoint] $*"; }

# Volumen
mkdir -p "$PGDATA" "$DATA_DIR/backups" "$DATA_DIR/caddy"
chown postgres:postgres "$PGDATA" "$DATA_DIR/backups"
chown node:node "$DATA_DIR/caddy"
chmod 700 "$PGDATA"
touch "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

# Secretos: una variable de entorno con valor tiene prioridad; si no, se usa la guardada
# en el volumen y, si tampoco existe, se genera una vez y se guarda para los siguientes arranques.
stored() { grep -m1 "^$1=" "$SECRETS_FILE" | cut -d= -f2- || true; }
random_secret() { node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))"; }
secret() {
  local name=$1 value=${!1:-}
  [ -n "$value" ] || value=$(stored "$name")
  if [ -z "$value" ]; then
    value=$(random_secret)
    echo "$name=$value" >>"$SECRETS_FILE"
    log "Generado $name y guardado en $SECRETS_FILE"
  fi
  export "$name=$value"
}

: "${PUBLIC_URL:?Define PUBLIC_URL con la URL pública, por ejemplo https://habitos.ejemplo.com}"
secret POSTGRES_PASSWORD
secret JWT_SECRET
if [ -z "${VAPID_PUBLIC_KEY:-}" ] && [ -z "$(stored VAPID_PUBLIC_KEY)" ]; then
  (cd /app/api && node -e "const k=require('web-push').generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\nVAPID_PRIVATE_KEY='+k.privateKey)") >>"$SECRETS_FILE"
  log "Generadas claves VAPID y guardadas en $SECRETS_FILE"
fi
export VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-$(stored VAPID_PUBLIC_KEY)}
export VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-$(stored VAPID_PRIVATE_KEY)}
if [ -z "${VAPID_SUBJECT:-}" ]; then
  case "$PUBLIC_URL" in
    https://*) VAPID_SUBJECT=$PUBLIC_URL ;;
    *) VAPID_SUBJECT=mailto:admin@localhost ;;
  esac
fi
export VAPID_SUBJECT
DATABASE_URL="postgres://habitos:$(node -p 'encodeURIComponent(process.env.POSTGRES_PASSWORD)')@127.0.0.1:5432/habitos"
export DATABASE_URL

# Postgres: solo escucha en 127.0.0.1; el superusuario entra por socket con peer y la app con contraseña.
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "Inicializando Postgres en $PGDATA"
  su-exec postgres initdb -D "$PGDATA" -U postgres --encoding=UTF8 --no-locale \
    --auth-local=peer --auth-host=scram-sha-256 >/dev/null
fi
su-exec postgres postgres -D "$PGDATA" \
  -c listen_addresses=127.0.0.1 -c port=5432 -c unix_socket_directories="$PGSOCKET" &
PG_PID=$!
until su-exec postgres pg_isready -q -h "$PGSOCKET"; do
  kill -0 "$PG_PID" 2>/dev/null || { log "Postgres no arrancó"; exit 1; }
  sleep 0.5
done

# Usuario y base de la app; la contraseña se sincroniza en cada arranque para que nunca queden desfasadas.
su-exec postgres psql -h "$PGSOCKET" -U postgres -v ON_ERROR_STOP=1 -qtA >/dev/null <<'SQL'
\getenv pw POSTGRES_PASSWORD
SELECT 'CREATE ROLE habitos LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'habitos')\gexec
ALTER ROLE habitos WITH LOGIN PASSWORD :'pw';
SELECT 'CREATE DATABASE habitos OWNER habitos' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'habitos')\gexec
SQL

log "Aplicando migraciones"
(cd /app/api && su-exec node node dist/db/migrate.js)

(cd /app/api && exec su-exec node node dist/main.js) &
API_PID=$!
(cd /app/web && HOSTNAME=127.0.0.1 PORT=3100 exec su-exec node node apps/web/server.js) &
WEB_PID=$!
XDG_DATA_HOME="$DATA_DIR/caddy" XDG_CONFIG_HOME=/tmp/caddy \
  su-exec node caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!
BACKUP_DIR="$DATA_DIR/backups" PGHOST="$PGSOCKET" su-exec postgres backup.sh &
BACKUP_PID=$!

shutdown() {
  trap - TERM INT
  log "Deteniendo servicios"
  kill -TERM "$CADDY_PID" "$WEB_PID" "$API_PID" "$BACKUP_PID" 2>/dev/null || true
  wait "$CADDY_PID" "$WEB_PID" "$API_PID" 2>/dev/null || true
  # SIGINT es el apagado rápido y seguro de Postgres.
  kill -INT "$PG_PID" 2>/dev/null || true
  wait "$PG_PID" 2>/dev/null || true
}
trap 'shutdown; exit 0' TERM INT

log "Listo en :8080"
status=0
wait -n "$PG_PID" "$API_PID" "$WEB_PID" "$CADDY_PID" "$BACKUP_PID" || status=$?
log "Un proceso terminó (código $status); deteniendo el contenedor"
shutdown
exit 1
