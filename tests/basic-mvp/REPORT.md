# Candidata MVP Basic — informe consolidado

05/11/2026 · **APTO PARA VALIDACIÓN CONECTADA DE BASIC**.

La candidata permite comenzar una aceptación autenticada de lectura tras autorizar
su publicación y despliegue staging. No certifica disponibilidad comercial ni
producción. La generación Basic, reviewer y Premium siguen cerrados; vender una
oferta que dependa de ellos requiere cerrar sus pruebas y decisiones pendientes.

## 1. Candidata, procedencia y alcance

Rama local: `codex/basic-mvp-release-candidate-20261105`.
Worktree aislado: `.worktrees/basic-mvp-release-candidate-20261105`.
Base exacta: `3d4dba7baa7f272d13ed0ff3ce44a719414824da`.
Main remoto leído: `b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`.
El SHA del commit que contiene este informe se obtiene con `git rev-parse HEAD`;
queda también registrado después del commit en `results/CHECKPOINT.json` local,
junto con el diff y estado final. No hay push ni PR nueva.

El delta propio contiene 26 archivos (producto/build, contratos, pruebas e informes).
La composición completa frente a main contiene 169 archivos: incluye el trabajo
ya aprobado de las PR y no debe confundirse con 169 cambios nuevos de esta misión.

Se conservaron los worktrees anteriores. La composición aprobada ya incorporaba
retorno #5, tema #8, backend #7, suscripción #6, Coach reconciliado y hosting.
No se añadieron parches experimentales posteriores de chat Premium. Sus 1.330
pruebas históricas no se suman a esta ejecución.

Lecturas externas limitadas a referencias públicas/documentación: las seis PR
siguen abiertas; #5 no es draft y #1/#2/#6/#7/#8 sí. La página productiva respondió
HTTP200 (HTML UTF-8 SHA256
`76470ca106c252db7ddac37a51bf96d79c897346a848d5396145105ace34ccbf`).
Eso no certifica una sesión productiva ni identifica por sí solo el commit de
cada recurso servido. No se autenticó ni modificó ningún entorno conectado.

## 2. Cambios funcionales y defectos corregidos

| Cambio | Causa y resultado verificable |
|---|---|
| Acción de suscripción por rol | Se mostraba a entrenadores aunque no funcionaba. Ahora solo aparece al cliente, sigue la identidad de la aplicación y se cierra al salir |
| Identidad tras leer capabilities | Un cambio de cuenta durante esa espera podía presentar la respuesta de la cuenta anterior. Se verifica otra vez el usuario antes de renderizar |
| Compra incierta por propietario | El booleano compartido contaminaba otra identidad y podía perderse al volver. Se marca antes del envío y conserva en memoria por propietario, incluso al cerrar/reabrir la vista; solo la conciliación confirmada de esa cuenta la retira |
| Retorno con sesión existente | El formulario seguía visible aunque el usuario estuviera autenticado. Ahora refleja la sesión verificada, ofrece cierre local y limpia sus controles |
| Volver desde la caché de navegación | La vista destruida al salir se vuelve a montar y autenticar al restaurarse por BFCache |
| Perfil de validación | El build habitual cerraba la interfaz comercial. Se añade un perfil explícito de staging de solo lectura, sin cambiar el perfil habitual ni los derechos del servidor |

El estado de incertidumbre solo vive durante la página; no se persisten claves,
tokens ni nuevas credenciales. Tras recarga completa/nueva pestaña la idempotencia
y el estado autoritativo siguen perteneciendo al backend. No se promete que un Set
de frontend sea un bloqueo distribuido. Los cambios mantienen el contrato económico
y no crean operaciones, Customers ni nuevos derechos.

Producto: cuatro archivos `assets/subscription*.js/css` y tres referencias de
caché en `index.html`. Build: `scripts/hosting-build.cjs` exporta su detector de
secretos existente; `hosting-commercial-build.cjs` añade el perfil acotado.
Arnés: `tests/coach-flow/contracts.cjs` conserva inventario y fuentes protegidas,
aceptando solo las cuatro nuevas huellas de suscripción y tres referencias HTML
exactas. No se relajó la comprobación general.

