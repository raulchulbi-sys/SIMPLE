# Aceptación conectada de Basic — preparada, no ejecutada

Fecha de preparación: 05/11/2026. Esta fase es independiente del desarrollo local.
No autoriza sesiones, SQL conectado, publicación, compras, Portal ni generación.
El Portal TEST vigente ya fue validado históricamente; no se repite.

## 1. Recorrido de aceptación de lectura

**Proyecto único** `dmqjexigdnfzobarhnib`, origen
`https://simple-staging-raulchulbi.pages.dev`, compra TEST existente de `mock`.
Segunda identidad: `real`, sin suscripción. Resolver ambos UUID/roles privadamente
en el manifiesto existente y contrastarlos con el backend antes de autenticar.
Este documento y sus scripts no contienen ni abren el manifiesto.

### Preflight y autorización separada

1. Autorizar lectura de configuración/catálogo/SQL de staging y de Stripe TEST,
   más como máximo dos sesiones Auth, una de cada identidad anterior, y su uso
   por la UI real en dos contextos de navegador efímeros y aislados. La UI conserva
   su sesión en el almacenamiento del contexto; esa persistencia de aplicación
   debe estar incluida en la futura autorización. No exportar el perfil ni
   storageState. No dar por vigente un token ni por activa la compra a partir
   del informe histórico.
2. Confirmar proyecto y `livemode=false`, bundle efectivo y JWT de las Edge, los
   tres RPC protegidos, checkpoints A/B y gate/reviewer/Premium cerrados. Contrastar
   las 27 referencias de entrenamiento, las cinco huellas billing y las funciones,
   owners, ACL, RLS y datos de la compra antes/después. No reinstalar SQL.
3. La factura y su periodo deben acreditar Basic activo hoy. Si ya expiró, hay
   hold, discrepancia o pago fallido, detener el caso positivo y conservar el estado.
   No renovar ni modificar la compra para obtener un PASS.
4. Publicar previamente y con otra autorización el artefacto staging Basic validado.
   Debe proceder del commit y manifiesto acordados, tener `billingTest=true` y
   `billingValidationReadOnly=true` inmutables, backend/origen staging exactos,
   recursos y CSP revisados. Ninguna URL puede habilitar el modo comercial.
5. Los seis contratos de lectura exactos figuran en `acceptance.cjs`. El CLI solo
   imprime el plan con `--dry-run`; no tiene modo conectado ni carga credenciales.
   Rechaza otros argumentos. El operador usa el cliente SDK de la sesión que ya
   inició en la UI para esas lecturas, pasando al validador resultados en memoria.
   Si se necesita un lector separado, reutiliza el access JWT vigente de esa misma
   sesión solo en memoria, sin otro login y sin `setSession`, que podría renovar
   el token. El lector separado usa `persistSession=false`, `autoRefreshToken=false`
   y `detectSessionInUrl=false`; estas opciones no describen la UI de producto.
6. Interceptar en el navegador las acciones Checkout, Portal, reconcile, cualquier
   Edge de generación y todo método de escritura REST. No pulsar «Comprobar pago».
   Guardar únicamente checks/estado/hash no sensible; sin HAR, storageState, vídeo
   de login, URLs temporales, cuerpos privados, contraseñas, JWT o refresh tokens.

### Ejecución prevista

| Paso | Lectura o comprobación exacta | Criterio |
|---|---|---|
| Login Basic | Un login manual `mock` en un contexto efímero de navegador | Perfil client y UUID esperado; sesión de la UI en almacenamiento aislado, sin exportarlo |
| Estado | Edge `billing-test` `{action:"status"}` | TEST, Basic, 499 céntimos EUR, `accessActive=true`, periodo pagado futuro |
| Derecho | Edge `{action:"access"}` y RPC `billing_test_my_access()` | Mismo resultado y periodo; sin Customer, factura o URL privada en proyección |
| Gate | RPC `billing_test_capabilities()` + `get_my_coach_access()` | Basic activo; `basicGenerationEnabled=false`, `can_generate=false`, `quotasChanged=false`, revisión humana |
| Premium | RPC `premium_my_access()` | `enabled=false`; sin habilitación o generación |
| Interfaz | Ajustes → Mi suscripción en desktop y móvil | Precio/estado/periodo coinciden con servidor; texto de generación cerrada; no acciones económicas en modo lectura |
| Otra identidad | Un login `real` en el segundo contexto efímero, mismas seis lecturas | Sin derecho Basic/Premium ni datos comerciales de `mock`; no inferir inactividad de un error de red |
| Aislamiento REST | SELECT de columnas `user_id` en `billing_test.customers`, `subscriptions`, `invoices`, `checkouts`, filtro por el otro UUID sintético | HTTP200 `[]`, o error explícito de permiso/schema no expuesto; 401/caducidad/timeout/500 no son PASS |
| Aislamiento RPC | `billing_test_read_customer(p_user=otro)` con JWT sintético | Denegación EXECUTE; cero proyección privada; no ejecutar RPC de mutación |
| Retorno | Navegar a `/billing-test.html` por HTTPS, sin crear Portal; Pages puede normalizarla a `/billing-test` | Admitir solo esas dos rutas exactas, mismo origen, sin query/hash ni subrutas; no-store/CSP y estado verificado; URL no concede derechos |
| Sesión | Abrir retorno y volver dentro del mismo contexto y origen | Sesión restaurada desde el almacenamiento aislado, validada por el servidor; los dos contextos no comparten identidades |
| Cierre | `signOut({scope:"local"})` para cada una de las dos sesiones y comprobar respuesta, después cerrar ambos contextos | Evidencia de cierre y descarte del almacenamiento efímero; no afirmar invalidación inmediata del access JWT |
| Integridad | Repetir las referencias anteriores y contabilidad TEST | Misma compra/filas/configuración. Solo cambios inevitables de Auth documentados |

