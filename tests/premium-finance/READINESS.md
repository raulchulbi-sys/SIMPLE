# Financial P1 — compatibilidad final, 2026-10-10

**FINANCIAL P1: READY FOR PROMOTION. No publicado.**

Rama `codex/premium-financial-compat`, basada en `d569c6deec99a9224f6aa3d6576d4983e24d7f86`. Main remoto continúa en `0d73c798708a6251d6940e766c86bc7574f9723a`. La autorización de esta fase es preparación y validación en staging; no se ha vuelto a intentar publicar.

## Causa y alternativa elegida

`premium_enabled` pertenece a los controles operativos C5/C6 separados, exclusivamente de staging. Fuente local: worktree premium-financial-concurrency, migración `20261007232452_coach_premium_pilot_controls.sql`; historial de SIMPLE Security Test: `20261007234925 coach_premium_pilot_controls_staging`. Añadió boolean NOT NULL DEFAULT true (conservar accesos explícitos anteriores), cuatro metadatos de control y un wrapper de entitlement. Nunca formó parte del backend productivo que se estaba promoviendo. Financial P1 había arrastrado la referencia directa sin crear ni promover esa extensión.

Se elige **B**. No añadir una columna ni promover controles ajenos para satisfacer la consulta. Producción conserva enabled/chat_enabled/shared_enabled, acceso individual autorizado, expiración, capabilities y cuotas. El gate lee el registro como JSON: si premium_enabled existe y está OFF, bloquea; si no existe, mantiene todos los controles productivos existentes. Su ausencia no otorga acceso ni incrementa presupuesto. Preflight exige boolean NOT NULL cuando existe.

Única modificación funcional respecto a d569c6d: dependencia opcional en premium_check_dispatch. Hash nuevo: `e3728e982bdad65f629be16423685a05`. Las otras seis funciones financieras, Edge, UI, Auth, Basic, reviewer y entrenamiento no cambian. Migration y rollback sustituyen también la referencia directa en su guarda de proveedores.

## Diferencias de esquema auditadas

Producción: budget de 18 columnas. Staging: las mismas 18 más premium_enabled y cuatro metadatos de pilot controls. Tipos/defaults/PK de las columnas comunes comprobados. Variantes de CHECK existentes y conservadas: max_calls 24/26, chat_max_calls 11/30, chat_max_usd 0,50/0,45 (producción/staging). No se sincronizan límites ni se escriben contadores. El manifiesto permite únicamente definiciones auditadas, incluidas dos representaciones equivalentes de CHECK que Postgres produce al recrearlos; no elimina controles ni admite SQL arbitrario.

## Preflight antes de la primera escritura

`preflight.sql` es read-only y se incorpora automáticamente al inicio de migration y rollback, antes de DDL/DML. `build-preflight.cjs` lo genera desde el motor y el manifiesto versionados.

Comprueba 17 tablas (dos financieras opcionales antes de instalar), 60 funciones (53 dependencias transitivas y siete helpers/RPC nuevos opcionales), columnas/tipos/nullability, defaults presupuestarios, owner/RLS/ACL, hashes de versiones, constraints e índices financieros, PK y singleton budget. Detecta instalación parcial y orden de dependencias ausentes. Hash de función incluye SECURITY DEFINER/search_path; owner/grants se contrastan además por separado. Una versión desconocida requiere revisión del manifiesto, no continuar por fuerza.

Pasa contra producción real **en solo lectura**, staging habitual y clon aislado. Nueve alteraciones deliberadas rechazadas y revertidas: tabla, columna, tipo, default, constraint, función/orden, versión, grants y control opcional inválido. Otros seis checks confirman restitución y semántica de interruptores: total 15/15.

## Ensayo aislado equivalente a producción

En SIMPLE Security Test se crearon finance_compat_private / finance_compat_public con budget productivo de 18 columnas **sin premium_enabled**, constraints/defaults reales y 53 definiciones productivas exactas reubicadas. Sin copiar registros personales, workouts ni contabilidad existentes. Dos perfiles sintéticos y sus permisos solo en el clon; las identidades sintéticas existentes no se eliminaron.

