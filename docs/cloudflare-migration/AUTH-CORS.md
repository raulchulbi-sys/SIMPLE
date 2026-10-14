# Autenticación y CORS durante la migración

Este documento describe la adaptación de alojamiento y sus límites de prueba. Supabase conserva Auth, usuarios, perfiles, sesiones, permisos y Edge Functions. La migración no requiere cambiar `assets/auth.js` ni `assets/oauth.js`: sus tres destinos ya utilizan `APP_URL`, que ahora obtiene la configuración pública validada del entorno.

Estado: **preview Cloudflare desplegada; configuración Auth pendiente**. Proyecto dedicado a staging `simple-staging-raulchulbi`, deployment `4a8636ab-ec94-42db-b57e-cf43d01230b9`, fuente `0aa1d6b6dc6fe0165534b8c7610c1e8a56521709` — mismo árbol que el candidato local `1369022d637815cd6b6d7af827d7f325208cc22a`.

| Destino real | URL |
| --- | --- |
| URL estable, `S` | `https://simple-staging-raulchulbi.pages.dev/` |
| Este build, `D` | `https://4a8636ab.simple-staging-raulchulbi.pages.dev/` |

Este proyecto debe permanecer en staging. No convertir su URL estable a producción mientras reciba callbacks de staging: podrían llegar a un SDK configurado contra otro backend. La futura producción requiere otro proyecto/origen estable y un corte autorizado. GitHub Pages y Supabase productivo siguen siendo la producción vigente.

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

La URL `S` ya pertenece al proyecto verificado. Su configuración debe añadirse solamente en **Authentication → URL Configuration → Redirect URLs** del staging `dmqjexigdnfzobarhnib`, conservando las entradas anteriores y Site URL. No usar `https://**.pages.dev/**`.

Las dos entradas pendientes son:

```text
https://simple-staging-raulchulbi.pages.dev/
https://simple-staging-raulchulbi.pages.dev/\?reset=1
```

El carácter `?` se escapa como `\?` porque la allowlist usa patrones glob. El frontend continúa enviando la URL normal `https://simple-staging-raulchulbi.pages.dev/?reset=1`. `D` no necesita una Redirect URL de Auth: los tres flujos utilizan siempre `APP_URL = S`, independientemente del origen donde se abrió la aplicación.

Estas entradas **todavía no se han guardado**. El panel de Supabase, pestaña 8, continúa en login manual y la solicitud al propietario sigue pendiente. En el único baseline Cloudflare, los dos GET con token deliberadamente inválido devolvieron HTTP 303 a `http://localhost:3000`; es un diagnóstico de allowlist pendiente, no un fallo nuevo del frontend. No repetirlo en bucle: verificar ambos destinos después de guardar las entradas y antes de plantear cualquier ajuste productivo.

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

## CORS actual de staging

Auth, REST/RPC y Storage se llaman directamente al mismo proyecto Supabase. No añadir un proxy Cloudflare ni modificar RLS para resolver CORS.

Las cuatro funciones llamadas por los adaptadores frontend conservan su negocio y sus guards. Las versiones LIVE actuales son:

| Función | Uso | Versión staging | Puertos locales anteriores conservados |
| --- | --- | ---: | --- |
| `simple-coach-mock` | Generación Basic | 31 | 4194, 4195, 4280 |
| `simple-coach-premium` | Análisis Premium y semanal | 15 | 4233, 4241, 4251, 4262, 4263, 4280 |
| `simple-coach-chat` | Chat Premium | 15 | 4245, 4251, 4262, 4263, 4280 |
| `simple-coach-initial-premium` | Generación Premium inicial/directa | 4 | 4262, 4263, 4280 |

Cada puerto conserva sus entradas `localhost` y `127.0.0.1`: son 34 entradas locales de whitelist entre las cuatro funciones. Se añadieron exclusivamente estos dos orígenes HTTPS exactos a cada una, sin ruta ni barra final:

```text
https://simple-staging-raulchulbi.pages.dev
https://4a8636ab.simple-staging-raulchulbi.pages.dev
```

El readback de los cuatro bundles confirmó los 41 archivos exactamente contra el plan previsto. JWT sigue obligatorio; no se cambiaron guards, roles, permisos, RLS, presupuestos, proveedor o flags de negocio. La whitelist productiva sigue siendo GitHub Pages y sus funciones no recibieron esta publicación.

