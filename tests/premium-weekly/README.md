# Premium semanal — cierre y candidato de revisión

Fecha: 04/10/2026. Base `00c3f64a365cbe927a8f79200aafd4600f63e0f6`, rama `codex/premium-weekly`.
Genealogía: `72fc545 → 660dcb1 → dde5dd8 → 00c3f64 → HEAD de esta rama`.
**PREMIUM PHASE 2: CLOSED. PREMIUM PHASE 3: READY FOR REVIEW.**
Todo el backend nuevo está limitado a SIMPLE Security Test, `dmqjexigdnfzobarhnib`. No se ha publicado Premium.

## Phase 2: evidencia real y cierre

Se auditaron las catorce llamadas conservadas: **12 KEEP / 1 MODIFY / 1 REVIEW / 0 inválidas**, modelo `gpt-5.4-2026-03-05`, coste histórico **0.194317 USD**. Diez outputs `premium-recommendation-v1` y cuatro `premium-recommendation-v2`; prompts históricos `premium-analysis-v1` y `premium-analysis-v1.1` permanecen conservados. Ninguna llamada nueva de Phase 2.

F era el MODIFY real ya existente: sustituir `db_curl` por `band_curl` por exclusión expresa. Se repitió su aceptación con JWT reales sobre fixtures nuevas, usando exactamente aquel output y **author_kind=mock/replay**. No se presentó ese transporte como una generación nueva del modelo. N, sus ocho workouts y los otros tres ejercicios quedaron intactos; N+1 cambió únicamente el ejercicio permitido, sin heredar historial por nombre; doble aceptación idempotente y competidor stale rechazado. Evidencia y crítica del KEEP descendente I: [PHASE2-CLOSURE.md](PHASE2-CLOSURE.md).

El guard adicional rechaza series canónicas malformadas aunque el ejercicio no se esté editando, en lugar de reconstruirlas desde el resumen escalar. Mantiene proyección explícita legacy válida y bloqueo de identidades ambiguas. Solo dos definiciones staging, permisos originales conservados, **36/36** checks SQL transaccionales finales (28 originales + ocho entradas de field null/ausente). El statement de integridad del replay precede a este guard: no significa que la fase completa no haya cambiado funciones en staging.

## Arquitectura Phase 3

Nueva tabla única `coach_weekly_checkins`: UUID, usuario/rutina/mesociclo/semana/revisión con FK reales, semana, schema, answers JSON cerrado ≤4096 bytes, row_version, submitted_at y timestamps. Único registro mesociclo/semana. Reutiliza `coach_mesocycles`, `coach_mesocycle_weeks`, `routine_revisions`, `coach_recommendations`, `routine_management`, `context_grants` y workouts existentes.

Check-in `premium-weekly-checkin-v1`: siete preguntas, unos 1–2 minutos:
1. Recuperación: very_good/good/normal/worse/bad.
2. Sueño: very_good/good/normal/bad/very_bad.
3. Fatiga: very_low/low/normal/high/very_high.
4. Estrés: low/moderate/high/very_high.
5. Percepción: easier/similar/harder/much_harder.
6. Disponibilidad: changed boolean, weekdays mon..sun únicos y minutos 15..120 por día declarado.
7. Revisión: none/volume/effort/duration/distribution/exercise; solo exercise admite UUID exacto del ejercicio vigente.

No salud, diagnósticos, texto libre, peso, fotos ni nutrición. El grant `premium_weekly_checkin` / notice `premium-checkin-v1` requiere consentimiento explícito, separado del historial. Revocarlo impide nuevas reservas, lectura de reviewer y acciones pendientes; el propietario conserva lectura de sus respuestas. Concederlo otra vez no revive una captura antigua.

Borrador con CAS row_version y vinculación exacta a semana/revisión; un envío queda inmutable. Mismo envío repetido es idempotente. Lock por usuario compartido por reserva/finish/review/accept y las dos rutas de permisos. Capturas de grant, check-in, hash, revisión y semana se comprueban en cada frontera. Respuestas tardías o revocadas quedan superseded y no se aplican. La ruta histórica no elude el permiso semanal.

