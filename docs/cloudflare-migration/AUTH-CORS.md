# Autenticación y CORS durante la migración

Este documento describe la adaptación de alojamiento y sus límites de prueba. Supabase conserva Auth, usuarios, perfiles, sesiones, permisos y Edge Functions. La migración no requiere cambiar `assets/auth.js` ni `assets/oauth.js`: sus tres destinos ya utilizan `APP_URL`, que ahora obtiene la configuración pública validada del entorno.

## Destinos y flujo real

| Operación actual | Destino enviado por SIMPLE |
| --- | --- |
| Google, `signInWithOAuth` | `APP_URL` |
| Registro, `signUp` | `emailRedirectTo: APP_URL` |
| Recuperación, `resetPasswordForEmail` | `APP_URL + '?reset=1'` |
| Limpieza local de recuperación/error | El origen y pathname de la página actual |

`APP_URL` debe ser una base exacta, terminada en `/`, sin credenciales, query ni fragmento. En GitHub Pages conserva `/SIMPLE/`; en un despliegue Cloudflare utiliza la raíz que haya sido verificada para ese proyecto. No se deriva el destino de una query `next`, de un parámetro `redirect_to` recibido por la web ni de un hostname cualquiera.

`window.SimpleAppRuntime` selecciona explícitamente el proyecto: previews y desarrollo usan staging `dmqjexigdnfzobarhnib`; producción usa `yvguatdqncadkwewlepe`. El identificador de entorno, la URL de Supabase y la clave pública deben concordar. El retorno de Auth utiliza la URL estable configurada; la infraestructura puede admitir además el origen exacto `CF_PAGES_URL` de ese build para servir la preview. No admite otros aliases de despliegue, aunque pertenezcan al mismo proyecto. Un host no autorizado debe fallar antes de crear el cliente Supabase. Las pruebas de esa selección se describen en el informe general de migración.

El SDK sigue siendo `supabase-js 2.115.0`, con `persistSession`, `autoRefreshToken` y `detectSessionInUrl` activados. SIMPLE captura solamente tres indicadores booleanos del callback antes de crear el cliente: hay acceso, recuperación o error. No copia access/refresh tokens a un objeto propio. El SDK conserva la responsabilidad de recuperar la sesión, renovar tokens y consumir el callback.

Los perfiles existentes siguen teniendo prioridad. Google no crea ni cambia el perfil durante el inicio de OAuth; un usuario sin perfil selecciona su rol en la pantalla existente «Completar registro». La migración no altera UUID, roles, vinculación de cuentas ni políticas RLS.

## Supabase: URL Configuration

La configuración productiva previa debe conservarse. En particular, no cambiar Site URL de `https://raulchulbi-sys.github.io/SIMPLE/` durante esta preparación ni retirar su Redirect URL.

Cuando exista una URL Cloudflare realmente perteneciente al proyecto, registrar solamente sus destinos necesarios en **Authentication → URL Configuration → Redirect URLs**. Primero probar en staging. Añadir cada preview controlada de forma individual; no usar `https://**.pages.dev/**`.

Para un despliegue cuya base verificada sea `APP_URL_DEPLOY`:

1. Añadir la URL base exacta `APP_URL_DEPLOY` para OAuth y confirmación.
2. Añadir el destino de recuperación `APP_URL_DEPLOY + '?reset=1'`, teniendo en cuenta que la allowlist usa patrones glob: el carácter `?` se escapa como `\?` para representar una interrogación literal. El valor guardado debe ser `APP_URL_DEPLOY + '\?reset=1'`; el frontend continúa enviando la URL normal con `?reset=1`.
3. Comprobar que se conservan todas las entradas anteriores y Site URL.
4. Verificar ambos destinos contra el servidor de staging antes de plantear una adición productiva.

