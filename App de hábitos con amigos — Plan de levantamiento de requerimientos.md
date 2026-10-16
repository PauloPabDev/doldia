# App de hábitos con amigos — Plan de levantamiento de requerimientos

Oct 15, 2026 · @Paulo

## Propósito y alcance

El levantamiento debe definir cómo la app logra que una persona entre, invite a sus amigos y siga registrando hábitos después de la tercera semana. La hipótesis central: un hábito se sostiene mejor cuando es visible para un grupo pequeño y cada registro se siente como una pequeña victoria.

**Objetivos del levantamiento**

- Entender por qué la gente abandona otras apps de hábitos y en qué momento.
- Validar qué mecánicas sociales motivan y cuáles generan presión negativa.
- Definir el flujo de entrada que lleva a un usuario nuevo a su primer registro en menos de 2 minutos.
- Traducir las cuatro leyes de Hábitos Atómicos en requerimientos concretos, tanto para crear hábitos como para dejar hábitos no deseados.

**Fuera de alcance en esta fase:** integraciones con apps de salud, retos públicos abiertos y monetización detallada.

## Marco conductual: Hábitos Atómicos

Cada función de la app debe responder a una de las cuatro leyes de James Clear, o a su inversión cuando el usuario quiere dejar un hábito. La app maneja dos tipos de hábito con lógica distinta: **construir** (hacerlo más) y **romper** (hacerlo menos o nunca).

| Ley | Construir un hábito | Romper un hábito (inversión) | Requerimiento en la app |
| --- | --- | --- | --- |
| 1. Hacerlo obvio | Señales claras: cuándo y dónde se hace | Hacerlo invisible: quitar las señales | Intención de implementación al crear ("haré X a las Y en Z"), recordatorios ligados a hora o lugar; para romper, registro de detonantes |
| 2. Hacerlo atractivo | Asociarlo con algo que se disfruta y con un grupo donde es normal | Hacerlo poco atractivo: resaltar el costo | Pactos con amigos, feed social; para romper, mostrar lo ganado (dinero, días libres) |
| 3. Hacerlo sencillo | Reducir la fricción, empezar en pequeño | Hacerlo difícil: añadir fricción | Versión mínima de 2 minutos por hábito, registro en un toque; para romper, plan de obstáculos y momento de pausa antes de ceder |
| 4. Hacerlo satisfactorio | Recompensa inmediata y progreso visible | Hacerlo insatisfactorio: consecuencia inmediata | Animación y XP al registrar, mapa de calor; para romper, compañero que se entera de las recaídas y contrato de hábito |

**Principios transversales del libro que se vuelven reglas de producto**

- **Identidad antes que metas:** al crear un hábito, el usuario define quién quiere ser ("soy alguien que lee"). Cada registro cuenta como un voto por esa identidad, y así se muestra.
- **Apilamiento de hábitos:** permitir encadenar un hábito nuevo a uno existente ("después de servir el café, medito 2 minutos").
- **Regla de los 2 minutos:** todo hábito tiene una versión mínima que también cuenta como cumplida.
- **Nunca fallar dos veces:** fallar un día es normal; la app reacciona al segundo día seguido, no al primero.
- **Compañero de responsabilidad y contrato:** el grupo cumple el papel de testigo; el contrato opcional define una consecuencia acordada.
- **Medir sin obsesionarse:** el seguimiento es una herramienta, no el objetivo; evitar que el número reemplace al hábito.

## Sistema de gamificación

La gamificación premia la constancia y la identidad, nunca el castigo. Cada mecánica refuerza una ley concreta; si no refuerza ninguna, no entra.

| Mecánica | Cómo funciona | Ley que refuerza |
| --- | --- | --- |
| XP por registro | Puntos inmediatos al marcar, con bonus por versión completa | 4. Satisfactorio |
| Niveles de identidad | Subes de nivel en "Lector", "Atleta", etc., no en un nivel genérico | Identidad |
| Rachas personales | Días consecutivos cumplidos; la versión de 2 minutos también cuenta | 4. Satisfactorio |
| Comodines | 1 o 2 por semana para proteger la racha en un mal día | Nunca fallar dos veces |
| Racha de grupo | El pacto acumula días si todos registran; con comodines grupales | 2. Atractivo |
| Misiones semanales | Retos pequeños y variados ("registra 5 días antes de las 9 a. m.") | 1. Obvio, 3. Sencillo |
| Logros | Medallas por hitos de identidad (primer voto, 21 días, primera recaída superada) | 4. Satisfactorio |
| Meta cooperativa | Barra grupal: "el pacto suma 100 registros este mes" | 2. Atractivo |
| Ligas opcionales | Ranking semanal solo para quien lo active | 2. Atractivo (para perfiles competitivos) |
| Contador de libertad | Para hábitos a romper: días sin el hábito y lo ganado | Inversión de la ley 4 |

**Reglas anti-castigo**