Cuatro RPC públicas nuevas, autenticadas y con comprobaciones internas:
`premium_save_weekly_checkin`, `premium_weekly_permission`, `premium_weekly_provider_context`, `premium_weekly_reserve_analysis`.
Diez definiciones existentes adaptadas, trece funciones añadidas en total; owner, ACL y search_path de las existentes permanecen iguales. Helpers privados cerrados; únicamente el helper de visibilidad necesita EXECUTE authenticated para las SELECT policies. Sin permiso directo de escritura en la tabla; RLS separa propietario y reviewer asignado, y no concede acceso directo del reviewer a workouts.

## Provider, prompt y decisiones

Provider `premium-weekly-provider-v1`: entrenamiento y métricas comparables, prescripción por serie, check-in vigente, schedule y hasta cuatro semanas anteriores con decisiones/parches aceptados. No envía UUID, email, notas, grants, bindings ni hashes internos. Falta de check-in es `checkin:null / checkin_missing:true`; las señales deben estar vacías. Sin inventar valores normales.

Prompt/output `premium-weekly-analysis-v1`, modelo snapshot fijo `gpt-5.4-2026-03-05`, reasoning low, store=false, salida máxima 1800 tokens, sin retry automático. KEEP es válido; no forzar una novedad semanal. Contrastar hechos con percepción y reconocer discrepancias sin afirmar causalidad. REVIEW y aprobación humana se mantienen. Reutiliza validadores V2 de series, catálogo, from y semántica; máximo tres cambios.

Nuevo cambio `change_week_schedule`: from completo en orden canónico, to conserva cada día lógico una vez. Permite compartir weekday si la suma de minutos cabe; no elimina sesiones ni regenera la rutina. Duración se estima con la política operativa V5 congelada, no como regla fisiológica. No reduce descansos para hacer caber más volumen. Schedule legacy solo se proyecta si el mapeo es inequívoco; en caso contrario exige REVIEW.

Warnings descriptivos preservados: checkin ausente, repetición de fallo en ejercicios de alto coste, adaptación de toda la rutina, target recién cambiado, disponibilidad incompatible, coincidencia con deporte externo, además de los avisos por serie existentes. No modifican hechos ni fuerzan cambios. `repeated_high_cost_failure` significa que las dos exposiciones comparables más recientes tienen al menos dos series RIR0 en un ejercicio de coste alto: política de revisión explícita, no umbral científico de fatiga.

## Seis llamadas nuevas reales

Todas HTTP200, error=null, schema_valid=true y semantic_valid=true, sobre fixtures de staging. Ningún retry. Un token local caducado se detectó antes de dispatch, ledger o reserva de proveedor; refrescar esa sesión no fue una llamada OpenAI fallida.

| Caso | Decisión | USD |
|---|---|---:|
| Semana 4 tras KEEP/KEEP/MODIFY | KEEP | 0.0257725 |
| Descenso + check-in desfavorable | KEEP | 0.0283325 |
| Descenso + check-in favorable, discrepancia | KEEP | 0.0284475 |
| Check-in ausente, una exposición | KEEP | 0.0177375 |
| Disponibilidad cinco→cuatro weekdays | MODIFY | 0.0345725 |
| Solicitud de revisar exercise_3 | KEEP | 0.025815 |
| **Nuevo** | **5 KEEP / 1 MODIFY** | **0.1606775** |

48,461 input / 2,635 output / 0 cached. Acumulado con Phase 2: **20 llamadas / 0.3549945 USD**. Dentro de las diez llamadas y 0.35 USD adicionales autorizados. Outputs y receipts completos seguros: [REAL-OUTPUTS.md](REAL-OUTPUTS.md); contrato/prompt/valoración: [EDGE-WEEKLY.md](EDGE-WEEKLY.md).

El KEEP descendente conserva objetivos aún dentro del rango y es prudente, pero otra decisión revisada podría ser razonable. La explicación del caso exercise_3 podría referirse con más detalle a ese ejercicio: recomendación editorial, no pérdida de identidad ni sustitución arbitraria. Seis casos sintéticos no demuestran eficacia clínica ni eficacia longitudinal con atletas reales.

## Simulación longitudinal y versionado

