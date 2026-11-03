# Backend comercial TEST — revisión pendiente

Seguimiento 03/11: [revisión de integración y corrección de caducidad](INTEGRATION-REVIEW-20261103.md)
y [plan de staging sin repetir compras](STAGING-VALIDATION-PLAN.md).
Los recuentos siguientes son históricos; el seguimiento separa 15 casos nuevos
de las regresiones reutilizadas y no acredita ningún despliegue conectado.

Base main `b2f77c6`; recuperación selectiva de seis commits comerciales cuyo HEAD
era `f393d29e`. No se incorpora el frontend de esa candidata ni Auth/Cloudflare
de PR #1 ni los cambios de Coach de PR #2. Nada se ha aplicado a Supabase.

## Código existente y delta preparado

`code-comparison.json` compara las fuentes locales con los hashes efectivos de
la evidencia histórica de despliegue del 02/11, no con el número de versión.
El usuario comunica posteriormente billing v6/webhook v5 con esos mismos hashes.
El contrato de precios/recibos, `billing-test-checkout.mjs` y el entrypoint del
webhook coinciden byte a byte. Cambian el entrypoint billing y el runtime para
añadir `status` y la gestión autenticada del Portal; se añade el módulo de estado.
La conciliación de Checkout pagado y el protocolo SQL 1 se conservan.

La evidencia histórica acredita compra Basic TEST, pago, conciliación y derecho
Basic; no acredita una nueva compra en este sprint ni el Portal visual. No se ha
accedido a Stripe/Supabase para repetirla. Los archivos privados y recibos no se
incluyen en esta rama.

## Contratos y dependencias

- Stripe SDK 23.0.0, API/eventos 2026-09-30.endive, Supabase JS 2.115.0.
- Cuenta y precios TEST resueltos en servidor; Basic 499 céntimos/mes y Premium
  1299 céntimos/mes. La UI de la rama B solo ofrece Basic; el contrato existente
  de backend conserva Premium para su futuro ensayo separado. No está validado
  comercialmente ni abierto a usuarios fuera de la allowlist TEST.
- Billing requiere JWT y verifica usuario no anónimo, rol client y allowlist.
  Webhook no exige JWT de Supabase; autentica firma Stripe sobre el cuerpo original,
  timestamp, versión de API y modo TEST antes de leer datos o conciliar.
- CORS permanece limitado a localhost de pruebas y staging HTTPS. `status`
  consulta la proyección SQL con el mismo JWT del usuario. Ni URL de retorno ni
  pago aislado del proveedor conceden derechos. La renovación fallida no inventa
  periodos; la cancelación programada conserva únicamente el periodo pagado.
- Customer Portal exige Customer asociado al propietario y configuración TEST
  con cancelación al final del periodo, facturas y método de pago; cambios de plan
  desactivados. No se guardan URLs efímeras.
- Las listas incompletas o estados incoherentes fallan cerrados. La conciliación
  usa estado actual del proveedor, transacción SQL y lease; no confía en el orden
  de los webhooks. Un envío incierto se concilia antes de permitir otro Checkout.

## SQL preparado y orden futuro

Estos archivos son candidatos revisables, no un instalador comercial de LIVE ni
una migración que deba reaplicarse a ciegas:

1. Capturar esquema/ACL/funciones/filas y código efectivos del entorno autorizado.
   El esquema base de billing debe existir. `tests/billing-test/fixtures/` es
   exclusivamente un adaptador sintético local; nunca instalarlo en Supabase.
2. `billing-test-install.sql` exige preimagen MD5 y atestación de staging y aplica
   la conciliación pagada. Si el MD5 ya es `725010c6affa7bd961af76090115e296`,
   comprobar ACL y omitirla; ese es el estado histórico documentado. No ejecutar
   `billing-test-change.sql` suelto en un entorno conectado.
3. `billing-test-commercial.sql` añade la lectura service-only de Customer para
   `status`. Desplegar el bundle de billing solo tras autorizar este delta y
   conservar el bundle exacto anterior. El webhook mantiene su entrypoint.
4. **Paquetes opcionales sensibles separados:** `billing-test-coach-gate.sql` y
   `coach-reviewer-scope.sql`. No son requisitos para consultar la suscripción ni
   el retorno mínimo. Exigen revisión humana de preimágenes, dependencias y
   asignaciones antes de cualquier instalación autorizada. Crear tablas vacías
   no autoriza asignar reviewer, activar generación ni ampliar cuotas.

