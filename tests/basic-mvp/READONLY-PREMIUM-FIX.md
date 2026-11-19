# Basic de solo lectura: contención de consultas Premium

6 de noviembre de 2026 · **APTO PARA REVISIÓN INDEPENDIENTE**.

Cambio exclusivamente local sobre `8086008c9017a59e21d5464b27b1a9186ff0aa92`,
en `codex/basic-readonly-premium-guard-20261106`. No se publicó, desplegó,
autenticó una cuenta real ni consultó SQL conectado. El worktree anterior y sus
recibos se conservaron. El SHA del único commit de esta entrega queda en
`results/readonly-final-checkpoint.json` y en `git rev-parse HEAD`.

## Evidencia y causa

Se leyó el informe privado de aceptación del 06/11: 42 comprobaciones pasaron,
pero el filtro interceptó tres intentos de `premium_initial_my_state`. No se
recuentan esas comprobaciones como pruebas nuevas. Por lectura HTTP pública se
confirmó que `assets/coach.js` de staging seguía coincidiendo con `8086008`
(SHA-256 LF `00f1edda86e420e1e6c7f94fef10f04c53513b28d2557992bbcc9590667f377f`)
y que el runtime tenía `billingValidationReadOnly=true`. No se consultó el panel
Cloudflare; el ID `03c5e1c5-f8b1-4274-bbbc-aca6c2eb936e` procede del recibo anterior.

`renderCoachHome()` interpretaba la existencia del componente `PremiumInitial`
como motivo suficiente para consultar su estado. El nombre de la RPC inducía a
considerarla lectura, pero su cuerpo puede marcar operaciones caducadas como
`failed` y propuestas como `stale`. Lo hace antes de calcular la admisión Premium.

Reproducción sobre los bytes originales obtenidos de Git, sin modificar el
worktree original: dos casos VM y ocho aserciones de navegador en cuatro
combinaciones Chromium/WebKit × 390/1280. Cada combinación observó dos entradas
al SDK para esa RPC al iniciar sesión. Los transportes eran sintéticos.

## Corrección y límites

- `assets/coach.js`: comprueba el flag exacto antes de construir `db.rpc(...)`.
  Mantiene las consultas Basic y `premium_my_access`, que no escriben. En este
  perfil no muestra la entrada al seguimiento Premium ni permite abrirlo.
- `assets/coach-premium-initial.js`: `open()` y `mount()` terminan antes de crear
  el adaptador, suscribir Auth o iniciar la consulta de estado.
- `assets/coach-premium-initial-adapter.js`: impide iniciar este flujo en el
  perfil de validación, incluso si un llamador conserva el adaptador. Comprueba
  antes y después de esperar Auth, y justo antes de construir una RPC o envío
  Edge. No sustituye la consulta por otra RPC.
- `index.html`: actualiza únicamente las tres referencias de caché de esos JS.

La configuración generada es inmutable. La comprobación se evalúa en cada
entrada, no se captura antes de las esperas. Las respuestas tardías no pueden
activar la RPC en el perfil de lectura. Un flag ausente o `false` conserva el
flujo normal; la admisión inicial sigue siendo independiente de la admisión al
seguimiento. Los derechos, identidad, cuotas, permisos y revisión humana siguen
perteneciendo al servidor. Este flag no protege contra un cliente malicioso ni
convierte toda la aplicación de entrenamiento en una base de datos de solo lectura.

No cambia V5, consentimiento, prescripción, lógica de generación, idempotencia,
facturación, checkpoints A/B, permisos, Edge ni SQL. La salida temprana del flujo
Premium es contención de interfaz en este perfil, no un permiso de seguridad.

## Pruebas efectivamente ejecutadas

No hay JWT reales, fixtures remotas, pagos ni llamadas a proveedores. Los nombres
mock/real del arnés representan actores inventados, sin reutilizar sus UUID o
credenciales conectadas. Los contadores se incrementan al entrar en `rpc()`,
antes de cualquier transporte: cero no significa peticiones rechazadas por red.

| Batería | Resultado de esta ejecución |
|---|---:|
| Nuevos casos VM: guard, demoras, cambio de identidad, cierre y compatibilidad | 17/17 |
| Nuevo recorrido completo Chromium/WebKit, 390 y 1280 | 84/84 |
| Nueva restauración BFCache real Chromium, 390 y 1280 | 2/2 |
| Reproducción previa, separada de la solución | 2 VM + 8 aserciones navegador |
| CI offline existente | 24/24 suites, 513 casos/aserciones, 54 comprobaciones sintácticas |
| Contratos de fuentes Coach | 21/21 |
| Build de validación y unidad de suscripción | 24/24 |
| Navegador de suscripción existente | 64/64 |
| Entrenamiento e identidad existentes | 156/156 |
| Artefacto real con SDK sintético, claro/oscuro, 320/1280, ambos motores | 8/8 combinaciones |
| Reproducibilidad: tres perfiles, dos raíces/procesos por perfil | 13/13 |
| Recuperación Coach/contexto existente | 54/54 |
| Límites entre flujos Coach existentes | 44/44 |
| Adaptador Premium inicial normal | 25/25 |
| Recorrido Premium inicial normal | 879/879 |