LIKE INCLUDING ALL no replica todas las FK/triggers externas. Este clon valida contratos financieros y compatibilidad de esquema; no se presenta como una réplica de todos los workflows de SIMPLE. No se usaron stubs permisivos de las funciones de admisión.

Forward, rollback exacto de siete definiciones y reaplicación idempotente pasan sin columna y con columna opcional añadida únicamente en el clon. El rollback completo rechaza responsabilidad sin conciliar antes de restaurar funciones; hash del gate y recibo quedan intactos. Se concilió exclusivamente evidencia sintética no facturable para terminar el ensayo. No se borró auditoría para forzar el rollback. Los 8 items/18 eventos finales del clon se conservaron en evidencia privada antes de retirar ambos esquemas; el ledger habitual 12/44 permanece intacto.

## Pruebas de esta fase

| Ejecución final | Resultado |
|---|---:|
| provider-receipt.cjs | 10/10 |
| premium-chat/contract.cjs, transporte interceptado | 72/72 |
| premium-chat-prescription/contract.cjs | 25/25 |
| premium-series/unit.cjs | 34/34 |
| financial-regression.sql, clon sin columna y staging habitual | 11/11 en cada entorno |
| financial-safety.sql, clon sin columna y staging habitual | 8/8 en cada entorno |
| Fallos de preflight y switches | 15/15 |
| Cruces HTTP simultáneos con JWT reales, proveedor simulado | 6/6 |
| JWT: mock/real/retry/reviewer/trainer/anon; tres RPC financieros denegados y ledger privado no expuesto | 24/24 |

Son **224 ejecuciones de casos** contando los 19 SQL en cada uno de los dos esquemas. No se suman a las 465 comprobaciones históricas ni se cuentan las reejecuciones fallidas como pruebas nuevas. Las 12 pruebas HTTP originales se conservan como evidencia histórica; esta fase repite seis cruces críticos sobre el clon, no afirma una nueva ejecución de las doce.

Cruces: dos reservas caben (dos ganadores), solo cabe una (uno), duplicado mismo usuario/id (uno), incidencia (cero), shared OFF (cero), Chat/análisis compartido (uno). Todos verifican solapamiento HTTP y servidor, txids diferentes, reserva positiva y liquidación una sola vez. El transporte usa premium_check_dispatch + capture/settle reales aislados; no sustituye una prueba nueva completa de todo premium_chat_claim.

Dos fallos de harness resueltos: numeración fija de mesociclo chocaba al reutilizar fixtures; se obtiene siguiente número dentro del lock. financial-safety dependía del entitlement activo de una ejecución anterior: ahora establece únicamente el prerrequisito del cliente sintético dentro de la transacción que termina en ROLLBACK. Sin cambios del producto para adaptar expectativas. Se renovó ventana temporal tras interrupciones; JWT expirados/caducidad del transporte no se clasifican como bug de SIMPLE. Error transitorio del conector requestState se verificó consultando estado antes de repetir una escritura.

Cero llamadas OpenAI, coste real 0 USD. Tokens exclusivamente en memoria; procesos cerrados; refresh tokens descartados inmediatamente. Evidencias sanitizadas/SQL ensamblado/resultados quedan en private/ ignorado, fuera del candidato.

## Limpieza, permisos e integridad

Transporte público, schemas aislados, fixtures y ventana temporal eliminados. Cleanup versionado identifica solo esos objetos y exige cero reservas/incidencias pendientes. Verificado: ambos namespaces y RPC ausentes. Staging vuelve exactamente a sus nueve hashes centrales anteriores (incluyendo Auth estable/identidades), budget exacto, tres entitlements desactivados, whitelist 0, reservas 0, incidencias 0. Conservados los 12 items/44 eventos y el QA audit preexistente. No se amplió RLS.

