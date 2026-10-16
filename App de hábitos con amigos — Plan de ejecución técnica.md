# App de hábitos con amigos — Plan de ejecución técnica

Oct 15, 2026 · @Paulo

## Resumen y decisiones clave

Un monorepo con pnpm y Turborepo aloja la API en NestJS, el front en Next.js y paquetes compartidos; Caddy actúa como proxy interno y sirve todo bajo un mismo dominio. Al compartir origen, la sesión viaja en cookies httpOnly sin CORS. La regla general: si Node, Nest o el navegador ya lo resuelven, no se añade una librería.

| Área | Decisión | Por qué |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | Instalación rápida, builds en paralelo y caché de tareas |
| API | NestJS sin Passport ni class-validator | Guards y pipes propios cubren auth y validación con menos dependencias |
| Auth | JWT HS256 firmado con `node:crypto`, contraseñas con `scrypt` | Cero librerías de criptografía externas |
| Validación | Zod en un paquete compartido | El mismo esquema valida en el front y en la API |
| Base de datos | PostgreSQL 16 + Drizzle ORM | ORM liviano, SQL tipado y sin motor binario |
| Proxy | Caddy | Un binario, configuración de pocas líneas, HTTPS automático en producción |
| Front | Next.js App Router con CSS por clases y tokens | Design system intercambiable cambiando un archivo de tokens |
| Tiempo real | Server-Sent Events nativos de Nest | Notificaciones in-app sin WebSockets ni librerías |
| Push | Web Push con VAPID (librería `web-push`) | Cifrado del estándar ya resuelto y probado |
| PWA | Manifest nativo de Next y service worker escrito a mano | Control total y sin plugins |

Supuestos: TypeScript estricto en todo el repo y Node 22 LTS. Ambos se pueden cambiar si ya tienes otra versión fijada.

## Arquitectura

El navegador solo habla con Caddy; Caddy envía `/api` a NestJS y el resto a Next.js. La API es la única que toca Postgres y la única que envía notificaciones push.

&#91;embedded content: arquitectura · proxy, web, API, base de datos y push\]

Next.js renderiza en el servidor llamando a la API por la red interna y reenvía la cookie del usuario; el navegador recibe las notificaciones en vivo por SSE a través del mismo proxy.

## Estructura del monorepo

Dos apps y cuatro paquetes compartidos; las apps nunca se importan entre sí, solo consumen paquetes. Así el contrato entre front y API vive en un único lugar.

