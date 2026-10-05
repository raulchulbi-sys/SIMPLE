# Premium Phase 5 — cierre de validación, 2026-10-05

**PREMIUM PHASE 5: READY FOR REVIEW.** Sin push, merge, publicación ni Premium en producción. Candidato base de esta continuación: 1ad6bd6, rama codex/premium-upgrade; el SHA final se comunica en el chat.

## Fallo real y corrección acotada

El JWT de trainer asignado detectó dos dependencias de actor client que los mocks no habían ejercitado: el adapter llamaba a premium_my_access antes de identificar al reviewer; premium_recommendation_view inicializaba su actor con coach_private.actor(), que exige role=client. La primera ejecución JWT se detuvo tras comprobar que la revisión privada permanecía oculta.

El adapter identifica primero un mesociclo explícito visible por RLS, omite el intake privado y evita el RPC de entitlement del atleta cuando el actor es reviewer. La proyección segura usa auth.uid(), exige role=client para el owner o la autorización vigente del reviewer asignado. Sin nuevas RLS, grants, roles, permisos globales ni fallback de atleta. Owner sigue cargando su prescripción exacta. Única definición final distinta en staging: public.premium_recommendation_view(uuid), hash ce10c6e8fdcc9f62bcd5f5e4876ed0f4; SECURITY DEFINER, owner postgres, search_path y ACL conservados.

## Evidencias finales y contabilidad de checks

| Suite | Casos únicos | Ejecución |
|---|---:|---|
| reviewer-adapter.cjs jwt | 7 | JWT reales renovados; SDK, scope, revisión oculta y proyección segura |
| closing-validation.cjs | 32 | 16 invariantes en cuatro cruces + seis ventanas externas + cinco controles de acceso + cinco invariantes de resolución/late |
| reviewer-adapter.cjs local | 16 | Repetida tras el fix; dos expectativas nuevas, reemplaza las 14 previas |
| host.cjs | 150 | Índice actual offline, Chromium/WebKit, owner/reviewer, errores y respuestas atrasadas |
| reviewer-ui.cjs | 24 | Índice actual offline, ambos motores, sin inferencias de datos privados |
| backend.sql | 36 | Transacción revertida; Basic v2/v3/v4/V5, baseline, cuotas, identidad, historial y management |
| rollback-stack.cjs | 6 | Full stack → Basic → reapply, definiciones/ACL/owner y 16 inventarios/accounting exactos |

**271 casos únicos ejecutados en esta continuación. Total consolidado 1990/1990:** 1949 anteriores, sustituyendo reejecuciones, +7 JWT, +32 cierre y +2 expectativas locales nuevas. No se ha repetido toda la matriz UI1062/entrenamiento/contratos anteriores ni se presenta como una ejecución nueva sobre el último SHA. Esas suites históricas siguen documentadas en los informes originales de esta rama. No se suman refresh, diagnósticos, consultas de integridad, intentos abortados o repeticiones.

El mock de host para RPC ausente ahora falla en premium_recommendation_view, que es la dependencia del reviewer, conservando el requisito de error visible y sin montaje. No se hizo tolerante el test a un fallo funcional.

## Concurrencia: resultado y límites

- Upgrade Basic→Premium de dos pestañas y reintento idempotente: evidencia JWT anterior conservada.
- Upgrade frente a reserva Basic: HTTP400 coach_premium_management_active; una admisión, misma rutina/día/ejercicio y operación/revisión Basic byte-exactas.
- Provision frente a upgrade: HTTP400 premium_upgrade_conflict; una baseline existente, sin inventar procedencia Basic.
- Upgrade frente a workout save: HTTP201; un workout, payload/revisión fuente exactos; no requiere esperar el lock de admisión.
- Upgrade frente a recommendation acceptance MOCK: HTTP200, una sola N+1; misma rutina, operación y baseline anteriores intactas.
- Routine revision/edición frente a adopción, ambos sentidos: dos carreras A/B anteriores con diez checks; no se repiten porque el fix no modifica locks.
- Upgrade frente a dos resoluciones reviewer MOCK: una HTTP204 y otra HTTP400 premium_invalid_state; KEEP ready, sin aplicar revisión.
- Respuesta MOCK tardía con baseline anterior frente a aceptación: superseded/stale_revision, patches vacíos, sin result_revision_id. Aceptación HTTP400 premium_not_ready; N+1 vigente intacta.
- UI tardía/cambio de sesión: host150 final, sin reabrir ni montar un scope antiguo.

