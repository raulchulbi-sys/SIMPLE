# SIMPLE Coach — cuestionarios v2 (candidato de staging)

Base publicada: `49661ca83217e9e27ec54aa9992123875439eeb4`, mismo árbol que la base local `57a4008`. Rama aislada `codex/coach-intake-v2`. Sin publicación ni cambios en producción.

## Basic

Ocho pasos, una pregunta por pantalla:

1. Experiencia constante: menos de 6 meses, 6–12 meses, 1–2 años, 2–4 años, más de 4 años.
2. Objetivo: desarrollo equilibrado, recuperar masa tras poco entrenamiento o volver a entrenar estructuradamente.
3. Frecuencia realista: 2–6 días.
4. Días habituales: selección de **exactamente N días**. Reducir la frecuencia borra una selección excesiva y exige volver a elegir; no descarta días arbitrariamente.
5. Tiempo por sesión: 30, 45, 60, 75 o 90+. Se utiliza 90 como límite conservador.
6. Experiencia estimando esfuerzo: desconocido, en aprendizaje, estimación habitual o uso de RIR/RPE.
7. Ejercicios excluidos: catálogo buscable, máximo 20. Ninguna selección de ejercicios favoritos u obligatorios.
8. Otra actividad: ninguna, fútbol, running, ciclismo, CrossFit, artes marciales, otro deporte o trabajo físico. Requiere días cuando procede.

Después aparece el inventario, sin numerarlo como pregunta 9, y una revisión antes de enviar. Atrás conserva respuestas. Guardar borrador usa el RPC actual con control de versión; admite cuestionarios incompletos. Retomar recupera las respuestas desde Supabase. Cerrar durante un guardado impide iniciar la llamada al proveedor desde esa pantalla.

## Premium: únicamente preview

Contrato `premium-intake-v1`; no entitlement, persistencia en Supabase, checkout ni llamada OpenAI. El único acceso está en el servidor local de preview. Su borrador de demostración queda en sessionStorage de esa pestaña.

- Experiencia → pausa de más de dos meses → objetivo.
- Menos de un año: no pregunta puntos débiles.
- 1–2 años: puntos débiles opcionales, máximo dos.
- Más de dos años: máximo dos o «No estoy seguro».
- «No estoy seguro» es exclusivo; no declara especialización.
- Días → disponibilidad → tiempo individual por día.
- Otra actividad → días, duración y exigencia si corresponde.
- Esfuerzo desconocido: omite confianza. Otras respuestas: pregunta confianza estimando RIR 1–2.
- Recuperación → sueño (estabilidad opcional) → estrés → exclusiones → preferencia de distribución.
- Inventario compartido, fuera del contador.

Son **13–15 pasos** según las ramas. Al cambiar experiencia/esfuerzo se eliminan respuestas de ramas que dejan de aplicar; al quitar un día se elimina su duración. No quedan huecos visuales. Sueño, estrés y recuperación solo se prueban con datos ficticios en la preview; no se envían ni se persisten en backend.

Se omite el campo libre final: la disponibilidad y el tiempo por día cubren los ejemplos solicitados y evitan recoger información personal o médica innecesaria.

## Inventario

Una sola biblioteca activa en `assets/coach-intake.js`, compartida por Basic, Premium y Edge. Categorías: pecho/empuje, espalda, pierna, hombro/brazos y material común. Poleas, mancuernas, barra y banco aparecen una sola vez. Se reutilizan los nombres del catálogo anterior; el contrato anterior conserva su copia histórica para reproducir v2 sin alterarlo.

Disponibilidad no significa obligación de uso. Los requisitos de cada ejercicio son explícitos; banca/sentadilla con barra exigen también soportes de seguridad. Peso corporal no exige equipo.

Equipo adicional: hasta diez nombres de 2–40 caracteres, con validación frontend/backend y rechazo de patrones evidentes de datos personales o médicos. **No se envían esos nombres a OpenAI ni al reviewer**; no habilitan ejercicios hasta disponer de una correspondencia de catálogo. La pantalla y revisión lo explican. No se construye una base de gimnasios.