Advisors conserva INFO por RLS sin policies en tablas privadas (intencional) y avisos previos de RPC SECURITY DEFINER / protección de contraseñas; no se cambian permisos ni Auth para silenciarlos. Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy y https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.

Producción solo recibió SELECT/preflight read-only. Las 183 definiciones/owner/ACL/search_path siguen exactas, agregado `ad100a839025d29ce640990f8a6c9dac`; policies `56586b14fb7823542777412842780623`; ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. Auth estable conserva 7 usuarios/10 identidades y hashes originales. Budget idéntico: análisis 1 / 0,0307175; Chat 10 / 0,243427; reservas 0; límites intactos. No existe aún ledger Financial P1 en producción.

**No afirmar identidad total de datos productivos entre los días 8 y 10:** hay tres workouts nuevos ajenos a Patata (58→61), notas 204→211 y hashes distintos de routines/routine_exercises. Timestamps desde el día 8 muestran tres workouts/19 notas, ninguna actualización de routines/routine_exercises; no hay evidencia suficiente para atribuir sus diferencias de huella a un actor/evento concreto. No se corrigieron ni sobrescribieron esos datos. No hubo escrituras productivas de esta tarea. Una promoción futura debe capturar un baseline fresco, no reutilizar el hash del día 8 como si los usuarios no hubieran usado la app.

Patata sigue client, R1/R2 con hashes originales ca7954a44427a2087bb12c9f0bffeed7 / 2b44df04b727c078bec5a1fcd66364bc, cinco workouts, 12 UUID únicos y 12/12 prescripciones actuales coinciden con R2. No se generan ni aceptan propuestas ni se escribe en su cuenta.

## Rollback y próxima promoción

Rollback ensayado en ambos esquemas, con bloqueo seguro ante datos financieros vivos. Conserva ledger/events/helpers y presupuestos; no elimina obligaciones ni cargos. Requiere proveedores OFF, cero reservas y todas las incidencias conciliadas/cerradas. La reapertura de una incidencia sigue necesitando autorización independiente. Entrenamiento no depende del bloqueo Premium.

La corrección queda preparada para promoción posterior; **esta fase no publica**. Sigue vigente el empaquetado productivo de Edge del candidato anterior: no desplegar literalmente los entrypoints con guardas de staging. Actualizar baseline/ejecutar preflight; si aparece una dependencia desconocida, detener antes de escribir. Pendientes legales y defecto histórico premium-chat-selection conservan la limitación documentada a continuación.

---

# Evidencia histórica de d569c6d (2026-10-08; no son nuevas ejecuciones)

# Financial P1 — revisión final, 2026-10-08

**FINANCIAL P1: READY FOR PROMOTION. No publicado.**

Rama `codex/premium-financial-p1`, continuación de `ecb72e997dfc53a2802a43b84c5b0031bd5d07fd`, sobre main `0d73c798708a6251d6940e766c86bc7574f9723a`. Cero llamadas reales a OpenAI; coste real: **0 USD**. El canary cerrado no se repitió.

## Causa y modelo contable

El parche parcial validaba límites, pero aún convertía una reserva en cargo estimado ante recibos incoherentes. Faltaban conciliación de gasto externo verificado, incidencia duradera y bloqueo común de nuevos envíos. Chat tenía la misma carencia y su wrapper descartaba procedencia del recibo.

| Concepto | Contrato final |
|---|---|
| Estimado | Cota calculada en servidor: bytes UTF-8 de la petición completa + 2.048 de margen y máximo de salida. |
| Reservado | Exposición positiva antes del envío; incluida en límites individuales y compartidos bajo lock transaccional. |
| Liquidado | Importe incorporado al contador; nunca se trunca un exceso verificado a la reserva. |
| Verificado | Uso del proveedor ligado a dispatch/response/modelo/tarifa, o evidencia externa revisada por operador autorizado. No equivale a una factura descargada en esta tarea. |
| No verificado | Importe verificado/liquidado NULL, reserva retenida, recibo conservado e incidencia abierta. |

