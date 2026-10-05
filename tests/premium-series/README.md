# Premium Fase 2: prescripción por serie

Base canónica: `72fc545 → 660dcb1 → dde5dd8`. Rama aislada `codex/premium-series`. No promoción a producción. Resultado y limitaciones: [RESULTS.md](RESULTS.md).

## Alcance de producto

- `assets/coach-premium-analysis.js` y `.css`: Antes/Después por serie, ordinal de series realizadas y presentación segura de REVIEW. Sin rediseño del cuestionario.
- `supabase/functions/simple-coach-premium/series-contract.mjs`: extensión de `contract.mjs` sin sustituir el contrato v1; contexto numérico, cambios individualizados, validación y avisos.
- `supabase/functions/simple-coach-premium/index.ts`: únicamente selecciona el contrato ampliado. Autenticación, origen permitido, transporte y presupuesto anteriores conservados.
- `supabase/migrations/20261003213139_coach_premium_per_set.sql`: seis funciones ampliadas, siete helpers privados, techo de presupuesto 16 llamadas. Sin nuevas tablas, columnas de entrenamiento, policies ni triggers. El piloto termina cerrado.

`premium-provider-v1` conserva mapping y estructura; añade `prescription_context_version=premium-prescription-v2`. Prompt `premium-analysis-v1.1`, salida `premium-recommendation-v2`. Modelo conservado: `gpt-5.4-2026-03-05`.

La fuente canónica de la prescripción completa es `routine_revisions.snapshot.days[].exercises[].planned_sets`, identificada por UUID exacto. Acepta el root de Basic V5 y el root histórico Premium. No modifica Basic ni su arquitectura. La proyección escalar en `routine_exercises` conserva número de series y objetivo de la primera; nunca sustituye las series completas para el análisis.

```json
{"set_number":1,"reps_min":6,"reps_max":8,"rir":1,"rest_seconds":240}
```

Todos son números enteros. El nuevo `to` acepta reps 5–20, RIR 0–4 y descanso 60–300 segundos; `from` admite los límites legacy RIR 5 y descanso 30 segundos. También se validan catálogo y experiencia. SQL vuelve a validar identidad, prescripción anterior, campos cerrados y estado antes de aplicar.

- `change_set`: `exercise_ref`, `set_number`, `from` completo, `to` completo.
- `remove_set`: declara explícitamente ordinal y `from`; conserva los objetivos y orden relativo de las restantes. Renumera solo la nueva revisión.
- `add_set`: exclusivamente N+1, con `to` completo. Cambio de volumen ±1; no se mezcla con otro cambio del mismo ejercicio. Máximo de adición: cuatro series, heredado del contrato acotado de Fase 2.

Los workouts se comparan con su revisión histórica verificable, no con la prescripción actual. Se valida marcador de revisión/propiedad/rutina/fecha; sin marcador, solo se utiliza una revisión temporal inequívoca. Si no puede conocerse el plan, se declara desconocido. Las series registradas con ordinal conservan ese ordinal, incluso si están incompletas o reordenadas. Ordinales duplicados no se resuelven arbitrariamente. No se infiere identidad por nombre.

## Reproducción y evidencias

Los scripts requieren Node y Playwright disponibles en el entorno. No son dependencias de ejecución de SIMPLE.

| Archivo | Uso |
|---|---|
| `unit.cjs` | Contrato, límites, cambios y transporte interceptado; ninguna llamada OpenAI real. |
| `build.cjs` | Construye SQL desde las definiciones originales incluidas en rollback. |
| `live.cjs` | Manifiesto privado de fixtures staging, JWT, intake, contexto y llamadas explícitas. No ejecutarlo de nuevo por defecto. |
| `template.sql` | Definiciones de la extensión SQL que expande `build.cjs`; no contiene datos de usuarios. |
| `functional.cjs` | RPC autenticados de propietario, otro cliente, trainer, reviewer asignado y anon. |
| `advanced.cjs` | Concurrencia y rollback transaccional durante aceptación. |
| `review-c.cjs` | Ambigüedad histórica persistida como REVIEW. |
| `sql-tests.cjs` | Construye verificaciones SQL deterministas. |
| `final-sql.cjs` | Invariantes y ciclo de petición tardía/presupuesto sin nuevas llamadas. |
| `closure-sql.cjs` | Verifica root V5, proyección live, campos cerrados y conservación de series. |
| `protected.cjs` | Compara 24 archivos protegidos byte a byte con dde5dd8. |
| `preview.cjs` | Preview loopback offline, acciones simuladas claramente indicadas. |
| `ui.cjs` / `ui-edge.cjs` | Chromium/WebKit, móvil/escritorio, temas, foco, errores y respuestas tardías. |
| `rollback.sql` | Rollback SQL preparado y probado, con guard contra recomendaciones/revisiones v2 residuales. |

Los manifiestos, JWT, fixtures materializadas, contextos, recibos y capturas están en `private/` y `results/`, ignorados por Git. Nunca publicar esos directorios ni copiar credenciales al repositorio. El README no proporciona accesos. Las cinco cuentas controladas preexistentes de staging se reutilizaron; no se crearon ni eliminaron usuarios Auth.

`final-sql.cjs` genera la limpieza por IDs/propiedad exactos del manifiesto privado; no ejecuta el SQL por sí mismo. La limpieza se revisó y ejecutó únicamente en staging durante esta fase.

Preview de esta ejecución: `http://127.0.0.1:4240/review`. Consume capturas locales de recomendaciones persistidas durante las pruebas; las fixtures ya fueron eliminadas de staging. Los controles de la preview simulan acciones y no escriben en Supabase.

## Rollback y límites

El rollback restaura las seis definiciones originales, elimina los siete helpers y devuelve el límite del presupuesto a su configuración anterior, con el piloto cerrado. No borra revisiones, recomendaciones, workouts ni usuarios. Antes de un rollback futuro con datos v2 se requiere evaluar esos datos: el guard impide una reversión a ciegas.

La Edge original puede reconstruirse desde dde5dd8/660dcb1, manteniendo `verify_jwt=true`. Se ensayó restaurar y volver a desplegar la candidata en staging, sin tocar secrets. La UI puede volver a dde5dd8. Nada se publicó en main.

La cobertura de MODIFY por serie/volumen es real en base de datos con salidas deterministas. Las nuevas llamadas reales al modelo produjeron KEEP/REVIEW, no MODIFY; no confundir ambas evidencias. Historial sin revisión fiable seguirá teniendo menor granularidad. No se implementa enrolamiento automático de rutinas Basic ya gestionadas, Fase 3, pagos, salud, nutrición ni Premium comercial.
