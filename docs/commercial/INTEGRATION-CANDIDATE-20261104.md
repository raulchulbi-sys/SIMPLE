# Candidata comercial local — 4 de noviembre de 2026

**APTA PARA REVISIÓN LOCAL. No publicada y no lista todavía para producción.**

La rama `codex/commercial-integration-candidate-20261104` reúne el contenido
aprobado de #5, #8, #7 y #6 sobre `main@b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`.
Los HEAD de las seis PR y main se comprobaron en GitHub al comenzar; coincidían
con el encargo. No se cambió ninguna rama remota ni estado de PR.

El worktree raíz tenía cambios históricos: se conservaron sin reset, stash ni
normalización. Todas las escrituras de código de esta misión están en worktrees
nuevos. Se leyeron CONTEXTO-CODEX.md y AGENTS.md; el encargo autoriza expresamente
esta composición aunque las instrucciones ordinarias prefieran una PR por tarea.

## Composición y resultado funcional

| Orden | Fuente exacta | Commit de integración local |
|---|---|---|
| 1 | #5 `fc245c9c91113b1b9db9a28847bcbdfc715c5224` | `70c59af` |
| 2 | #8 `1d1e443147d27a3e55a71aba9c212e30627a7b03` | `f68b12a` |
| 3 | #7 `b2a7636ca000eec838467952f87375067c3574cb` | `e9cc032` |
| 4 | #6 `313344dbc607f2219922f7eb8a9102bc8cde3d53` | `b4ed62dd278c15c9408c2ad9571475515169085f` |

Los merges son exclusivamente locales. Preservan los commits originales y
permiten revisar por separado cada incorporación. El conflicto de contenido en
`scripts/ci-offline.cjs` se resolvió con la unión de suites. Se añadieron las once
regresiones de tema y las 26 de huellas/orden SQL que antes no estaban incluidas
en ese comando. No cambia ningún workflow ni automatización remota.

El producto de la composición conserva exactamente los blobs aprobados de las
cuatro PR: retorno HTTPS reproducible, tema que distingue sessionStorage de
localStorage, backend comercial TEST con seguridad reconciliada y Mi suscripción.
No fue necesario corregir código de producto adicional en esta rama.

Mi suscripción continúa deshabilitada por defecto. Exige `billingTest === true`,
backend exacto de Security Test y perfil client; el servidor verifica JWT,
identidad, allowlist, Customer y derechos independientemente de la interfaz.
Con Basic activo se muestran precio y periodo pagado; generar permanece cerrado
si falta la capacidad del servidor. Premium no se ofrece para contratar. El
retorno no concede derechos y las respuestas tardías no deben sustituir otra cuenta.

La página alternativa `staging/subscription/return.html` necesita configuración
explícita que el arnés proporciona. No se presenta como una ruta desplegada:
el artefacto de hosting usa el retorno aprobado de #5, no esa plantilla alternativa.

El inventario exacto de 94 archivos frente a main y las referencias se conservan
en [INTEGRATION-CANDIDATE-20261104.json](INTEGRATION-CANDIDATE-20261104.json).
Incluye 91 archivos de composición y tres archivos de evidencia/regresión nuevos.
No incorpora archivos private, resultados de ejecución, SDK descargados ni recibos.

## Pruebas ejecutadas en esta candidata

Node 24.19.0, PostgreSQL 17.11 y Chromium/Edge headless + WebKit. Las siguientes
son **698 comprobaciones distintas efectivamente ejecutadas**, no la suma de
intentos. De ellas, 38 son nuevas; 660 son regresiones existentes reejecutadas
porque se compusieron ramas que antes se habían validado por separado.

| Comando | Casos únicos | Resultado |
|---|---:|---|
| `node scripts/ci-offline.cjs` | 354, 14 suites | PASS |
| `node scripts/premium-review-postgres.cjs` | 91 | PASS |
| `node scripts/commercial-postgres.cjs` | 89 Basic + 24 facturación | PASS |
| `node tests/premium-direct-production/unit.cjs` | 23 | PASS |
| `node --experimental-vm-modules --test tests/commercial/webhook-crypto.test.mjs` | 7 | PASS |
| `node tests/subscription/browser.cjs` | 72 | PASS |
| `node tests/subscription/integration-browser.cjs` | 38 nuevas | PASS |
| **Total** | **698/698** | **0 fallos finales** |