## Datos y compatibilidad

- Se reutiliza `training_intakes`; cero tablas y cero columnas nuevas.
- `schema_version=1`: interpretación histórica intacta.
- `schema_version=2` y `training.schema_version="basic-intake-v2"`: nuevo contrato.
- `basic-intake-v2.schema.json` describe la forma de borrador. La validación completa añade obligatoriedad, número de días y coherencia de actividad antes del envío/reserva.
- `premium-intake-v1.schema.json` es documental/preview. El backend rechaza Premium.
- JSON con claves cerradas, enums, listas sin duplicados y límites. RLS, Auth y permisos existentes no cambian.
- Intakes anteriores no se convierten automáticamente. Se muestran como históricos; empezar el nuevo cuestionario es una acción explícita. Un intake enviado mantiene su revisión original.
- Locks, comparación de row_version, idempotencia, revocación A, reserva única y revisión humana se conservan.

Cambian cuatro funciones existentes: validador privado, guardado, contexto backend y claim de generación. Se añaden cuatro helpers privados de validación, sin EXECUTE público/authenticated/service_role. Una segunda migración adapta exclusivamente la proyección de lectura de la cola reviewer, por autorización expresa. Aprobar/Rechazar, estados y acciones permanecen intactos.

## Contexto y modelo

`basic-initial-v3`, modelo sin cambios `gpt-5.4-2026-03-05`. El contexto se construye con campos permitidos: experiencia, objetivo, días, disponibilidad, minutos, esfuerzo, equipos conocidos, exclusiones y actividad. Sin identidad, salud, historial, puntos débiles, preferencias de inclusión ni texto libre de equipo.

`contract-v2.mjs` conserva exactamente el contrato de `basic-initial-v2`. El router selecciona v3 solo para Basic v2. El esquema de propuesta sigue siendo 1: días con nombres de semana y una instrucción de esfuerzo fija en description. El reviewer ve exactamente la misma proyección de entrenamiento enviada al modelo.

La validación de propuesta comprueba catálogo/material/exclusiones, frecuencia, volumen por patrón, series, reps, RIR, descanso y presupuesto temporal. RIR desconocido limita a 3–4 y añade una explicación; otros niveles mantienen los márgenes del piloto. En coincidencia con otra actividad, el margen conservador limita a seis series de rodilla+cadera ese día. Son reglas del piloto, no una medición fisiológica ni una validación clínica.

## Generación real

Cuatro llamadas reales en SIMPLE Security Test, sin reintentos; coste estimado a partir del uso registrado: **0,124035 USD**. Límite autorizado: diez llamadas / 0,50 USD. El ledger reserva 0,15 USD antes de cada envío y bloquea otra llamada ante 429 o un resultado incierto. No se modifica el ledger de fases anteriores.

| Perfil sintético | Aspectos cubiertos | Minutos estimados | Coste USD |
|---|---|---|---:|
| Principiante, 3 días, gimnasio completo | 1 y 9: experiencia inicial y RIR desconocido | 50 / 46 / 48 | 0,036915 |
| Principiante, 4 días, mancuernas/bandas | 2 y 5: poco material y 30 minutos | 24 / 23 / 23 / 24 | 0,022225 |
| Intermedio, 4 días, gimnasio, fútbol | 3, 6, 7 y 8: 90 minutos, varias exclusiones y otra actividad | 47 / 42 / 48 / 49 | 0,0286275 |
| Avanzado, 5 días, RIR habitual | 4 y 10 | 46 / 46 / 42 / 43 / 42 | 0,0362675 |

Las cuatro propuestas pasaron las comprobaciones y quedaron en pending_review; ninguna se aprobó ni aceptó. [Rutinas completas y evaluación](GENERACIONES.md). Los 90 minutos son un máximo, por lo que no se añaden ejercicios para llenarlos.