Los check-ins, mesociclos, aceptación, historial y reviewer también usan RPC/REST y no requieren otra función Cloudflare. La fuente desplegada puede diferir de un `index.ts` versionado. Antes de cualquier publicación Edge, guardar el bundle y metadata actuales de **cada entorno**, comparar hashes y partir de esa fuente real. El snapshot histórico `production-edge-before.json` de la tarea anterior contiene solamente Premium v3 y chat v4; no sustituye los bundles LIVE capturados para esta fase.

Las respuestas actuales mantienen `Vary: Origin`, `Cache-Control: no-store`, `Access-Control-Allow-Methods: POST,OPTIONS` y headers `authorization,apikey,content-type,x-client-info`. Devuelven el origen solamente si pertenece a la whitelist; un origen ajeno obtiene `origin_denied`. OPTIONS se atiende antes de la lógica de negocio. Se conservan JWT, comprobación del usuario y controles financieros/de acceso. CORS no sustituye esa autenticación.

En otro build, `S` seguirá siendo estable pero cambiará `D`. Si se utiliza el nuevo hash para el flujo Edge completo, revisar y añadir solamente su origen exacto, conservando los anteriores; para QA funcional ordinaria utilizar `S`. No añadir `*`, dominios de preview de terceros ni `*.pages.dev`. No desplegar el bundle productivo en staging para eludir el guard de entorno de Premium/chat. Si hace falta modificar lógica de negocio o un guard, separar ese cambio para revisión.

Comprobar en staging para cada función:

1. OPTIONS con el origen nuevo, método solicitado POST y los headers reales del navegador: debe permitir solamente ese origen y los headers necesarios.
2. OPTIONS con GitHub Pages/locales anteriores cuando proceda: compatibilidad conservada.
3. OPTIONS con un dominio `.invalid` ajeno: debe denegarlo y no devolver un ACAO permisivo.
4. Una llamada POST sin sesión válida debe continuar rechazada; no invocar generación/chat con una sesión real para probar CORS ni gastar OpenAI.
5. Repetir la petición desde un navegador: un éxito de curl/Node aislado no demuestra que el navegador acepte CORS.

