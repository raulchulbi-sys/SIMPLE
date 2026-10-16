# Preparación de producción — corte pendiente

Checkpoint actualizado el **16/10/2026**: **PRODUCTION PROJECT CONFIGURED — DEPLOYMENT PENDING**. El proyecto independiente `simple-raulchulbi` está creado y sirve un placeholder público sin backend. La aplicación conectada a Supabase producción **no está desplegada**. Access sigue pendiente. GitHub Pages mantiene la aplicación vigente y `main` permanece en `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`; la PR #1 continúa en borrador, sin merge ni corte.

Google OAuth y recuperación reales de staging ya están cerrados. No repetir esos recorridos, enviar nuevos correos ni modificar sus cuentas para cerrar este documento. El detalle de evidencia y límites está en [AUTH-CLOSURE.md](AUTH-CLOSURE.md); el checkpoint productivo completo, en [PRODUCTION-PREPARATION.md](PRODUCTION-PREPARATION.md).

## Configuración actual y promoción futura

| Campo | Configuración aplicada ahora | Aplicación futura, todavía pendiente |
|---|---|---|
| Proyecto | `simple-raulchulbi`, independiente de staging | Conservar este proyecto |
| URL estable | https://simple-raulchulbi.pages.dev/ | Mismo origen técnico, bajo Access antes de publicar la aplicación |
| Rama | `codex/cloudflare-production-preparation` | `main`, después de merge autorizado |
| Build | `node scripts/hosting-build.cjs --target placeholder` | `node scripts/hosting-build.cjs --target production` |
| Output | `dist` | `dist`, exclusivamente allowlist |
| `SIMPLE_DEPLOY_TARGET` | `placeholder` | `production` |
| `SIMPLE_PAGES_PROJECT` | `simple-raulchulbi` | Conservar |
| `SIMPLE_APP_URL` | `https://simple-raulchulbi.pages.dev/` | Conservar salvo nueva revisión explícita |
| `CF_PAGES_BRANCH` / `CF_PAGES_URL` | Automáticas; no introducir manualmente | Automáticas |
| Autodeploy productivo | **OFF**, verificado en el panel | Mantener OFF durante la promoción manual |
| Preview branches | **None**, verificado en el panel | Conservar |
| Backend inicializado | Ninguno | `yvguatdqncadkwewlepe`, únicamente bajo protección verificada |
| Access | **No configurado** | Obligatorio antes del frontend productivo |

La integración Git está limitada a `raulchulbi-sys/SIMPLE`. El deployment actual es `170fea3b-05ea-426b-b482-af7749bd0218`, fuente remota `8b2f526edae136b43970dd9770f5b74db575e7e6`, URL exacta https://170fea3b.simple-raulchulbi.pages.dev/. El paquete placeholder tiene SHA-256 `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399` y cinco archivos: HTML de entrada, 404, CSS, headers y robots. No contiene runtime, SDK, formularios, scripts ni configuración de backend.

La evidencia guardada recoge 12/12 contratos offline del placeholder y 28/28 comprobaciones HTTPS/navegador sobre ese contenido. El diagnóstico inicial de propagación DNS se conserva. Estas pruebas no acreditan Access ni funcionalidad productiva autenticada. Los contratos offline de la aplicación futura tampoco equivalen a un despliegue. No se ejecutaron nuevas pruebas para esta actualización documental.

## Qué activaría un merge

