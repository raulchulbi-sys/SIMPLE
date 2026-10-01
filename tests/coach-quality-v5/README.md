# Basic v5 — candidato para revisión, sin publicación

**Actualización 01/10/2026:** el ajuste posterior a `1b96f61` está documentado en [CIERRE-REST.md](CIERRE-REST.md) y [FINAL-REST.md](FINAL-REST.md). G/H ya están completas; se conserva debajo el informe histórico de la primera ejecución, sin sumar sus pruebas al ajuste final. No publicado.

Base exacta: `2a8bfc01336e73b33896d20c5144a1a48524932c`. Rama aislada: `codex/coach-quality-v5`. Prompt `basic-initial-v5`. GPT-5.4 snapshot `gpt-5.4-2026-03-05`.

**No está cerrado para producción:** se ejecutaron seis de los ocho casos reales. A–F pasan el contrato; G/H quedaron sin generar por el límite de coste. No se sustituye una prueba real con mocks. No se publicó ni se modificó main.

## Resultado y presupuesto

| Caso | Series | RIR medio | Series RIR 0 / 1 | Ejercicios con variación entre series | Coste USD |
| --- | --- | --- | --- | --- | --- |
| A | 32 | 3,563 | 0 / 0 | 0 | 0,035340 |
| B | 24 | 3,417 | 0 / 0 | 0 | 0,026900 |
| C | 44 | 1,636 | 0 / 16 | 0 | 0,047100 |
| D | 40 | 1,750 | 0 / 10 | 0 | 0,033045 |
| E | 40 | 0,700 | 12 / 28 | 1 | 0,038050 |
| F | 48 | 0,750 | 12 / 36 | 2 | 0,043270 |
| G/H | — | — | — | — | No enviados |

**6 llamadas, 1 intento por caso, 0,223705 USD confirmados.** Sin 429 ni reintentos. La reserva conservadora del siguiente caso es 0,0934775 USD (máximo output + cota de input en bytes y margen); 0,223705 + 0,0934775 = 0,3171825, superior a 0,30. El gasto real del siguiente caso podría ser menor, pero no se asume para autorizarlo. Quedan 0,076295 USD sin consumir. El ledger privado conserva los seis recibos y no se resetea.

Las seis salidas reales permanecieron en pending_review, sin aprobación ni aceptación; luego se eliminaron exclusivamente las fixtures. Una prueba de aceptación SQL usó una propuesta **mock**, dentro de una transacción completamente revertida: no fue una séptima generación ni aprobación de resultados reales.

- [Todas las propuestas y cada serie](GENERACIONES.md).
- [Comparación ejercicio por ejercicio contra v4 archivada](COMPARATIVA.md).
- [Fuentes científicas y límites de atribución](EVIDENCE.md).
- [Arquitectura y compatibilidad](ARCHITECTURE.md).

## Implementación

- Motor v5 independiente; v4, v3 y v2 permanecen interpretables. Provider, modelo y transporte sin cambios; ningún dato antiguo reescrito.
- Principiante: referencia RIR 3–4, 2 selectivo con aviso, nunca 0–1 en este piloto. Intermedio: 1–2 y 0 selectivo. Experimentado: 0–2 disponible, 0–1 razonable en máquinas/aislamientos; no obligación de fallo en todas las series.
- Metadata cualitativa de estabilidad, técnica, fatiga, idoneidad del fallo y rango. No mediciones fisiológicas exactas.
- Seis opciones nuevas: crunch suelo, inverso, lastrado, polea, máquina y rueda. Dead bug/Bird dog conservados con prioridad contextual; ninguno aparece en A–F.
- Descanso almacenado en segundos y presentado en minutos. Referencias 1,5–2 min en aislamientos, 2–3 en compuestos/máquinas y hasta 4 cuando proceda; no reglas automáticas por nivel. Límites e incidencias son explícitos.
- Prescripción schema 2: `scheme` y array `planned_sets`. Objetivos por serie junto a los campos reales, compacto, foco accesible y un solo Guardar sesión estático al final.
- No tablas ni columnas nuevas. La revisión existente conserva el objeto completo y los UUID. Scalar target/reps/RIR/rest representa la **primera serie**, nunca un rango agregado. El consumidor v5 consulta el array mediante revisión/operación/propietario/UUID exactos. Si falta o contradice la estructura, bloquea la apertura; no reconstruye objetivos.
- El logging realizado, historial, Última sesión, notas, UUID, ciclos y gráficas no se reescriben. La interfaz histórica continúa con su modelo anterior; no se implementa otra vista histórica de objetivos por serie.
- Basic mantiene ocho preguntas y textos. Solo amplía el vocabulario de exclusiones y dos equipos necesarios: máquina abdominal y rueda. Inventario no implica preferencia; material libre sigue sin enviarse al modelo. Premium conserva su catálogo/schema y permanece preview.
- Reviewer: solo presentación de schema 2 y avisos por ejercicio/serie. Permisos y acciones Aprobar/Rechazar intactos.

## Staging y rollback

Migración `20260929145436_coach_programming_v5.sql`, creada con el CLI documentado; aplicada **solo en SIMPLE Security Test**. Cambia cuatro funciones: `basic_intake_schema`, `validate_proposal`, `coach_backend_claim`, `coach_backend_finish`; única restricción ampliada: output_schema_version admite 1/2. Owner, ACL, SECURITY DEFINER y search_path conservados. No cambios RLS/policies/triggers/índices. Edge staging `simple-coach-mock` v26, JWT requerido; diagnóstico de rechazo restringido a las identidades sintéticas q5 de staging.

