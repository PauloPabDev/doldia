# syntax=docker/dockerfile:1
# Caddy con el Caddyfile del proyecto incluido, para desplegar sin montar archivos del repo.
FROM caddy:2.10-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