## 3. Experiencia cliente y entrenador

Chromium/Edge 156.0.4314.50 y WebKit locales, SDK y respuestas sintéticos,
sin tráfico a servicios. Entrenamiento/roles: 320, 390 y 1280 px, claro/oscuro.
Suscripción histórica: 320, 360, 390, 430 y 1280; nuevos escenarios de identidad
y retorno en ambos motores. Artefacto final: 320/1280, ambos temas.

Se comprobó login/logout, rol del perfil frente a metadata, cambio entre tres
clientes, separación plantilla/asignación, vista de días, edición del entrenador,
ausencia de «Ver sesión» en atleta, un botón final para guardar, historial y
conservación de notas/prescripciones. La navegación no mezcla sesiones de usuarios.
Preferencia de tema tras recarga, mensajes, estados de carga/error, nombres de
controles y ausencia de desbordamiento pasaron. Capturas sintéticas móviles y de
retorno revisadas; no constituye una auditoría WCAG exhaustiva ni prueba de Safari
en iPhone físico.

El recorrido Coach Basic existente pasó recuperación incierta, recarga completa,
revisión humana simulada, aceptación y entrenamiento, manteniendo consentimientos,
gate y separación de identidades. Ninguna de esas acciones ocurrió en Supabase.

## 4. Mi suscripción y retorno HTTPS

Se comprobaron sin suscripción, activa, pago pendiente/fallido, cancelación al
final del periodo, periodo expirado, revisión requerida, red caída, 401, respuesta
tardía y cambio de identidad. La UI solo presenta derechos validados del servidor;
un parámetro `plan`/`paid`/`session_id` en la URL no concede acceso.

El contrato Portal se comprueba mediante dobles con origen oficial permitido;
no se abrió un Portal real ni se repitió la compra TEST histórica. La vuelta al
mismo origen conserva la sesión del SDK, vuelve a consultar al servidor y limpia
parámetros/fragmentos. La página nueva incluye logout local. Un fallo de red no
se trata como prueba de ausencia de suscripción.

El artefacto de aceptación oculta y bloquea Checkout, Portal y reconcile: solo
status/capabilities. Este perfil permite validar la compra existente sin ejecutar
una nueva acción económica. No habilita generación aunque Basic esté activo.

## 5. Pruebas ejecutadas en esta misión

**1.372 casos/comprobaciones distintos, todos superados: 298 nuevos y 1.074
regresiones reutilizadas ejecutadas ahora.** Además, 54 comprobaciones de sintaxis.
Los casos parametrizados por motor/tamaño/tema se identifican separadamente; no se
cuentan invocaciones, wrappers ni reejecuciones como casos nuevos.

| Suite / evidencia local | Nuevos | Reutilizados | Resultado |
|---|---:|---:|---:|
| `scripts/ci-offline.cjs`, 24 suites | 0 | 539 | 539/539 |
| PostgreSQL billing/install | 0 | 24 | 24/24 |
| PostgreSQL Basic/comercial/seguridad/concurrencia | 0 | 89 | 89/89 |
| `training-browser.cjs` | 156 | 0 | 156/156 |
| `tests/client-routine/browser.cjs` | 0 | 116 | 116/116 |
| `tests/coach-flow/recovery.cjs` | 0 | 111 | 111/111 |
| `tests/coach-flow/journey.cjs` | 0 | 40 | 40/40 |
| `tests/coach-flow/reload-uncertain.cjs` | 0 | 20 | 20/20 |
| `edge-v36-reconciliation.test.mjs` | 0 | 17 | 17/17 |
| `tests/coach-flow/contracts.cjs` | 0 | 21 | 21/21 |
| `subscription-unit.cjs` | 12 | 0 | 12/12 |
| `subscription-browser.cjs` | 64 | 0 | 64/64 |
| `tests/subscription/browser.cjs` | 0 | 72 | 72/72 |
| Hosting: contratos/reproducibilidad/artefacto navegador | 33 | 0 | 12+13+8 |
| Preparación aceptación + coordinador revocación | 33 | 0 | 21+12 |
| Acuses IPC históricos | 0 | 25 | 25/25 |

