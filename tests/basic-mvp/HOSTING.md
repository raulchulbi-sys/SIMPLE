# Hosting local de la candidata Basic

Este trabajo prepara archivos. No despliega ni cambia configuraciones externas.
La fuente es la candidata integral `3d4dba7baa7f272d13ed0ff3ce44a719414824da`.
La candidata Basic conserva los componentes Premium de esa base, cerrados por
sus controles de servidor. No incorpora los parches experimentales de chat.

## Dos perfiles explícitos

El comando habitual `node scripts/hosting-build.cjs --target preview` sigue
generando el perfil cerrado de 43 archivos. `billingTest` no está habilitado y
la ruta `/billing-test.html` conserva exactamente la fuente histórica de #5.
El entorno de producción no contiene el retorno TEST.

El comando **local**, nuevo y optativo, es

```powershell
$env:SIMPLE_APP_URL='https://simple-staging-raulchulbi.pages.dev/'
$env:SIMPLE_PAGES_PROJECT='simple-staging-raulchulbi'
$env:CF_PAGES_BRANCH='codex/cloudflare-migration'
$env:CF_PAGES_URL='https://simple-staging-raulchulbi.pages.dev/'
node scripts/hosting-commercial-build.cjs --target preview --basic-validation
```

Las variables anteriores son entradas públicas para reproducir offline el build.
No justifican cambiar una rama de despliegue ni suplantar la metadata del proveedor.
El comando escribe únicamente el `dist/` acotado del directorio de fuentes.
No hace publicación, SQL, Auth, Checkout, Portal ni llamadas de proveedor.

Este perfil tiene 41 archivos y una configuración inmutable con
`billingTest=true` y `billingValidationReadOnly=true`. Sólo funciona en
`https://simple-staging-raulchulbi.pages.dev` y en las rutas `/`, `/index.html`,
`/billing-test` y `/billing-test.html`. Rechaza localhost, producción, aliases,
otra ruta o cualquier target distinto de preview. Ninguna variable de entorno,
parámetro de URL o perfil por defecto lo activa.

La interfaz consulta `status` y `billing_test_capabilities`. El modo de validación
oculta Checkout, Portal y conciliaciones mutadoras. Las decisiones comerciales,
cuotas, generación, reviewer y Premium continúan siendo del servidor. Esta
configuración pública no es un mecanismo de autorización de backend.

## Retorno y sesión

Sólo en el perfil optativo, `/billing-test.html` procede de
`staging/subscription/return.html`, carga el runtime validado y
`assets/subscription-return.js`. Reutiliza la sesión de aplicación en el mismo
origen mediante el SDK, comprueba `getUser` y vuelve a leer el estado del servidor.
La URL de retorno nunca concede derechos. Se retiran parámetros y fragmentos.
Si no existe sesión válida aparece el login de la misma cuenta.

Las cuatro fuentes históricas de #5 y su manifiesto permanecen intactos. No se
requiere cambiar `BILLING_TEST_RETURN_URL` si sigue apuntando al retorno estable
aprobado. El despliegue futuro sí sustituiría los bytes de esa ruta exclusivamente
en el artefacto de validación y necesita autorización explícita por su SHA.

El retorno mantiene CSP aplicada, `no-referrer` y `no-store`; el runtime y recursos
se revalidan. La página principal sigue usando CSP Report-Only por sus scripts
inline históricos. GitHub Pages no interpreta automáticamente `_headers`.
El tema se carga antes de las hojas de estilo y conserva la preferencia local.

## Reproducibilidad y pruebas

```text
node --test tests/basic-mvp/hosting.test.cjs
node tests/basic-mvp/hosting-reproducibility.cjs
node tests/basic-mvp/hosting-browser.cjs
```

La reproducción usa dos directorios de entrada independientes y dos procesos
Node por cada perfil, con las mismas fuentes públicas. Comprueba todos los bytes
de salida y sus inventarios. Los tres perfiles son staging cerrado, validación
Basic y producción GitHub cerrada. El inventario saneado está en
`HOSTING-INVENTORY.json`; las rutas de los artefactos A/B quedan en el recibo
ignorado `results/hosting-reproducibility.json`.

El navegador utiliza los bytes del artefacto, incluida su configuración optativa,
sin modificar el runtime mediante el arnés. Sirve las URLs HTTPS por
interceptación local, con el SDK simulado y todas las demás solicitudes bloqueadas.
Chromium y WebKit comprueban 320/1280, claro/oscuro, Basic activo, modo sólo lectura,
retorno mismo origen, conservación de sesión sintética y ausencia de desbordamiento.
No es evidencia de JWT reales, Auth conectado ni un Portal Stripe nuevo.

Resultado final de esta misión: **33/33 casos nuevos** de hosting, desglosados en
12 filesystem/VM, 13 comprobaciones de reproducción independiente y 8 escenarios
de navegador. Las 23 regresiones previas de `commercial-build.cjs` también pasaron,
pero están en CI y no se cuentan nuevamente. Un bloqueo inicial de conexión local
y otro de arranque del navegador se resolvieron por el mecanismo normal de
ejecución autorizada. No se alteraron los controles ni las aserciones.
Las reejecuciones tras los ajustes de suscripción no aumentan el total.

