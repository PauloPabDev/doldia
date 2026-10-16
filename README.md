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

Todo corre en **una sola imagen** (`Dockerfile` en la raíz): Postgres 16, API, web y Caddy, coordinados por `infra/docker/entrypoint.sh`. Solo Caddy queda expuesto, en el puerto 8080; API (3101), web (3100) y Postgres (5432) escuchan en `127.0.0.1` dentro del contenedor, así que no chocan con otros servicios del servidor.

```bash
docker run -d -p 8080:8080 -v habitos_data:/data \
  -e PUBLIC_URL=https://habitos.ejemplo.com ghcr.io/paulopabdev/doldia:latest
```

Al arrancar, el contenedor:

1. Genera los secretos que falten (`POSTGRES_PASSWORD`, `JWT_SECRET`, claves VAPID) y los guarda en `/data/secrets.env`. Si defines una variable de entorno, esa tiene prioridad.
2. Inicializa Postgres en `/data/postgres` la primera vez y sincroniza la contraseña del usuario `habitos`.
3. Aplica las migraciones y arranca API, web y Caddy con usuarios sin privilegios.
4. Hace `pg_dump` diario en `/data/backups` (14 días de retención; ajústalo con `BACKUP_RETENTION_DAYS`). Sincronízalo con almacenamiento externo.

Si un proceso cae, el contenedor se detiene y Docker o Coolify lo reinicia. Con `SIGTERM` se apaga en orden, Postgres al final. El volumen `/data` es todo el estado: respáldalo, porque guarda la base y los secretos. El servidor necesita al menos 1 GB de RAM.

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `PUBLIC_URL` | Sí | URL pública con https |
| `VAPID_SUBJECT` | No | `mailto:` de contacto para push; por defecto, `PUBLIC_URL` |
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | No | Se generan solas; defínelas solo para fijar valores propios |
| `JWT_SECRET_PREVIOUS` | No | Secreto anterior al rotar `JWT_SECRET` |
| `TRUSTED_PROXIES` | No | Rangos de proxies confiables para obtener la IP real; por defecto, las redes privadas |

### CI/CD con GitHub Actions y Coolify

Cada PR corre lint, tipos y pruebas, construye la imagen y la prueba arrancada: health, web y un reinicio. Al hacer push a `main`:

1. `check`: lint, tipos y pruebas.
2. `image`: la misma prueba de humo, y luego publica `ghcr.io/paulopabdev/doldia` con las etiquetas `latest` y `sha-<commit>`, SBOM y procedencia firmada.
3. `deploy`: llama al webhook de Coolify para redesplegar.

Configuración única:

- En Coolify, crea un recurso *Docker Compose* con `infra/docker-compose.prod.yml`, define `PUBLIC_URL` y asigna el dominio al servicio `app` en el puerto 8080. Coolify termina el HTTPS.
- Si el paquete de GHCR es privado, agrega en el servidor de Coolify un login a `ghcr.io` con un token de solo `read:packages` (o haz público el paquete).
- En Coolify, *Keys & Tokens → API tokens*: crea un token con permiso de deploy. Copia la URL del webhook del recurso (*Webhooks → Deploy Webhook*).
- En GitHub, *Settings → Environments → production*, agrega los secretos `COOLIFY_WEBHOOK` (URL https) y `COOLIFY_TOKEN`. El environment ya está limitado a `main`; puedes exigir aprobación manual.

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