Las 38 unitarias históricas de suscripción y 23 de build comercial ya forman parte
de las 539 de CI. La comprobación Edge que contiene 20 assertions se cuenta como
20, sin añadir su wrapper Node. El control de fuentes de los tres RPC es evidencia
adicional, no tres casos inflados. `TEST-RESULTS.json` conserva el desglose saneado.

Las 72 regresiones de suscripción se ejecutaron antes del último ajuste del Set;
la fuente final volvió a pasar sus 12 unitarias nuevas, 64 checks de navegador y
38 unitarias previas. BFCache se ejercita con eventos `persisted`, no se afirma
una restauración natural certificada en todos los navegadores.

Node 24.19.0. PostgreSQL 17.11 en un cluster desechable nuevo, escuchando solo en
127.0.0.1:55449, detenido al finalizar. Se comprobaron RLS, ACL, ownership, gates,
idempotencia, reserva concurrente, revocación/caducidad local y rollback cerrado.
Los claims SQL simulados no son JWT reales. No se ejecutó ninguna batería Premium
adicional a los controles compartidos ya incluidos en CI.

Incidencias del arnés: restricciones iniciales de escucha/spawn/hardlink exigieron
el procedimiento normal de aprobación local; pasaron sin relajar controles.
Un clic sintético estaba dentro del antirrebote existente de 900 ms: el test ahora
espera su liberación. Los pins de fuentes anteriores rechazaron correctamente el
delta nuevo; se actualizaron exclusivamente sus valores explícitos revisados.
La CI histórica regenera un inventario versionado: se restauró al HEAD original y
los inventarios nuevos se guardan en este directorio. No se modificó automatización.
La revisión final detectó un falso negativo del validador de aceptación: Pages
puede normalizar el retorno a `/billing-test`. Se admiten exclusivamente esa ruta
y `/billing-test.html`, con el mismo origen HTTPS, sin parámetros ni subrutas;
dos regresiones nuevas verifican aceptación exacta y rechazo de variantes.

Logs y capturas quedan en directorios `results/` ignorados; no se añaden volcados
ni credenciales. Los cambios funcionales finales, no artefactos intermedios,
superaron la CI, los contratos y el navegador del artefacto final.

## 6. Seguridad conservada

| RPC protegido | MD5 del cuerpo aprobado y comprobado localmente |
|---|---|
| `review_coach_proposal` | `d94b96ae65e69997a37ae83b521ec16b` |
| `authorize_coach_retry` | `cdf6200bb140563a96ddc472cc0ac9b7` |
| `premium_initial_review` | `c16541b25d191997fce42c2024784c7d` |

Sin delta en `supabase/`, los módulos Coach/Premium, configuración de backend,
orígenes, catálogo, V5, modelos, guard de coste, quotas o workflows. Se conservan
rollback y control de instalación de RPC. No reinstalar migraciones históricas:
algunas contienen definiciones anteriores por trazabilidad y no son un procedimiento
de actualización válido de un entorno ya configurado.

Gate Basic, reviewer, Premium, consentimiento y revisión humana se verifican en
contratos y PostgreSQL local. Su estado efectivo conectado deberá volver a leerse
antes de aceptar staging; no se presenta como una nueva verificación externa.

## 7. Artefacto reproducible

Dos directorios de entrada independientes y dos procesos por perfil, mismos bytes
en cada salida. Inventario completo: `HOSTING-INVENTORY.json`.