Cuatro semanas **lógicas simuladas**, no cuatro semanas de seguimiento transcurrido:
- W1 mock KEEP, revisado/aceptado, mantiene N.
- W2 mock KEEP, check-in y reviewer/aceptación con navegador y JWT reales, mantiene N.
- W3 mock MODIFY elimina exclusivamente S3 del hack, mantiene S1/S2 heterogéneas y crea N+1.
- W4 modelo real KEEP sobre N+1, con historial comparable mejorando y cambios anteriores visibles; mantiene N+1 y avanza seguimiento.

S1 hack 6–8/RIR1/240s, S2 8–10/RIR0/240s permanecen exactamente; S3 10–12/RIR0/240s es la única eliminación W3. IDs/días/orden conservados. Siete invariantes SQL en lectura verifican N, N+1, workouts e historial de semanas. Otras siete comprueban la redistribución real: cinco días lógicos sobre cuatro weekdays, sin cambiar ejercicios o series/reps/RIR/descanso; doble aceptación misma N+1.

Preparación de fixtures: una propuesta de fechas repetía la UNIQUE existente routine/day/date y fue rechazada atómicamente; se corrigieron solo fechas sintéticas propias. Ocho workouts de la fixture W1 se desplazaron 28 días durante la preparación y se recapturó baseline antes de las siguientes operaciones. Desde ese baseline las aceptaciones no reescriben workouts. No se atribuye a datos reales ni se oculta esa corrección.

N es byte-inmutable. En N+1 de schedule la proyección canónica agrega reps_min/reps_max de resumen que faltaban en la fixture; derivan de planned_sets válidas y no cambian prescripción. No se afirma igualdad byte-a-byte de todo el snapshot N+1.

## Validación contada una vez

**1650/1650 aserciones** seleccionadas en 52 informes finales. Son aserciones de suites y matrices, no 1650 escenarios independientes. Las regresiones de revisión final sustituyen guard28→36 y backend54→83; la comprobación local de schedule añade76.

| Capa | Resultado | Evidencia principal |
|---|---:|---|
| Auditoría local catorce outputs Phase 2 | 15/15 | results/phase2-audit.json |
| Replay F, JWT/transporte real | 37/37 | phase2-login/intake/reserve/review/stale-ready/accept/logout.json |
| Guard SQL transaccional | 36/36 | results/phase2-guard.json |
| Regresiones contratos v1/v2 y producto congelado | 86/86 | suites Phase 2/series originales y control local 24 |
| Weekly contrato/gateway interceptado | 73/73 | results/weekly-unit.json |
| Backend SQL transaccional | 83/83 | results/phase3-backend.json |
| Timezone y conservación del caller | 9/9 | results/phase3-timezone.json |
| UI offline | 1047/1047 | results/ui.json |
| UI con JWT real de staging | 24/24 | ui-staging-checkin/review.json |
| Harness real, selección final de transporte | 82/82 | weekly-login/intake/checkin/context/reserve/mock/review/accept/real/logout |
| JWT/RLS/races/revocación con filas reales | 68/68 | jwt-isolation/draft-race/duplicate-reserve/closed-week/populated-isolation/revocation |
| Invariantes longitudinales + schedule en lectura | 14/14 | longitudinal-invariants/schedule-invariants.json |
| Mapping/UX schedule, captura local reconstruida | 76/76 | results/schedule-ui.json |

No sumar refresh operativo5, diagnóstico UI9 incompleto, verify-checkin3 ya consolidados en12, guard repetido, comprobación de seis receipts como otra suite, ni cientos de checks históricos. El bloque timezone positivo se ejecutó tras medianoche y `actual_boundary=false`; un caller determinista Etc/GMT+12 con fecha anterior verifica el límite y restauración de timezone (`secondary_boundary=true`). No se presenta como observación natural de medianoche. La función semanal aplica Europe/Madrid solo localmente; Phase 2 anterior no se cambia.

Rollback e integridad son controles separados del contador de suites:
- Con datos Phase 3, rollback rechaza antes de DROP.
- Ensayo real de rollback Phase 3 y guard: **89/89** definiciones originales exactas, incluidos owner/ACL/config.
- Reaplicación guard→candidato: **102/102** definiciones finales exactas, cuatro policies, RLS, constraints, ACL y trigger.
- Edge anterior seis archivos restaurado byte-exacto con JWT401; candidato final siete archivos restaurado byte-exacto, activo versión8, verify_jwt=true, no JWT→401.

