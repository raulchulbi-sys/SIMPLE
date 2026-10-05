# Weekly Edge y contrato — candidato staging

Base `72fc545 → 660dcb1 → dde5dd8 → 00c3f64`; rama `codex/premium-weekly`. Esta extensión mantiene los contratos Phase 2 `contract.mjs` y `series-contract.mjs` intactos. Phase 2 está CLOSED con sus catorce llamadas originales: 12 KEEP, 1 MODIFY, 1 REVIEW y coste 0,194317 USD; no se repitieron para crear esta extensión.

## Entrada y contexto

La petición histórica `{mesocycle_id,key}` conserva el RPC de reserva anterior. La nueva entrada cerrada `{mesocycle_id,key,mode:"weekly"}` usa `premium_weekly_reserve_analysis`. El contrato se elige después de reservar, según el schema del contexto capturado: provider legacy mantiene el contrato por serie y provider weekly selecciona `weekly-contract.mjs`, incluso si la llamada venía con la forma histórica y el backend la elevó por su grant semanal. Una petición explícitamente weekly que reciba contexto legacy falla sin llamar al proveedor. JWT real, origen permitido, límite de body, clave idempotente, claim presupuestado y finish mantienen la ruta existente. Sólo staging y previews loopback 4233/4241. No reintentos automáticos.

El provider usa `premium-weekly-provider-v1`, el bundle por serie anterior, `checkin_missing`, `checkin`, `recent_weeks` con un máximo de cuatro semanas, `week_schedule` y su fuente explícita. El checkin conserva `premium-weekly-checkin-v1` y enums de recuperación/sueño/fatiga/estrés/percepción/disponibilidad/revisión. La referencia del ejercicio pedido se convierte a `review.exercise_ref`; no se envía su UUID. Ausencia significa `checkin:null` y `checkin_missing:true`, nunca valores normales inventados. Una proyección inicial del schedule sólo es legítima si el backend puede relacionar todos los días lógicos de forma inequívoca; `unresolved` impide proponer un schedule inventado.

El nuevo output cerrado `premium-weekly-analysis-v1` contiene schema_version, kind, facts, checkin_signals, interpretation, changes, reason y confidence. Facts conservan únicamente el claim real de metrics.trend. Las señales son objetos `{field,value}`: sólo un valor exacto del checkin actual para cada field. Availability se expresa como changed/unchanged y review como su topic. No campos libres ni señales de salud; el pedido de un ejercicio es contexto para revisión y no provoca una sustitución automática.

La semántica proyecta explícitamente los campos heredados a `premium-recommendation-v2` para reutilizar sus validadores, conservando cambios por serie, límites, catálogo, `from`, identidad y avisos. Valida además el kind semanal y los schedules; un MODIFY sólo de schedule no se confunde con un KEEP vacío. El schema permite un máximo de tres cambios.

## Decisiones y disponibilidad

`premium-weekly-analysis-v1` conserva KEEP como decisión válida. Una mala percepción aislada no impone reducir volumen; el modelo debe contrastarla con datos comparables, adherencia, prescripción y cambios aceptados de semanas anteriores. Reconoce discrepancias sin afirmar que el sueño/estrés/recuperación haya causado el rendimiento. Los cambios sucesivos requieren una razón, no novedad semanal. El prompt no revela razonamiento interno.

`change_week_schedule` contiene sólo action/from/to con arrays completos `{day_ref,weekday,minutes}`. From debe coincidir con el schedule congelado en valores y orden canónico, igual que el validador SQL. To permite distinto orden, conserva cada referencia lógica una vez, usa los weekdays permitidos y suma los minutos de las sesiones que comparten weekday. Dos sesiones lógicas pueden compartir un día si su suma cabe en el cap declarado. No borra días/ejercicios ni regenera la rutina para convertir cinco días en cuatro.

Cada duración asignada cubre la estimación conservadora que ya utiliza Basic V5: 300 segundos de calentamiento por sesión lógica, 120 por ejercicio y por cada serie reps_max×4 segundos de ejecución más descanso; unilateral duplica ejecución y añade 15 segundos. Se redondea hacia arriba a minutos. Es una política de estimación operativa, no un umbral fisiológico. El cálculo usa el programa resultante tras cambios válidos. No permite reducir descansos junto con schedule para hacerlo caber; una prescripción incierta requiere REVIEW. Disponibilidad nueva incompatible con el schedule actual y sin un ajuste aplicable exige REVIEW, no un KEEP que ignore el conflicto.

## Avisos de calidad

Los avisos no crean modificaciones ni cambian hechos. Además de los avisos por serie previos:

