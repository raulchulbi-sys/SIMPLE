# SIMPLE — preparación Cloudflare sin facturación

Vigente20/10/2026. **Corte BLOCKED por contraste JWT productivo pendiente; corte NO ejecutado.** La rama de hosting integra todo main `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`: ambos arreglos del reviewer, Bloq Mayús y el reinicio por UUID de la primera sesión del ciclo. Conserva también recovery al recargar y la separación de entornos. La ventana temporal productiva no se ha utilizado en este checkpoint; UI, SQL y staging no sustituyen el positivo de proyección y negativo REST con el mismo JWT legítimo. La aplicación productiva sigue en [GitHub Pages](https://raulchulbi-sys.github.io/SIMPLE/). [Cloudflare producción](https://simple-raulchulbi.pages.dev/) conserva el placeholder inerte. [Cloudflare staging](https://simple-staging-raulchulbi.pages.dev/) usa exclusivamente SIMPLE Security Test. Actualizar sólo staging requiere controles frescos y regresiones correctas; no equivale al corte.

La decisión actual es **frontend público Pages + Supabase Auth/JWT/grants/RLS/RPC**. No se activa Access/Zero Trust, no se visita su checkout y no se registra tarjeta o suscripción. Access no es una puerta de publicación obligatoria; sí lo es validar la autorización real del backend. Noindex y CORS no autentican usuarios.

## Ruta de lectura vigente

1. [CHECKPOINT](CHECKPOINT.md): resultados y límites actuales, Git/deploy/integridad.
2. [PUBLIC-SECURITY-INVENTORY](../../tests/cloudflare/PUBLIC-SECURITY-INVENTORY.md): permisos reales, RLS/RPC/JWT y pendientes.
3. [PUBLIC-RELEASE](PUBLIC-RELEASE.md): comandos de preparación offline, simulación y recibos del artefacto.
4. [PUBLIC-AUTH-CORS](PUBLIC-AUTH-CORS.md): adiciones exactas propuestas, Google/plantillas, CORS y rollback.
5. [CUTOVER](CUTOVER.md): orden de lanzamiento futuro, STOP y rollback.
6. [PRIVACY-READINESS](PRIVACY-READINESS.md): proveedores, logs, límites y decisiones jurídicas pendientes.
7. [PR-REVIEW](PR-REVIEW.md): clasificación y mantenimiento de la PR#1.

## Entornos y fuente

| Entorno | Origen | Backend | Publicación |
|---|---|---|---|
| GitHub vigente | https://raulchulbi-sys.github.io/SIMPLE/ | yvguatdqncadkwewlepe | main; un merge publica GitHub Pages |
| LOCAL | localhost/127.0.0.1:4280 | dmqjexigdnfzobarhnib | build local explícito |
| STAGING | https://simple-staging-raulchulbi.pages.dev/ | dmqjexigdnfzobarhnib | codex/cloudflare-migration; previews None |
| Producción preparada | https://simple-raulchulbi.pages.dev/ | ninguno actualmente | placeholder; autodeploy OFF, previews None |
| Aplicación futura Cloudflare | mismo origen productivo | yvguatdqncadkwewlepe | main, target production; NO desplegada |

Main verificado: `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`, descendiente de `b415e9f2`, con ambos arreglos del reviewer, Bloq Mayús y las tres funciones de ciclo publicadas. PR existente [#1](https://github.com/raulchulbi-sys/SIMPLE/pull/1), borrador, sin merge. No crear otro proyecto Pages ni otra PR de migración. Releer estado real antes de cualquier acción.

El proyecto producción existente tiene deployment170fea3b-05ea-426b-b482-af7749bd0218, fuente8b2f526edae136b43970dd9770f5b74db575e7e6, sólo cinco archivos. El staging previo de referencia es4eef94ba-b617-48b6-bf99-f1d6bb83a5ad con esa fuente; un commit de código de build puede producir otro deployment de staging y debe verificarse expresamente.

## Build y controles

Se reutiliza scripts/hosting-build.cjs y config/static-public-manifest.json; no framework nuevo ni dependencia de ejecución añadida. Sólo36archivos públicos en la app: HTML,31assets existentes, runtime generado y3archivos de plataforma. Nunca SQL/tests/docs/privados/backups/Git/node_modules.

El builder resuelve referencias y valida antes de limpiar dist. Normaliza CRLF a LF en texto, conserva binarios y genera inventario/hash. Runtime exige target/URL explícitos, identidades/ramas aprobadas, HTTPS remoto y backend correcto. Las claves públicas se vinculan ahora por SHA256 a la configuración revisada: una opaque publishable de otro proyecto no puede pasar sólo por su formato. Una rotación real requiere revisar ese pin, no cambiar Auth automáticamente.

El runtime del repo conserva GitHub /SIMPLE/ y loopback staging. Cada build Cloudflare contiene sólo su backend y origen estable más el hash exacto del propio deployment. No comodines de origen, fallback a producción ni selección desde URL/localStorage. No se copian sesiones entre dominios.

Los comandos de release trabajan en tests/cloudflare/results/ ignorado para no reemplazar el dist raíz del placeholder. Consultar PUBLIC-RELEASE para sintaxis. El builder directo sí reemplaza su dist del sourceRoot: no ejecutarlo en el checkout principal como si fuera un dry-run.

Para una preview local consciente:

~~~powershell
$env:SIMPLE_APP_URL='http://127.0.0.1:4280/'
node scripts/hosting-build.cjs --target local
node scripts/hosting-preview.cjs
~~~

Esto genera app con staging en dist; no publica y no acepta backend productivo en el servidor local. Las pruebas offline se ejecutan por archivo; no hay instalación global ni suite productiva al arrancar.

## Auth y privacidad

Google/recovery reales de staging son evidencia histórica cerrada; no se han repetido ni enviado correos en esta misión. Producción Cloudflare OAuth/recovery siguen pendientes de su corte y prueba autorizados. Google productivo sigue con origen GitHub y callback Supabase; Site URL y Redirect actual siguen en GitHub. Las plantillas reales releídas16/10 usan ConfirmationURL sin host de app incrustado. No se cambió SMTP ni templates.

Las dos Redirect URLs exactas y CORS para origen Cloudflare productivo están preparados, no aplicados. La guía vigente es PUBLIC-AUTH-CORS; no usar bundles antiguos de staging sobre producción.

Headers de app: HTML no-cache, assets mutables max-age=0,must-revalidate; CSP report-only, no CSP estricta de bloqueo. Placeholder: no-store y CSP restrictiva aplicada. Sin analytics/publicidad/servicios nuevos. Identificadores pseudónimos legacy ya públicos se documentan como minimización pendiente; no se alteran aliases ni se presenta el scanner como garantía absoluta de ausencia de datos personales.

## Historia conservada

AUTH-CORS/AUTH-CLOSURE, PRODUCTION-PREPARATION y las secciones antiguas de CHECKPOINT/VALIDATION conservan la evidencia cronológica. Sus cifras635,94y103 no son nuevos tests de esta misión. Referencias antiguas Access pendiente, Google stagingOFF o deployments eb9/e829 describen sus fechas, no el estado vigente. No reaplicar sus helpers/cleanup sin revisar alcance; las cuentas financieras y usuarios existentes no son fixtures desechables.

No se fusiona main, no se sustituye el placeholder, no se modifican Supabase producción/DNS/canónico y no se llama a OpenAI. Se mantiene Premium directo cerrado y FinancialP1 sin reinstalar. El dominio pages.dev puede servir provisionalmente; no hace falta comprar uno para preparar este corte.
