# Candidato local de hosting comercial — 04/11/2026

Preparación local, no publicación ni corte. Rama
`codex/hosting-commercial-candidate-20261104`, sobre composición comercial
`b4ed62dd278c15c9408c2ad9571475515169085f` (#5/#8/#7/#6) desde main
`b2f77c6f86318a4bf11d2b6754b2e3bbd7263ac6`.

## Composición revisable

Se incorporan de #1 `81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839` únicamente
runtime público, build/preview, configuración estática, las nueve líneas de
integración de runtime/recuperación en producto y sus pruebas offline relevantes.
No se importa la rama entera, sus runners conectados, SQL, automatizaciones ni
evidencias privadas. Basic/Premium SQL no cambian. El tema corregido y los tres
recursos de Mi suscripción de la composición se conservan.

`config/static-public-manifest.json` añade los tres recursos que faltaban:
`assets/subscription.js`, `assets/subscription-app.js`, `assets/subscription.css`.
La validación recursiva sigue rechazando dependencias no declaradas, archivos
internos, paths inseguros, enlaces simbólicos y secretos reconocibles.

`scripts/hosting-commercial-build.cjs` compone el build base y el retorno HTTPS
de #5 en un solo árbol. Valida **antes de reemplazar dist** el manifiesto y los
headers históricos por SHA-256, los cuatro archivos fuente exactos y la ausencia
de colisiones. No cambia ni relaja el manifiesto histórico de 36→40 archivos:
ese manifiesto deliberadamente rechaza el nuevo árbol.

El comando existente `node scripts/hosting-build.cjs --target preview` delega
en el compositor. No hace falta una segunda carga manual del retorno que se
pueda olvidar después de un build. `--target placeholder` conserva su camino
inerte, y `--target production` **excluye el retorno TEST**. El nuevo compositor
no contiene despliegues, red, SDK, login ni llamadas al backend.

## Artefactos locales

| Perfil | Archivos | SHA-256 del inventario ordenado |
|---|---:|---|
| Preview staging | 43 | `8b186fb1e9b1ebf7b28f46376b87530e8c095ade33a98b4b640cd46541dd626a` |
| Producción offline | 39 | `9295d2b77d7a4b11951a35a109fe87deae6c79abdd4974ba44998bf89a730a9b` |
| Local, puerto de smoke 4381 | 43 | `f32a7691ff9e0f314b10f02fbf39e069c262119c3494ea7ce64dbbb7f53182c4` |
| Placeholder | 5 | `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399` |

Inventarios saneados completos: `HOSTING-CANDIDATE-INVENTORY-20261104.json`.
El árbol conservado en `dist/` corresponde a **preview**, nunca a producción.
Dos builds preview consecutivos dieron exactamente el mismo inventario y hash.
Los hashes cambian justificadamente si se incorpora después Coach o cambia la
aplicación; este recibo no aprueba esos árboles futuros.

El runtime conserva sus orígenes/URLs/backend públicos revisados y no añade
`billingTest=true`. Mi suscripción permanece deshabilitada por defecto, también
ante parámetros manipulados de URL. No se activan generación, Premium o reviewer.
El servidor de preview sólo admite loopback, GET/HEAD y archivos permitidos.
Sirve `/billing-test` y `/billing-test.html`, `.mjs` con MIME JavaScript y los
headers restrictivos del retorno. No hay catch-all, worker ni proxy.

El retorno exacto de #5 sólo inicia su lógica en
`https://simple-staging-raulchulbi.pages.dev`; falla cerrado en localhost,
aliases de deployment, GitHub Pages y producción. Su presencia en el artefacto
local permite inspeccionar archivos/headers; no certifica un retorno comercial
funcional desde localhost. La página alternativa de #6
`staging/subscription/return.html` necesita `assets/commercial-config.js`, todavía
sin configuración versionada: se conserva en fuente, **no se publica**. Se usa
el retorno TEST ya validado, sin sustituirlo silenciosamente.

CSP del principal permanece **report-only**, como #1; no se afirma protección
CSP estricta de toda la app. El retorno y placeholder sí tienen CSP restrictiva
enforced. Las cabeceras de Cloudflare no se aplican automáticamente en GitHub
Pages. Ninguna configuración remota ha sido consultada o cambiada en este frente.

## Defectos de integración resueltos

1. El scanner de #1 confundía `new URL(response?.url)` en Mi suscripción con CSS
   `url(...)`: rechazaba un build válido por un falso recurso `response`.
   Ahora distingue únicamente el constructor JS `new URL` fuera de archivos CSS.
   Conserva CSS `URL()` case-insensitive, literales `assets/...` y URLs de assets
   estáticos con `import.meta.url`; rutas de traversal siguen rechazadas.
2. El test heredado de placeholder comparaba salida LF contra fuente CRLF de
   Windows. Normaliza su expectativa al contrato LF existente; no cambia el
   producto ni rebaja comprobaciones de contenido.
3. Auditoría independiente detectó una carencia preventiva del detector de
   secretos: ahora rechaza también formatos de clave restringida Stripe
   (`rk_test_`/`rk_live_`) y firma webhook (`whsec_`). No se encontró un secreto
   real filtrado. El escáner por patrones no garantiza detectar todo secreto.

## Pruebas realmente ejecutadas

Node 24.19.0. **114 casos distintos, 114 PASS**: 31 nuevos (23 compositor/scanner/CLI
y 8 smoke de navegador), 83 regresiones previas reejecutadas. No sumar los
reintentos ni las comprobaciones del frente comercial padre otra vez.

| Comando | Casos | Naturaleza |
|---|---:|---|
| `node --test tests/cloudflare/build.cjs` | 17 | filesystem, allowlist, secretos, aislamiento de paths |
| `node --test tests/cloudflare/commercial-build.cjs` | 23 | nuevos: composición, fuentes exactas, runtime cerrado, CLI, rechazo, loopback HTTP |
| `node tests/cloudflare/runtime.cjs` | 32 | VM, orígenes, perfiles, claves públicas y callbacks |
| `node tests/cloudflare/auth-contract.cjs` | 18 | handlers reales con SDK doble en VM |
| `node tests/cloudflare/placeholder-build.cjs` | 12 | placeholder inerte y negativo |
| `node tests/cloudflare/production-build.cjs` | 4 | empaquetado productivo únicamente offline |
| `node tests/cloudflare/commercial-browser.cjs` | 8 | Chromium/Edge y WebKit, 320/1280, claro/oscuro |

La primera ejecución reveló el falso positivo de URL y un bloqueo ambiental para
crear junctions; la segunda ejecución por el mecanismo normal de permisos locales
pasó 38/38 tras el fix. Se añadieron/verificaron dos casos dirigidos de CLI y
secretos posteriormente (40 casos únicos build+compositor), sin sumar reejecuciones.
El test de placeholder se reejecutó tras ajustar la expectativa CRLF. Resultados
originales y finales quedan locales ignorados en `.tests-local/` y
`tests/cloudflare/results/`.

El smoke utiliza los **archivos reales del artefacto**, un SDK sintético y rutas
que interceptan todo tráfico no local. Verificó carga, ausencia de errores y
404, runtime staging inmutable, Auth/recuperación disponibles, temas, geometría
y UI comercial cerrada. No hubo login real ni se probó OAuth conectado. Todos
los contextos de navegador y el servidor loopback terminaron cerrados.

Comprobación adicional `node scripts/reviewer-sql-check.mjs`: los tres cuerpos
aprobados siguen en sus hashes; no se ejecutó SQL. `git diff --check` limpio.

## Reproducir sin publicar

Para preview offline, proporcionar sólo valores públicos en el proceso local:

```powershell
$env:SIMPLE_APP_URL='https://simple-staging-raulchulbi.pages.dev/'
$env:SIMPLE_PAGES_PROJECT='simple-staging-raulchulbi'
$env:CF_PAGES_BRANCH='codex/cloudflare-migration'
$env:CF_PAGES_URL='https://simple-staging-raulchulbi.pages.dev/'
node scripts/hosting-build.cjs --target preview
```

Estos valores sintéticos de metadata sirven para **empaquetado offline**. En un
despliegue real Cloudflare debe suministrar su propia metadata; no falsificarla.
El comando reemplaza sólo `dist/` tras validar paths/symlinks y fuentes. No publica.
No ejecutar el ensamblador histórico #5 contra este artefacto nuevo.

## Pendientes y siguiente autorización

- La integración #2/Coach está separada; agregarla requerirá regenerar inventario
  y verificar el grafo de dependencias. No copiar v33 sobre Coach v36 instalado.
- Persisten pruebas conectadas y autorización explícita de publicación, Auth/CORS
  y corte. El gate reviewer productivo previo no queda satisfecho por este smoke.
- Antes de push a una rama con autodeploy: leer otra vez controles Cloudflare y
  SHA/base. Antes de merge: considerar que main puede republicar GitHub Pages.
- Esta rama deriva de la composición local; no es un push fast-forward para #1.
  Preparar posteriormente el traslado de su delta a la rama autorizada y revisar
  el SHA exacto. Nunca publicar toda la composición por inferencia.

La siguiente autorización sería exclusivamente publicar un candidato exacto
revisado con controles de despliegue verificados. Activar la interfaz TEST,
validar sesiones reales o efectuar el corte son autorizaciones separadas.