Un intento de rollback falló atómicamente al restaurar el límite antiguo antes de reducir su configuración; el rollback entregado corrige ese orden, conserva consumo/coste y fue ensayado nuevamente. No resetea la contabilidad del proveedor.

## UX y preview

[Preview navegable offline](http://127.0.0.1:4241/review), con aviso explícito de simulación y acciones que no llaman a Supabase/OpenAI. `node tests/premium-weekly/preview.cjs` si necesita reiniciarse. Implementación modular y adaptador staging separados; no se ha incorporado este flujo al entrypoint publicado `index.html`.

Siete pasos + revisión, atrás con borrador, controles táctiles, foco/teclado, errores visibles, carga/doble submit, conservación de respuestas y conflicto entre pestañas. Hechos / check-in / recomendación separados; Before→After conserva series individualizadas. Reviewer asignado primero; atleta no acepta pendiente. Falta/stale/revocación visibles.

Matriz offline: Chromium+WebKit, 320/360/390/430/1280, Claro+Oscuro (20 combinaciones). Prueba autenticada de navegador: Chromium390claro, 24 checks, sin mock de Supabase; no se extiende esa cobertura real a toda la matriz offline. Puerto temporal4242 cerrado; credenciales/JWT solo servidor, sesiones locales revocadas y archivo de sesiones eliminado. Capturas seleccionadas locales ignoradas y detalles: [UX.md](UX.md).

## Limpieza, staging y producción

Se reutilizaron cinco cuentas Auth controladas ya existentes: ninguna creada ni eliminada. Fixtures Phase 3 identificadas exclusivamente por manifest+UUID+owner+prefijo de esta fase. Se limpiaron seis rutinas propias y sus días/ejercicios/workouts, seis mesociclos/semanas, ocho check-ins, nueve recomendaciones, ocho revisiones, grants y gestión asociada. F tuvo limpieza propia separada. No se borraron fixtures preexistentes de otros trabajos.

Estado final: weekly_checkins/mesos/weeks/recs/revisions/Premiumgrants/management/ownroutines=0; **staging whitelist=0**. Tabla nueva/schema/Edge permanecen para revisar el candidato. Presupuesto **cerrado**, maxcalls24/maxusd0.544317, dispatched20/charged0.3549945/reserved0. Las siete tablas centrales tienen recuentos/huellas iguales al baseline: perfiles5, rutinas15, días17, ejercicios23, workouts22, asignaciones12, notas4.

Producción solo lectura: main **b15968c73ab1b075c70f5456e6531733696c3bf5**, árbol **adca265df680845f1ac119bdded6b0a69e034e2b**, sin publicación. Siete tablas centrales byte-hashes/counts iguales: perfiles6, rutinas5, días15, ejercicios84, workouts69, asignaciones3, notas248. Definiciones/owner/ACL/config/policies/triggers y Auth estable iguales. Ciclo **88c3564c3c49cf9c53fccba89a1e71b5**.

Auth estable comprueba id/email/role/created_at y cantidad: cinco staging, seis producción, sin exponer tokens. Login/refresh/logout de pruebas puede cambiar timestamps normales de Auth; no se usa un hash completo mutable como criterio ni se modifican usuarios para ajustarlo. No cambios en Auth/OAuth/Google/recovery/secrets/configuración.

Patata `284d6bb6-e798-44a9-b72c-f31d3e27deef`, client: datos existentes conservados, una rutina/un workout y estados Coach anteriores intactos. No se usó para Premium: no existe en staging y producción carece de la arquitectura nueva. No se crearon objetos sobre ella ni se declara E2E Premium real de Patata. Tampoco se editó el resto de usuarios.

## Correcciones de la revisión final

La revisión independiente encontró tres defectos concretos antes del commit:
- Revocar un grant semanal exigía acceso vigente y fallaba con un mesociclo completado/caducado. La revocación comprueba propiedad exacta; conceder permiso sigue exigiendo acceso vigente y consentimiento de historial.
- Un parche manual con field JSON/SQL null podía entrar en la rama planned_sets por lógica SQL de tres valores y desalinear snapshot/proyección viva. Ahora se rechaza antes de cualquier mutación; las entradas válidas siguen el contrato previo.
- El adaptador de la preview buscaba day_ref dentro de un patch interno que solo contiene day_id. Resuelve UUID→binding capturado→ref, usa nombre del snapshot exacto o etiqueta de esa ref y rechaza ambigüedad. No cambia identidad ni programación.

La comprobación focalizada de schedule utiliza el output/patch real conservado y reconstruye localmente weekly_days/nombres desde el manifest y SQL setup capturados, porque no quedó un bundle íntegro de availability. Se etiqueta como reproducción local; no es una nueva prueba JWT ni una llamada de modelo. El runtime usa bindings capturados, nunca esta reconstrucción por orden. Las regresiones focalizadas y el ensayo final sustituyen sus versiones anteriores en el recuento.

Resultados finales de las correcciones: guard36/36 (ocho casos nuevos), backend83/83 (siete casos de parche manual y 22 de permisos completados/caducados además de los54 originales), schedule76/76 (32 unitarias/integración del formatter real +44 checks de navegador Chromium320/1280 y Claro/Oscuro). El transporte del test de formatter está prohibido; no carga credenciales ni llama a Auth. Capturas schedule-captured-320-light.png y schedule-captured-1280-light.png permanecen ignoradas. Rollback/reapply final vuelve a comprobar89/89/102 definiciones, sin sumar el ensayo anterior al contador.

## Advisors e índices

El incremento de 35→39 RPC SECURITY DEFINER ejecutables por authenticated corresponde a las cuatro RPC nuevas intencionadas: cada una comprueba actor/propiedad/permiso/contexto. No se concedió ejecución de helpers privados adicionales para silenciar el aviso. Referencia del [advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Tres avisos nuevos de [FK sin índice de cobertura completo](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) quedan documentados como rendimiento del piloto acotado: FK mesocycle_id/routine_id/user_id, FK mesocycle_week_id y FK routine_revision_id/routine_id/user_id. Las consultas semanales actuales usan el UNIQUE mesocycle_id/week_number y el máximo es 26 filas por mesociclo; ese prefijo ya selecciona las filas de la primera FK. Las otras dos importan principalmente al borrar/actualizar claves padre o a consultas futuras por semana/revisión. No es un fallo de integridad y no se añadió infraestructura innecesaria a última hora. Revaluar índices de cobertura antes de ampliar el volumen del piloto.

Se conservan premium_weekly_owner y las dos policies SELECT: tabla recreada y vacía no demuestra que el índice sobre, y propietario/reviewer tienen permisos diferentes. RLS sin policy del presupuesto privado significa denegación deliberada. Avisos antiguos, incluida protección de contraseñas filtradas, no se corrigieron fuera del alcance ni se cambió Auth.

## Archivos y límites de promoción

Producto: dos assets semanales, extensión mínima de Edge index.ts, weekly-contract.mjs y dos migraciones. Tests/docs bajo tests/premium-weekly. Sin cambios en index.html, assets anteriores, Basic, Auth, aliases, ciclo, catálogo ni entrenamiento publicado.

Rollback preparado: phase3-rollback.sql → phase2-guard-rollback.sql, solo después de revisar que no haya datos incompatibles; restaurar también los seis archivos previos de Edge. No ejecutar indiscriminadamente sobre propuestas aceptadas. Scripts de comparación requieren baseline privado del entorno, no reemplazarlo.

Private/results, capturas, JWT, bundles y SQL temporal permanecen ignorados; no deben entrar en Git ni publicarse. REAL-OUTPUTS solo contiene seis outputs/receipts seguros. Los scripts no despachan OpenAI al ejecutar suites locales; `live.cjs real TAG` es una ruta explícita que **no debe ejecutarse sin nueva autorización y fixtures/budget revisados**.

Premium comercial, pagos, chat, 1:1 y salud siguen desactivados. Candidato preparado para revisión técnica/visual, sin autorización de promoción a producción.
