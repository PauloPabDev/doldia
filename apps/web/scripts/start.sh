#!/bin/sh
# Arranca la build standalone igual que el Dockerfile: copia estáticos y public
# junto a server.js y lo ejecuta en modo producción.
set -e
cd "$(dirname "$0")/.."
OUT=.next/standalone/apps/web
if [ ! -f "$OUT/server.js" ]; then
  echo "No hay build. Corre primero: pnpm build" >&2
  exit 1
fi
rm -rf "$OUT/.next/static" "$OUT/public"
cp -r .next/static "$OUT/.next/static"
cp -r public "$OUT/public"
# Escucha en todas las interfaces: Caddy (en Docker) llega por host.docker.internal.
NODE_ENV=production PORT="${WEB_PORT:-3100}" HOSTNAME=0.0.0.0 exec node "$OUT/server.js"