Dos tablas privadas: `premium_financial_items` conserva contrato/estado de cada envío; `premium_financial_events` conserva eventos inmutables con importe/delta, actor, autorización, motivo y fecha. Sin backfill ni reescritura de recibos históricos. Sin FK que obligue a borrar auditoría al limpiar fixtures.

Contrato capturado por envío: `gpt-5.4-2026-03-05`, tier `default`, tarifas existentes de entrada/caché/salida 2,5/0,25/15 USD por millón, cotas de tokens y costes adicionales previstos=0, sin tools. No se redujeron prompts, calidad ni máximos: análisis 1.800; Chat hasta 1.000 según configuración existente. Tier default explícito evita liquidar otro tier al precio equivocado.

`provider-receipt.mjs` conserva solo metadatos cerrados: response_id, modelo, tier y uso. Los Edge añaden dispatch_id servidor. No se guardan headers, credenciales ni texto libre en el registro financiero.

## Conciliación y reapertura

Recibo normal: números JSON enteros no negativos; caché <= entrada; entrada/salida dentro del contrato; modelo/tier correctos; HTTP 200; response_id único. Se calcula con tarifa capturada. El `cost_usd` enviado por el llamador no es autoridad contable.

Recibo incoherente, ausente, fallo de transporte o dispatch caducado: no se inventa gasto; se conserva la responsabilidad pendiente y se bloquean nuevos envíos Premium de Chat/análisis. El dispatch caducado bloquea incluso antes de materializar el evento de incidencia. La respuesta tardía no borra el recibo original ni deshace conciliación.

Procedimiento exclusivamente backend/operador, nunca atleta ni reviewer de entrenamiento:

1. `premium_finance_incidents()` identifica incidencias y materializa caducidades.
2. Contrastar con evidencia fiable del proveedor; no tomar un importe del test por una factura.
3. `premium_finance_reconcile(...)`: importe completo, evidencia, actor, autorización, motivo y clave idempotente. Evidencia externa exige tipo permitido, referencia, moneda USD, dispatch_id exacto y SHA256 del documento revisado. **El hash vincula el documento; no valida su autenticidad. El operador debe contrastarlo antes de autorizar.**
4. Incorporar solo el delta frente a liquidación previa, liberar responsabilidad reservada una sola vez y conservar exceso íntegro. Incidencia sigue abierta, incluso por encima del límite global; no se elevan caps.
5. `premium_finance_resume(...)`: autorización separada e importe ya verificado. Resuelve solo esa incidencia; otras incidencias, cuotas y kill switches siguen vigentes. Mismo request_key con distinto contenido se rechaza.

`controlled_test` exige dominio de pruebas de staging y envío marcado como test. No puede conciliar un envío real. Los registros sintéticos conservados son no facturables.

La reserva impide admitir gasto concurrente por encima del presupuesto bajo el contrato capturado. No se promete impedir físicamente una anomalía de facturación externa ni cancelar llamadas ya enviadas: un exceso externo verificado se registra íntegro y detiene nuevo gasto hasta resolverlo.

## Alcance

- Migración `20261007230107_premium_analysis_receipt_bounds.sql`: dos tablas privadas, cuatro helpers, tres RPC de servicio y siete funciones existentes. Se reutiliza el archivo del candidato parcial; ensayos/rollback constan también en el historial remoto de staging.
- Existentes adaptadas: `premium_check_dispatch`, `premium_analysis_claim`, `premium_chat_claim`, `premium_analysis_finish`, `premium_upgrade_prior_premium_chat_finish`, `premium_chat_finish`, `premium_upgrade_prior_premium_chat_expire`.
- Cinco archivos Edge: dos contratos, dos entrypoints y helper de recibos.
- Sin cambios a UI, Auth/OAuth, roles, entrenamiento, Basic, cuestionario, catálogo, reviewer, RLS/policies existentes o presupuestos productivos.
- Se retiran los tres SQL parciales de recibos/rollback; el rollback unificado sustituye el rollback solo de analysis, ya incompleto. Historia conservada en Git y evidencias originales.

