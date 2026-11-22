# Revisión local de PR #5/#6/#7 — 03/11/2026

No merge, despliegue, SQL compartido, pago, sesión Portal ni llamada OpenAI.
El estado conectado de Stripe/Supabase no se volvió a auditar en esta tarea.

## Fuentes y revisión oficial

- Main remoto: `b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`.
- #5: `fc245c9c91113b1b9db9a28847bcbdfc715c5224`, ready, sin cambios.
- #6: `313344dbc607f2219922f7eb8a9102bc8cde3d53`, draft, sin cambios.
- #7 de entrada: `c8355af73b1c37ebb733d8bccbd5f4fa5135d6bc`, draft.
- #1: `81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839`, draft, intacta.
- #2: `49ef741d5ba9fb58e38732fe7a031e7034d907dd`, draft, intacta.

Se pidió **una** revisión oficial en
[6597721966](https://github.com/raulchulbi-sys/SIMPLE/pull/5#issuecomment-6597721966).
El [recibo del bot](https://github.com/raulchulbi-sys/SIMPLE/pull/5#issuecomment-6597751917)
y su estado estructurado confirman Code Review completada para el SHA completo
de #5, sin hallazgos ni hallazgos abiertos. No es una Security Review separada
ni un APPROVE humano. No se ha editado el comentario reservado de Work.

CI GitHub de los heads de entrada: #5 [41542299226](https://github.com/raulchulbi-sys/SIMPLE/actions/runs/41542299226),
#6 [41540274165](https://github.com/raulchulbi-sys/SIMPLE/actions/runs/41540274165),
#7 [41540282352](https://github.com/raulchulbi-sys/SIMPLE/actions/runs/41540282352): success.
El run de #7 anterior no certifica el commit de esta corrección; comprobar su
check actual por SHA al revisar. #5 queda preparada para una decisión humana.

## Defecto P1 reproducido y corregido en #7

`review_coach_proposal` y `authorize_coach_retry` comprobaban el scope antes
del `SELECT ... FOR UPDATE` de la operación. Otra transacción podía retener
esa fila hasta después de caducar la asignación o la admisión del reviewer;
la acción continuaba sin volver a comprobar la hora real.

Cuatro regresiones nuevas, con dos conexiones PostgreSQL y observación de
`pg_stat_activity`, reprodujeron el defecto: review/retry × caducidad de
asignación/reviewer. Antes: 4/4 permitían indebidamente la mutación. Después:
4/4 deniegan y conservan estado/decisión/reintento originales. Se repite
`lock_review_scope` tras adquirir el bloqueo; se conserva el bloqueo de la
asignación hasta commit. No cambian firmas, ACL, roles, RLS ni decisiones humanas.

Dos regresiones antiguas de concurrencia fallaron en la primera ejecución por
suponer que dormir 80 ms garantizaba que el otro proceso ya tenía el bloqueo.
Ahora observan el bloqueo real antes de continuar. Son casos corregidos y
reejecutados, no pruebas nuevas. Se conservan los recibos fallidos localmente.

## Revisión de seguridad y límites

| Superficie | Resultado local y condición pendiente |
|---|---|
| SECURITY DEFINER / identidad | RPC públicos usan `auth.uid()`, no un propietario enviado por frontend. Helpers privados sin EXECUTE para PUBLIC/anon/authenticated/service_role; referencias de tablas cualificadas y `pg_catalog` primero. Contrastar propietarios, membresías y CREATE en schemas del destino antes de instalar. |
| Cambios de esquema | Gate mueve los cuerpos originales a privados y revoca EXECUTE; wrappers nuevos conservan firmas. Rollback conserva cuerpo/ACL en la fixture. Hay que inventariar dependencias por OID, vistas/funciones dependientes y llamadas por nombre en el destino; SET SCHEMA conserva OID y no demuestra por sí solo que nadie pueda saltarse el wrapper. |
| Reviewer | Global admission sin asignación devuelve cero operaciones. Owner+operación+reviewer+acciones+consentimiento+caducidad+revocación; locks contra resolución/revocación concurrentes. Acceso privado directo denegado. No se habilitó ningún reviewer conectado. |
| Proyección privada | Cola con campos explícitos; respuesta de aprobación conserva tipo compuesto con campos privados NULL. El recibo original sigue almacenado. Feedback se limita al owner/rutina de la operación asignada; revisar su contrato si se añaden columnas sensibles. |
| Customer | Solo backend autenticado obtiene el mapping. Lectura Customer es INVOKER service-only. Cliente, sesión, suscripción y factura se contrastan con el mismo Customer y owner. No hay selectores de owner/customer aceptados desde UI. |
| Checkout | Price TEST en servidor, una reserva/lease, clave idempotente estable, ventana de recuperación y no reintento automático. Estado incierto no crea otra compra. Casos ejecutados con dobles y SQL local, no otra compra TEST. |
| Webhook | Firma sobre bytes originales antes de parseo útil; versión, TEST, tipo de evento, cuenta y vinculación se comprueban. Evento persistido idempotente, estado actual conciliado y escritura transaccional. Se reutilizan las 7 pruebas criptográficas históricas porque el entrypoint no cambia; no se suman a esta ejecución. |
| Basic/Premium | Periodo pagado determina el derecho Basic; URL y UI no lo conceden. Premium capability false, generación false por defecto; la política comercial no inventa cuota. El adaptador mantiene el precio Premium TEST existente, no una apertura comercial ni una compra autorizada. |
| Recuperación | Duplicados/eventos desordenados/lease caducado/concurrencia/transacción fallida probados en PostgreSQL local. Más de 100 elementos, pagos parciales/múltiples o cambios de plan no soportados fallan cerrados: límites del piloto TEST, no preparación LIVE. |
| Rollback | Billing por preimagen/ACL, lectura Customer aditiva, gate restaura originales, reviewer vuelve a denegación cerrada reteniendo asignaciones e historia. No volver al acceso global para arreglar un error. |

Referencias técnicas consultadas: [funciones PostgreSQL](https://www.postgresql.org/docs/17/sql-createfunction.html),
[funciones Supabase](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[webhooks Stripe](https://docs.stripe.com/webhooks),
[Checkout/Portal](https://docs.stripe.com/billing/quickstart).
La documentación no sustituye las pruebas ni acredita el estado del proyecto real.

## Simulación de integración

Worktree independiente `.worktrees/commercial-integration-review`, rama local
`codex/commercial-integration-review`, basado en main anterior. Se aplicaron los
diffs sin ejecutar merge ni mover ramas originales. No se creó otra PR.

Único conflicto textual entre #5/#6/#7: `scripts/ci-offline.cjs`. Resolución:
conservar las cuatro suites base, `staging-return/offline.cjs`,
`subscription/offline.cjs`, las tres suites billing, `commercial/backend.test.mjs`
y `commercial/package.test.mjs`; usar `--experimental-vm-modules --test
--test-concurrency=1` para `.mjs` y mantener el chequeo de sintaxis del ensamblador.
La simulación añade una duodécima suite con 11 casos de composición.

Los tres cambios no se pisan en producto. La UI de #6 requiere `status`/`portal`
de #7; `access` de #5 sigue funcionando. Sin `billing_test_capabilities` la UI
mantiene generación cerrada: no hay que instalar el gate para consultar estado.

Incidente del arnés: al aplicar diff con autocrlf de Windows antes de reconocer
atributos anidados nuevos, se convirtieron fuentes históricas a CRLF y falló
`Headers hash`. #5 **ya tenía** `staging/return/.gitattributes` correcto. Se
recuperaron sus blobs exactos del SHA aprobado, sin cambiar su código, sus hashes
ni tolerar variantes. Una regresión de integración comprueba atributos efectivos
con autocrlf=true. Se retiró un ajuste exploratorio innecesario; #5 quedó limpia.

El árbol combinado conserva exactamente los blobs de cada PR salvo el CI común,
las dos correcciones de #7 y las pruebas/documentación de esta revisión.
Los artefactos/reports crudos quedan ignorados; no contienen JWT reales.

## Pruebas de esta sesión, sin duplicar reejecuciones

| Grupo | Resultado final | Casos nuevos |
|---|---:|---:|
| CI offline combinado | 328/328 | 11 de composición UI→handler→estado/Portal y atributos Git |
| PostgreSQL 17.11 local, billing | 24/24 | 0 |
| PostgreSQL 17.11 local, comercial/reviewer | 35/35 | 4 de caducidad durante bloqueo de fila |
| Chromium/WebKit, backend simulado | 72/72 | 0 |
| Análisis sintácticos combinados | 48/48 | No son casos funcionales |

**459 casos distintos ejecutados, 15 nuevos.** Las corridas fallidas/repetidas
no se suman. Los 7 casos criptográficos anteriores solo se reutilizan como evidencia.
No hay JWT real, Stripe real ni comprobación nueva de RLS en Supabase. SQL local
usa roles y claims sintéticos; navegador usa dobles y bloquea toda red externa.
Los clusters locales se apagaron; no se borraron las evidencias sintéticas.

## Orden recomendado y pendientes

1. Decisión humana de #5; después #7 corregida y #6, conservando la unión del CI.
   Integrar código no autoriza desplegar ni activar flags. #6 permanece cerrada
   hasta tener backend compatible y configuración pública revisada.
2. Reconciliar #1 sobre esa base en una tarea separada: el manifiesto de build
   actual no incluye los recursos subscription; runtime no habilita billingTest.
   El ensamblador de #5 acepta su base histórica exacta, no cualquier build nuevo.
   Definir un nuevo inventario revisado y conservar retorno/headers explícitamente;
   nunca omitir hashes o sobrescribir todo el artefacto con un checkout viejo.
3. #2 no es necesaria para leer la suscripción. Sí es una dependencia de validación
   antes de un piloto de generación: conservar recuperación/idempotencia, guard,
   CORS y bundle efectivo de Coach; no redesplegar `simple-coach-mock` desde #7.

No se detectó P0 en el alcance local. P1 corregido: caducidad durante bloqueo.
P1 pendientes para activar: preflight de funciones efectivas/dependencias y pruebas
JWT reales; ensamblado hosting con UI nueva; validación del Portal real autorizada.
La privacidad JWT productiva pendiente de #1 sigue separada. Fiscalidad unspecified,
oferta/cuotas comerciales, condiciones legales y validación LIVE no se resuelven aquí.

Siguiente encargo a Work: revisar esta corrección y preparar un preflight de lectura
de staging según [el plan acotado](STAGING-VALIDATION-PLAN.md). Conservar la
suscripción Basic TEST existente. No repetir el pago ni aplicar automáticamente SQL.