```text
habitos/
├─ apps/
│  ├─ api/                 # NestJS
│  │  ├─ src/
│  │  │  ├─ modules/         # auth, users, habits, logs, pacts, feed, gamification, notifications
│  │  │  ├─ common/          # guards, pipes, filtros, decoradores
│  │  │  ├─ db/              # cliente Drizzle, esquema, migraciones
│  │  │  ├─ jobs/            # worker de recordatorios y rachas
│  │  │  └─ main.ts
│  │  └─ test/
│  └─ web/                 # Next.js
│     ├─ app/                # rutas: (auth), (app)/hoy, pactos, perfil
│     ├─ lib/                # cliente API, sesión, cola offline
│     └─ public/             # sw.js, íconos
├─ packages/
│  ├─ contracts/           # esquemas Zod + tipos compartidos
│  ├─ tokens/              # design tokens en CSS (variables)
│  ├─ ui/                  # componentes React + su CSS por componente
│  └─ config/              # tsconfig base
├─ infra/
│  ├─ Caddyfile
│  ├─ docker/              # entrypoint y respaldo de la imagen única
│  ├─ docker-compose.dev.yml
│  └─ docker-compose.prod.yml
├─ Dockerfile              # imagen única de producción
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

- **contracts:** cada endpoint exporta su esquema de entrada y salida; la API lo usa para validar y el front para tipar formularios y respuestas.
- **tokens:** solo variables CSS; cambiar este paquete recrea el design system sin tocar componentes.
- **ui:** componentes sin lógica de negocio, cada uno en su carpeta con `.tsx` y `.css`.

## Presupuesto de dependencias

La API corre con 9 dependencias de producción y el front con 4, contando Zod en ambos. Cualquier librería nueva debe justificar qué no puede hacer la plataforma.

| Paquete | Dónde | Para qué |
| --- | --- | --- |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | api | Núcleo de Nest |
| `reflect-metadata`, `rxjs` | api | Requeridos por Nest (rxjs también alimenta SSE) |
| `drizzle-orm` + `pg` | api | ORM y driver de Postgres |
| `web-push` | api | Envío de notificaciones push con VAPID |
| `zod` | contracts | Validación compartida |
| `next`, `react`, `react-dom` | web | Framework del front |

**Herramientas de desarrollo:** `typescript`, `turbo`, `drizzle-kit` (migraciones), `@nestjs/cli` (build y watch), Biome (lint y formato en un solo binario, en lugar de ESLint y Prettier) y `tsx`.

**Lo que se resuelve sin librerías**

| Necesidad | Librería típica que se evita | Solución nativa |
| --- | --- | --- |
| Firmar y verificar JWT | `jsonwebtoken`, `@nestjs/jwt` | `crypto.createHmac` + `timingSafeEqual` |
| Hash de contraseñas | `bcrypt`, `argon2` | `crypto.scrypt` con sal aleatoria |
| Estrategias de auth | `passport` | Un `AuthGuard` propio |
| Validación de DTOs | `class-validator`, `class-transformer` | `ZodValidationPipe` propio |
| Leer cookies | `cookie-parser` | Función de 10 líneas sobre el header |
| Límite de peticiones | `@nestjs/throttler` | Guard con ventana deslizante en memoria (Postgres si hay varias instancias) |
| Cabeceras de seguridad | `helmet` | Cabeceras en el Caddyfile |
| Tareas programadas | `@nestjs/schedule` | `setInterval` + bloqueo con `SKIP LOCKED` |
| Tiempo real | `socket.io` | `@Sse()` de Nest |
| Pruebas | `jest` | `node:test` + `fetch` nativo |
| Estilos | Tailwind, styled-components | CSS con `@layer` y variables |
| PWA | `next-pwa` | `app/manifest.ts` + `sw.js` propio |

## API NestJS: módulos y seguridad

La API se organiza en ocho módulos de dominio, todos protegidos por defecto: una ruta es pública solo si se marca con `@Public()`. Todas las rutas viven bajo `/api/v1`.

| Módulo | Responsabilidad | Endpoints principales |
| --- | --- | --- |
| auth | Registro, login, refresh, logout, sesiones | `POST /auth/register`, `/login`, `/refresh`, `/logout` |
| users | Perfil, zona horaria, preferencias de notificación | `GET/PATCH /me` |
| habits | Hábitos de construir y romper, identidad, versión mínima, apilamiento | `CRUD /habits` |
| logs | Registros diarios, recaídas, comodines | `POST /habits/:id/logs`, `POST /logs/sync` |
| pacts | Pactos, invitaciones por enlace, miembros | `POST /pacts`, `POST /pacts/join/:code` |
| feed | Actividad del pacto, reacciones, empujones | `GET /pacts/:id/feed`, `POST /logs/:id/reactions`, `POST /nudges` |
| gamification | XP, niveles de identidad, rachas, logros, misiones | `GET /me/progress` |
| notifications | Bandeja in-app, stream SSE, suscripciones push | `GET /notifications`, `GET /notifications/stream`, `POST /push/subscribe` |

**Capa de seguridad**

1. **Guard global de autenticación:** lee la cookie de acceso, verifica firma, expiración y emisor, y adjunta el usuario a la petición.
2. **Guard de pertenencia:** valida que el usuario sea dueño del hábito o miembro del pacto antes de leer o escribir.
3. **Validación con Zod:** toda entrada pasa por el esquema de `contracts`; lo que no está en el esquema se descarta.
4. **Protección CSRF:** cookies `SameSite=Lax` y verificación de un header `X-Requested-With` en métodos que modifican datos.
5. **Límite de peticiones:** 5 intentos de login por minuto por IP y correo; límite general por usuario en el resto.
6. **Filtro de errores:** respuestas uniformes sin trazas ni detalles internos en producción.
7. **Consultas parametrizadas:** Drizzle evita SQL concatenado; nunca se arma SQL con texto del usuario.
8. **Secretos por entorno:** `JWT_SECRET`, `VAPID_*` y `DATABASE_URL` se validan al arrancar con Zod; si falta uno, la API no inicia.
9. **Cabeceras en el proxy:** HSTS, `X-Content-Type-Options`, `Referrer-Policy` y Content Security Policy desde Caddy.
10. **Auditoría mínima:** registro de logins, cambios de contraseña y revocación de sesiones.

## Autenticación con JWT

Se usan dos tokens: uno de acceso corto y firmado, y uno de refresco opaco que rota en cada uso y se guarda hasheado en la base de datos. Ninguno toca `localStorage`: ambos viajan en cookies httpOnly.

| Token | Formato | Vida | Cookie | Se guarda en BD |
| --- | --- | --- | --- | --- |
| Acceso | JWT HS256 con `sub`, `iat`, `exp`, `iss`, `sid` | 15 minutos | `access`, `Path=/api` | No |
| Refresco | 32 bytes aleatorios en base64url | 30 días | `refresh`, `Path=/api/v1/auth` | Sí, como hash SHA-256 |

Ambas cookies llevan `HttpOnly`, `Secure` y `SameSite=Lax`.

**Flujo**

1. **Registro:** correo y contraseña validados con Zod; la contraseña se guarda con `scrypt` y sal de 16 bytes.
2. **Login:** se compara con `timingSafeEqual`; si es correcto, se crea una sesión (`sid`) y se emiten ambos tokens.
3. **Petición normal:** el guard verifica el JWT solo con `node:crypto`, sin consultar la base de datos.
4. **Expiración:** el cliente recibe 401, llama a `/auth/refresh` una sola vez y reintenta la petición original.
5. **Rotación:** cada refresh invalida el token anterior y emite uno nuevo de la misma familia.
6. **Detección de robo:** si llega un refresh ya usado, se revoca toda la familia y el usuario debe iniciar sesión de nuevo.
7. **Logout:** borra la sesión en BD y expira las cookies; existe también "cerrar todas las sesiones".

**Implementación del JWT sin librerías**

- Codificar header y payload en base64url, firmar con `createHmac('sha256', secret)` y comparar firmas con `timingSafeEqual`.
- Rechazar cualquier `alg` distinto de HS256 y tokens sin `exp`.
- Permitir dos secretos (actual y anterior) para rotar `JWT_SECRET` sin cerrar sesiones.
- Cubrir con pruebas: firma alterada, token expirado, `alg: none` y payload modificado.

Más adelante se puede sumar login con Google como otro método que termina en la misma emisión de tokens.

## Base de datos y ORM

PostgreSQL 16 con Drizzle ORM: el esquema se escribe en TypeScript, `drizzle-kit` genera migraciones SQL versionadas en el repo y las consultas quedan tipadas de punta a punta. Los IDs son UUID v7 y todas las fechas se guardan en UTC.

| Tabla | Campos clave | Notas |
| --- | --- | --- |
| `users` | email, password\_hash, display\_name, timezone | `timezone` decide cuándo se cierra el día de cada usuario |
| `sessions` | user\_id, family\_id, refresh\_hash, expires\_at, revoked\_at | Rotación y detección de robo de tokens |
| `habits` | user\_id, kind (build / break), identity, title, min\_version, cue\_time, cue\_place, stacked\_on, visibility | `stacked_on` apunta a otro hábito para el apilamiento |
| `habit_logs` | habit\_id, local\_date, status (done / min / relapse / skip), value, note, photo\_url, client\_id | Único por `habit_id + local_date`; `client_id` evita duplicados offline |
| `streaks` | habit\_id, current, best, freezes\_left, last\_date | Se recalcula al registrar y en el cierre diario |
| `pacts` | name, goal, starts\_at, ends\_at, invite\_code | `invite_code` corto y revocable |
| `pact_members` | pact\_id, user\_id, role, joined\_at | De 3 a 8 miembros |
| `pact_habits` | pact\_id, habit\_id | Qué hábitos comparte cada miembro |
| `reactions` | log\_id, user\_id, emoji | Una por usuario y emoji |
| `nudges` | from\_user, to\_user, habit\_id, local\_date | Máximo uno por día y hábito |
| `xp_events` | user\_id, identity, amount, reason, ref\_id | Libro mayor: el XP nunca baja |
| `achievements` / `user_achievements` | code, rule / user\_id, unlocked\_at | Logros definidos como datos |
| `notifications` | user\_id, type, payload (jsonb), read\_at, created\_at | Bandeja in-app |
| `push_subscriptions` | user\_id, endpoint, p256dh, auth, user\_agent | Una por dispositivo |
| `jobs` | type, run\_at, payload, locked\_at, attempts | Cola de recordatorios y tareas diferidas |

**Reglas de datos**

- La fecha del registro es `local_date` en la zona del usuario, no la hora del servidor: así las rachas son justas para todos.
- Los registros de recaída usan la misma tabla con `status = relapse` y respetan la visibilidad privada por defecto.
- Índices en `habit_logs (habit_id, local_date)`, `notifications (user_id, read_at)` y `jobs (run_at) WHERE locked_at IS NULL`.
- Un script de seed crea usuarios, un pacto y dos semanas de registros para desarrollar con datos realistas.

## Frontend Next.js y design system

El front usa App Router con Server Components para leer datos y Client Components solo donde hay interacción. Los estilos son CSS plano con clases: los componentes nunca usan colores ni medidas directas, solo variables de `packages/tokens`, así que cambiar ese archivo recrea todo el design system.

**Tres capas de estilo**

1. **Tokens** (`packages/tokens/tokens.css`): colores, tipografía, espaciado, radios, sombras y duraciones como variables CSS, con variantes para modo oscuro mediante `[data-theme='dark']`.
2. **Base** (`apps/web/app/globals.css`): reset, tipografía base y orden de capas con `@layer reset, tokens, base, components, utilities`.
3. **Componentes** (`packages/ui`): un archivo CSS por componente dentro de `@layer components`, con clases con prefijo y estilo BEM (`hb-button`, `hb-button--primary`, `hb-button__icon`).

```css
/* packages/tokens/tokens.css */
@layer tokens {
  :root {
    --color-bg: #fbfaf7;
    --color-text: #1f1d1a;
    --color-accent: #2f6f5e;
    --space-2: 8px;
    --space-4: 16px;
    --radius-md: 12px;
    --font-body: 'DM Sans', system-ui, sans-serif;
  }
}

