# Validación comercial de staging sin repetir compras — preparado, NO ejecutado

Objetivo: consultar la suscripción Basic TEST existente, comprobar aislamiento y
el reviewer por operación. Ningún pago, Checkout, cancelación, reembolso, simulación
de renovación o generación. No usar datos de producción. Ninguna autorización de
esta revisión local permite ejecutar este plan automáticamente.

## A. Preflight de lectura y recibo previo

1. Verificar mediante conector/panel la identidad `SIMPLE Security Test`, proyecto
   `dmqjexigdnfzobarhnib`, y cuenta Stripe TEST `acct_1UWwZP6soMMQB8IR`. No deducirla
   de un nombre de archivo ni de `SET simple.approved_project`.
2. Resolver privadamente las identidades ya autorizadas: titular de la compra
   Basic, segundo cliente sintético, trainer y reviewer existentes. Confirmar roles,
   allowlist actual y sesiones legítimas. No crear cuentas ni cambiar Auth.
   Mantener JWT/refresh tokens únicamente en memoria; no logs/HAR/storageState.
3. Contrastar los cinco Secrets por presencia/nombre, sin leer valores; cuenta,
   catálogo 499/1299 EUR mes TEST, versión API/eventos `2026-09-30.endive`,
   endpoint y tipos suscritos. No cambiar secrets ni portal configuration.
4. Obtener fuente efectiva y configuración de billing, webhook y Coach; registrar
   hashes, imports y `verify_jwt`. Billing true, webhook false con firma obligatoria.
   No inferir código por número de versión ni restaurar Coach v33 sobre una v35.
   Comparar el bundle completo; si difiere de lo revisado, detener instalación.
5. Capturar contabilidad real TEST, Customer, factura/periodo, suscripción, eventos
   y reservas del titular; hashes en recibo privado. No exportar filas a Git.
   Conservar exactamente la compra existente, incluso si está cancelada a fin de
   periodo. Si ya expiró, no fingir Basic activo ni extenderlo: registrar bloqueo.
6. Contrastar 27 referencias de entrenamiento históricas con procedencia verificada
   y captura nueva previa; distinguir cambios legítimos de billing posteriores a
   aquel snapshot. No forzar una coincidencia borrando la suscripción. Auth: UUID,
   cantidad, rol y campos estables; timestamps de login no son identidad completa.
7. Capturar definiciones, firmas, owners, ACL efectivas, RLS/policies, membresías,
   privilegios CREATE de schemas y schemas expuestos. Inventariar `pg_depend` de
   los OID originales de `reserve_basic_generation(uuid,uuid)` y
   `get_my_coach_access()`, y llamadas por nombre en funciones/vistas/triggers.
   Una dependencia puede seguir apuntando al OID movido: detener si conserva un
   camino privilegiado al cuerpo anterior fuera del wrapper autorizado.
8. Comprobar exclusividad de la ventana, ausencia de leases/operaciones en vuelo
   y cambios de otros operadores. Guardar rollback de fuentes/configuración y
   preimágenes SQL. No sustituir falta de evidencia por una prueba anónima.

## B. Cambios mínimos que requieren autorización separada

| Paquete | Cambio propuesto | No hacer |
|---|---|---|
| Estado/Portal | `billing-test-commercial.sql` (RPC de lectura service-only), bundle billing de #7 y UI #6 configurada solo para staging | No recrear productos, precios, Customer, Checkout o la suscripción |
| Conciliación ya existente | Si `billing_test_change` tiene hash/ACL efectivos revisados, SKIP; historial documentado `725010c6affa7bd961af76090115e296` | No reaplicar por número de versión. Otro hash inesperado detiene el plan |
| Gate de generación | Opcional y separado: `billing-test-coach-gate.sql`, únicamente tras revisar dependencias y rollback; flag false | No es requisito para leer suscripción. No habilitar generación, cuotas ni Premium |
| Reviewer | `coach-reviewer-scope.sql` corregido, transacción y preimagen verificadas | No habilitar el reviewer global antiguo ni usarlo como atajo |
| Hosting | Ensamblado revisado de #1/#5/#6 con runtime público staging, assets permitidos, retorno y CSP | No usar producción/preview productiva ni sustituir placeholder |

Orden futuro: RPC de lectura → bundle billing compatible → artefacto UI autorizado.
El webhook no se redespliega si código/configuración efectivos ya coinciden.
Gate/reviewer son transacciones independientes; instalarlos no autoriza asignaciones.
No ejecutar `supabase functions deploy` general: únicamente slugs expresamente
autorizados. Ninguna fixture de `tests/**/fixtures` es una migración del proyecto.

SQL de conciliación preparado exige preimagen `cbe9e10d28bbf874b1ef96e685a2c0e0`,
ACL y atestación separada; usarlo únicamente si sigue siendo necesario y autorizado.
Si ya está aplicado, omitirlo. Las transacciones no deben mantenerse abiertas mientras
se espera respuesta humana. Cambios inesperados → detener y conservar el recibo.

## C. Pruebas reales propuestas

Usar SDK con JWT real del titular y una matriz explícita de identidades, después
de autorizar la fase conectada. Prohibir en el runner Checkout, generación, Stripe
mutations y SQL administrativo durante las lecturas. No pulsar «Comprobar pago»
por rutina: `reconcile` sí escribe y solo se habilita con autorización concreta.