- Una recaída no borra el progreso acumulado: el XP y los niveles nunca bajan.
- Al romperse una racha, la app muestra el récord y propone volver mañana, sin culpa.
- Los hábitos a romper registran recaídas en privado por defecto; el usuario decide si el grupo las ve.
- Ninguna recompensa se compra con dinero, para no vaciar de sentido el progreso.

**Preguntas abiertas para el levantamiento:** ¿cuántos comodines por semana se sienten justos? ¿La racha grupal motiva o genera culpa en quien falla?

## Friends loop

El friends loop une retención y crecimiento: cada registro visible genera una reacción, y la satisfacción social empuja a invitar a alguien más. El paso que refuerza el ciclo es la invitación a un pacto, por eso debe costar un solo toque.

&#91;embedded content: friends loop · 5 pasos, el paso 4 refuerza el ciclo\]

El paso 4 es el eslabón que hace crecer el ciclo; si el amigo invitado no registra en sus primeras 24 horas, el loop se corta.

**Requerimientos que salen del loop**

- **Invitación contextual:** el enlace lleva al pacto concreto, no a la tienda de apps ni a una pantalla genérica.
- **Momentos para invitar:** al cumplir 7 días, al lograr una medalla o al crear un hábito nuevo, cuando el orgullo es alto.
- **Empujón con límite:** un amigo puede empujar una vez al día por hábito, con mensajes predefinidos y amables.
- **Bienvenida del grupo:** el pacto recibe aviso cuando alguien entra, para que reaccione a su primer registro.
- **Loop de regreso:** si alguien lleva 2 días sin registrar, el grupo recibe una sugerencia para animarlo, nunca un señalamiento público.

## Onboarding y primera semana

El usuario debe registrar su primer hábito en menos de 2 minutos y tener al menos un amigo dentro antes del día 3. La primera semana decide la retención, así que cada día tiene un objetivo.

1. **Entrada por invitación (día 0):** si llega desde un enlace, aterriza directo en el pacto del amigo, con su nombre y foto visibles. Registro con Google o número de teléfono.
2. **Identidad (día 0):** pregunta "¿quién quieres ser?" con opciones (lector, saludable, enfocado, sin redes de noche…) antes de hablar de hábitos.
3. **Primer hábito (día 0):** plantillas con versión de 2 minutos ya escrita, intención de implementación (hora y lugar) y opción de apilarlo a una rutina existente. Máximo 1 a 3 hábitos al inicio.
4. **Primer registro inmediato (día 0):** se invita a hacer la versión mínima ya mismo para ganar el primer voto y el primer XP.
5. **Invitar (día 0 a 2):** si entró solo, la app propone crear un pacto y compartir el enlace por WhatsApp; sin amigos, ofrece un compañero de práctica o seguir en solitario.
6. **Refuerzo (días 1 a 3):** recordatorio en la hora elegida, primera reacción de un amigo y primer logro.
7. **Primer tropiezo (días 3 a 5):** si falla, se ofrece el comodín y se explica la regla de nunca fallar dos veces.
8. **Cierre de semana (día 7):** resumen con votos por la identidad, racha del grupo y propuesta de ajustar o agregar un hábito.

**Para hábitos a romper**, el onboarding cambia: se registran detonantes, se define un sustituto y se elige quién del grupo puede ver las recaídas.

## Requerimientos priorizados

El MVP necesita siete requerimientos "Debe": sin ellos no existe el ciclo de hábito ni el friends loop. La priorización es una propuesta inicial que el levantamiento debe confirmar o mover.

| ID | Requerimiento funcional | Base | Prioridad |
| --- | --- | --- | --- |
| RF-01 | Crear hábito con identidad, intención de implementación y versión de 2 minutos | Leyes 1 y 3 | Debe |
| RF-02 | Dos tipos de hábito, construir y romper, con flujos distintos | Leyes e inversión | Debe |
| RF-03 | Registro en un toque con prueba opcional (foto, nota, número) | Ley 3 | Debe |
| RF-04 | Pactos de 3 a 8 personas por enlace de invitación | Friends loop | Debe |
| RF-05 | Feed del pacto con reacciones rápidas | Ley 2 | Debe |
| RF-06 | Rachas personales con comodines semanales | Ley 4, nunca fallar dos veces | Debe |
| RF-07 | Recordatorios por hora y empujones de amigos | Ley 1, friends loop | Debe |
| RF-08 | XP y niveles por identidad | Identidad, ley 4 | Debería |
| RF-09 | Racha grupal y meta cooperativa del pacto | Ley 2 | Debería |
| RF-10 | Apilamiento de hábitos | Ley 1 | Debería |
| RF-11 | Registro de detonantes y contador de libertad para hábitos a romper | Inversión leyes 1 y 4 | Debería |
| RF-12 | Misiones semanales y logros | Ley 4 | Podría |
| RF-13 | Contrato de hábito con consecuencia acordada | Inversión ley 4 | Podría |
| RF-14 | Ligas semanales opcionales | Ley 2 | Podría |
| RF-15 | Retos públicos e integración con apps de salud | Crecimiento | No por ahora |

