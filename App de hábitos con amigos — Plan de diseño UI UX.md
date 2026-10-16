# App de hábitos con amigos — Plan de diseño UI/UX

Oct 15, 2026 · @Paulo

## Principios de diseño

La app debe sentirse como un ritual de segundos, no como una tarea: abrir, marcar, sentir la recompensa y cerrar. Cada decisión de interfaz se evalúa contra cinco principios.

1. **Un toque para lo esencial.** Registrar un hábito nunca requiere más de un gesto desde la pantalla de inicio, una notificación o un acceso directo.
2. **Calma por defecto, emoción en el momento justo.** La interfaz en reposo es silenciosa y espaciosa; el color, el movimiento y el sonido se reservan para el registro, los logros y las reacciones de amigos.
3. **La identidad al centro.** La pantalla no habla de tareas pendientes sino de quién estás siendo: "Hoy votaste 3 veces por ser lector".
4. **Social sin ansiedad.** Ver a los amigos motiva; compararse con ellos o ser señalado no. Nada de rojos de error ni contadores de fallos públicos.
5. **Pensada para el pulgar.** Acciones principales en la mitad inferior de la pantalla, navegación inferior y paneles que suben desde abajo.

**Lo que se evita:** formularios largos, menús profundos, notificaciones de culpa, gráficos complejos en la pantalla principal y diseño recargado de recompensas que distraiga del hábito.

## Estrategias modernas e innovadoras

El diseño de 2025 y 2026 se aleja del minimalismo plano hacia interfaces más expresivas, con capas y movimiento, pero sin sacrificar claridad. Estas ocho estrategias son las que mejor encajan con una app de hábitos social.