El origen de Site URL tiene una excepción en Supabase Auth: permite otras rutas/queries del mismo esquema, host y puerto. En loopback, el código actual permite variar el puerto; esa excepción local no se aplica a un dominio Pages. Esto explica que la recuperación antigua funcionase con la URL base. La excepción de Site URL no cubre un origen Cloudflare diferente mientras Site URL sigue en GitHub Pages. La allowlist compara el destino completo, sin fragmento, por lo que autorizar solamente la base Cloudflare no acredita la recuperación con query. Esta conclusión se deriva del [código oficial actual de Supabase Auth](https://github.com/supabase/auth/blob/master/internal/utilities/request.go) y de la [sintaxis documentada de Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

Una comprobación negativa segura consiste en hacer **un GET sin seguir redirects** a `/auth/v1/verify`, con `type=recovery`, un token deliberadamente inválido nuevo y `redirect_to` igual al destino exacto. Leer `Location` y comprobar origen, pathname y `reset=1`. El callback llevará un error de enlace caducado; no debe contener tokens válidos. Repetir con un dominio sintético `.invalid` no autorizado: no debe devolver allí. Esta prueba verifica la selección del destino y el caso negativo, no la entrega de correo ni el cambio de contraseña. No utilizar enlaces o tokens de usuarios reales.

La plantilla estándar puede usar `{{ .ConfirmationURL }}`. Una plantilla personalizada que construya el destino con `{{ .SiteURL }}` puede ignorar `emailRedirectTo`/`redirectTo`; inspeccionarla sin revelar SMTP ni cambiarla automáticamente. No sustituirla por una ruta `/auth/confirm` nueva: SIMPLE procesa el callback en su página actual. [Guía oficial de redirects y plantillas](https://supabase.com/docs/guides/auth/redirect-urls#email-templates-when-using-redirectto).

## Google Cloud

El flujo actual es SIMPLE → Supabase Auth → Google → callback Supabase → SIMPLE. El URI de retorno del proveedor productivo sigue siendo:

```text
https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback
```

El callback correspondiente de staging es:

```text
https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/callback
```

Son callbacks del proveedor, diferentes de la Redirect URL de retorno a la web. No reemplazarlos por un dominio Cloudflare ni crear otro cliente OAuth para cambiar de hosting.

Si el cliente web de Google existente necesita incluir el nuevo sitio, revisar **Google Auth Platform → Clients → cliente Web existente**. En **Authorized JavaScript origins** se utiliza únicamente el origen HTTPS comprobado, sin pathname `/SIMPLE/` ni barra/ruta de callback. En **Authorized redirect URIs** conservar el callback Supabase del proyecto correspondiente. Revisar Branding/Audience solamente si Google exige un dominio autorizado o una cuenta de prueba; no activar usuarios externos ni cambiar la audiencia comercial. Nunca registrar `pages.dev` completo como autorización genérica ni introducir un Client Secret en GitHub o en el frontend. [Configuración oficial del proveedor Google](https://supabase.com/docs/guides/auth/social-login/auth-google#project-setup).

Comprobar que el botón aparece únicamente si el endpoint público `/auth/v1/settings` confirma `external.google === true`. La bandera frontend existente de Google no acredita por sí sola la configuración ni una prueba real del proveedor. Apple y Facebook conservan sus banderas independientes desactivadas.

## Recuperación y confirmación: cómo validar

La pantalla «Revisa tu correo» se conserva: aparece solo tras una respuesta aceptada, con un texto genérico que no revela si existe la cuenta. HTTP 400/429/500 y un fallo de red mantienen el login y permiten reintento manual. No debe enviarse automáticamente otro correo.

En staging y con una cuenta sintética propia de la misión y un buzón de pruebas autorizado:

1. Provocar un login fallido y solicitar recuperación una vez.
2. Recibir el enlace de prueba; confirmar que contiene el proyecto de staging y el retorno al despliegue de staging.
3. Abrirlo una vez en el destino exacto; debe mostrarse el modal de cambio sin perder el indicador de recuperación cuando el SDK consume el hash.
4. Comprobar contraseña corta y confirmación diferente: ninguna debe enviar `updateUser`.
5. Guardar una contraseña válida; se debe comprobar el usuario, hacer un único cambio, cerrar la sesión y volver al login con el mensaje de éxito.
6. Volver a entrar con la nueva contraseña, recargar, cerrar sesión y verificar que no aparece un bucle de recuperación.
7. Abrir un enlace caducado o usado: no debe reutilizar otra sesión para mostrar el formulario.

No enviar correos a personas reales ni cambiar contraseñas productivas. El mínimo de seis caracteres de la interfaz se conserva; Supabase puede aplicar una política adicional. Inspeccionar la política existente y probar con ella, sin reducirla para que pase una fixture. [Flujo oficial de contraseña y recuperación](https://supabase.com/docs/guides/auth/passwords).

El registro sintético debe usar staging, mantener `emailRedirectTo` y el rol seleccionado, y consumir la confirmación sin sobrescribir perfiles existentes. Si no existe un buzón sintético autorizado o una cuenta Google de pruebas, la entrega real de correo y el recorrido real del proveedor quedan pendientes. Un enlace de prueba generado por un administrador puede verificar consumo/cambio, pero no demuestra que SMTP entregó el correo. Las respuestas HTTP interceptadas tampoco acreditan esa entrega.

Al cambiar de GitHub Pages a Cloudflare, el navegador tiene un origen diferente y normalmente exigirá iniciar sesión otra vez. Es el comportamiento esperado del almacenamiento de sesión. No copiar tokens entre dominios. Los datos del usuario siguen en el mismo Supabase.

## CORS: inventario y cambio mínimo

Auth, REST/RPC y Storage se llaman directamente al mismo proyecto Supabase. No añadir un proxy Cloudflare ni modificar RLS para resolver CORS.

Las cuatro funciones llamadas por los adaptadores frontend son:

| Función | Uso | Whitelist observada en el código versionado previo |
| --- | --- | --- |
| `simple-coach-mock` | Generación Basic | Producción: `https://raulchulbi-sys.github.io`; staging: localhost/127.0.0.1, puertos 4194 y 4195 |
| `simple-coach-premium` | Análisis Premium y semanal | `https://raulchulbi-sys.github.io`; la fuente versionada restringe el proyecto a producción |
| `simple-coach-chat` | Chat Premium | `https://raulchulbi-sys.github.io`; la fuente versionada restringe el proyecto a producción |
| `simple-coach-initial-premium` | Generación Premium inicial/directa | Producción: `https://raulchulbi-sys.github.io`; staging: localhost/127.0.0.1, puertos 4262 y 4263 |

Los check-ins, mesociclos, aceptación, historial y reviewer también usan RPC/REST y no deben requerir otra función Cloudflare. La fuente desplegada puede diferir de un `index.ts` versionado. Antes de cualquier publicación Edge, guardar el bundle y metadata actuales de **cada entorno**, comparar hashes y partir de esa fuente real. El snapshot histórico `production-edge-before.json` de la tarea anterior contiene solamente Premium v3 y chat v4; no demuestra el estado actual de las cuatro funciones ni de staging.

Las respuestas actuales mantienen `Vary: Origin`, `Cache-Control: no-store`, `Access-Control-Allow-Methods: POST,OPTIONS` y headers `authorization,apikey,content-type,x-client-info`. Devuelven el origen solamente si pertenece a la whitelist; un origen ajeno obtiene `origin_denied`. OPTIONS se atiende antes de la lógica de negocio. Se conservan JWT, comprobación del usuario y controles financieros/de acceso. CORS no sustituye esa autenticación.

Una vez conocido el origen Cloudflare controlado, el cambio permitido es añadir **ese origen exacto**, sin ruta ni barra final, a la whitelist del entorno correspondiente. Conservar los anteriores. No añadir `*`, dominios de preview de terceros ni `*.pages.dev`. No desplegar el bundle productivo en staging para eludir el guard de entorno de Premium/chat; validar la adición sobre la fuente real de staging. Si hace falta modificar lógica de negocio o un guard, detener esa publicación y documentar el cambio separado.

Comprobar en staging para cada función:

1. OPTIONS con el origen nuevo, método solicitado POST y los headers reales del navegador: debe permitir solamente ese origen y los headers necesarios.
2. OPTIONS con GitHub Pages/locales anteriores cuando proceda: compatibilidad conservada.
3. OPTIONS con un dominio `.invalid` ajeno: debe denegarlo y no devolver un ACAO permisivo.
4. Una llamada POST sin sesión válida debe continuar rechazada; no invocar generación/chat con una sesión real para probar CORS ni gastar OpenAI.
5. Repetir la petición desde un navegador: un éxito de curl/Node aislado no demuestra que el navegador acepte CORS.

El SDK actual puede incorporar headers opcionales en determinadas operaciones; comprobar los enviados antes de ampliar la lista. Los headers de trazas no están habilitados por defecto. La [guía oficial de CORS](https://supabase.com/docs/guides/functions/cors) exige OPTIONS y headers acordes al cliente; su ejemplo con `*` no autoriza a relajar la whitelist de SIMPLE.

## Auditoría actual de solo lectura

Las lecturas nuevas de esta misión obtuvieron los cuatro bundles productivos usados por el frontend: Basic v3, Premium v4, chat v5 e inicial v1, todos con `verify_jwt: true`. Sus 41 entradas de archivo coinciden con el repositorio después de normalizar CRLF y el final del archivo: 21 coinciden también byte a byte; las otras 20 difieren solamente en esa representación. La whitelist productiva de las cuatro sigue permitiendo exclusivamente el origen de GitHub Pages. El helper productivo adicional v15 se inventarió y no se modificó.

El panel autenticado de URL Configuration requirió conexión de la cuenta y aceptación de términos; no se pudieron leer la lista completa actual ni las plantillas actuales por ese medio. La evidencia HTTP nueva permite afirmar solamente:

| Comprobación de lectura | Producción | Staging |
| --- | --- | --- |
| `/auth/v1/settings` | Google y email habilitados | Google deshabilitado; email habilitado |
| Token inválido de recuperación, base exacta | Retorna a GitHub Pages `/SIMPLE/` | Retorna a `http://127.0.0.1:4262/` |
| Token inválido, query `?reset=1` | Conserva destino y query | Conserva destino y query en 4262 |
| Dominio `.invalid` ajeno | Rechazado | Rechazado |
| OPTIONS permitido/ajeno | Las cuatro: 204/403 para GitHub Pages | Premium/chat/inicial: 204/403 en 4262; Basic rechaza 4262 con 403 |

Son probes sin seguir redirecciones y con tokens deliberadamente inválidos; no crean ni consumen sesiones reales. El `Vary` efectivo del gateway es `Accept-Encoding, Origin`, que conserva el comportamiento requerido por origen. Producción pasó 20 checks de lectura/gateway, incluidos GET y POST vacío con JWT deliberadamente inválido: los ocho devolvieron 401 antes de ejecutar negocio. Staging inicialmente en 4262 pasó 11 de 12; el resultado Basic 403 corresponde a sus puertos existentes 4194/4195 y se registra como limitación previa.

La fuente real de staging es Basic v29, Premium v13, chat v13 e inicial v2, todas con JWT obligatorio. Premium/chat/inicial conservan su guard específico para `dmqjexigdnfzobarhnib`; no utilizar el bundle productivo para reemplazarlas. Para el desarrollo local elegido en 4280, se preparó un plan aditivo que introduce únicamente `http://127.0.0.1:4280` y `http://localhost:4280` en las cuatro whitelists de staging, conservando todas las entradas anteriores y los guards.

`tests/cloudflare/auth-stage-cors.cjs` exige el proyecto exacto de staging y verifica los hashes de los 41 archivos del baseline antes de preparar el payload. Modifica solamente una línea de whitelist por función; su payload `rollback` contiene todos los archivos originales exactos. El script **no despliega**. El plan privado y los bundles anteriores permanecen ignorados por Git. La validación local `auth-stage-cors-test.cjs` pasó 54 casos: orígenes nuevos y anteriores, origen ajeno, conservación de guards y JWT, rechazo de proyecto/hash/JWT alterado y rollback exacto.

El responsable de la misión desplegó posteriormente ese plan únicamente en staging: Basic v30, Premium v14, chat v14 e inicial v3, todas con JWT obligatorio. Una descarga nueva de las cuatro confirmó que los 41 archivos coinciden byte a byte con el payload previsto. En `http://127.0.0.1:4280`, el probe posterior pasó 20/20: retorno base y query de recuperación, rechazo de un destino ajeno, ajustes públicos de Auth, cuatro OPTIONS 204 con ACAO exacto, cuatro OPTIONS ajenas 403 y ocho GET/POST con JWT inválido 401. Otra comprobación OPTIONS pasó 30/30 para las 26 entradas locales anteriores y las cuatro entradas `http://localhost:4280` nuevas. No se añadió ningún origen Cloudflare aún: no existe una URL de despliegue verificada de esa cuenta.

La prueba de CORS real en navegador pasó 24/24: Chromium y WebKit, cuatro funciones, dos orígenes 4280 autorizados y un puerto loopback ajeno. La página de laboratorio se sirve por HTTP real y **no hay interceptación de red**. En los orígenes admitidos, el navegador pudo leer el rechazo 401 del JWT inválido; en el origen ajeno, la preflight impidió la respuesta POST y `fetch` terminó con un error CORS. No se autenticó una cuenta ni se ejecutó negocio/OpenAI. Los primeros diagnósticos con interceptación de Playwright se descartaron como prueba de CORS nativo: Chromium puede omitir esa comprobación cuando se intercepta la red.

## Evidencia y límites

- `tests/cloudflare/auth-contract.cjs` ejecuta los handlers originales en una VM aislada para comprobar los retornos bajo `/SIMPLE/`, raíz Cloudflare sintética y localhost, roles de registro, errores de recuperación y limpieza de callback.
- `tests/cloudflare/auth-browser.cjs` utiliza el SDK real pinado con las páginas y la configuración generada; todos los HTTP de Auth/RPC son interceptados y las cuentas son sintéticas. Pasaron 84 casos únicos, Chromium/WebKit, 320/1280 y tres bases. La consolidación sustituye las reejecuciones de 12 casos WebKit OAuth afectados por esperas del harness durante navegación; no suma repeticiones. Se bloquea cualquier otro destino de red.
- `tests/cloudflare/auth-cors.cjs` comprueba el prefijo original de OPTIONS/origen de las funciones versionadas, antes de cualquier llamada de negocio: 20 casos locales pasados.
- `tests/cloudflare/auth-probe.cjs --config ARCHIVO_PUBLICO_JSON` ejecuta los probes HTTP de lectura descritos arriba. Su JSON necesita `appUrl`, `supabaseUrl` y `supabasePublicKey`, nunca una clave privada. Con `--invalid-auth` añade GET/POST vacío con un JWT deliberadamente inválido, que debe ser rechazado con 401 por el gateway. No publica valores de claves ni tokens y falla si recibe otro proyecto o un token de sesión/service role.
- `tests/cloudflare/auth-live-cors-browser.cjs` verifica CORS del staging real desde documentos de laboratorio, sin interceptar la red y usando exclusivamente el JWT inválido. No es una prueba de login ni de operaciones autenticadas.
- Las pruebas con SDK real y HTTP interceptado se identifican como tales. Nunca equivalen a Google OAuth real, entrega SMTP, JWT real, escritura staging o verificación autenticada productiva.
- Los resultados actuales deben leerse en `tests/cloudflare/results/`; no reutilizar recuentos históricos de `CONTEXTO-CODEX.md` como ejecuciones nuevas.
- El estado final de URLs, CORS, funciones desplegadas y cualquier cambio remoto se recoge en el informe general de esta misión. Este documento no acredita una modificación de esos paneles.

Se revisó la documentación oficial actual y el changelog. La URL Markdown de changelog no pudo leerse con la herramienta web; se utilizó [el changelog HTML oficial](https://supabase.com/changelog). Se revisaron los cambios sobre [plantillas de email en el plan Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) y [estado HTTP del endpoint OAuth de la API de gestión](https://supabase.com/changelog/45468-breaking-change-oauth-token-endpoint-will-return-http-200-instead-of-201). Ninguno requiere sustituir Auth ni alterar el SMTP existente para este cambio de hosting.

## Reversión de ajustes aditivos

Antes de añadir nada, registrar las entradas originales y la versión/hash del bundle Edge. Si el nuevo hosting se retira, eliminar únicamente las Redirect URLs que se añadieron para ese despliegue y retirar únicamente sus orígenes CORS. Conservar Site URL y todos los destinos anteriores. Para la adición local de staging, el plan privado contiene un array `rollback` con los cuatro payloads originales completos y `verify_jwt: true`. Antes de aplicarlo, descargar el estado actual y comprobar que sigue coincidiendo con el payload `deployments` de esta misión; si apareció una versión posterior con otras modificaciones, reconciliarla para no sobrescribirla. Restaurar esos cuatro payloads solo en `dmqjexigdnfzobarhnib` y verificar después los 41 hashes originales y OPTIONS anteriores/ajenos. Supabase creará nuevas versiones de función, pero el contenido de los archivos anteriores será exacto. No restaurar toda la base de datos ni borrar usuarios, perfiles, rutinas o historiales por un problema del frontend.