**Requerimientos no funcionales**

- **Rapidez:** registrar un hábito toma 1 toque y responde en menos de 1 segundo.
- **Offline:** se puede registrar sin conexión y sincroniza después (PWA en la primera versión).
- **Zona horaria:** las rachas se cierran a medianoche de cada usuario, no del servidor.
- **Privacidad por hábito:** solo yo, pacto o amigos; las recaídas son privadas por defecto.
- **Notificaciones:** push con límite diario para no saturar; el usuario controla horario y frecuencia.
- **Accesibilidad:** contraste suficiente, textos legibles y animaciones que se puedan reducir.

## Plan de levantamiento

El levantamiento avanza en cinco fases cortas, de entender el problema a validar un prototipo con grupos reales de amigos. Cada fase termina con un entregable que alimenta la siguiente.

1. **Descubrimiento**
   - Actividades: revisión de apps de hábitos y sus reseñas negativas; mapa de las cuatro leyes contra lo que hacen bien o mal.
   - Entregable: lista de motivos de abandono y oportunidades.
2. **Entrevistas a usuarios**
   - Actividades: 8 a 12 entrevistas a personas que intentaron sostener un hábito o dejar uno, idealmente en grupos de amigos.
   - Entregable: 2 o 3 perfiles (por ejemplo, el competitivo, el cooperativo, el que quiere dejar algo en privado).
3. **Taller de co-creación**
   - Actividades: sesión con un grupo de amigos para ordenar mecánicas de gamificación por motivación e incomodidad; mapa del recorrido de la primera semana.
   - Entregable: mecánicas priorizadas y recorrido validado.
4. **Definición**
   - Actividades: escribir historias de usuario y criterios de aceptación para cada requerimiento "Debe"; confirmar la tabla de prioridades.
   - Entregable: backlog del MVP.
5. **Prototipo y prueba**
   - Actividades: prototipo navegable del onboarding y del pacto; prueba con 3 grupos durante 2 semanas, aunque sea con registro manual.
   - Entregable: métricas iniciales y ajustes antes de programar.

**Guía de preguntas para entrevistas**

- ¿Qué hábito intentaste construir o dejar la última vez? ¿Qué pasó en la segunda o tercera semana?
- ¿Qué te hizo fallar: olvido, pereza, falta de tiempo o perder el sentido?
- ¿Alguna vez lo intentaste con alguien más? ¿Ayudó o te presionó?
- ¿Te sentirías cómodo si tus amigos vieran que no cumpliste? ¿Y una recaída en un hábito que quieres dejar?
- ¿Qué te motiva más: ganarle a otros, no fallarle al grupo o ver tu propio progreso?
- ¿Qué recompensa se sentiría valiosa y cuál se sentiría infantil?
- ¿Cómo invitarías a un amigo y qué te haría dudar de hacerlo?
- ¿Cuántas notificaciones al día tolerarías antes de silenciar la app?

## Métricas e hipótesis

El éxito se mide por retención y por invitaciones, no por descargas. Las metas son hipótesis iniciales para ajustar con la prueba de la fase 5.

| Métrica | Meta inicial (hipótesis) | Qué valida |
| --- | --- | --- |
| Tiempo hasta el primer registro | Menos de 2 minutos | Onboarding sencillo (ley 3) |
| Usuarios con al menos 1 amigo en un pacto al día 3 | 50 % | Friends loop |
| Invitaciones enviadas por usuario activo | 1,5 o más | Crecimiento viral |
| Retención al día 7 / día 30 | 45 % / 25 % | Constancia real |
| Retención con pacto vs. en solitario | Al menos el doble con pacto | Hipótesis central de la app |
| Recuperación tras un fallo (registra al día siguiente) | 70 % | Regla de nunca fallar dos veces |
| Reacciones por registro en el feed | 1 o más | Satisfacción social (ley 4) |

## Riesgos y consideraciones éticas

El mayor riesgo es que la presión social se vuelva culpa y el usuario abandone el grupo en vez del mal hábito.

- **Presión tóxica:** rachas grupales y rankings pueden señalar a quien falla. Mitigación: comodines grupales, rankings opcionales y mensajes de ánimo en lugar de alertas de fallo.
- **Arranque en frío:** sin amigos la app pierde su motor. Mitigación: modo en solitario completo y compañeros de práctica opcionales.
- **Adicción a la app:** la gamificación no debe competir con el hábito. Mitigación: límite de notificaciones y nada de recompensas por tiempo dentro de la app.
- **Privacidad en hábitos sensibles:** dejar alcohol, tabaco o redes puede ser íntimo. Mitigación: privado por defecto y control fino de quién ve qué.
- **Medir en exceso:** convertir todo en números puede quitar el sentido. Mitigación: resúmenes centrados en identidad, no solo en porcentajes.
- **Casos que requieren ayuda profesional:** algunas conductas a dejar (adicciones, trastornos) superan una app. Mitigación: no prometer resultados clínicos y enlazar a recursos de ayuda cuando aplique.
