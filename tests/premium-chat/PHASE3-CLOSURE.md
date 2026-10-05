# Phase 3 — revisión final del contrato semanal

Base conservada: `7af766f`. Este documento registra la revisión adicional; las 1.650 comprobaciones del candidato anterior son evidencia histórica, no nuevas ejecuciones.

## Los tres avisos FK

Lectura de staging del 04/10/2026: `coach_weekly_checkins`, `coach_mesocycles`, `coach_mesocycle_weeks` y `routine_revisions` están vacías tras la limpieza anterior. Los tres avisos siguen siendo INFO del asesor de rendimiento. No prueban pérdida de integridad.

Índices actuales de `public.coach_weekly_checkins`: PK `(id)`, UNIQUE `(mesocycle_id, week_number)` y `premium_weekly_owner (user_id, mesocycle_id, week_number)`. La semana está limitada a 1–26 y el UNIQUE impide duplicarla: como máximo 26 check-ins por mesociclo. Un primer piloto con un mesociclo añade como máximo 26 filas; con P mesociclos retenidos, el máximo es 26P. No se presupone un número de pilotos no autorizado.

| FK en coach_weekly_checkins | Consultas/rutas afectadas | Impacto actual y crecimiento | Clasificación |
| --- | --- | --- | --- |
| `(mesocycle_id, routine_id, user_id)` → `coach_mesocycles(id, routine_id, user_id)` | Reserva legacy/weekly, assert, bundle, save, schedule check y lectura longitudinal filtran por mesociclo, habitualmente con semana. DELETE/UPDATE de clave padre también filtra mesociclo. | El UNIQUE existente comienza por mesocycle_id y permite localizar como máximo 26 filas para comprobar las columnas restantes. Un índice completo sería cobertura formal redundante para estas rutas, incluso aumentando mesociclos. | **C: no necesario ahora.** |
| `(mesocycle_week_id)` → `coach_mesocycle_weeks(id)` | Comprobación de DELETE/UPDATE de clave padre; posibles consultas futuras por UUID de semana. Las rutas actuales consultan `(mesocycle_id, week_number)`, cubierto por UNIQUE. | Piloto acotado: recorrido de una tabla de hasta 26 filas por mesociclo. Al retener muchos mesociclos, comprobaciones por week_id necesitarían recorrer la tabla completa. | **B: indexar antes de ampliar usuarios.** |
| `(routine_revision_id, routine_id, user_id)` → `routine_revisions(id, routine_id, user_id)` | Comprobación de DELETE/UPDATE de clave padre; posibles consultas futuras por revisión. Las revisiones históricas se conservan y las rutas actuales acceden por mesociclo/semana, no por revisión sola. | No bloquea el piloto. La comprobación de referencia podría recorrer todos los check-ins al crecer el archivo de mesociclos; añadir cobertura antes de ampliar usuarios o introducir esas consultas. | **B: indexar antes de ampliar usuarios.** |

No hay índices A. Por el alcance autorizado, no se añade ninguna migración de índices ni se elimina el índice de propietario. Una tabla vacía y un contador de uso cero no bastan para considerar inútil ese índice.

La lectura de `pg_proc` confirmó cinco funciones con acceso directo a la tabla: `premium_reserve_analysis`, `premium_weekly_assert`, `premium_weekly_bundle`, `premium_weekly_schedule_check` y `premium_save_weekly_checkin`. Todas seleccionan mesociclo; el join longitudinal usa mesociclo/semana. Los UPDATE de prescripciones cambian referencias de revisión en mesociclo/semanas, no actualizan la clave primaria de la revisión histórica y no disparan una búsqueda de FK por una clave padre modificada.

Referencia: [Supabase Database Advisor — FK sin índice](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0001_unindexed_foreign_keys).

## Cierre de REVIEW semanal

`phase3-review.cjs` prepara una única fixture nueva con IDs explícitos y reutiliza cuentas controladas de staging. No crea usuarios Auth ni tiene ruta Edge/OpenAI. Emite un output real del contrato semanal con `kind=REVIEW`, validado localmente, y lo finaliza mediante el mecanismo backend `mock`; no cambia administrativamente el kind después de finalizar.

Recorrido que debe quedar demostrado con JWT reales: check-in enviado → reserva semanal → REVIEW persistida en pending_review → reviewer asignado explícitamente → atleta/otro cliente/trainer no pueden resolver/aceptar → aprobación directa de REVIEW rechazada → reviewer resuelve KEEP con razón → ready → atleta acepta → accepted y siguiente semana. KEEP conserva revisión, ejercicios y workouts; doble aceptación es idempotente. El contador de llamadas y el coste del proveedor deben permanecer iguales.

Los pasos SQL de creación, binding/assignment, finalización mock y limpieza son archivos ignorados y los ejecuta el coordinador en staging. La sesión autenticada realiza intake, permisos separados, check-in, reserva, resolución y aceptación por las RPC existentes. El estado del presupuesto se controla y restaura por el coordinador; la fixture no altera una autorización de producción.

Resultado A3: **39/39 comprobaciones nuevas superadas** con JWT reales de staging, sin una llamada OpenAI. Login 4, intake/permisos 4, check-in 1, contexto 2, reserva 1, schema/semántica del output REVIEW 1, reviewer/autorización 15, aceptación/invariantes 7 y logout 4. Cada fase conserva su informe ignorado `results/phase3-review-<fase>.json`; prepare/cleanup SQL no se cuentan como pruebas. Un primer intento en shell sin acceso de red no ejecutó aserciones ni solicitudes aceptadas; después se habilitó únicamente el acceso autorizado de la prueba.

La propuesta se finalizó como REVIEW legítima (`analysis_trace.output.kind=REVIEW`, modelo mock, coste cero, error null), sin UPDATE posterior que forzara el kind. La petición explícita del check-in era revisar el primer ejercicio y había una exposición por cada uno de los cuatro ejercicios: facts `insufficient_data`. Quedó persistida en `pending_review`, visible para el reviewer asignado y el propietario. Otro cliente y el trainer normal no pudieron resolver ni aceptar; el trainer normal tampoco pudo leerla. La aprobación directa devolvió `premium_manual_resolution_required`. El reviewer resolvió KEEP con razón y pasó a `ready`, sin aceptar por el atleta. La aceptación posterior del propietario dejó `accepted`, completó la semana 1 y avanzó a la 2 sin clonar la revisión. Snapshot, cuatro ejercicios y dos workouts sintéticos permanecieron exactamente iguales. Dos aceptaciones simultáneas devolvieron la misma revisión N.

Sesiones de prueba cerradas con alcance local y archivo JWT eliminado. El coordinador ejecutó la limpieza exacta y confirmó que el baseline central vuelve a coincidir y el presupuesto de análisis permanece cerrado e intacto. La evaluación de las seis respuestas conservadas consta en `PHASE3-OUTPUT-AUDIT.md`. Con estas comprobaciones, **Premium Phase 3 CLOSED**, sin modificar el prompt para producir más MODIFY y sin añadir índices que no fueran necesarios antes del piloto.