Settings → Pages se leyó nuevamente: **Deploy from a branch**, rama **main**, carpeta **/ (root)**. La ejecución Pages observada es [38479333757](https://github.com/raulchulbi-sys/SIMPLE/actions/runs/38479333757).

- Un merge en `main` **sí activa GitHub Pages**. Antes de autorizarlo, comprobar su árbol exacto y conservar el runtime de repositorio para `https://raulchulbi-sys.github.io/SIMPLE/` con Supabase producción. No copiar sobre ese runtime el generado exclusivamente para Cloudflare.
- El mismo merge **no activa hoy Cloudflare producción**: sus publicaciones automáticas están OFF, previews en None y la rama configurada es la de preparación.
- Tampoco activa Cloudflare staging desde `main`: ese proyecto conserva `codex/cloudflare-migration` como rama y no admite otras preview branches. Staging sigue aislado con `dmqjexigdnfzobarhnib`.

Estas conclusiones dependen de los controles observados: releerlos antes de cada operación. El builder mantiene producción restringida a `main` y rechaza intercambiar las identidades Pages de staging y producción. [Cloudflare: Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

## Access: alta con condiciones financieras pendiente

Cloudflare One recuperó la carga el 16/10/2026. La selección **Free** se completó dentro de la autorización existente para inspeccionar el siguiente paso. El checkout real **Activate Zero Trust Free** mostró base de **0 dólares y 50 usuarios**, tarjeta, dirección de facturación, aceptación de Terms/Privacy y autorización de cargos mensuales por uso que exceda los límites gratuitos. Se detuvo sin rellenar campos, seleccionar wallets, aceptar casillas ni pulsar Activate. No existe alta, política o aplicación Access configurada. [Cloudflare One: setup](https://developers.cloudflare.com/cloudflare-one/setup/).

Los errores Session Expired/Loading son antecedentes del 15/10 ya superados. No queda pendiente la autorización para seleccionar Free: el paso actual requiere una **nueva autorización explícita** sobre método de pago, condiciones y cargos, porque el encargo original prohíbe activar facturación. La inspección autorizada no permite completarlo. No se conservaron datos de SMS/Link ni URLs privadas de iframes de pago.

La protección debe cubrir expresamente `simple-raulchulbi.pages.dev` y `*.simple-raulchulbi.pages.dev`, con todas las rutas de la aplicación. Seguir el procedimiento oficial de Pages para la raíz y las aplicaciones Access correspondientes; proteger previews no demuestra que la raíz esté protegida. Comprobar sin sesión el origen estable, el hash actual y los aliases/hashes históricos relevantes antes de entregar HTML/JS conectado a producción. [Pages: known issues](https://developers.cloudflare.com/pages/platform/known-issues/), [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

Hasta verificarlo, mantener únicamente el placeholder. Noindex, una URL desconocida o una clave JavaScript no sustituyen ese control. La interacción Access/Supabase OAuth se validará sin desactivar la protección y sin asumir que el PASS real de staging prueba esta combinación productiva.

## Auth/CORS: propuestas exactas, ninguna aplicada

| Configuración | Adición preparada |
|---|---|
| Supabase Redirect URLs | `https://simple-raulchulbi.pages.dev/` |
| Supabase Redirect URLs, recovery | `https://simple-raulchulbi.pages.dev/\?reset=1` |
| Origen CORS de las funciones necesarias | `https://simple-raulchulbi.pages.dev` |

El backslash pertenece al patrón de allowlist; la URL real de recovery contiene `?reset=1`. Conservar todas las entradas GitHub existentes y la Site URL productiva en GitHub Pages. No se ha aplicado ninguna de estas adiciones productivas ni cambiado Site URL, DNS o canónico.

Antes de escribir deben cumplirse las seis puertas descritas en [PRODUCTION-PREPARATION.md](PRODUCTION-PREPARATION.md): origen propio verificado; Access real en raíz y aliases; backup verificable y rollback; validación del diff en staging; cambios exclusivamente aditivos que conserven JWT/RLS/Auth/roles/Site URL/controles financieros; aprobaciones obligatorias respetadas y lectura posterior. La falta actual de Access mantiene la operación bloqueada.

El backup Auth privado está en `tests/cloudflare/private/production-auth-urls-before.json`; la propuesta CORS, en `tests/cloudflare/private/production-cors-plan-review.json`, con aplicación deshabilitada. Son evidencias ignoradas, no archivos del hosting. Antes de utilizarlos, releer el estado LIVE y verificar que siguen siendo una base válida; no desplegar bundles antiguos de staging ni lógica de negocio no relacionada sobre producción.

La lectura Google autorizada se completó el 16/10/2026 en **SIMPLE Web**, proyecto **simple-509717**: Authorized JavaScript origins tiene una única URI, `https://raulchulbi-sys.github.io`; Authorized redirect URIs tiene una única URI, `https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback`. No se abrió ningún secreto ni guardó configuración. Los errores de carga anteriores no son el estado actual. La adición propuesta de `https://simple-raulchulbi.pages.dev` en Authorized JavaScript origins **no está autorizada por la aprobación de sólo lectura y no se aplicó**. Conservar el origen GitHub y el callback Supabase; no sustituirlo por Cloudflare ni crear clientes, scopes o secretos. La modificación requiere autorización separada y no bloquea el placeholder. OAuth real desde Cloudflare producción sigue pendiente. [Supabase: Google Project setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Orden ejecutable cuando se satisfagan los permisos y condiciones

1. **Preflight:** releer main, PR, controles Pages/GitHub, deploy servido, fuentes LIVE, flags, presupuesto, RLS y huellas estables de datos protegidos. Capturar backup y rollback contra ese estado. No ejecutar pruebas sintéticas productivas ni llamadas OpenAI.
2. **Protección:** resolver primero la nueva autorización del alta con método de pago, condiciones y cargos. Sólo después completar Access con el titular y comprobar raíz, wildcard, rutas y aliases sin sesión y con acceso autorizado. Si no puede verificarse, conservar el placeholder y continuar sólo con tareas independientes.
3. **Puertas y configuración:** validar el diff mínimo en staging y satisfacer las seis puertas. Aplicar sólo Redirect URLs/CORS exactos autorizados, conservar los anteriores y leer el resultado. Releer Google y aplicar la adición exacta propuesta sólo con autorización separada; Site URL, SMTP, roles y datos permanecen fuera de estos cambios.
4. **Merge autorizado:** revisar el árbol exacto y su efecto inmediato en GitHub Pages. Solicitar únicamente la autorización final que todavía corresponda; no fusionar con la autorización de preparación. Verificar el resultado servido por GitHub tras el merge.
5. **Cambio controlado de Cloudflare:** comprobar Access de nuevo; cambiar rama de preparación a `main`, comando de placeholder a `--target production` y target a `production`. Mantener proyecto/URL correctos, autodeploy OFF y previews None. Releer la configuración completa antes de ejecutar un deployment manual.
6. **Publicación protegida:** desplegar manualmente el SHA aprobado. Contrastar SHA, deployment, bytes, runtime, backend `yvguatdqncadkwewlepe`, allowlist, headers, HTTPS, caché y rutas privadas. El nuevo hash también debe quedar protegido.
7. **Validación productiva:** con cuenta expresamente autorizada, comprobar login/logout, Google, persistencia y recovery cuando corresponda. Verificar roles, vistas atleta/entrenador, entrenamientos, historial y contratos afectados. No guardar entrenamientos sintéticos, alterar contraseñas/cuentas ajenas ni realizar llamadas AI. Reutilizar la evidencia histórica aplicable y distinguir limitaciones pendientes de PASS reales.
8. **Corte separado:** presentar el resultado para una autorización posterior. No abrir a terceros, cambiar DNS/canónico, establecer redirecciones permanentes ni retirar GitHub Pages dentro de esta preparación. No trasladar tokens entre dominios; los usuarios pueden necesitar iniciar sesión de nuevo.

Después de cada cambio autorizado, comparar las lecturas de integridad con su baseline, distinguiendo actividad legítima concurrente. Mantener Premium directo OFF, sin ampliar elegibilidad ni cambiar otros flags; conservar JWT, reviewer, reservas y Financial P1. Los datos deportivos y financieros no deben requerir restauración por una migración de hosting.

## Rollback preciso

| Situación | Reversión |
|---|---|
| Preparación actual | Conservar el placeholder y autodeploy OFF; GitHub Pages continúa disponible. No hay una aplicación Cloudflare productiva que revertir. |
| Falla la primera aplicación protegida | Restaurar mediante Pages Rollback el placeholder `170fea3b-05ea-426b-b482-af7749bd0218`, fuente `8b2f526edae136b43970dd9770f5b74db575e7e6`; comprobar paquete `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399`, cinco archivos y ausencia de backend. |
| Rollback de un deployment posterior | Elegir un deployment aprobado y verificar su runtime/backend antes de restaurarlo; si la aplicación no puede mantenerse protegida, volver al placeholder seguro. |
| Fallan las nuevas Redirect URLs | Comparar el estado LIVE con el backup; retirar únicamente la base Cloudflare y el patrón recovery añadidos por esta promoción. Conservar todas las entradas anteriores, GitHub y Site URL. |
| Falla CORS nuevo | Retirar únicamente `https://simple-raulchulbi.pages.dev` de las fuentes LIVE afectadas, preservando cambios posteriores, orígenes anteriores, JWT, guards y lógica financiera. Usar la fuente anterior completa sólo si se demuestra que no hubo cambios posteriores. |
| Site URL/DNS | No ejecutar reversión si nunca se cambiaron. Una modificación futura necesita autorización y rollback específico de los valores capturados. |
| Datos/backend | No ejecutar SQL amplio, restaurar entrenamientos, redeployar Financial P1 ni borrar cuentas, perfiles, identidades Google o usuarios de pruebas conservados. |

Rollback del origen estable no elimina las URLs de hashes antiguos. Mantener Access sobre cualquier deployment o alias que haya servido una aplicación conectada a producción y comprobar esos accesos directos después de revertir. No retirar la protección mientras sobreviva alguno accesible.

El placeholder es actualmente el primer deployment de este proyecto; no existe una versión anterior de producción demostrada. Se ha preparado el procedimiento, pero no se ha ejecutado un rollback productivo. Access y la aplicación productiva autenticada siguen pendientes de validación.