La barrera comercial conserva literalmente las funciones previas de reserva y
acceso en `coach_private`, y delega consentimiento, cuota e idempotencia. Su
interruptor queda false; requiere además Basic pagado y revisión humana. No
activa Premium. La asignación reviewer exige operación, propietario, reviewer,
acciones, caducidad, consentimiento vigente y revocación; no basta el reviewer
global. FKs impiden asignaciones cruzadas. Lectura directa privada sigue denegada.

### Bug reproducido y corregido

El RPC de aprobación devolvía la fila completa, incluido el recibo privado,
aunque la cola lo ocultaba. La regresión PostgreSQL falló antes de la corrección.
Ahora devuelve el mismo tipo compuesto con una lista explícita de campos seguros;
los demás son NULL, también futuras columnas. El registro almacenado y el recibo
no se alteran. La UI existente no consume la fila de respuesta: refresca la cola.
No se cambian la decisión humana, el contrato de entrada ni los grants.

## Pruebas ejecutadas en este sprint

| Tipo | Resultado | Alcance real |
|---|---:|---|
| Billing offline reutilizadas | 149/149 | Código real con proveedor/SDK de acceso simulados |
| Estado/Portal offline reutilizadas | 28/28 | Transiciones y propietario, JWT caducado simulado |
| Configuración/imports nuevas | 2/2 | JWT configurado y grafo completo de seis módulos |
| Firma con SDK Stripe real local | 7/7 | Criptografía, cuerpo, duplicados; cero API Stripe |
| PostgreSQL local billing reutilizadas | 24/24 | SQL real, ACL, RLS, leases, concurrencia y rollback |
| PostgreSQL local comercial | 31/31 | 27 anteriores + 4 nuevas: respuesta privada, acceso directo, doble resolución y revocación concurrente |
| Regresiones base de main | 88/88 | Suites existentes preservadas |

La CI ejecuta las 88 base +149+28+2 = **267** pruebas y 44 análisis sintácticos.
Lista cerrada auditada: fixtures en memoria, Node VM con imports fijados,
`fetch` sustituido y fallando ante destinos inesperados, lectura de código público;
sin procesos SQL, SDK descargado, red, Secrets o escrituras persistentes.
El workflow no cambia permisos ni despliega. Criptografía con paquete público y
PostgreSQL quedan fuera de CI, documentados por separado.

```text
node scripts/ci-offline.cjs
node --experimental-vm-modules --test tests/commercial/webhook-crypto.test.mjs
node scripts/commercial-postgres.cjs
```

Para criptografía, preparar previamente el SDK público fijado mediante
`scripts/commercial-test-deps.cjs` (su opción de descarga NO pertenece a CI).
PostgreSQL requiere `SIMPLE_POSTGRES_BIN`, una distribución local 17, y puerto
127.0.0.1:55449 libre. Crea un cluster nuevo bajo `.tests-local`, valida host,
puerto, usuario, base, directorio y marcador antes de alterar fixtures y lo apaga
al terminar. No reutiliza la base histórica. Roles/claims de prueba son adaptadores
SQL: **no equivalen a JWT reales ni a un ensayo conectado**.

## Reversión y dependencias con otras PR

Billing: conservar bundle anterior y usar `billing-test-restore.sql` solamente
si coincide su preimagen/ACL; no borrar facturas, suscripciones ni eventos.
Estado: `rollback-billing-test-commercial.sql` retira solo su RPC nuevo.
Gate: rollback recupera exactamente las funciones previas y mantiene el flag
false; requiere que volver al piloto cerrado siga siendo el modelo autorizado.
Reviewer: rollback deliberadamente cerrado, conserva asignaciones/historia y
deshabilita la revisión; nunca restablecer el acceso global para resolver un fallo.

PR #2 debe revisarse primero para un futuro piloto Basic completo. Sus cambios
de SQL/Edge y este gate necesitan contraste de las funciones efectivas antes de
aplicar wrappers. Esta rama no cambia V5, intake, guard ni Financial P1. PR #1
aporta el ensamblado/configuración HTTPS futuro; no se mezcla aquí. Las tres ramas
del sprint añaden suites al mismo orquestador: conservar la unión de listas al
integrarlas, sin perder las 88 pruebas base.

No está autorizado el despliegue de este paquete ni la activación comercial.