[Rollback SQL](rollback.sql) restaura exactamente las definiciones anteriores y la restricción. Se probó completo dentro de una transacción revertida: la configuración final sigue v5. Bloquea la retirada si permanecen operaciones schema 2 o anamnesis con vocabulario nuevo; no se deben borrar participantes para hacerlo pasar. Para rollback del motor, desplegar los archivos Edge de 2a8bfc0, sin reescribir propuestas/revisiones.

Limpieza SQL confirmada: whitelist 0, reviewers temporales 0, usuarios/perfiles q5 0, operaciones 0, intakes 0, salud 0. Nueve tablas principales y agregados de Auth staging recuperan baseline. Manifest, JWT, contraseñas sintéticas, diagnósticos y recibos se quedan en private/results ignorados.

## Producción y patatasimple

No se emitió ninguna escritura, llamada Auth, OpenAI ni deploy contra producción. Main remoto sigue `49661ca83217e9e27ec54aa9992123875439eeb4`; el candidato v4 original sigue 2a8bfc0.

Nueve tablas de entrenamiento (incluidos perfiles, rutinas, workouts, notas y asignaciones), las 47 funciones, whitelist, permisos, RLS, políticas, restricciones, índices, triggers y Edge de producción conservan sus huellas/configuración. El perfil y los datos de entrenamiento de patatasimple no se tocaron.

**Salvedad de integridad:** la huella global de `auth.users` cambió, con 6 usuarios antes/después; `auth.identities` no cambió. Se observan updated_at posteriores al último login en cuentas existentes; sería compatible con mantenimiento de sesión, pero el baseline agregado no permite atribuirlo concluyentemente. La consulta de audit_log_entries no devuelve eventos recientes. No se declara identidad byte a byte de todas las filas Auth ni se intenta corregirlas.

## Pruebas ejecutadas

| Suite final | Resultado |
| --- | --- |
| unit.cjs: contrato v5, schema2, material/exclusiones, fatiga, mock provider, no retries | 35/35 |
| legacy-v4.cjs: contrato histórico y provider con versión v4 explícita | 37/37 |
| training.cjs: UUID, set targets, discrepancias, borrador/reapertura, trainer normal, 320/360/390/430/1280, claro/oscuro, Chromium/WebKit | 92/92 |
| ui.cjs: cuestionario Basic y Premium preview | 150/150 |
| ui-delta.cjs: navegación, errores, accesibilidad/contraste, solicitudes tardías | 30/30 |
| SQL: formato, negativos, schema1, pending review, aceptación mock y revisión exacta; ROLLBACK | 20/20 |
| live.cjs verify: JWT reales owner/otro/trainer/reviewer/anon; no aceptación ni claim cliente | 58/58 |
| real-ui.cjs: las seis salidas reales archivadas, G/H pendientes y vocabulario | 48/48 |
| Regresión entrenamiento/modos | 16/16 |
| Regresión sesiones/borradores | 7/7 |
| Regresión duración | 30/30 |
| A–F reales: uso/coste/una llamada/estado/propuesta/aislamiento | 90/90 |
| **Total de comprobaciones anteriores, sin sumar reejecuciones** | **613/613** |

G/H son **dos casos reales pendientes**, no incluidos como éxitos en ese total. Los screenshots tampoco suman pruebas. Pruebas UI con mocks identificadas; las seis llamadas y JWT son reales staging. El harness antiguo de duración necesitaba inyectar los helpers periféricos actuales (confirmación, feedback, nota y notificación de ciclo); se actualizaron solo sus stubs, sin modificar expectativas ni código de duración. Una captura inicial se tomó durante la transición de tema; las capturas finales esperan a que termine, sin cambiar la paleta.

## Crítica para revisión

- **Bloqueo de cierre de la validación:** G/H sin generación real por presupuesto. No afirmar cobertura de 5 días/75 min ni 6 días/45 min.
- **Revisar B:** 24 avisos de descanso corto; 60–75 s en algunos compuestos se quedan por debajo de las referencias. El formato y el tiempo pasan, pero no equivalen a demostrar recuperación suficiente. No ajustar datos para ocultar esos avisos.
- **Revisar D:** 16 ejercicios distintos frente a la guía de 14 para 1–2 años. Es aviso, no fallo determinista.
- A/C: avisos de descanso corto en abdomen o accesorios. Los avisos de rango bajo de curl/hip thrust 8–10 no convierten automáticamente esa opción razonable en un error.
- E/F usan top/back-off y RIR0 real, con 8–10 series por sesión y descansos 90–180 s. No se detecta concentración excesiva según los umbrales heurísticos; eso no demuestra recuperación individual.
- C/D no usan RIR0: sigue siendo selectivo, no requisito. E/F no usan RIR2, pero sí está usado y validado en C/D; no se fuerza una estadística.
- Comparación A/B/F: descriptiva, no causal. Gym completo de v5 incluye dos equipos nuevos; se explicita esa diferencia. No inventar controles equivalentes para C/D/E.
- No atribuir una metodología numérica a preparadores cuando solo se encontró una entrevista o presentación pública.

## Revisión local

`node tests/coach-quality-v5/preview.cjs` → http://127.0.0.1:4200/review. Seis salidas reales archivadas, G/H pendientes. CSP bloquea conexión a Supabase/OpenAI; no hay acciones aprobar/aceptar. Requiere los recibos locales ignorados.

Capturas finales: results/training-320-light.png, training-320-dark.png, training-390-light.png, training-390-dark.png, training-1280-light.png, training-1280-dark.png y real-B/E-light/dark.png. Entrenamiento por serie probado con fixture local; propuestas B/E corresponden a salidas reales archivadas.

No ejecutar indiscriminadamente los scripts live/real-quality: son staging y tienen efectos autorizados solo para fixtures. El presupuesto/ledger de esta fase no se resetea. Sin publicación. Pendiente revisión del usuario.
