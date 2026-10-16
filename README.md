# Hábitos con amigos

Monorepo (pnpm + Turborepo) con la API en NestJS, el front en Next.js y paquetes compartidos. Caddy sirve todo bajo un mismo origen, así la sesión viaja en cookies httpOnly sin CORS.

```text
apps/api        NestJS: auth, users, habits, logs, pacts, feed, gamification, notifications, worker
apps/web        Next.js App Router + PWA (manifest, sw.js propio, cola offline)
packages/contracts  Esquemas Zod compartidos por API y front
packages/tokens     Design tokens (variables CSS)
packages/ui         Componentes React + un CSS por componente
infra/              Caddyfile, compose de desarrollo y producción, respaldo
```

## Arranque local

```bash
pnpm install
pnpm bootstrap  # .env con secretos, Postgres y Caddy en Docker, migraciones y datos de prueba
pnpm dev        # API, web y contratos en modo watch
```

La guía completa (build, arranque compilado, base de datos y problemas comunes) está en [docs/DESARROLLO.md](docs/DESARROLLO.md).

Abre http://localhost:8180. Usuarios de prueba: `ana@habitos.dev`, `beto@habitos.dev`, `carla@habitos.dev` (contraseña `habitos123`), pacto "Madrugadores" con código `AMIGOS26`. El catálogo del design system está en `/design`.

Los puertos por defecto (web 3100, API 3101, Postgres 5442, Caddy 8180) se cambian en `.env`.

| Comando | Qué hace |
| --- | --- |
| `pnpm test` | Pruebas con `node:test` (la API usa una base `habitos_test` aislada) |
| `pnpm typecheck` / `pnpm lint` | Tipos y Biome |
| `pnpm build` | Build de producción con caché de Turbo |
| `pnpm db:generate` | Genera una migración a partir de `apps/api/src/db/schema.ts` |

## Producción

```bash
cp .env.production.example .env.production   # secretos reales
DOMAIN=habitos.ejemplo.com POSTGRES_PASSWORD=... docker compose -f infra/docker-compose.prod.yml up -d --build
```

La API aplica las migraciones al arrancar. El servicio `backup` hace `pg_dump` diario con 14 días de retención en `infra/backups` (sincronízalo con almacenamiento externo). El workflow `.github/workflows/ci.yml` corre lint, tipos y pruebas en cada PR y construye las imágenes (sin publicarlas).

### CI/CD con GitHub Actions y Coolify

Al hacer push a `main`:

1. `check`: lint, tipos y pruebas.
2. `image`: construye `api`, `web` y `proxy`, las publica en GHCR (`ghcr.io/pedropab/doldia-{api,web,proxy}`, etiquetas `latest` y `sha-<commit>`) con SBOM y procedencia firmada.
3. `deploy`: llama al webhook de Coolify para redesplegar.

Configuración única:

- En Coolify, crea un recurso *Docker Compose* con `infra/docker-compose.coolify.yml`, define sus variables (`POSTGRES_PASSWORD`, `JWT_SECRET`, `VAPID_*`, `PUBLIC_URL`) y asigna el dominio al servicio `proxy` en el puerto 8080.
- Si los paquetes de GHCR son privados, agrega en el servidor de Coolify un login a `ghcr.io` con un token de solo `read:packages` (o haz públicos los paquetes).
- En Coolify, *Keys & Tokens → API tokens*: crea un token con permiso de deploy. Copia la URL del webhook del recurso (*Webhooks → Deploy Webhook*).
- En GitHub, *Settings → Environments → production*, agrega los secretos `COOLIFY_WEBHOOK` (URL https) y `COOLIFY_TOKEN`. Opcional: exige aprobación manual y limita el environment a la rama `main`.

Para volver a una versión anterior, define `IMAGE_TAG=sha-<commit>` en Coolify y redespliega.

## Decisiones tomadas al implementar

- **Cookie de acceso con `Path=/`** (el plan decía `/api`): Next necesita leerla para renderizar en servidor. El refresh sí queda en `Path=/api/v1/auth`. Una cookie `hb_session` sin datos sensibles avisa al front que hay sesión renovable; `/renovar` la renueva y vuelve.
- **Reuso de refresh**: si dos pestañas refrescan a la vez (menos de 5 s) no se trata como robo.
- **Aviso de riesgo de racha**: dos horas antes del horario silencioso (20:00 por defecto), porque las 22:00 caen dentro del silencio.
- **Recordatorios**: ignoran el horario silencioso y el tope de 4 push al día, porque los programa el propio usuario.
- **Node 24 y TypeScript 5.9**: Node 24 es el instalado; TypeScript 7 todavía no es compatible con el CLI de Nest.
- **Límite de peticiones y SSE en memoria**: válido con una instancia de la API. Para varias habría que moverlos a Postgres (contador y `LISTEN/NOTIFY`).

## Pendiente

- Decisiones abiertas del plan: alojamiento, almacenamiento de fotos (el campo `photo_url` existe pero no hay subida) y login con Google.
- Fase 7 en el mundo real: monitoreo de errores, pruebas de carga y la prueba con 3 grupos de amigos.
- Misiones, ligas opcionales y contrato de hábito (RF-12 a RF-14) solo tienen una primera versión (misiones) o no existen aún (ligas, contrato).