| Perfil | Archivos | SHA256 del inventario ordenado |
|---|---:|---|
| Basic staging de lectura | 41 | `eac9efa2a80542f595c7f192f771df45939f4ae7e9d0e6ea1ac05cef6ca8b266` |
| Staging habitual cerrado | 43 | `347f222373b1e4db6103ef1d3258d0de801a07efcb57027af385280fcec7951a` |
| GitHub Pages cerrado | 39 | `7fa0f0ad025134d8f8e8781366ac3af298f0d19528b7c6a71913b44b0556b488` |

Artefacto local elegido:
`results/basic-hosting-7rb9j0/basic-validation-A/dist`.
Su copia B es idéntica. Los hashes de fuentes y bytes de cada fichero están
incluidos; no son un deployment ID ni un hash de una publicación real.

`--basic-validation` exige preview y origen exacto HTTPS staging; runtime inmutable,
backend Security Test, rutas permitidas y fallo cerrado en otro origen. El perfil
por defecto permanece cerrado. No hay activación por querystring o variables
ambientales sin elegir explícitamente el perfil. Retorno con CSP aplicada,
no-referrer/no-store, recursos revalidables, allowlist y análisis de secretos.
La CSP principal sigue siendo Report-Only por los scripts inline históricos;
GitHub Pages no aplica `_headers` como Cloudflare. CDN y estas diferencias siguen
siendo límites conocidos, no se certifican como endurecimiento resuelto.

## 8. Validación conectada preparada, no ejecutada

`VALIDATION.md` y `acceptance.cjs` especifican proyecto único, `mock` Basic y `real`
sin suscripción, seis lecturas permitidas, proyecciones, REST/RPC entre identidades,
precio 499 EUR céntimos, periodo vigente, gate/Premium cerrados y comprobación de
las 27 referencias y cinco huellas billing antes/después. El CLI solo admite dry-run.

Máximo dos logins futuros en contextos efímeros separados; la UI mantiene su
contrato de sesión persistida en ese contexto. No exportar perfiles/storageState,
JWT ni HAR. Cualquier lector separado reutiliza el token solo en memoria; no añade
login ni refresh. Logout local y destrucción de contextos al cerrar. Detenerse si
el periodo TEST expiró; no renovar para hacer pasar el caso positivo.

La denegación conectada de generación se comprobará por capacidades y UI, sin
invocar reservas ni Edge de generación: la denegación de reserva se demostró
localmente. Retorno directo HTTPS sin comprar ni crear Portal. Ninguna prueba
autenticada real se ha ejecutado durante esta misión.

## 9. Revocación con el mismo JWT, independiente

Se recuperó el protocolo documentado y módulo IPC de la auditoría previa, no un
script privado adicional de Work. Los 25 casos IPC se reutilizan byte por byte.
La secuencia preparada requiere una sesión `trainer`, cuatro filas nuevas exactas
(consentimiento/intake/operación/asignación view), excepción de reviewer_config
máximo 60 minutos por reloj SQL y cierre/restauración exactos.

Primera lectura HTTP200 con A; revocación de la asignación confirmada por COMMIT;
segunda lectura HTTP200 `[]` con **la misma cadena JWT vigente**, admisión y
consentimiento todavía válidos. Solo después cerrar admisión y limpiar por UUID.
Una denegación por token o configuración caducada no demuestra revocación.
Acuses atómicos vinculados a fase/plan/run/plazo; cierre seguro independiente del
éxito de IPC. No se repiten las 34 comprobaciones históricas.

Esta prueba no bloquea la consulta comercial con reviewer cerrado; sí bloquea
declarar validada su activación. Requiere autorización nueva, no se ejecutó.

## 10. Integración y publicación posterior

Las referencias remotas leídas son #5 `fc245c9`, #8 `1d1e443`, #7 `b2a7636`,
#6 `313344d`, #2 `49ef741d`, #1 `81fe65f4`. Revalidarlas antes de publicar.
La candidata ya compone sus contenidos; no volver a aplicar PR completas a ciegas.

1. Revisar y publicar el SHA Basic autorizado en una rama de revisión, después
   de comprobar controles actuales de GitHub y ambos proyectos Cloudflare.
   No sustituir una PR parcial por toda la composición.
