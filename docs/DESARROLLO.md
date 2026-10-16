# Guía de desarrollo local

Cómo instalar, compilar y levantar la app en tu máquina, y cómo comprobar que funciona.

## 1. Requisitos

| Herramienta | Versión | Comprobar |
| --- | --- | --- |
| Node.js | 22 o superior (probado con 24) | `node -v` |
| pnpm | 11.1.2 (la fija `packageManager`) | `corepack enable && pnpm -v` |
| Docker + Compose v2 | cualquiera reciente | `docker compose version` |

Puertos que usa (todos cambian en `.env`):

| Servicio | Puerto | Dónde corre |
| --- | --- | --- |
| Caddy (entrada única) | 8180 | Docker |
| Web (Next.js) | 3100 | tu máquina |
| API (NestJS) | 3101 | tu máquina |
| PostgreSQL 16 | 5442 (solo 127.0.0.1) | Docker |

Siempre entra por **http://localhost:8180**: Caddy junta web y API en el mismo origen y las cookies de sesión dependen de eso. Si abres el puerto 3100 directamente, el login no funciona.

## 2. Primera vez

```bash
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` hace cuatro cosas, y puedes correr cada una por separado:

1. `node scripts/init-env.mjs`: crea `.env` desde `.env.example` con un `JWT_SECRET` y un par de claves VAPID nuevos. Si `.env` ya existe, no lo toca.
2. `pnpm infra:up`: levanta Postgres y Caddy en Docker y espera a que estén sanos.
3. `pnpm db:migrate`: aplica las migraciones de `apps/api/drizzle`.
4. `pnpm db:seed`: carga los datos de prueba. Se puede repetir: borra y vuelve a crear solo sus propios datos, y siempre deja los mismos.

## 3. Modo desarrollo (recarga en caliente)

```bash
pnpm dev
```

Compila los contratos y deja en modo watch la API (`nest start --watch`) y la web (`next dev`). Está listo cuando el log muestra `API escuchando en :3101/api/v1` y `Ready` de Next. Para detenerlo usa `Ctrl+C`; Postgres y Caddy siguen corriendo hasta `pnpm infra:down`.

## 4. Build y arranque compilado

Sirve para probar lo mismo que irá a producción, sin recarga en caliente:

```bash
pnpm build      # contratos, API (dist/) y web (.next/) con caché de Turbo
pnpm start      # infra + API compilada + servidor standalone de Next
```

`pnpm start` arranca la web igual que el Dockerfile: copia `.next/static` y `public` junto a `.next/standalone/apps/web/server.js` y lo ejecuta con `NODE_ENV=production` (ver `apps/web/scripts/start.sh`). Después de cada cambio vuelve a correr `pnpm build`.

Usa los mismos puertos que `pnpm dev`, así que no corras los dos a la vez. Para pasar de uno a otro, detén el que esté corriendo con `Ctrl+C`.

## 5. Probar la app

1. Abre http://localhost:8180 y entra con `ana@habitos.dev` / `habitos123`. También existen `beto@habitos.dev` y `carla@habitos.dev`, con la misma contraseña.
2. En **Hoy**, toca un hábito para registrarlo. La racha y la XP se actualizan al instante.
3. En **Pactos** está "Madrugadores", el pacto con los tres usuarios. Abre otra ventana en incógnito como `beto` para ver el registro de ana en el feed y reaccionar.
4. Para unirte con el código de invitación, crea un usuario nuevo en `/registro` y ve a http://localhost:8180/unirse/AMIGOS26.
5. El catálogo de componentes está en http://localhost:8180/design.

Comprobaciones rápidas desde la terminal:

```bash
curl -s localhost:8180/api/v1/health      # {"status":"ok","db":"ok",...}
curl -sI localhost:8180/ | head -1        # 307 hacia /entrar sin sesión
```

## 6. Calidad

```bash
pnpm lint         # Biome
pnpm typecheck    # TypeScript en los 5 paquetes
pnpm test         # pruebas de la API contra la base aislada habitos_test (requiere infra:up)
```

## 7. Base de datos

| Tarea | Comando |
| --- | --- |
| Cambiar el esquema | Edita `apps/api/src/db/schema.ts`, luego `pnpm db:generate` y `pnpm db:migrate` |
| Recargar los datos de prueba | `pnpm db:seed` |
| Empezar de cero (borra todo) | `docker compose -f infra/docker-compose.dev.yml --env-file .env down -v && pnpm bootstrap` |
| Abrir psql | `docker compose -f infra/docker-compose.dev.yml exec db psql -U habitos` |

## 8. Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| `Variables de entorno inválidas` al arrancar la API | Falta `.env` o tiene secretos vacíos. Bórralo y corre `node scripts/init-env.mjs`. |
| `port is already allocated` | Otro proceso usa ese puerto. Cambia `DB_PORT`, `API_PORT`, `WEB_PORT` o `PROXY_PORT` en `.env` (y `DATABASE_URL` / `API_INTERNAL_URL` si mueves la base o la API). |
| `502` en localhost:8180 | Caddy está arriba pero la web o la API no. Revisa la terminal de `pnpm dev`. |
| Te saca de la sesión al cambiar `.env` | Cambiar `JWT_SECRET` invalida los tokens. Pon el viejo en `JWT_SECRET_PREVIOUS` para rotarlo sin cerrar sesiones. |
| La PWA muestra una versión vieja | El service worker guardó caché. En DevTools → Application → Service Workers, marca "Update on reload" o usa "Unregister". |
| Las notificaciones push no llegan | Deben estar permitidas en el navegador y el perfil, y no caer en el horario silencioso (22:00–07:00). Los recordatorios sí suenan en ese horario. |
