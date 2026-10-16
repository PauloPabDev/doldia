# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@habitos/web

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0
WORKDIR /app
# output: 'standalone' trae solo lo necesario para ejecutar.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3100
CMD ["node", "apps/web/server.js"]
