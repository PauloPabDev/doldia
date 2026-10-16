#!/bin/sh
# Carga el .env de la raíz (si existe) y ejecuta el comando recibido.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  . "$ROOT/.env"
  set +a
fi
exec "$@"