/* packages/ui/button/button.css */
@layer components {
  .hb-button {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
  }
  .hb-button--primary { background: var(--color-accent); color: var(--color-bg); }
}
```

**Componentes separados en `packages/ui`**

- **Primitivos:** Button, Input, Checkbox, Card, Avatar, Badge, Sheet (panel inferior para móvil), Toast.
- **De dominio:** HabitCard, CheckInButton (registro en un toque con animación), StreakFlame, HeatmapCalendar, PactFeedItem, ReactionBar, NudgeButton, XpBar, AchievementBadge.
- Cada componente vive en su carpeta (`button/button.tsx`, `button/button.css`, `button/index.ts`) y no conoce la API: recibe datos y callbacks por props.
- Una ruta interna `/design` muestra todos los componentes y estados, a modo de catálogo sin instalar Storybook.

**Datos y estado sin librerías extra**

- `lib/api.ts`: un `fetch` envuelto que añade `X-Requested-With`, maneja el 401 con un único refresh y valida respuestas con los esquemas de `contracts`.
- Server Actions para formularios simples y `useOptimistic` de React para que el registro se marque al instante.
- Un contexto de sesión pequeño; sin Redux, Zustand ni React Query.
- `middleware.ts` de Next redirige a login si no existe la cookie de sesión (la verificación real sigue en la API).

**Pantallas del MVP:** login y registro, onboarding de identidad, Hoy (hábitos del día), detalle de hábito, pactos y su feed, unirse por enlace, progreso y perfil con notificaciones.

## Sistema de notificaciones

Las notificaciones refuerzan la ley 1 (hacerlo obvio) y la ley 4 (hacerlo satisfactorio) sin volverse ruido. Todo pasa por un único `NotificationService` que decide el canal: in-app, push o ambos, según el tipo, las preferencias y un límite diario.

| Tipo | Disparador | Canal | Ley que refuerza |
| --- | --- | --- | --- |
| Recordatorio de hábito | Hora de la señal elegida por el usuario | Push | 1. Obvio |
| Reacción recibida | Un amigo reacciona a un registro | In-app (push agrupado) | 4. Satisfactorio |
| Empujón | Un amigo envía un nudge | Push + in-app | 2. Atractivo |
| Nuevo miembro del pacto | Alguien entra por invitación | In-app | Friends loop |
| Riesgo de racha | Faltan 2 horas para cerrar el día sin registro | Push | Nunca fallar dos veces |
| Logro o subida de nivel | Regla cumplida | In-app con animación | 4. Satisfactorio |
| Resumen semanal | Domingo en la tarde, hora local | In-app + push | Identidad |

**Cómo funciona cada canal**

- **In-app en tiempo real:** el endpoint `GET /notifications/stream` usa `@Sse()` de Nest. El front abre un `EventSource` nativo; al llegar un evento se muestra un Toast y sube el contador de la bandeja.
- **Push:** el usuario acepta permisos después de su primer registro, no al entrar. El navegador entrega una suscripción que se guarda en `push_subscriptions`; la API envía con `web-push` y borra las suscripciones que respondan 404 o 410.
- **Recordatorios programados:** al crear o editar un hábito se agenda un trabajo en `jobs` para la próxima hora local de su señal. Un worker revisa cada minuto con `SELECT … FOR UPDATE SKIP LOCKED`, envía y reprograma el siguiente.
- **Cierre diario:** un trabajo por zona horaria cierra el día, actualiza rachas, consume comodines y genera los avisos de riesgo.

**Reglas para no saturar**

- Máximo 4 push por día por usuario; las reacciones se agrupan ("Ana y 2 más reaccionaron").
- Horario silencioso configurable, por defecto de 22:00 a 7:00 hora local.
- Si ya registró el hábito, el recordatorio se cancela.
- Preferencias por tipo en el perfil, con opción de apagar todo menos los recordatorios.

## PWA

La app se instala desde el navegador y permite registrar hábitos sin conexión; los registros se sincronizan al volver la red. Todo con el manifest nativo de Next y un service worker propio de unas 150 líneas.

**Manifest** (`app/manifest.ts`): nombre, `display: standalone`, colores tomados de los tokens, íconos de 192 y 512 px (incluido uno `maskable`) y un acceso directo "Registrar hoy".

**Service worker** (`public/sw.js`)

| Recurso | Estrategia | Por qué |
| --- | --- | --- |
| Shell de la app (HTML, JS y CSS de `/_next/static`) | Cache first, con versión por build | Abre al instante, incluso sin red |
| Pantalla Hoy y lista de hábitos | Stale-while-revalidate | Muestra lo último conocido y actualiza en segundo plano |
| `GET /api` del feed y el progreso | Network first con respaldo en caché | Prioriza datos frescos |
| `POST` de registros | Cola offline en IndexedDB | Ningún registro se pierde |
| Auth y notificaciones | Solo red | Nunca se cachean datos sensibles |

**Registro offline**

1. El usuario marca un hábito; la UI lo muestra hecho al instante gracias a `useOptimistic`.
2. Si no hay red, el registro se guarda en IndexedDB con un `client_id` único y su `local_date`.
3. Al volver la conexión (Background Sync donde exista, o el evento `online` como respaldo) se envía el lote a `POST /logs/sync`.
4. La API usa `client_id` para ignorar duplicados y devuelve rachas y XP actualizados.

**Push en el service worker**

- El evento `push` muestra la notificación con acciones rápidas: "Hecho" y "Versión de 2 min".
- `notificationclick` registra el hábito directamente o abre la app en la pantalla correcta.
- En iOS, el push solo funciona con la app instalada en la pantalla de inicio; el onboarding mostrará cómo instalarla.

**Actualizaciones:** al publicar un build nuevo, el service worker nuevo queda en espera y la app muestra "Hay una nueva versión" para recargar sin perder la cola offline.

## Desarrollo, build y despliegue

Un solo comando levanta todo en local y el mismo Caddyfile funciona en desarrollo y producción, así lo que se prueba en local se comporta igual en el servidor. Turborepo construye solo lo que cambió y reutiliza la caché en CI.

**Proxy interno con Caddy**

```text
# infra/Caddyfile
{$DOMAIN:localhost:8080} {
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000"
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
  }
  handle /api/* {
    reverse_proxy {$API_UPSTREAM:host.docker.internal:3001} {
      flush_interval -1   # necesario para SSE
    }
  }
  handle {
    reverse_proxy {$WEB_UPSTREAM:host.docker.internal:3000}
  }
}
```

**Comandos del día a día**

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Levanta Postgres y Caddy con Docker y corre API y web en modo watch vía Turbo |
| `pnpm db:generate` / `pnpm db:migrate` | Genera y aplica migraciones de Drizzle |
| `pnpm db:seed` | Carga datos de prueba |
| `pnpm test` | Pruebas con `node:test` en todos los paquetes |
| `pnpm typecheck` / `pnpm lint` | Verificación de tipos y estilo |
| `pnpm build` | Build de producción con caché de Turbo |

**Pipeline de Turbo:** `build` depende de `^build`, así `contracts`, `tokens` y `ui` se compilan antes que las apps; `typecheck`, `lint` y `test` corren en paralelo; `dev` no se cachea.

**Builds de producción: una sola imagen**

- **Dockerfile en la raíz, multi-stage:** compila API y web con Turbo, deja la API solo con dependencias de producción (`pnpm deploy --prod`) y la web con `output: 'standalone'`, y las junta en una imagen `node:24-alpine` con Postgres 16 y el binario de Caddy.
- **Un contenedor, cuatro procesos:** `tini` como PID 1 y `infra/docker/entrypoint.sh` como supervisor. Arranca Postgres, aplica las migraciones y luego levanta API, web y Caddy. Si uno cae, detiene todo para que el orquestador reinicie el contenedor; con `SIGTERM` apaga en orden, Postgres al final.
- **Sin conflictos de puertos:** solo Caddy se expone (8080). API (3101), web (3100) y Postgres (5432) escuchan en `127.0.0.1`. Caddy envía `/api/*` a la API (SSE sin buffer) y el resto a Next, y Next llama a la API por `127.0.0.1`.
- **Mínimo privilegio:** Postgres corre como `postgres` y API, web y Caddy como `node`; root solo prepara el volumen. Postgres acepta al superusuario por socket local (peer) y a la app con contraseña (SCRAM).
- **Lista para funcionar:** solo `PUBLIC_URL` es obligatoria. Los secretos que falten (`POSTGRES_PASSWORD`, `JWT_SECRET`, VAPID) se generan en el primer arranque y se guardan en el volumen `/data/secrets.env`. Una variable de entorno siempre tiene prioridad.
- **Estado en un volumen:** `/data` guarda la base, los secretos y los respaldos.
- **HTTPS:** lo termina Coolify (Traefik) delante del contenedor. Caddy confía en el `X-Forwarded-For` de redes privadas en modo estricto y entrega a la API la IP real del cliente para el límite de peticiones.

**CI/CD con GitHub Actions:** en cada PR corren typecheck, lint y test con caché de pnpm y Turbo, y se construye la imagen y se prueba arrancada (health, web y un reinicio). Al hacer merge a `main`, además se publica en GHCR (`latest` y `sha-<commit>`) con SBOM y procedencia firmada, y un webhook pide a Coolify el redeploy. Las migraciones corren al arrancar el contenedor. Las actions van fijadas por SHA, cada job tiene permisos mínimos y los secretos de Coolify viven en el environment `production`, limitado a `main`.

**Respaldo:** `pg_dump` diario dentro del contenedor a `/data/backups` con 14 días de retención; sincronízalo con almacenamiento externo.

## Fases de ejecución

Siete fases en orden de dependencia: cada una termina con algo usable y un criterio de cierre verificable. Las fases 4 y 5 pueden avanzar en paralelo si hay dos personas.

1. **Fundaciones**
   - Monorepo con pnpm y Turbo, tsconfig base, Biome, Docker Compose con Postgres y Caddy, CI con typecheck y test.
   - Cierre: `pnpm dev` levanta todo y `localhost:8080` responde con la web y `/api/v1/health`.
2. **Autenticación y usuarios**
   - JWT con `node:crypto`, `scrypt`, sesiones con rotación, guards, validación con Zod, límite de peticiones; pantallas de login y registro.
   - Cierre: pruebas de token alterado, expirado, `alg: none` y reuso de refresh pasan en verde.
3. **Design system y shell del front**
   - Paquete de tokens, capas CSS, primitivos de `ui`, catálogo `/design`, layout móvil y navegación.
   - Cierre: cambiar `tokens.css` cambia todo el look sin tocar un componente.
4. **Hábitos y registro**
   - CRUD de hábitos (construir y romper), identidad, versión de 2 minutos, apilamiento, registro en un toque, rachas con zona horaria y comodines; onboarding.
   - Cierre: un usuario nuevo registra su primer hábito en menos de 2 minutos.
5. **Pactos y friends loop**
   - Pactos, invitación por enlace, feed, reacciones, empujones con límite.
   - Cierre: un invitado entra desde el enlace directo al pacto y su registro aparece en el feed de los demás.
6. **Notificaciones, PWA y gamificación**
   - SSE in-app, push con VAPID, worker de recordatorios y cierre diario; manifest, service worker y cola offline; XP, niveles y logros.
   - Cierre: un registro hecho sin red se sincroniza al volver y un recordatorio llega a la hora local configurada.
7. **Endurecimiento y lanzamiento**
   - CSP ajustada, pruebas de carga básicas, respaldos, monitoreo de errores y despliegue de producción; prueba con 3 grupos de amigos.
   - Cierre: la app instalada funciona en Android e iOS y los primeros grupos completan una semana.

**Decisiones abiertas**

- ¿Dónde se aloja? Un VPS con Docker Compose es lo más simple; se puede mover a otro proveedor más adelante.
- ¿Las fotos de prueba se guardan en disco del servidor o en un almacenamiento compatible con S3?
- ¿Se incluye login con Google desde el inicio o después del MVP?