No llamar a `reserve_basic_generation` ni a `simple-coach-mock` para demostrar el
gate en este recorrido de lectura. La evidencia conectada demuestra capabilities,
lectura y UI cerradas. La denegación de reserva está comprobada en PostgreSQL local;
un ensayo conectado de esa llamada requeriría autorización y barrera independiente
que garantice que una regresión no cree una operación. Distinguir ambas evidencias.

**Configuración real de producto.** `index.html` crea su SDK con
`persistSession=true`, `autoRefreshToken=true`, `detectSessionInUrl=true`.
`subscription-return.js` comparte la sesión del mismo origen y usa
`persistSession=true`, `autoRefreshToken=true`, `detectSessionInUrl=false`.
No se afirma que esas pantallas sean memory-only ni se altera su contrato para
hacer pasar la prueba. Las opciones sin persistencia del plan se aplican solamente
al lector separado opcional, que recibe un access token vigente y no crea sesión.

Verificar margen de vigencia suficiente antes de las lecturas, acotar la duración
y detenerse si se observa refresh, caducidad o pérdida de sesión. No hacer un
tercer login ni `setSession` para recuperarla. La UI puede iniciar renovación por
su configuración normal; el runner de futura aceptación debe interceptar y bloquear
los grant de refresh no autorizados y registrar la comprobación como incompleta.
El token de la sesión existente solo puede reutilizarse en memoria dentro del
proceso aprobado. No exportarlo a logs, herramientas, archivos o otro servicio.

No usar perfiles de navegador con usuarios reales. Incluir logout confirmado y
cierre de los contextos en `finally`, incluso ante fallos; si logout falla, registrar
la incidencia antes de descartar almacenamiento, sin declarar revocación remota.
No modificar Auth para probar expiración. Si hace falta otra sesión, compra, Portal
o permiso, parar esa parte y solicitar autorización independiente. La prueba de
revocación siguiente mantiene su propio JWT fijo y no utiliza la UI persistente.

## 2. Revocación con JWT idéntico — ensayo mínimo independiente

**Procedencia recuperada.** La auditoría local previa conserva el protocolo en
`../unified-independent-audit-20261104/tests/independent-night/REPORT.md`, sección
9.1, y el control `revocation-ack.cjs` con 25 casos históricos. Se reutilizan aquí
el módulo y sus pruebas byte por byte. Se conserva la distinción entre acceso
positivo/aislamiento de las 34 pruebas históricas y la revocación JWT pendiente.
No se afirma haber recuperado ni ejecutado un script privado de Work distinto de
esas evidencias locales. No se han abierto credenciales o filas privadas.

### Autorización nueva necesaria

Una sesión de `trainer`, propietario sintético `real` sin nueva sesión, exactamente
cuatro filas nuevas (consentimiento, intake, operación A y asignación `view`), más
una excepción temporal para **solo** `coach_private.reviewer_config()`, con plazo
efectivo PostgreSQL máximo 60 minutos, restauración exacta y limpieza por UUID.
No autorizar `review`, `retry`, aceptación, rutina, revisión, workout, generación,
gate Basic, Premium ni cuotas. Los UUID se fijarán una única vez en un recibo
privado tras autorizar; no se han generado identificadores de fixtures ahora.

### Secuencia que evita el fallo del coordinador

1. Preparar y revisar el SQL final de alta/revocación/restauración/limpieza antes
   de escribir. Capturar definición completa, OID, owner, ACL, atributos y huella
   de reviewer_config. Confirmar cierre, cero asignaciones/operaciones/intakes,
   exclusividad, las 27 referencias, cinco billing y seguridad. Verificar que la
   admisión no abre Premium u otra ruta global a datos ajenos. Si no puede
   demostrarse, no activar. No reutilizar autorización de ensayos anteriores.
2. Comprobar que el directorio local permite publicación atómica de acuses con
   hardlinks. Los archivos se vinculan a proyecto/run/planSHA/desafío/fase/plazo.
   `publish` escribe con exclusión, fsync y enlace inmutable; `consume` ignora
   temporales. No depende de stdout ni de sondeos de salida truncada.