| Estrategia | Qué dice la evidencia | Cómo la aplicamos |
| --- | --- | --- |
| [Diseño expresivo](https://developer.android.com/design/ui/wear/guides/get-started/benefits) (Material 3 Expressive) | En la investigación de Google, las variantes expresivas duplicaron la preferencia y subieron hasta 170 % la valoración estética; gustan sobre todo entre 18 y 24 años, pero una minoría fuerte prefiere versiones más calmadas | Formas redondeadas y tamaños generosos en el botón de registro y los logros; un modo "calma" que baja color y animaciones |
| [Capas flotantes y translucidez](https://www.createwithswift.com/exploring-a-new-visual-language-liquid-glass/) (Liquid Glass de Apple) | Los controles flotan sobre el contenido y se retiran cuando no hacen falta; las formas siguen la geometría del dedo | Barra de navegación inferior flotante con desenfoque sutil (`backdrop-filter`), siempre con contraste verificado |
| [Transiciones nativas de vista](https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026) | Para mayo de 2026 Chrome, Firefox y Safari soportan la View Transitions API, con más del 95 % del tráfico global | La tarjeta del hábito se "expande" hasta su detalle y el avatar viaja al perfil, sin librerías de animación |
| [Rachas éticas](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design) | Duolingo separó la racha de la meta diaria, sumó comodines, recuperación de rachas y rachas con amigos | La versión de 2 minutos mantiene la racha; los comodines y la racha de pacto se muestran como cuidado, no como amenaza |
| [Respiro en el diseño de rachas](https://smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/) | Las rachas aprovechan la aversión a la pérdida, y un sistema ético deja espacio para descansar | Nunca mostrar "perdiste tu racha" en rojo; mostrar récord, votos acumulados y "volvemos mañana" |
| [Compañero emocional](https://screensdesign.com/showcase/finch-self-care-pet) (estilo Finch) | El onboarding emocional de Finch crea apego desde el primer minuto y su barra de energía conecta el progreso con lo que el usuario hace; su punto débil es la pantalla saturada | Un "jardín del pacto" que crece con los registros de todo el grupo, en una sola vista y sin competir con la lista de hábitos |
| [Presencia fuera de la app](https://feedbagel.com/post/the-psychology-and-ux-design-principles-behind-effective-streak-systems) | Los widgets de racha de Duolingo en iOS aumentaron el compromiso de los usuarios en 60 % | Como PWA: acciones rápidas en la notificación ("Hecho", "2 min") y acceso directo "Registrar hoy" desde el ícono |
| [Onboarding con preguntas de contexto](https://apiko.com/blog/ux-design-trends/) | El onboarding móvil es uno de los retos clave de 2026; la tendencia es preguntar según el contexto en vez de formularios largos | Preguntas de identidad de un toque, y sugerencias de hora de recordatorio aprendidas de cuándo suele registrar cada persona |

**Lo que se descarta:** interfaces por voz, realidad aumentada y 3D decorativo. Suman complejidad sin ayudar a registrar más rápido.

## Arquitectura de información y navegación

La app tiene cuatro pestañas en una barra inferior flotante y un botón central para crear hábitos; ninguna pantalla está a más de dos toques. Hoy es la pantalla de inicio y la única que importa en el día a día.

&#91;embedded content: mapa de pantallas · 4 pestañas, 12 pantallas, 3 atajos\]

Los atajos externos llevan directo a la acción: quien registra desde una notificación puede hacerlo sin abrir la app, y quien llega por invitación aterriza en el pacto, no en una pantalla genérica.

**Reglas de navegación**

- Los detalles y formularios abren como paneles inferiores que se cierran deslizando hacia abajo, para no perder el contexto.
- El botón atrás del sistema y el gesto de deslizar siempre funcionan igual.
- La barra se oculta al hacer scroll hacia abajo y vuelve al subir, para dar más espacio al contenido.

## Pantallas clave y flujos

Cinco pantallas concentran casi todo el uso esperado; cada una tiene una sola acción principal, siempre al alcance del pulgar.

| Pantalla | Acción principal | Qué muestra | Detalle de diseño |
| --- | --- | --- | --- |
| Hoy | Registrar un hábito | Saludo con la identidad del día, lista de hábitos pendientes y hechos, franja con la actividad del pacto | Los hechos bajan con animación y se agrupan; cuando todo está hecho, la pantalla celebra y se vacía |
| Registro | Confirmar con un toque | Botón grande "Hecho", opción "Versión de 2 min" y foto o nota opcionales | Panel inferior que sube desde la tarjeta; mantener presionado abre las opciones sin otra pantalla |
| Pacto | Reaccionar o empujar | Jardín compartido, racha de grupo, feed con los registros recientes | Reacciones con un toque largo sobre el registro; empujón con frases amables ya escritas |
| Progreso | Entender el avance | Niveles por identidad, mapa de calor, logros, contador de libertad para hábitos a romper | Lenguaje de votos ("62 votos por ser atleta"), sin porcentajes de fallo |
| Crear hábito | Terminar en menos de 1 minuto | Identidad, plantilla, versión mínima, señal de hora y lugar, apilamiento | Asistente de 4 pasos con valores sugeridos; todo se puede editar después |

**Flujo de onboarding (objetivo: primer registro en menos de 2 minutos)**

1. Si llega por invitación, la primera pantalla muestra el pacto y la cara del amigo que lo invitó.
2. Registro con Google o correo en una sola pantalla.
3. "¿Quién quieres ser?" con tarjetas grandes de identidad.
4. Plantilla de hábito ya rellena con su versión de 2 minutos; solo se elige la hora.
5. Invitación a hacer la versión mínima ya mismo, con la primera celebración.
6. Solo después se piden permisos de notificación y se propone instalar la app.

**Flujo de hábito a romper:** la misma estructura, pero con detonantes, un sustituto y la elección de quién puede ver las recaídas. La pantalla principal muestra días de libertad en lugar de casillas por marcar.

**Estados vacíos y de error:** cada pantalla tiene un estado vacío ilustrado con una acción clara ("Crea tu primer pacto") y los errores de red se resuelven en silencio con la cola offline, avisando solo si algo no se pudo sincronizar.

## Sistema visual

Un sistema cálido y calmado en reposo, con un acento vivo que solo aparece al actuar. Todo se define como tokens CSS en `packages/tokens`, así que esta sección es a la vez la guía visual y la especificación de ese archivo.

**Color por roles, no por nombres**

| Token | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| `--color-bg` | Fondo general | Blanco cálido `#FBFAF7` | `#141412` |
| `--color-surface` | Tarjetas y paneles | `#FFFFFF` | `#1E1D1A` |
| `--color-text` / `--color-text-muted` | Texto principal y secundario | `#1F1D1A` / `#6B675F` | `#F2EFE8` / `#A39E94` |
| `--color-accent` | Registro, acción principal | Verde esmeralda `#2F6F5E` | `#5FB89E` |
| `--color-celebrate` | Logros, subida de nivel | Dorado `#E0A526` | `#F2C14E` |
| `--color-social` | Reacciones y pacto | Coral `#E8735A` | `#F08F7A` |
| `--color-calm` | Hábitos a romper, días de libertad | Azul suave `#5B7FA6` | `#8AA9CC` |

No existe un "rojo de error" para los hábitos: los fallos se muestran en gris neutro. El rojo se reserva para errores del sistema y acciones destructivas.

**Tipografía:** una sola familia variable para títulos y texto (por ejemplo DM Sans o Inter), con pesos de 400 a 700 y una escala de 6 tamaños (12, 14, 16, 20, 28 y 40 px). Los números de rachas y XP usan cifras tabulares para que no salten al animarse.

**Espaciado y forma**

- Escala de espaciado en múltiplos de 4 px (4, 8, 12, 16, 24, 32, 48).
- Radios generosos: 12 px en tarjetas, 20 px en paneles inferiores y forma de píldora en botones principales.
- Sombras mínimas; la jerarquía se logra con superficie, tamaño y espacio.

**Iconografía e ilustración:** iconos de trazo redondeado de 24 px; ilustraciones suaves para estados vacíos, el jardín del pacto y los logros. Cada identidad tiene un color y un ícono propios para reconocerla de un vistazo.

**Tema por pacto (innovación):** cada pacto puede elegir su color de acento entre 6 opciones accesibles; al entrar al pacto, la interfaz cambia el token `--color-accent`, reforzando la sensación de espacio compartido.

## Movimiento y microinteracciones

El movimiento explica qué pasó y premia lo que hiciste; nunca decora sin motivo. Todo se construye con CSS, View Transitions y Web Animations API, sin librerías, y se reduce automáticamente con `prefers-reduced-motion`.

**Tokens de movimiento**

| Token | Duración | Curva | Uso |
| --- | --- | --- | --- |
| `--motion-quick` | 120 ms | ease-out | Presionar botones, cambios de estado pequeños |
| `--motion-base` | 220 ms | ease-in-out | Paneles, tarjetas que se reordenan |
| `--motion-spring` | 400 ms | resorte con `linear()` | Registro, logros, rachas que suben |
| `--motion-page` | 300 ms | ease-in-out | Transiciones entre pantallas |

**Microinteracciones clave**

1. **El registro (la estrella):** al tocar, el círculo se llena desde el punto del dedo, el check se dibuja, la tarjeta da un pequeño rebote y aparece un "+10 XP" que sube y se desvanece. Dura menos de medio segundo para no frenar.
2. **Registro en cadena:** si quedan hábitos, la siguiente tarjeta se resalta suavemente, invitando a seguir sin obligar.
3. **Racha que crece:** la llama del número aumenta de tamaño en hitos (7, 21, 30 días) con un destello dorado.
4. **Reacciones:** el emoji vuela desde el feed hasta el registro del amigo; quien lo recibe ve una burbuja animada en su próximo ingreso.
5. **Mantener presionado:** abre opciones del registro (2 min, nota, foto) con un panel que crece desde la tarjeta.
6. **Deslizar:** deslizar una tarjeta a la derecha registra, a la izquierda pospone; siempre con alternativa de botón para quien no usa gestos.
7. **Transiciones entre pantallas:** la tarjeta del hábito se expande hasta su detalle con View Transitions, así el usuario nunca pierde el contexto.
8. **Esqueletos de carga:** formas suaves con brillo lento en lugar de spinners; con datos en caché casi nunca se ven.

**Sonido y vibración:** un sonido corto y opcional al registrar y otro al subir de nivel; vibración breve con la Vibration API donde el navegador lo permita (Android), sin depender de ella.

## Gamificación visual y feedback emocional

La gamificación se ve, se siente y se celebra, pero nunca tapa el hábito. La regla visual: la recompensa aparece después de actuar y se va sola en segundos.

| Elemento | Representación visual | Tono emocional |
| --- | --- | --- |
| Racha personal | Llama junto al hábito que crece en hitos; en día protegido por comodín se muestra con un escudo | Orgullo tranquilo |
| XP y nivel por identidad | Barra fina bajo cada identidad; al subir, pantalla breve con el nuevo título ("Lector constante") | Logro |
| Jardín del pacto | Ilustración compartida: cada registro del grupo hace crecer una planta; si todos cumplen la semana, florece | Pertenencia |
| Racha de grupo | Cadena de eslabones con la foto de cada miembro; los que ya registraron hoy se iluminan | Compromiso mutuo |
| Logros | Medallas ilustradas con forma propia, coleccionables en el perfil | Descubrimiento |
| Contador de libertad | Número grande con lo ganado (días, dinero, horas) en azul calma | Alivio |
| Misiones semanales | Tarjeta con 3 retos y su progreso, renovada cada lunes | Curiosidad |

**Mensajes y tono de voz**

- Hablar en segunda persona, cálido y breve: "Un voto más por ser lector".
- Tras un fallo: "Ayer fue un día difícil. Hoy cuenta igual", nunca "Rompiste tu racha".
- En el pacto: celebrar al grupo antes que al individuo ("El pacto lleva 12 días juntos").
- Empujones con frases amables predefinidas, para que nadie escriba algo hiriente.

**Momentos de celebración grande** (pantalla completa con confeti sutil): primer registro, primera semana completa, primer pacto que florece y subida de nivel. Fuera de esos momentos, la celebración es pequeña y en línea.

## Accesibilidad e inclusión

La meta es cumplir WCAG 2.2 nivel AA desde el primer componente, no como revisión final. Una app que se usa a diario, con una mano y a veces con prisa, se beneficia de todo esto aunque el usuario no tenga una discapacidad.

- **Áreas táctiles:** [WCAG 2.2 exige un mínimo de 24 × 24 px y recomienda 44 × 44 px](https://specification.website/spec/accessibility/touch-target-size/); en la app, todo control mide al menos 44 px y el botón de registro más.
- **Contraste:** 4.5:1 para texto y 3:1 para iconos y bordes, verificado en claro, oscuro y en cada color de pacto; el desenfoque de la barra flotante siempre lleva un fondo semiopaco debajo.
- **El color no es la única señal:** un hábito hecho tiene check y texto, no solo cambio de color; el mapa de calor incluye patrón o número al tocar.
- **Movimiento reducido:** con `prefers-reduced-motion` las animaciones se vuelven fundidos breves y no hay confeti.
- **Gestos con alternativa:** todo lo que se hace deslizando o manteniendo presionado tiene un botón visible.
- **Lectores de pantalla:** etiquetas claras ("Leer 10 páginas, pendiente, botón registrar"), anuncios en vivo al registrar ("Registrado, racha de 8 días") y orden de foco lógico.
- **Texto ampliable:** el diseño soporta hasta 200 % de tamaño de fuente sin cortar contenido.
- **Foco visible:** anillo de foco con el color de acento y nunca tapado por la barra flotante.
- **Lenguaje inclusivo y simple:** frases cortas, sin jerga, y avatares e ilustraciones diversos.
- **Privacidad como accesibilidad emocional:** los hábitos sensibles se ven privados por defecto y se pueden ocultar de la pantalla Hoy con un nombre genérico.

## Proceso de diseño y validación

El diseño avanza en seis etapas y se valida con grupos reales de amigos antes de programar las pantallas finales. Cada etapa conecta con las fases del plan técnico.

1. **Referentes y moodboard:** análisis de Duolingo, Finch, Streaks y apps sociales; tablero visual con dos direcciones (expresiva y calma).
   - Entregable: dirección visual elegida.
2. **Arquitectura y wireframes:** mapa de pantallas, flujos de onboarding, registro y pacto en baja fidelidad.
   - Entregable: flujos aprobados.
3. **Design system base:** tokens, tipografía, color, movimiento y primitivos en el catálogo `/design` (alineado con la fase 3 técnica).
   - Entregable: tokens y componentes listos para desarrollo.
4. **Alta fidelidad y prototipo:** las cinco pantallas clave con microinteracciones prototipadas.
   - Entregable: prototipo navegable en el móvil.
5. **Pruebas con usuarios:** 5 a 8 personas por ronda, en grupos de amigos reales.
   - Tareas: crear un hábito, registrar, invitar a alguien, reaccionar y entender el progreso.
   - Se mide: tiempo hasta el primer registro, errores, claridad de la racha y qué tan motivante o presionante se siente.
6. **Iteración y medición en producción:** ajustes según las métricas del plan de requerimientos (retención al día 7, invitaciones, recuperación tras un fallo).

**Pruebas A/B tempranas sugeridas**

- Modo expresivo vs. modo calma como predeterminado.
- Jardín del pacto vs. cadena de racha grupal como elemento principal del pacto.
- Pedir permiso de notificaciones tras el primer registro vs. al día siguiente.

**Criterio de éxito del diseño:** 4 de cada 5 participantes registran su primer hábito sin ayuda en menos de 2 minutos y describen la app como "motivante" y no "presionante".

## Fuentes

- [Benefits of expressive design — Android Developers (Material 3 Expressive)](https://developer.android.com/design/ui/wear/guides/get-started/benefits)
- [Google ushers in age of expressive interfaces — Dezeen](https://www.dezeen.com/2025/05/28/google-ushers-in-age-of-expressive-interfaces-with-material-design-update/amp/)
- [Exploring a new visual language: Liquid Glass — Create with Swift](https://www.createwithswift.com/exploring-a-new-visual-language-liquid-glass/)
- [Liquid Glass — Wikipedia](https://en.wikipedia.org/wiki/Liquid_Glass)
- [CSS View Transitions and Scroll-Driven Animations in 2026 — CoderCops](https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026)
- [Designing a Streak System: The UX and Psychology of Streaks — Smashing Magazine](https://smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/)
- [The Psychology and UX Design Principles Behind Effective Streak Systems (resumen)](https://feedbagel.com/post/the-psychology-and-ux-design-principles-behind-effective-streak-systems)
- [The Psychology of Hot Streak Game Design — UX Magazine](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design)
- [Finch: Self-Care Pet — Screens Design showcase](https://screensdesign.com/showcase/finch-self-care-pet)
- [UI/UX Design Trends to Watch in 2026 — Apiko](https://apiko.com/blog/ux-design-trends/)
- [Touch target size — specification.website (WCAG 2.2)](https://specification.website/spec/accessibility/touch-target-size/)