2. Orden de dependencias de contenido: #5 retorno → #8 tema → #7 backend seguro
   → #6 interfaz → delta #2 Coach → delta #1 hosting → delta Basic de esta misión.
   Conservar la unión de CI y los tres cuerpos protegidos. La documentación no es
   autorización de merge.
3. Con autorización separada, instalar solo el artefacto de lectura en staging.
   Antes, comparar bundles y contratos efectivos Edge. `billing-test` v7, webhook
   v5 y Coach v36 son antecedentes, no lecturas actuales. Si sus contratos/huellas
   ya coinciden, esta candidata no necesita redeploy Edge ni SQL.
4. No repetir A/B ni parches de denegación instalados. Cualquier diferencia real
   exige un delta revisado y una nueva autorización; no sustituir funciones por
   una versión antigua para conseguir coincidencia.
5. Ejecutar aceptación de lectura; realizar revocación por separado. No abrir
   gates ni vender prestaciones aún cerradas como consecuencia del despliegue.

La CI versionada solo prueba en `pull_request`/`workflow_dispatch`; no despliega.
Un merge a main puede publicar GitHub Pages por configuración externa. Cloudflare
tiene reglas de rama/autodeploy fuera del repositorio que deben verificarse de
nuevo; no se consultaron ni modificaron aquí. Ningún push es seguro por suposición.

Rollback futuro: conservar deployment/artefacto anterior completo, restaurar
solo frontend si falla la aceptación, verificar HTTPS, backend, recursos y cierre
comercial. No revertir datos, suscripción, cuotas ni SQL al revertir el frontend.
El perfil cerrado se construye y verifica independientemente.

## 11. Preparación comercial, riesgos y bloqueos

No se han identificado nuevos P0/P1 en el alcance local corregido. Esto no equivale
a demostrar ausencia de defectos conectados o readiness LIVE.

- **Bloqueantes de validación:** publicar/desplegar esta candidata con autorización,
  repetir el preflight conectado y contrastar UI con JWT reales y compra vigente.
- **Bloqueante de activación reviewer:** revocación real con el token original;
  no resuelto por las pruebas locales.
- **Bloqueantes para vender Basic:** prestaciones y generaciones incluidas, límites,
  revisión/soporte humanos, precio/periodo final, cancelación/reembolso, identidad
  contractual, privacidad/conservación/proveedores, fiscalidad/IVA y Stripe LIVE.
  Propietario y asesores deben decidirlo; 4,99 EUR TEST no resuelve LIVE.
- **Límites técnicos conocidos:** CI/browser local con dobles, no OAuth real,
  backend remoto no releído, CSP principal Report-Only, recursos CDN, autorización
  y publicación separadas. Premium experimental queda fuera.

La fecha 30/11 depende de esos cierres. No hay compra, Portal nuevo, Auth real,
SQL remoto, deploy, generación OpenAI, gasto nuevo ni modificación externa.

## 12. Tres siguientes autorizaciones

1. **Publicación de código:** autorizar exclusivamente el SHA local resultante a
   una rama de revisión acordada, tras confirmar ausencia de autodeploy. Sin merge,
   SQL, despliegue ni cambios en PR parciales por inferencia.
2. **Staging y aceptación de lectura:** autorizar el artefacto con SHA arriba,
   preflight conectado de lectura, como máximo las dos sesiones sintéticas
   previstas y su recorrido UI en contextos efímeros. Sin compra/Portal,
   renovaciones, generación, SQL ni cambios Auth/CORS/Secrets.
3. **Revocación JWT independiente:** autorizar la única sesión, cuatro fixtures
   exactas, excepción temporal acotada de reviewer_config, revocación y restauración
   descritas en `VALIDATION.md`, tras revisar el SQL concreto. Sin aprobación,
   aceptación, generación ni ampliación comercial.

La autorización de producción, LIVE y activación de prestaciones queda para una
fase posterior; ninguna de las tres decisiones anteriores la concede.
