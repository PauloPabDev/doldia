#!/bin/sh
# pg_dump diario con retención. Sincroniza $BACKUP_DIR con un almacenamiento externo (rclone, S3…).
set -u -o pipefail
dir=${BACKUP_DIR:-/data/backups}
days=${BACKUP_RETENTION_DAYS:-14}
while true; do
  file="$dir/habitos-$(date -u +%Y%m%d-%H%M).sql.gz"
  if pg_dump -U postgres habitos | gzip >"$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "[backup] Respaldo creado: $file"
  else
    rm -f "$file.tmp"
    echo "[backup] Falló el respaldo" >&2
  fi
  find "$dir" -name 'habitos-*.sql.gz' -mtime +"$days" -delete
  sleep 86400
done