3. Obtener una sesión `trainer`. Capturar la cadena JWT original en memoria,
   desactivar refresh. Preparar una función de consulta HTTP que use siempre esa
   cadena en Authorization. No escribir token ni digest en el recibo.
4. Alta transaccional acotada de cuatro filas y excepción reviewer_config. Preservar
   OID/atributos/ACL, usar `clock_timestamp()` para caducidad efectiva; validar huella
   **temporal** durante la ventana y la original después. Emitir `prepared` solo
   después de COMMIT confirmado. Gate Basic y Premium permanecen apagados.
5. Consulta de cola con JWT original: HTTP200, exactamente A y proyección segura.
   Emitir `visible` con checks, sin respuesta ni UUIDs privados.
6. Revocar **solo** la asignación exacta en una transacción. Confirmar COMMIT y
   `revoked_at`, manteniendo admisión y consentimiento vigentes por reloj SQL.
   Solo entonces emitir/consumir `revoked`. No cerrar reviewer_config todavía.
7. `observeRevocation` realiza la segunda consulta con la misma cadena capturada,
   sin refresh. Exige HTTP200 y `[]`, token/plazo aún vigentes y nueva comprobación
   administrativa posterior de admisión/consentimiento. 403, token vencido,
   admisión cerrada o consentimiento revocado no demuestran esta revocación.
8. Emitir `hidden`. Restaurar inmediatamente la definición original exacta de
   reviewer_config y limpiar las cuatro filas únicamente tras comprobar UUID/FK,
   referencias y ausencia de actividad ajena. No reinstalar A/B ni rollbacks
   históricos. Emitir `restored`, cerrar sesión, `signed_out`, comprobar integridad
   y emitir `final`. Guardar evidencia de resultados, no secretos.

Los estados son `prepared → visible → revoked → hidden → restored → signed_out →
final`. Un acuse inválido, otra ejecución, un refresh o un plazo vencido detiene
la prueba. El cierre/restauración de emergencia se hace por la vía autorizada
preparada aunque el plazo de acuses haya vencido; se registra aparte como
INCOMPLETO. No esperar un acuse para cerrar un permiso inseguro. No realizar un
tercer intento implícito ni repetir las 34 comprobaciones.

`revocation.cjs` es un coordinador de observaciones con callbacks, sin red, Auth,
SQL ni credenciales. No acredita por sí mismo COMMIT, vigencia o identidad JWT.
El futuro operador aporta esas pruebas auténticas y el request de lectura mediante
la integración autorizada. Los tests usan cadenas sintéticas no firmadas y no
constituyen pruebas de autenticación.

## 3. Pruebas locales de preparación ejecutadas

```text
node tests/basic-mvp/acceptance.cjs --dry-run
node --test tests/basic-mvp/acceptance.test.cjs tests/basic-mvp/revocation.test.cjs
node --test tests/basic-mvp/revocation-ack.test.cjs
```

58 casos distintos superados: 21 nuevos de contratos/evidencia de aceptación,
12 nuevos del coordinador de lectura y 25 históricos de acuses reutilizados.
Los dos casos finales de aceptación cubren la ruta limpia de Pages y el rechazo
de prefijos/sufijos/subrutas para evitar un falso negativo sobre el retorno válido.
Una ejecución inicial del caso de hardlink falló con `EPERM` del entorno; se
repitió mediante aprobación normal de ejecución local y los 25 pasaron. No se
relajó la atomicidad ni se cambió el módulo para eludir el fallo. No sumar esa
reejecución como 25 casos adicionales. Cero Auth, SQL conectado o llamadas externas.

## 4. Decisiones del propietario antes de vender Basic

| Decisión pendiente | Responsable / trabajo técnico posterior |
|---|---|
| Precio final, mensualidad e impuestos incluidos/excluidos | Propietario + asesor fiscal; 4,99 € TEST no configura LIVE |
| Prestaciones y número/caducidad de generaciones, límites de uso | Propietario; después cuotas/gate servidor y pruebas. Hoy generación cerrada |
| Quién revisa, capacidad humana, plazos y soporte | Propietario/operación; luego asignación mínima por operación |
| Cancelación, reembolsos, incidencias y acceso al periodo pagado | Propietario + asesor jurídico; reconciliar política y backend |
| Identidad contractual, privacidad, conservación, derechos y proveedores | Propietario + profesionales; no textos ni identidades inventadas |
| Stripe LIVE, fiscalidad/IVA, métodos, webhooks y conciliación de riesgo | Autorización nueva tras validar TEST; configuración y pruebas separadas |
| Despliegue/corte, responsable de rollback y atención a incidencias | Operación + autorización de publicación concreta |

Estos puntos son decisiones pendientes, no asesoramiento jurídico o fiscal ni
certificación legal. No se activan Stripe Tax, LIVE ni servicios nuevos.