Tablas nuevas: RLS, cero policies y sin privilegios directos anon/authenticated/service_role. Tres RPC públicos solo service_role, owner postgres, SECURITY DEFINER, `search_path=pg_catalog,public`. Helpers privados no ejecutables por clientes ni servicio. Linter INFO de RLS sin policies es intencional en tablas privadas; no se amplía acceso para silenciarlo.

## Pruebas: 465 comprobaciones/grupos únicos

No se suman reejecuciones, asserts internos ni los 12 escenarios históricos como pruebas adicionales.

| Suite | Resultado |
|---|---:|
| premium-chat/contract.cjs, transporte interceptado | 72/72 |
| premium-chat-context/contract.cjs | 23/23 |
| premium-chat-prescription/contract.cjs | 25/25 |
| premium-series/unit.cjs | 34/34 |
| premium-weekly/weekly-unit.cjs, gateway interceptado | 76/76 |
| coach-quality-v5/unit.cjs, proveedor local | 35/35 |
| coach-intake-v2/unit.cjs | 50/50 |
| premium-phase2/unit.cjs, compatibilidad v1 | 28/28 |
| premium-distribution/unit.cjs | 38/38 |
| premium-finance/provider-receipt.cjs | 10/10 |
| financial-regression.sql: recibos/idempotencia/exposición/conciliación | 11/11 |
| financial-safety.sql: caducidad/evidencia/auditoría/respuestas tardías/kill switch | 8/8 |
| Concurrencia HTTP real en staging, proveedor simulado | 12/12 |
| JWT reales: tres clients, trainer, reviewer, anon; servicio positivo por QA | 30/30 |
| Entrenamiento HTTP con incidencia financiera abierta | 11/11 |
| Smoke de dos Edge finales con IA apagada | 2/2 |

Entrenamiento durante bloqueo: rutina, sesiones, prescripción y revisión legibles; un workout y una nota sintéticos guardados/releídos con UUID y valores exactos; datos de historial/gráfica/Última sesión conservados; ciclo 1/2. Son controles API/datos, no una auditoría visual nueva. Ambos registros eliminados. UI y Basic entregado permanecen byte-equivalentes a main; Basic v5/intake conservan contratos locales.

**Limitación declarada:** `premium-chat-selection/contract.cjs` falla su expectativa histórica «reviewer names without UUID or raw JSON» con el sample local archivado. Se reprodujo el mismo fallo sobre el árbol exacto de main, sin este fix. No se adaptó test ni producto para ocultarlo; no se cuenta como superado. Contrato vigente de prescripción: 25/25. No se declara una auditoría general totalmente verde.

### Doce escenarios HTTP

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Dos usuarios, ambas reservas caben | Dos claims positivos; liquidación independiente. |
| 2 | Solo cabe una reserva | Un ganador, otro rechazado sin gasto/cuota. |
| 3 | Duplicado mismo usuario | Un id, un claim/cargo. |
| 4 | Finish duplicado | Una liquidación idempotente. |
| 5 | Menor coste | 0,00425 frente a reserva 0,0175; diferencia liberada. |
| 6 | Coste igual | 0,0175 exactos. |
| 7 | Exceso verificado controlado de prueba | 0,04 íntegros; exceso 0,0225; conciliación duplicada sin doble cargo, incidencia abierta. |
| 8 | Recibo manipulado | NULL verificado, reserva 0,0175 retenida; sin gasto inventado. |
| 9 | Fallo tras reservar | Responsabilidad pendiente; sin reintento automático. |
| 10 | Incidencia abierta | Dos nuevos intentos denegados, sin consumo adicional. |
| 11 | Reapertura autorizada | Reapertura concurrente idempotente; siguiente envío controlado admitido. |
| 12 | Chat/análisis compartido | Saldo 0,032 permite 0,0175 o 0,0295, no ambos: un ganador. |

