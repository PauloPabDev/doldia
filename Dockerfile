# syntax=docker/dockerfile:1
# Imagen única de producción: Postgres, API, web y Caddy en un solo contenedor.
# Solo el puerto 8080 (Caddy) queda expuesto; API, web y Postgres escuchan en 127.0.0.1.
ARG NODE_IMAGE=node:24-alpine

FROM caddy:2.10-alpine AS caddy

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
# Las dependencias se descargan en una capa aparte: solo se repite si cambia el lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm turbo run build --filter=@habitos/api --filter=@habitos/web
# API con solo dependencias de producción, sin el resto del monorepo.
RUN pnpm --filter @habitos/api deploy --prod --legacy /out/api \
 && cp -r apps/api/dist apps/api/drizzle /out/api/

FROM ${NODE_IMAGE} AS runtime
RUN apk add --no-cache bash tini su-exec postgresql16 postgresql16-client \
 && mkdir -p /data /run/postgresql \
 && chown postgres:postgres /run/postgresql
COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy

ENV NODE_ENV=production \
    DATA_DIR=/data \
    API_HOST=127.0.0.1 \
    API_PORT=3101 \
    API_INTERNAL_URL=http://127.0.0.1:3101 \
    API_UPSTREAM=127.0.0.1:3101 \
    WEB_UPSTREAM=127.0.0.1:3100 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY --from=build /out/api ./api
# output: 'standalone' trae solo lo necesario para ejecutar Next.
COPY --from=build /repo/apps/web/.next/standalone ./web
COPY --from=build /repo/apps/web/.next/static ./web/apps/web/.next/static
COPY --from=build /repo/apps/web/public ./web/apps/web/public
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=755 infra/docker/entrypoint.sh infra/docker/backup.sh /usr/local/bin/

VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=4 \
  CMD wget -qO- http://127.0.0.1:8080/api/v1/health | grep -q '"status":"ok"' || exit 1
# El entrypoint arranca como root solo para preparar /data; cada proceso corre con su propio usuario.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