Además: 48 análisis de sintaxis del CI, sintaxis del nuevo arnés, diff-check y
control explícito `node scripts/reviewer-sql-check.mjs`. No se suman como casos.
Las 26 comprobaciones de huellas/reconciliación ya forman parte de las 354 del CI.

Las 72 pruebas de suscripción cubren estados, precio, carga, retorno manipulado,
Checkout/Portal simulados, respuesta incierta, errores de red/autenticación,
caducidad/cancelación sintéticas, cuenta distinta, layouts y conexión a Coach.
Las 38 nuevas comprueban en el DOM real flags falsos y de tipo incorrecto,
navegación trainer/client sin mutaciones, periodo/precio Basic, gates cerrados,
foco al cerrar, tema tras recarga, eventos nativos de sessionStorage/localStorage,
sincronización entre pestañas, móvil/escritorio y ausencia de tráfico externo.

PostgreSQL se ejecutó en clústeres nuevos de loopback con marcadores y controles de
host/puerto/directorio. Usa claims SQL y datos sintéticos: **no valida JWT reales**.
La criptografía usa Stripe SDK 23 real, firma sintética y transporte interceptado:
**no es una entrega de webhook conectada**. Ninguna prueba llama a OpenAI.

Los dos primeros arranques PostgreSQL y el primer navegador restringido fallaron
antes de ejecutar casos por permisos del entorno local. Los mismos comandos
pasaron mediante el procedimiento normal de ejecución ampliada, sin quitar
controles. Los cuatro clústeres propios quedaron detenidos; servidores de prueba
cerrados. El primer intento del nuevo arnés esperaba cero lecturas de facturación
en el arranque, pero el doble de Coach ya consulta status/capabilities. Se corrigió
esa expectativa a ausencia de mutaciones; no se cambió producto ni se ocultó el fallo.

Evidencia ignorada: `tests/subscription/results/ci-initial.txt`, `browser.json`,
`integration-browser.json`, TAP de Premium/comercial/facturación/webhook en sus
directorios results. Se conservan también los diagnósticos de intentos fallidos.

## Seguridad preservada

| RPC | MD5 exacto del cuerpo aprobado |
|---|---|
| `review_coach_proposal` | `d94b96ae65e69997a37ae83b521ec16b` |
| `authorize_coach_retry` | `cdf6200bb140563a96ddc472cc0ac9b7` |
| `premium_initial_review` | `c16541b25d191997fce42c2024784c7d` |

SQL Premium SHA-256:
`1dd35ba1a36dfcf1d11f6d0a07ec53540c20326ca1818cf89010a26890ad2458`.
Rollback cerrado SHA-256:
`4d2b33ed2b6770dfc1eb76dd17581ab004f6779334219a1a022e433819604428`.

Se mantienen autorización por operación, comprobaciones posteriores a esperas,
denegación uniforme, propagación de errores inesperados, idempotencia y revisión
humana. Los rollbacks estrechos cierran los RPC; no recuperan cuerpos vulnerables.
No cambian los interruptores de Premium ni se añaden admisiones, asignaciones o cuotas.

Revisión de fuentes/diff y escaneo de claves privadas no detectaron secretos.
Los SDK locales y fixtures sintéticas son material de pruebas, no credenciales.
Este escaneo no es una prueba matemática de ausencia de secretos.

**No se consultó ni modificó Supabase en esta misión.** La última lectura autorizada
anterior, del 04/11, constató los tres RPC coincidentes, checkpoints A/B cerrados,
27/27 referencias, cinco huellas de facturación y Premium apagado. Es evidencia
histórica reutilizada, no una verificación conectada nueva. Billing v7 coincidía
con #7; webhook v5 tenía una variante anterior de createPortal que no utiliza.
No corresponde redesplegarlo sólo para cambiar ese helper no usado.

## Instalación y despliegue: límites que permanecen