Carreras con HTTP concurrente, transacciones distintas y 1.200 ms de solapamiento servidor en admisión. La decisión monetaria se serializa con lock, como debe. Casos de coste individual no se presentan como carreras. Reservas ganadoras positivas.

Harness reutilizado del worktree local `premium-financial-concurrency/tests/premium-finance`. Orquestación final revisable en `concurrency.cjs` / `concurrency-runtime.cjs`; necesita manifiesto y credenciales sintéticas en `private/` ignorado y transporte QA autorizado en staging. El transporte está RETIRADO; lanzar el script no reactiva pruebas. Orden: 1,2,3,4,5,6,7,10,11,8,9,12. Restitución por caso solo de deltas no facturables sintéticos, no gasto real. Evidencia de ventanas/txid/deltas en `private/p1-concurrency.json`, setup/cleanup exactos en el mismo directorio y QA audit privado. No se versionan manifests, resultados, credenciales ni tokens.

Los SQL rollback-only requieren `finance.controlled_test=dmqjexigdnfzobarhnib` y `finance.test_user` de un client sintético autorizado. Hacen ROLLBACK. No necesitan OpenAI.

## Rollback y promoción posterior

Ensayados rollback exacto de siete definiciones productivas y reaplicación final, sin diferencias en presupuesto/auditoría. Guardas de hash previenen reemplazar funciones desconocidas. Migración y rollback requieren todos los interruptores de proveedores OFF y cero reservas; rollback rechaza incidencias pendientes.

`rollback-financial.sql` verifica hashes originales antes de COMMIT. Conserva tablas/helpers y evidencia; no borra contabilidad. Mantener IA apagada después: código anterior carece del nuevo bloqueo financiero.

Promoción futura autorizada: snapshot de ambas Edge productivas; quiescer proveedores sin cambiar caps/consumos; comprobar reservas/hashes; aplicar SQL; desplegar ambos paquetes con helper y empaquetado/guardas productivas habitual; verificar; reabrir solo con autorización. Los entrypoints del repositorio conservan guardas de staging: **no desplegarlos literalmente en producción sin ese empaquetado**. Rollback Edge con snapshots exactos. Copias staging en `private/rollback-edge-*.json`, fuera del commit. No se preparó una key nueva.

## Limpieza e integridad

- Eliminadas tres rutinas nuevas/dependencias, un workout, una nota y doce grants sintéticos.
- Cinco identidades sintéticas preexistentes conservadas; runtime cerrado, refresh tokens descartados, sin nuevas copias materializadas.
- Budget y tres entitlements staging exactos al snapshot inicial: consumos, límites y metadatos. Deltas sintéticos compensados con evento no facturable; nunca gasto OpenAI.
- Cero accesos Basic/Premium autorizados, reservas e incidencias; interruptores OFF.
- Conservados 12 items / 44 eventos, además de QA audit antiguo y nuevo. QA Edge retirado a HTTP 410, verify_jwt=true; helpers/gate temporales eliminados.
- Staging recupera hashes/recuentos: perfiles 5, rutinas 15, días 17, ejercicios 23, workouts 22, asignaciones 12; notas previas 4 conservadas.
- Producción: main `0d73c798`; funciones agregado `ad100a839025d29ce640990f8a6c9dac`; policies `56586b14fb7823542777412842780623`; ciclo `88c3564c3c49cf9c53fccba89a1e71b5`. Auth estable: 7 usuarios, hash `2a742f50a37127c871aec10bf44fd33c`; no updated_at/last_sign_in_at como identidad.
- Patata sigue client; huellas completas R1/R2 `ca7954a44427a2087bb12c9f0bffeed7` / `2b44df04b727c078bec5a1fcd66364bc`. Ninguna escritura productiva.

Pendientes legales del piloto externo independientes. Este cierre financiero permite revisión/promoción posterior; no autoriza publicar ni incorporar usuarios.