Las seis ventanas nuevas se acreditan con timestamps SQL/HTTP, y en resolución/late también con waiter real observado en pg_stat_activity. Los outputs de programación son fixtures SQL declaradas MOCK; las solicitudes HTTP y la concurrencia son reales, no llamadas OpenAI.

La primera ventana Basic excedió el timeout de staging: se redujo únicamente la duración del holder y se repitió ese caso, manteniendo solapamiento probado. Un intento de resolución previo al holder no se cuenta como ventana. El primer ensayo de rollback del fix detectó CRLF en el cuerpo aplicado desde Windows; se aplicó la misma definición con LF y el ensayo byte-exacto final pasó. No hubo cambios parciales en los ensayos abortados.

## Seguridad y tokens

Solo se renovaron owner c7bbe50b-d349-4f7e-8fdc-476f17c22674 y reviewer 6b47ae02-6574-46db-acdb-f00925efdd74. Tokens nuevos exclusivamente en memoria del runtime/IPC; nunca navegador, localStorage, logs, resultados, fixtures o Git. Runtime y workers cerrados. Copias antiguas de esas cuentas retiradas de los sessions privados de esta rama, cuatro sessions anteriores y diez objetos anidados en cinco manifests antiguos; sin borrar IDs, fixtures de otras cuentas o credenciales ajenas. No se renovaron otras sesiones.

JWT real del reviewer: sin revisión privada, workouts del owner ni mesociclos de otro atleta; sin asignación o con entitlement caducado, HTTP403. El control adicional de otro client utiliza rol authenticated/claims en una transacción SQL revertida, **no un tercer JWT renovado**; se distingue de los siete checks JWT del adapter. No se cambió Auth/OAuth ni ningún perfil/rol.

## Staging, producción y rollback

Cuatro rutinas aisladas, tres operaciones/intakes, sus revisiones, días/ejercicios, un workout, tres recomendaciones MOCK y grants eliminados por UUID/procedencia. Entitlement completo y accounting restaurados exactamente; no se borraron usuarios.

Staging final: profiles5, routines15, days17, exercises23, workouts22, assignments12, notes4, Auth estable5 e identities5; todos sus hashes iguales al inicio. Whitelist={}, reviewer_config={}, entitlements habilitados0, admissions0, mesocycles0, recommendations0, messages0, checkins0. Proveedor OFF; reservas0; ledger intacto: 29 llamadas / 0,589222 USD. **Cero llamadas OpenAI en esta continuación.** RLS/policies/triggers exactos al inicio.

Producción: main b15968c73ab1b075c70f5456e6531733696c3bf5, nueve inventarios centrales, 52 definiciones/owner/ACL/settings y tres inventarios de seguridad iguales al inicio. Ciclo 88c3564c3c49cf9c53fccba89a1e71b5. Patatasimple 284d6bb6-e798-44a9-b72c-f31d3e27deef sigue client, con su rutina Basic 036b43f2-f109-4a43-9129-32f7aba4a55a, tres días/doce ejercicios y todos sus datos intactos. Sin upgrade ni actuaciones sobre esa cuenta.

Rollback completo disponible y ensayado con el fix final, preservando contabilidad e históricos. Preview http://127.0.0.1:4251/review sigue navegable. Resultados/private/capturas y runtime temporal quedan fuera del commit. READY FOR REVIEW no autoriza promoción ni piloto productivo.