## Rollback, limpieza y producción

Rollback probado: bloquea si existen filas v2, sin borrar ni reinterpretar datos. Tras limpiar exclusivamente las fixtures sintéticas autorizadas, restauró exactamente las 47 definiciones anteriores y la estructura/ACL/RLS previa; luego se reaplicó el candidato.

Staging termina con whitelist vacía, reviewer temporal retirado, cero usuarios `coach-iv2-…`, cero intakes y operaciones de prueba. Se recuperaron los recuentos y hashes iniciales de las nueve tablas de datos comprobadas, Auth users e identities. No se tocaron datos preexistentes.

Producción conserva sus nueve tablas comprobadas, 47 definiciones, políticas, índices, triggers, constraints, ACL y Auth sin variación. Coach Edge continúa en versión 2; staging utiliza versión 22. El piloto real existente **permanece habilitado**: el usuario aclaró que whitelist=0 se aplica solo a staging.

Los avisos del advisor corresponden a RPC SECURITY DEFINER con acceso autenticado ya existente y a protección de contraseñas filtradas desactivada. No se amplía ningún grant ni RLS; los accesos negativos se probaron con JWT reales. Referencias: [RPC SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se cambia Auth en esta tarea.

## Preview y evidencia

Ejecutar `node tests/coach-intake-v2/preview.cjs` y abrir http://127.0.0.1:4197/review. Basic y Premium son navegables sin conexión a Supabase ni OpenAI; CSP bloquea tráfico externo. La preview de generación es una simulación de UX; las cuatro generaciones reales están identificadas aparte.

Capturas en `results/`, excluidas de Git. Matriz: Chromium/WebKit, 320/360/390/430/1280, Claro/Oscuro. Se comprueba teclado/foco, contraste, áreas táctiles, búsqueda, estados vacíos, navegación, persistencia de borrador, doble pulsación y cierre durante petición. La reducción de viewport reproduce el espacio disponible con teclado, pero no sustituye una prueba en iPhone físico.

No se publicará este candidato hasta revisar el cuestionario y las propuestas. Premium comercial, adaptación, pagos, chat, check-ins, salud y nutrición permanecen fuera de alcance.

## Pruebas finales

**1261 comprobaciones pertinentes superadas**, sin sumar reejecuciones.

| Bloque | Resultado |
|---|---:|
| Basic/Premium schema and adaptivity | 50/50 |
| v3 provider contract (synthetic) | 22/22 |
| staging JWT legacy/security | 47/47 |
| staging JWT new questionnaire/reviewer | 37/37 |
| browser matrix | 150/150 |
| interaction, contrast and stale requests | 30/30 |
| legacy provider compatibility | 62/62 |
| real staging generations (4 calls) | 60/60 |
| general passing regression suites | 794/794 |
| final scope/integrity invariants | 9/9 |

Nueve expectativas archivadas de interior/polish fallan idénticamente en la base y el candidato. No se han debilitado ni contado como éxitos. La comparación está en results/legacy-contract-audit.json. Los dos archivos que las contienen no se declaran íntegramente verdes.

La primera ejecución general necesitó recuperar la copia local ya existente del SDK público para cuatro suites. Se ejecutaron después solo las pendientes. Un test de igualdad JSON se corrigió para ignorar el orden de claves de jsonb; un test de anon aceptaba solo el mensaje de la función y ahora comprueba el rechazo HTTP 401/403. La prueba de límite de dos grupos hace clic y verifica el rechazo, sin exigir que el tercer checkbox quede marcado. Nada de ello altera los valores esperados del producto.

Durante la revisión se corrigió un defecto real: al pasar de otra actividad a «No» y volver, los checks ocultos conservaban marcas visuales. Ahora datos y controles se limpian juntos; hay un caso específico en ambos motores. La interfaz también bloquea antes de generar una combinación de material/exclusiones que el validador de backend considera inviable; muestra cómo revisar esas respuestas.
