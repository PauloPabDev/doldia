#!/bin/sh
# pg_dump diario con 14 días de retención. Sincroniza /backups con un almacenamiento externo (rclone, S3…).
set -eu
while true; do
  file="/backups/habitos-$(date -u +%Y%m%d-%H%M).sql.gz"
  pg_dump -h db -U habitos habitos | gzip > "$file"
  echo "Respaldo creado: $file"
  find /backups -name 'habitos-*.sql.gz' -mtime +14 -delete
  sleep 86400
done