| Perfil final | Archivos | SHA-256 del inventario |
|---|---:|---|
| Staging cerrado | 43 | `347f222373b1e4db6103ef1d3258d0de801a07efcb57027af385280fcec7951a` |
| Validación Basic sólo lectura | 41 | `eac9efa2a80542f595c7f192f771df45939f4ae7e9d0e6ea1ac05cef6ca8b266` |
| GitHub producción cerrado, build offline | 39 | `7fa0f0ad025134d8f8e8781366ac3af298f0d19528b7c6a71913b44b0556b488` |

Inventario de entradas final
`e6fb5178e5d2150ff7637fe7fe4ded5a1ca5df888255c5625c575949f189b0d5`.
Los seis artefactos quedan en `results/basic-hosting-7rb9j0/`, en directorios
independientes A/B. El navegador valida la coincidencia de las fuentes actuales
con ese inventario antes de abrir el artefacto, para impedir un PASS obsoleto.
Chromium/Edge 156.0.4314.50 y WebKit 26.5 dieron 8/8 sobre los bytes finales.

## Orden para publicar y validar posteriormente

1. Congelar y revisar el SHA Basic final y su diff. Volver a consultar los heads,
   CI, Pages source y controles efectivos de ambos proyectos Cloudflare antes de
   cualquier push. La lectura previa no garantiza la configuración futura.
2. Publicar código únicamente a una rama autorizada y sin despliegue automático.
   No actualizar una PR parcial con toda la composición. El orden de contenido
   reconciliado es #5 retorno, #8 tema, #7 backend, #6 suscripción, delta #2 Coach,
   delta #1 hosting. Conservar la unión de pruebas; evitar cherry-picks ciegos.
3. Con autorización separada, desplegar únicamente el artefacto Basic validation
   por SHA en staging. El build automático habitual permanece cerrado. No cambiar
   el placeholder productivo, DNS, Auth, Google, CORS ni secretos por inferencia.
4. Ejecutar el ensayo de lectura autenticado previsto, con identidades sintéticas
   y compra TEST existentes. No se necesita otra sesión Portal ni compra para
   validar la pantalla, derechos y retorno directo. Cerrar sesiones y comprobar
   integridad, revocación pendiente por protocolo independiente.
5. Activar prestaciones es una decisión posterior con autorización independiente.
   La presencia de `billingTest` en un frontend no autoriza abrir Basic/reviewer.

Los heads leídos de GitHub el 05/11 son main `b2f77c6`, #5 `fc245c9`, #8 `1d1e443`,
#7 `b2a7636`, #6 `313344d`, #2 `49ef741d` y #1 `81fe65f4`. Las seis PR estaban
abiertas; #5 no era borrador y las demás sí. Son referencias de procedencia, no
autorización para fusionarlas. El main local antiguo con cambios ajenos queda intacto.

El workflow versionado `ci-offline.yml` sólo tiene `pull_request` y
`workflow_dispatch`, permisos de lectura y pruebas Node. No despliega Edge ni SQL.
La configuración GitHub Pages main/root puede publicar al fusionar main aunque
el workflow no lo mencione. Cloudflare tiene controles de repositorio externos
al código; no se consultaron ni modificaron durante esta misión.

## Backend y rollback

Antes de desplegar el frontend, comparar con lecturas autorizadas las versiones
y bundles efectivos de `billing-test`, `billing-test-webhook` y `simple-coach-mock`,
con JWT, CORS, runtime compartido y preimágenes. v7/v5/v36 son referencias
históricas, no verificaciones actuales. Si coinciden con los contratos y hashes
aprobados, este frontend no exige redesplegar esas funciones.

No ejecutar SQL A/B, Basic uniform-denial o Premium ya instalado ni reinstalar
migraciones antiguas. Las tres huellas aprobadas deben seguir coincidiendo.
El permiso pendiente de reviewer se prueba por separado y no es requisito para
consultar una suscripción con generación y reviewer cerrados.

Rollback del frontend de validación: conservar antes el artefacto/deployment
anterior y su inventario; si la prueba falla, restaurar sólo esos archivos bajo
autorización. No restaurar bases de datos, cuotas, suscripciones ni funciones.
Volver al perfil cerrado revierte la pantalla comercial y el retorno de validación,
sin conferir ni retirar derechos backend. Auth/CORS no se modifican en este plan.

Riesgos pendientes: prueba conectada de esta candidata, revocación con JWT original,
configuración LIVE y oferta aprobada, fiscalidad/IVA, privacidad y contratos,
soporte y procedimientos de incidencia. CSP principal y dependencia CDN no son
controles endurecidos por esta misión. Una construcción offline de producción no
certifica seguridad ni autorización para un corte real.