El SDK actual puede incorporar headers opcionales en determinadas operaciones; comprobar los enviados antes de ampliar la lista. Los headers de trazas no están habilitados por defecto. La [guía oficial de CORS](https://supabase.com/docs/guides/functions/cors) exige OPTIONS y headers acordes al cliente; su ejemplo con `*` no autoriza a relajar la whitelist de SIMPLE.

## Evidencia anterior a la publicación Cloudflare

Las lecturas nuevas de esta misión obtuvieron los cuatro bundles productivos usados por el frontend: Basic v3, Premium v4, chat v5 e inicial v1, todos con `verify_jwt: true`. Sus 41 entradas de archivo coinciden con el repositorio después de normalizar CRLF y el final del archivo: 21 coinciden también byte a byte; las otras 20 difieren solamente en esa representación. La whitelist productiva de las cuatro sigue permitiendo exclusivamente el origen de GitHub Pages. El helper productivo adicional v15 se inventarió y no se modificó.

El panel autenticado de URL Configuration no permitió leer la lista completa actual ni las plantillas por falta de login. La evidencia HTTP de la fase anterior fue:

| Comprobación de lectura | Producción | Staging |
| --- | --- | --- |
| `/auth/v1/settings` | Google y email habilitados | Google deshabilitado; email habilitado |
| Token inválido de recuperación, base exacta | Retorna a GitHub Pages `/SIMPLE/` | Retorna a `http://127.0.0.1:4262/` |
| Token inválido, query `?reset=1` | Conserva destino y query | Conserva destino y query en 4262 |
| Dominio `.invalid` ajeno | Rechazado | Rechazado |
| OPTIONS permitido/ajeno | Las cuatro: 204/403 para GitHub Pages | Premium/chat/inicial: 204/403 en 4262; Basic rechaza 4262 con 403 |

Son probes sin seguir redirecciones y con tokens deliberadamente inválidos; no crean ni consumen sesiones reales. El `Vary` efectivo del gateway es `Accept-Encoding, Origin`, que conserva el comportamiento requerido por origen. Producción pasó 20 checks de lectura/gateway, incluidos GET y POST vacío con JWT deliberadamente inválido: los ocho devolvieron 401 antes de ejecutar negocio. Staging inicialmente en 4262 pasó 11 de 12; el resultado Basic 403 corresponde a sus puertos existentes 4194/4195 y se registra como limitación previa.

El baseline de staging anterior al ajuste local era Basic v29, Premium v13, chat v13 e inicial v2, todas con JWT obligatorio. Premium/chat/inicial conservaban su guard específico para `dmqjexigdnfzobarhnib`. El primer plan aditivo introdujo únicamente `http://127.0.0.1:4280` y `http://localhost:4280`, conservando las entradas anteriores y los guards.

`tests/cloudflare/auth-stage-cors.cjs` exige el proyecto exacto de staging y verifica los hashes de los 41 archivos del baseline antes de preparar el payload. Modifica solamente una línea de whitelist por función; su payload `rollback` contiene todos los archivos originales exactos. El script **no despliega**. El plan privado y los bundles anteriores permanecen ignorados por Git. La validación local `auth-stage-cors-test.cjs` pasó 54 casos: orígenes nuevos y anteriores, origen ajeno, conservación de guards y JWT, rechazo de proyecto/hash/JWT alterado y rollback exacto.

Ese primer plan se desplegó únicamente en staging: Basic v30, Premium v14, chat v14 e inicial v3. Una descarga posterior confirmó los 41 archivos contra el payload previsto. En `http://127.0.0.1:4280`, el probe pasó 20/20: retorno base y query de recuperación, rechazo de un destino ajeno, ajustes públicos de Auth, cuatro OPTIONS 204 con ACAO exacto, cuatro OPTIONS ajenas 403 y ocho GET/POST con JWT inválido 401. Otra comprobación OPTIONS pasó 30/30 para las 26 entradas locales anteriores y las cuatro entradas `http://localhost:4280` nuevas. Estos resultados se conservan como fase previa; no son nuevas ejecuciones contra Cloudflare.

La prueba local de CORS real pasó 24/24: Chromium y WebKit, cuatro funciones, dos orígenes 4280 autorizados y un puerto loopback ajeno, con HTTP real y sin interceptación de red. Los primeros diagnósticos con interceptación de Playwright se descartaron como prueba de CORS nativo: Chromium puede omitir esa comprobación cuando se intercepta la red.

## Verificación del despliegue Cloudflare real

Después de publicar las versiones de staging 31/15/15/4, pasaron **24/24 casos CORS nativos** desde documentos HTTPS de `S` y `D`, en Chromium y WebKit. No se sustituyeron páginas ni se interceptó HTTP. Dieciséis respuestas 401 al JWT deliberadamente inválido fueron legibles desde los dos orígenes admitidos; ocho peticiones desde un puerto loopback ajeno quedaron bloqueadas por CORS sin respuesta POST. Se comprobó que cada documento permanecía en el origen solicitado. No se generó ninguna sesión firmada ni se ejecutó negocio/OpenAI.

Evidencia: `tests/cloudflare/results/auth-live-cors-cloudflare-final.json`. El resultado local anterior se conserva por separado en `auth-live-cors-local-4280-final.json`. Los 34 orígenes locales se preservan en el plan Cloudflare y en sus 62/62 comprobaciones locales sobre los prefijos LIVE; no se vuelven a sumar los probes antiguos. Los 41 archivos descargados después del despliegue coinciden con el plan.

El baseline Cloudflare anterior al ajuste fue 6/16, con diez resultados pendientes esperados: dos retornos Auth caían a `http://localhost:3000` y ocho OPTIONS de `S`/`D` aún devolvían 403. La publicación CORS y los 24 casos nativos posteriores resuelven la parte de orígenes; la parte Auth sigue pendiente del panel y no se ha repetido antes de guardar URLs. Este diagnóstico está en `auth-probe-cloudflare-before.json`; no debe presentarse como diez defectos activos.

La verificación de hosting real es **42/42** y la comparación de portada tiene **24 mediciones de rendimiento** con red/caché reales; estas últimas no son casos funcionales ni demuestran una ventaja universal. La fase local/staging anterior conserva 425/425 casos, contados una vez. Ver [README.md](README.md) para identidad, límites y comparación. Ninguna de estas evidencias demuestra Google OAuth real, entrega SMTP o consumo/cambio real de contraseña en Cloudflare.

## Evidencia y límites

- `tests/cloudflare/auth-contract.cjs` ejecuta los handlers originales en una VM aislada para comprobar los retornos bajo `/SIMPLE/`, raíz Cloudflare sintética y localhost, roles de registro, errores de recuperación y limpieza de callback.
- `tests/cloudflare/auth-browser.cjs` utiliza el SDK real pinado con las páginas y la configuración generada; todos los HTTP de Auth/RPC son interceptados y las cuentas son sintéticas. Pasaron 84 casos únicos, Chromium/WebKit, 320/1280 y tres bases. La consolidación sustituye las reejecuciones de 12 casos WebKit OAuth afectados por esperas del harness durante navegación; no suma repeticiones. Se bloquea cualquier otro destino de red.
- `tests/cloudflare/auth-cors.cjs` comprueba el prefijo original de OPTIONS/origen de las funciones versionadas, antes de cualquier llamada de negocio: 20 casos locales pasados.
- `tests/cloudflare/auth-probe.cjs --config ARCHIVO_PUBLICO_JSON` mantiene Auth sobre `appUrl = S` y verifica CORS de los `allowedOrigins`/`corsOrigins` declarados por separado. Su JSON necesita también `supabaseUrl` y `supabasePublicKey`, nunca una clave privada. Con `--invalid-auth` añade GET/POST vacío con JWT deliberadamente inválido: el gateway debe rechazarlos con 401. No publica valores de claves ni tokens.
- `tests/cloudflare/auth-live-cors-browser.cjs --config tests/cloudflare/private/auth-probe-cloudflare-runtime.json` verifica CORS del staging real desde `/404.html` de `S`/`D`, sin interceptar la red y usando exclusivamente el JWT inválido. Sin `--config` conserva el modo local anterior. No es una prueba de login ni de operaciones autenticadas.
- `tests/cloudflare/auth-https-config.cjs` pasó 19 validaciones de configuración HTTPS sin red. Los helpers de CORS Cloudflare preparan payloads y rollback sobre hashes del bundle LIVE; no despliegan por sí mismos.
- Las pruebas con SDK real y HTTP interceptado se identifican como tales. Nunca equivalen a Google OAuth real, entrega SMTP, JWT real, escritura staging o verificación autenticada productiva.
- Los resultados actuales deben leerse en `tests/cloudflare/results/`; no reutilizar recuentos históricos de `CONTEXTO-CODEX.md` como ejecuciones nuevas.
- Google permanece OFF en staging. Registro por correo real, confirmación por SMTP, Google real y recuperación válida/cambio de contraseña no se han probado en Cloudflare. Los estados de fixtures y su limpieza se cierran en el informe general; no declarar cerrado el nuevo recorrido por reutilizar el cierre de la fase local anterior.

Se revisó la documentación oficial actual y el changelog. La URL Markdown de changelog no pudo leerse con la herramienta web; se utilizó [el changelog HTML oficial](https://supabase.com/changelog). Se revisaron los cambios sobre [plantillas de email en el plan Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) y [estado HTTP del endpoint OAuth de la API de gestión](https://supabase.com/changelog/45468-breaking-change-oauth-token-endpoint-will-return-http-200-instead-of-201). Ninguno requiere sustituir Auth ni alterar el SMTP existente para este cambio de hosting.

## Reversión de ajustes aditivos

Antes de añadir nada, registrar las entradas originales y la versión/hash del bundle Edge. Si el nuevo hosting se retira, eliminar únicamente las Redirect URLs que se hayan añadido para ese despliegue y retirar únicamente sus orígenes CORS. Actualmente las dos URLs Auth Cloudflare siguen pendientes: no hay una adición Auth de esta fase que revertir. Conservar Site URL y todos los destinos anteriores.

Para revertir únicamente los dos orígenes Cloudflare de staging, usar el array `rollback` de `tests/cloudflare/private/cloudflare-https-cors-plan-4a8636ab.json`; restaura los cuatro bundles previos a Cloudflare conservando las entradas locales 4280 y JWT obligatorio. `staging-local-cors-plan.json` corresponde a una fase anterior y no debe confundirse con este rollback.

Antes de aplicar cualquier rollback, descargar el estado actual y comprobar que sigue coincidiendo con `deployments` del plan correspondiente; si hay modificaciones posteriores, reconciliarlas para no sobrescribirlas. Restaurar solo en `dmqjexigdnfzobarhnib` y verificar después los 41 archivos originales y OPTIONS anteriores/ajenos. Supabase crea nuevas versiones de función, pero el contenido anterior queda exacto. No restaurar toda la base de datos ni borrar usuarios, perfiles, rutinas o historiales por un problema del frontend.