Son **103 nuevas comprobaciones positivas**, además de la reproducción previa.
Las reejecuciones por ajustes del arnés o restricciones de ejecución no se suman.
Los recuentos de suites históricas se muestran como ejecuciones actuales de sus
aserciones, no como nuevas pruebas ni una certificación conectada.

El recorrido incluye Basic activo, ausencia de suscripción, Mi suscripción,
entrar/salir de Coach, login/logout, sustitución de identidad, recarga, sesión
caducada, componentes Premium presentes, admisión de seguimiento inesperadamente
positiva y respuestas tardías. Cero invocaciones de `premium_initial_my_state`
en todos los casos del perfil corregido. El artefacto tampoco invoca
`premium_chat_load`. Las lecturas Basic siguen funcionando.

### BFCache y diagnóstico de los arneses

En Chromium se observó `pageshow` nativo con `isTrusted=true`, `persisted=true`,
el mismo documento/heap y lecturas Basic posteriores. Se retiró únicamente el
argumento de lanzamiento de Playwright que desactiva BFCache para este diagnóstico
local. Esto no altera un navegador del usuario ni mecanismos de seguridad.

En WebKit 26.5/Windows el ensayo de Atrás recargó la página y no produjo una
restauración BFCache acreditable. Sus eventos persistidos sí se probaron de forma
simulada en la matriz de 84. **BFCache real WebKit permanece sin verificar**, no
se convierte un timeout en PASS. El arnés conserva `--probe-webkit` como diagnóstico
estricto. [Playwright documenta que BFCache está desactivado por defecto y que su
restauración no está soportada por su seguimiento de navegación](https://playwright.dev/docs/navigations#backforward-cache-bfcache).
Las dos observaciones de Chromium son evidencia local acotada, no garantía para
todas las versiones de Safari/Chrome.

El arnés histórico de Premium utilizaba `/app` en 4263, ruta no reconocida por
el runtime reconciliado. Se corrigió solo su servidor de preview para servir una
configuración **sintética** explícita a todas sus pestañas. No se ampliaron los
orígenes del producto. Tras ese ajuste, la batería normal completó 879/879.
El primer CI se detuvo por EACCES del entorno en loopback; la ejecución local
autorizada con acceso a loopback completó las 24 suites. No fue un defecto backend.

## Inventario de RPC y efectos secundarios

Auditoría estática del candidato y las fuentes históricas conservadas. No es una
nueva lectura de definiciones remotas ni una auditoría exhaustiva de todo Supabase.

| Ruta | Efectos y riesgo | Resultado |
|---|---|---|
| Inicio → `premium_initial_my_state` | **P1** en aceptación readonly: bloqueo de propietario y UPDATE de operaciones antes de comprobar admisión inicial | Corregido antes de llamar al SDK y en las entradas iniciales |
| Seguimiento → Chat → `premium_chat_load` | **P1 si se trata como lectura**: llama a `premium_chat_expire`, que reconcilia mensajes vencidos y reservas/contabilidad; no es un SELECT puro | Se impide abrir seguimiento en este perfil; servidor intacto |
| `premium_my_access` | Proyección STABLE; lecturas de derechos y rutinas, sin escritura en el cuerpo y dependencias examinados | Conservada; no autoriza el flujo inicial por sí sola |
| `get_my_coach_access` + gate Basic | Proyección STABLE de acceso original y capabilities comerciales | Conservada; generación cerrada por servidor |
| `get_coach_reviewer_access`, `premium_initial_review_queue`, `premium_reviewer_state` | Proyecciones de lectura sujetas al scope; la consulta no crea asignaciones ni decide revisiones | Sin cambio; no se amplían permisos ni se prueba positivamente reviewer conectado |
| `get_client_routine_structure`, `get_client_routine_statistics_stage` | SELECT de estructura/etapa con comprobación de identidad; los resets son RPC separadas | Conservadas, junto con las lecturas de ciclo/historial/notas |
| `billing-test:status`, `access`, `billing_test_capabilities`, `billing_test_my_access`, `billing_test_read_customer` | Lectura SQL y GET a Stripe para el estado; no crean Customer/lease ni conceden derechos por retorno | Sin cambios |
| `reconcile`, `portal`, `checkout`; reserve/claim/finish; permisos, guardados, aceptación y revisión | Mutaciones explícitas. No deben confundirse con carga de estado | No invocadas en el perfil probado; implementación intacta |

Las fuentes relevantes son `supabase/migrations/20261011154036_coach_premium_initial.sql`,
`20261004161206_coach_premium_chat.sql`, `20261004220122_coach_premium_upgrade.sql`,
los parches financieros posteriores, `supabase/coach-reviewer-scope.sql`,
`supabase/billing-test-coach-gate.sql`, `supabase/billing-test-commercial.sql`,
`tests/billing-test/fixtures/schema-original.sql` y `_shared/billing-test-status.mjs`.
La instantánea de facturación es evidencia histórica, no una migración a ejecutar.

### Propuesta backend separada, no implementada

Separar una proyección pura de estado inicial/Chat de la conciliación mutadora,
con nombre y contrato explícitos para esta última. Conservar auditoría, bloqueo,
caducidad, contabilidad, revocación e idempotencia, y probar permisos con JWT antes
de instalar cambios. Mover un UPDATE después de una condición o marcar la RPC
STABLE no es por sí solo una corrección suficiente: podría dejar operaciones o
reservas sin conciliar. No se ha demostrado aquí una nueva lectura entre usuarios;
el defecto confirmado es ejecutar reconciliación como efecto de una vista readonly.

## Fuentes protegidas y artefacto

Todos los archivos `supabase/` permanecen idénticos a `8086008`. El comprobador
local de fuentes/orden de instalación y CI conservan estos MD5 de los cuerpos:

| RPC | MD5 |
|---|---|
| `review_coach_proposal` | `d94b96ae65e69997a37ae83b521ec16b` |
| `authorize_coach_retry` | `cdf6200bb140563a96ddc472cc0ac9b7` |
| `premium_initial_review` | `c16541b25d191997fce42c2024784c7d` |

Nuevo inventario [READONLY-PREMIUM-INVENTORY.json](READONLY-PREMIUM-INVENTORY.json).
El inventario histórico `HOSTING-INVENTORY.json` se conserva con sus resultados
anteriores. El nuevo artefacto Basic contiene 41 archivos. Solo difieren del
artefacto previo los tres JS de producto indicados y `index.html`.

- SHA-256 del inventario/árbol Basic: `fc35e2be369f2a7e7559602400169896e19bd019e19af9c4dfd4e1b5273525d4`.
- SHA-256 de las entradas de construcción: `66dc5a140dd5a11d12db43ebe21f4b6cc99dde8320c7c769cf006efb2a6c4f99`.
- Dos artefactos independientes dieron idénticos bytes y huellas. Backend/origen
  exactos, runtime congelado, headers y detección de secretos permanecen validados.
- Salida local: `results/basic-hosting-0k8hYE/basic-validation-A/dist/`.
- No se incluyen SQL, scripts, informes, diagnósticos privados ni nuevas claves.

Cambios de prueba: los tres arneses `readonly-*`, la aserción de cero intentos en
`hosting-browser.cjs`, los hashes exactos en `tests/coach-flow/contracts.cjs` y
el runtime sintético de `tests/premium-direct-production/preview.cjs`.
No se modifica ninguna automatización de CI/despliegue.

## Sustitución futura en staging, no ejecutada

1. Revisar el commit local y autorizar por separado su publicación o el despliegue
   del artefacto exacto. Confirmar entonces SHA, worktree, PR #9 y controles
   actuales de Cloudflare. Preservar preimagen e inventario del despliegue activo.
2. Verificar nuevamente los 41 archivos y la huella anterior con dos builds,
   usando `node tests/basic-mvp/hosting-reproducibility.cjs`. Este script reconstruye
   perfiles locales; no publica. Su informe `results/hosting-reproducibility.json`
   identifica la nueva ruta de salida si cambia el directorio temporal.
3. Bajo autorización específica, efectuar un único upload del perfil
   `basic-validation` a `simple-staging-raulchulbi`, rama estable del proyecto
   staging `codex/cloudflare-migration`. No modificar el proyecto productivo,
   autodeploy, SQL, Edge, Auth, cuotas ni secretos. Si hace falta una credencial
   temporal, obtener autorización específica; no reutilizar tokens eliminados.
4. Comparar archivos/headers públicos con el inventario y verificar el runtime.
   Solo después, con autorización independiente de dos sesiones sintéticas,
   repetir aceptación readonly y medir intentos al entrar en el SDK, además del
   filtro de red. Comprobar cierre e integridad 27/27 y facturación como en el
   protocolo previo; cero generación, reviewer, pagos o Portal.
5. Ante regresión, suspender la validación y aplicar únicamente el rollback de
   frontend previamente autorizado. Restaurar `8086008` devolvería también el
   defecto conocido: no reabrir la aceptación autenticada sobre ese artefacto.
   No restaurar SQL, permisos ni datos para resolver un fallo de frontend.

Pendientes: revisión independiente, BFCache real Safari/WebKit, publicación y
aceptación conectada del nuevo artefacto. No se afirma que el staging haya cambiado,
que sus 27 referencias se hayan vuelto a medir, ni que la revocación reviewer o
la preparación comercial LIVE estén resueltas.