Los SQL históricos siguen siendo históricos. No ejecutar migrations/* en bloque,
ni reinstalar checkpoints A/B sobre staging ya configurado. El plan incremental
para los tres RPC ya coincidentes es no-op. Antes de cualquier futura operación,
contrastar preimágenes, OID, propietarios, ACL, RLS, flags y datos; detenerse ante deriva.
El control local detecta órdenes conocidos peligrosos y huellas distintas, pero
no puede impedir que otra persona ejecute SQL manualmente.

Reconciliar Git no requiere aplicar SQL ni desplegar Edge. Integrar en main sí
puede reconstruir GitHub Pages, actualmente main/root según la revisión anterior.
En Cloudflare, la revisión anterior observó staging automático sólo para la rama
de #1, previews None y producción con autodeploy desactivado/placeholder. Estos
controles deben leerse otra vez antes de publicar; no se presume su vigencia futura.
No se cambió `.github/workflows/`, Secrets ni configuración de hosting.

Para volver atrás localmente, conservar esta rama y partir de la base registrada
en otro worktree; no resetear ramas de Work. Un rollback productivo sería una
operación separada con preimagen y autorización; este informe no lo ejecuta.

## Derivada Coach: PR #2 reconciliada con v36

Rama independiente `codex/coach-reconciled-20261104`, HEAD
`94c06d4e90bdb4449fde41fd6e6675e4db9d7e47`, sobre la misma base main. Dos commits
auditables: `4d8aa11` frontend y `94c06d4` fuentes v36. Worktree limpio, 22 archivos,
+1404/-17. No contamina esta composición comercial ni reemplaza su árbol.

Recuperación Basic por propietario/intake después de respuesta incierta y recarga,
reintento explícito Premium con la misma clave, respuestas tardías descartadas.
Se recuperó el bundle v36 ya conservado en memoria de la revisión anterior: ninguna
conexión nueva. Nueve de once archivos coinciden con PR #2 tras CRLF→LF; el
entrypoint difiere en CORS staging y el contrato tiene un único LF final adicional.
Se conservan los CORS efectivos observados. El LF se registra mediante una
excepción estricta de huella; no se toleran otros cambios. Guard y modelo intactos.

**426/426 casos del candidato Coach final**, 17 nuevos y 409 regresiones:
21 contratos, 233 navegador Coach, 44 guard, 30 evaluación deportiva, 35 V5,
20 handler Edge con transporte simulado, 26 reviewer UI y 17 huellas de fuentes.
No sumar los 256 de su primera capa. Estos casos pertenecen a otra rama y no
acreditan todavía una ejecución conjunta de las seis PR.

Informe y comandos: `.worktrees/coach-reconciled-20261104/docs/commercial/COACH-RECONCILIATION-20261104.md`
desde la raíz del repositorio compartido. El manifiesto saneado está en
`tests/coach-flow/observed-v36-source.json` de esa derivada. La captura completa
permanece ignorada. No se modifican SQL, config JWT ni workflows.

Un merge-tree de lectura del primer corte frontend contra la composición no
mostró conflictos. Antes de incorporar la derivada completa hay que preservar
index con assets de suscripción, tema y los RPC corregidos; aplicar su delta,
no sustituir todo el árbol por la rama basada en main.

## Derivada hosting: artefacto único comercial

Rama `codex/hosting-commercial-candidate-20261104`, basada en el producto
comercial `b4ed62dd278c15c9408c2ad9571475515169085f`, HEAD local
`d613ba9489e02900761395d62ca245df85327cf0`, 28 archivos +2160/-5 y worktree limpio.
Extrae de #1 sólo runtime,
build/preview, configuración estática, integración de Auth/runtime y pruebas
pertinentes. No importa SQL, runners conectados ni automatizaciones de aquella rama.

Se añaden al manifiesto los tres recursos de Mi suscripción que faltaban. El
comando de build existente empaqueta app y retorno juntos para staging, sin
necesitar una carga posterior manual; producción excluye el retorno TEST.
Mantiene el manifiesto histórico #5 intacto y verifica sus cuatro fuentes exactas.
Corrige el falso positivo que confundía el constructor JS `new URL` con CSS
`url(...)`; se comprueban CSS case-insensitive y dependencias estáticas. También
amplía la detección preventiva de claves Stripe restringidas y de webhook.
No se encontró una clave real filtrada. La corrección CRLF de una expectativa
del test de placeholder no altera el contrato LF del artefacto.

**114/114 casos distintos**, 31 nuevos y 83 regresiones: build17, compositor23,
runtime32, AuthVM18, placeholder12, producción offline4, navegador8.
El navegador usa archivos reales del artefacto con SDK doble y todo tráfico
externo interceptado: no acredita Google, recovery o JWT conectados.

| Artefacto offline | Archivos | SHA-256 del inventario |
|---|---:|---|
| Staging, conservado en dist/ | 43 | `8b186fb1e9b1ebf7b28f46376b87530e8c095ade33a98b4b640cd46541dd626a` |
| Producción, sin retorno TEST | 39 | `9295d2b77d7a4b11951a35a109fe87deae6c79abdd4974ba44998bf89a730a9b` |
| Placeholder | 5 | `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399` |

Dos builds staging consecutivos dieron el mismo inventario/hash. Fuentes,
comandos e inventarios en `docs/commercial/HOSTING-CANDIDATE-20261104.md` y
`HOSTING-CANDIDATE-INVENTORY-20261104.json` de esa rama. CSP de la app conserva
Report-Only; retorno y placeholder tienen CSP aplicada. No se afirma una política
CSP estricta de toda la app. Mi suscripción continúa deshabilitada por defecto.

Los tres frentes suman 1.238 casos distintos finales (86 nuevos, 1.152 regresiones)
sin sumar reejecuciones, sintaxis ni auditorías documentales. Es un desglose de
**tres candidatos locales**, no una prueba end-to-end de las seis PR juntas.
La rama de hosting integra las cuatro comerciales; Coach sigue como delta aparte,
tal como exige el encargo. Su incorporación futura cambiará el hash del artefacto.

## Riesgos y decisiones

- **P0 de lanzamiento, no defecto nuevo de este parche:** falta oferta comercial
  aprobada (cuotas, prestaciones, soporte), fiscalidad/contratos y configuración LIVE
  independiente. TEST y una interfaz cerrada no habilitan ventas reales.
- **P1 operativo:** reinstalar migraciones históricas, reponer Coach anterior o
  publicar sin revisar autodeploy puede revertir seguridad o cambiar la app pública.
- **P1 de activación reviewer:** revocación Basic con el mismo JWT conectado sigue
  pendiente. No bloquea revisar/integrar código con todos los accesos cerrados;
  sí impide declarar listo el acceso reviewer de un piloto comercial.
- **P1 de validación:** faltan pruebas autenticadas de esta composición y una
  decisión de hosting/Auth/CORS productivos. Ningún mock sustituye esa evidencia.
- **P2:** las tres ramas locales deben componerse y verificarse juntas antes de
  publicar un artefacto que reúna también Coach y hosting. Los informes antiguos
  conservados describen su fecha, no el estado actual de esta candidata.
- **P2:** CSP principal sigue report-only y la búsqueda de secretos es por
  patrones/allowlist; no constituyen garantías generales de seguridad.

## Cinco pasos siguientes

1. **Codex:** revisión humana de esta candidata y las derivadas Coach/hosting;
   preparar una composición final de sus deltas y las regresiones afectadas.
   Requiere autorización si se amplía a publicación; lo actual queda local.
2. **Work + propietario:** autorizar una prueba mínima de revocación con el mismo
   JWT sintético, admisión/asignación limitadas, reloj SQL, cierre y limpieza exactos.
   No repetir las 34 comprobaciones positivas ni generar rutinas.
3. **Codex + propietario:** autorizar publicación de SHA concretos y actualización
   de las PR existentes, tras lectura fresca de CI/autodeploy. Después, decidir
   merges por separado, empezando #5; reconocer explícitamente el efecto en Pages.
4. **Work:** autorizar despliegue exclusivo del frontend integrado a staging y
   validación autenticada de Mi suscripción usando la compra TEST existente.
   Sin nuevos pagos y sin sesión Portal adicional salvo autorización específica.
5. **Propietario, con asesoramiento profesional + operación:** cerrar oferta,
   fiscalidad/privacidad/condiciones, LIVE, soporte y rollback; autorizar después
   el corte de hosting y piloto Basic supervisado. Premium permanece cerrado.

No se efectuó push, merge remoto, despliegue, SQL conectado, Auth, pago, Portal,
OpenAI ni modificación de Stripe, Cloudflare, producción o sus automatizaciones.