| Caso | Operación exacta / evidencia esperada |
|---|---|
| Mi suscripción | `billing-test` POST `{action:"status"}` con JWT del titular; UI muestra Basic 4,99 €, periodo y cancelación según servidor |
| Derecho Basic | `billing-test` `{action:"access"}` y RPC `billing_test_my_access()` coinciden; el retorno por URL no concede derechos |
| Premium denegado | `billing_test_capabilities()` si está instalado: premiumEnabled=false, basicGenerationEnabled=false, quotasChanged=false; RPC de acceso Premium existente deniega al titular Basic. No llamar a generación ni comprar Premium |
| Otro cliente | Mismas lecturas con su JWT no contienen plan/Customer/factura ajenos; REST privado/RPC service-only no exponen los registros del titular |
| Trainer/reviewer | Endpoint billing deniega por rol/allowlist; no sustituir esta denegación por la prueba positiva del titular |
| Manipulación | `status` con `user`/`customer`/`plan` adicional rechaza; URL `plan=premium`, `paid=true`, `session_id` ajeno no concede acceso ni provoca escritura |
| Caducidad/cambio de sesión | Logout/cambio de identidad limpia la vista; respuesta tardía no muestra datos de otra cuenta; no fabricar claims ni editar Auth |
| Retorno HTTPS | Ruta exacta y limpia/extensión, recarga, caché no-store/referrer, CSP/recursos y backend staging; no crear una nueva compra para acceder a esa página |
| Portal | Solo tras autorización de **una** sesión Portal TEST: `{action:"portal"}` sin Customer enviado; backend usa mapping autenticado y return_url exacto; abrir URL en memoria, comprobar titular, facturas/cancelación al final del periodo y volver sin pulsar acciones comerciales |

No ejecutar intentos Portal de terceros que puedan crear una sesión adicional.
Su denegación se verifica primero con lectura/autenticación y dobles; cualquier
prueba conectada de creación adicional exige otro scope. No copiar URLs Portal
temporales, JWT ni datos de facturas a informes públicos.

## D. Reviewer por operación, sin generación

Primero instalar el scope restringido y verificar que la admisión global por sí
sola devuelve cero filas. No debe existir un intervalo con el RPC antiguo abierto.
La validación positiva necesita una operación sintética legítima ya disponible.
Si no existe, pedir autorización separada de fixture: consentimiento, intake y
operación pending_review con propuesta ya documentada, tres UUID nuevos fijados
en recibo privado antes del alta, máximo 60 minutos, cero modelo y cero cuotas.
No usar la operación de un cliente real ni la suscripción como fixture desechable.

Asignación única owner/operación/reviewer con `actions=['view']`, caducidad ≤60 min,
sin `review`/`retry`. Mantener rol existente. Si su admisión está caducada, no
renovarla por iniciativa propia: requerir autorización nominal y restauración.
No habilitar owner para generar ni ampliar presupuestos. Preparar desactivación
y limpieza exactas antes de abrir la ventana.

Con el mismo JWT real del reviewer: cola devuelve solo proyección de esa operación;
REST `coach_operations`/`training_intakes` no devuelve sus filas privadas; segundo
cliente/trainer/otro reviewer sin asignación no la ve. No aprobar/rechazar/aceptar,
no crear rutina/revisión/workout. Revocación/caducidad de la asignación retira
lectura; los cruces de escritura/concurrencia permanecen locales en esta fase.
Si no hay scope legítimo, prueba positiva BLOCKED; no ampliar permisos para pasarla.

## E. Verificación, parada y rollback

- Antes/después: 27 referencias de entrenamiento, perfiles/cuentas estables,
  contabilidad/recursos de la compra, operaciones, scopes, funciones/owners/ACL/RLS.
  Las diferencias esperadas deben enumerarse: RPC/código autorizados y, como máximo,
  sesión Portal autorizada y fixture/asignación temporal. No confundirlas con pagos.
- Suscripción, factura, eventos históricos y entrenamiento se conservan íntegros.
  No borrar recibos de una compra real TEST para volver a un snapshot anterior.
- Desactivar acceso temporal inmediatamente; limpiar únicamente UUID propios con
  FK/recibo comprobados. Si es incierto, conservar datos y evidencia, no DELETE amplio.
- Fuga, cambio de rol, proyecto incorrecto, recurso LIVE, factura alterada, generación
  o permiso inesperado: parar sin reintento y sin improvisar correcciones conectadas.
- UI/Edge: restaurar bundle/configuración exactos aprobados antes de retirar la RPC
  de lectura. SQL billing: `billing-test-restore.sql` solo si fue instalado en este
  ensayo y preimagen/ACL coinciden; nunca deshacer conciliación preexistente.
- Reviewer: rollback cerrado, conserva asignaciones/historia; no recuperar acceso
  global. Gate opcional: rollback preserva cuerpo original, con consentimiento
  explícito al modelo previo y pilot scopes cerrados. No resetear consumos.

## Autorizaciones que faltan

1. Aplicar exclusivamente los deltas de staging concretos tras revisar el preflight
   y las preimágenes; despliegue UI/billing separado del scope reviewer/gate opcional.
2. Validación autenticada con las identidades sintéticas nominales y, solo si hace
   falta, tres filas y asignación view temporal de reviewer descritas arriba.
3. Crear una única sesión Portal TEST para la suscripción existente, sin cancelar,
   pagar ni cambiar el método. Integración de PR/hosting productivo requiere otra
   decisión humana; este plan no autoriza merge ni lanzamiento LIVE.