- `checkin_missing`: ausencia explícita, admite análisis history-only.
- `repeated_high_cost_failure`: ejercicio catalogado de coste alto y las dos exposiciones más recientes contienen al menos dos series registradas RIR0. La repetición de dos exposiciones es una política de revisión descriptiva, no un umbral científico ni diagnóstico de fatiga.
- `whole_program_adaptation_requires_review`: un output toca todos los ejercicios de una rutina que tiene más de uno; sirve para revisar el alcance sin inventar un porcentaje científico universal.
- `recent_target_changed_requires_review`: se vuelve a cambiar un target que ya figura en los cambios aceptados de la semana anterior.
- `external_activity_overlap`: el nuevo schedule junta una sesión de pierna con actividad externa declarada; no inventa su intensidad/duración.
- `availability_not_resolved_requires_review`: el schedule no satisface los nuevos weekdays/caps; requiere resolverlo de manera segura.

## Reproducción local y límite de la evidencia

Ejecutar `node tests/premium-weekly/weekly-unit.cjs`. Resultado final: **73/73** aserciones con proveedor y gateway HTTP totalmente interceptados. Incluye KEEP/MODIFY/REVIEW, los quince escenarios solicitados, señales inventadas, checkin ausente, acciones por serie, cinco sesiones lógicas en cuatro weekdays, orden exacto de from y orden libre de to, suma de caps, duración oculta, compresión de descansos, referencias inexistentes/duplicadas, minimización y body cerrado. Las comprobaciones de duplicados/otro usuario/mesociclo cerrado/grant revocado simulan respuestas de denegación del RPC en el gateway; las pruebas JWT/RLS reales corresponden a las suites staging del arnés principal.

La ruta antigua se ejecuta con un request exacto sin mode para verificar compatibilidad. Phase 2 v1 unit **28/28** y series unit **34/34** también pasaron después de esta edición. Son regresiones locales, no nuevas llamadas OpenAI. El arnés del gateway evalúa la lógica del handler con tipos TypeScript retirados para Node; no sustituye compilación/despliegue Deno ni la prueba autenticada de staging.

El receipt semanal conserva modelo/tokens/coste/latencia y añade prompt/schema de la extensión, schema_valid y semantic_valid. Errores del proveedor se reducen a códigos cerrados; el cuerpo de diagnóstico no se copia al output. Un contexto semanal malformado o con UUID/email se finaliza por claim mock y error, sin consumir una llamada OpenAI. Modelo fijo `gpt-5.4-2026-03-05`, reasoning low, store=false y 1.800 tokens máximos.

Comprobación local adicional sobre los seis providers capturados en staging, después de recapturar el corte horario de Madrid: todos pasan contextQuality y minimización, sin UUID, notas, canarios ni bindings/grants internos. El contexto longitudinal de semana 4 señala revisión 2, planes de 2/3/3/3 series y cuatro exposiciones comparables crecientes. Sus dos series de hack y los otros tres planes conservan exactamente las prescripciones iniciales; el historial contiene KEEP/KEEP/MODIFY, con un solo cambio aceptado de tres a dos series en exercise_1. No se ha convertido este control del contexto en una nueva llamada del modelo.

Los casos de descenso, discrepancia, disponibilidad y revisión de ejercicio contienen cuatro exposiciones; missing contiene una y declara checkin:null/checkin_missing:true, con checkin_signals vacío. KEEP pasa semántica salvo disponibilidad incompatible, donde exige REVIEW o redistribución. El schedule controlado de cinco sesiones en cuatro weekdays pasa: estimaciones 19/22/19/19/19 minutos bajo asignaciones de 30 y suma máxima de 60 por weekday. La revisión del ejercicio conserva exercise_3 exacto sin forzar replacement. Las seis peticiones calculadas conservan el modelo/schema fijo y el mayor bound es 40.603 tokens, por debajo del límite SQL de 100.000.

La tarea principal completó seis llamadas OpenAI adicionales reales: cinco KEEP y un MODIFY de disponibilidad, 6/6 HTTP200/error null/schema_valid true/semantic_valid true. El coste nuevo fue 0.1606775 USD; el acumulado con las catorce llamadas históricas de Phase 2 es 0.3549945 USD. Los seis outputs vuelven a pasar semántica local contra los contextos capturados y el recálculo de coste coincide con los receipts. [REAL-OUTPUTS.md](REAL-OUTPUTS.md) contiene los outputs y receipts íntegros seleccionados, tabla y valoración humana, sin bundles ni identificadores internos. El replay Phase 2 de F no añadió llamadas ni coste.

Evidencia local ignorada: `results/weekly-unit.json` y `results/weekly-real.json`. La tarea principal coordina revisión, aceptación y limpieza. Este documento describe la evidencia del candidato; todavía no declara Phase 3 READY FOR REVIEW ni publicación.
