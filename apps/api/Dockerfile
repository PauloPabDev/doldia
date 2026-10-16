# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@habitos/api
# Solo dependencias de producción, sin el resto del monorepo.
RUN pnpm --filter @habitos/api deploy --prod --legacy /out \
 && cp -r apps/api/dist apps/api/drizzle /out/

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 3101
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main.js"]
