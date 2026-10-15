# SIMPLE: migración del frontend a Cloudflare

**CLOUDFLARE: PREVIEW DEPLOYED — FINAL CONFIGURATION PENDING**

Estado actualizado el **15/10/2026**, fecha del cliente. La preview permanece en https://simple-staging-raulchulbi.pages.dev/. **Google OAuth y password recovery: REAL PASS** en Chromium integrado, con participación manual del titular para la contraseña. Dos cuentas client de staging autorizadas conservadas, sin entrenamiento y con sesiones cerradas. Fix mínimo de recarga publicado y comprobado; 94 regresiones locales afectadas y 42/42 checks HTTPS de revalidación, sin sumar repeticiones a los 635 históricos. [Evidencia y límites](AUTH-CLOSURE.md). Producción Cloudflare: **CONFIGURATION PENDING**; [plan y rollback](CUTOVER.md). No merge, DNS, Site URL ni cambios productivos.

| Identidad verificada | Valor |
|---|---|
| Proyecto Pages | `simple-staging-raulchulbi`, dedicado exclusivamente a staging |
| URL estable, `S` | `https://simple-staging-raulchulbi.pages.dev/` |
| URL de este build, `D` | `https://e829b4d6.simple-staging-raulchulbi.pages.dev/` |
| Deployment ID | `e829b4d6-2235-44e8-a7f4-a96d875d8946` |
| Fuente desplegada | `eb9eba59ca9589a94a6b09612b0acd4354e9bba7` |
| Referencia local equivalente | `ed4b32be266ba6de3c4b0f70861f3430d2b3a0d4`, árbol `10a89b3e426a9c0fa995ba8741e7536a0f7d87b3` |
| Rama de despliegue | `codex/cloudflare-migration` |
| GitHub App | Instalación `171372329`, limitada a `raulchulbi-sys/SIMPLE` |

La rama de migración parte de `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`; no se ha integrado en `main`. No convertir este proyecto de staging en producción: su URL estable recibe los callbacks de staging. La futura producción necesita otro proyecto/origen estable y un corte expresamente autorizado.

Nota histórica anterior al cierre Auth, superada por el deployment eb9eba5: el check de Cloudflare observado entonces, `65d96659-8aab-41a1-9bd7-a3ae876c232e`, figura cancelado y corresponde a la fuente remota `a39ec11f5c3476c20fedb6b4a21be6fe65ea0675`, con cambios de pruebas/documentación. No publicó assets: `S` y `D` siguen sirviendo la fuente `0aa1d6b…` indicada arriba. En el checkpoint Git previo a esta reanudación, local `cf76bdfd0af1a523e48d602b50010c03f1a2bf78` y ese remoto compartían el árbol `c78dae8c23d4444bc3e9b58de04ba06150de66a6`; el checkout estaba limpio entonces. Ese check cancelado no es un despliegue correcto ni prueba que el filtro de rutas haya omitido el build.

## Arquitectura elegida

Cloudflare Pages con integración Git. Pages sirve solamente `dist/`; GitHub conserva el código y Supabase conserva PostgreSQL, Auth, Google, RPC, RLS, Edge, Storage y todos los datos. No hay Workers, Pages Functions, proxy, framework nuevo, pagos ni otra autenticación.

El proyecto actual es HTML/CSS/JS. `scripts/hosting-build.cjs` empaqueta una lista explícita de archivos públicos, resuelve dependencias de HTML, CSS y JS, valida todas las entradas antes de limpiar una salida y rechaza secretos, rutas inseguras y enlaces simbólicos. El resultado contiene el HTML adaptado y 31 assets existentes, un runtime generado y tres archivos de plataforma: `_headers`, `404.html`, `robots.txt`.

El builder normaliza únicamente CRLF a LF en texto; conserva todos los demás bytes y copia los binarios sin transformación. Así, el checkout Windows y el build Linux producen el mismo artefacto. Los 31 assets existentes del paquete final coinciden exactamente con los blobs del commit base de Git.

No se copian tests, SQL, código Edge, documentos, archivos privados, resultados, fixtures, históricos HTML, Git, dependencias ni configuración interna. `dist/` está ignorado y se reconstruye en cada despliegue.

El cambio del producto consiste en cargar `assets/runtime-config.js` antes del SDK y obtener de él los tres valores existentes: URL de Supabase, clave pública y URL de retorno. No cambia la lógica de autenticación, roles, entrenamiento, edición, historial, UUID, aliases ni Coach. Los demás assets del producto se conservan.

## Entornos

| Destino | Backend obligatorio | Condición |
|---|---|---|
| `local` | SIMPLE Security Test, `dmqjexigdnfzobarhnib` | HTTP loopback con puerto explícito; `/` o `/SIMPLE/` |
| `preview` | SIMPLE Security Test | Proyecto Pages verificado; rama `codex/cloudflare-migration` |
| `production` | `yvguatdqncadkwewlepe` | Otro proyecto/origen estable verificado y rama `main`; requiere decisión posterior de corte |

Una configuración desconocida falla antes de crear el cliente Supabase. No hay fallback a producción, parámetros de URL para cambiar backend ni selección a partir de localStorage. La configuración valida claves públicas y rechaza claves privadas, JWT de usuario, service role y mezclas de proyecto.

El runtime compilado admite el origen estable explícito y el origen exacto de `CF_PAGES_URL` de ese build, ambos dentro del proyecto verificado. No admite otros hashes de despliegue ni otros proyectos por comodines. Auth vuelve a la URL estable explícita. Esto evita añadir un nuevo redirect de Auth para cada hash y no transporta tokens entre dominios.

El runtime del repositorio conserva GitHub Pages en `/SIMPLE/` con el backend productivo y permite exclusivamente localhost/127.0.0.1:4280 con staging. El build sustituye ese archivo por una configuración única del entorno seleccionado; una preview no publica configuración productiva por fallback.

## Build local reproducible

Requiere Node, sin instalación de paquetes ni dependencia nueva de ejecución:

```powershell
$env:SIMPLE_DEPLOY_TARGET='local'
$env:SIMPLE_APP_URL='http://127.0.0.1:4280/'
node scripts/hosting-build.cjs --target local
node scripts/hosting-preview.cjs
```

La preview navegable queda en `http://127.0.0.1:4280/`, exclusivamente con staging. El servidor local no acepta un artefacto productivo ni proxifica Supabase. Para las comprobaciones locales independientes:

```powershell
node tests/cloudflare/runtime.cjs
node tests/cloudflare/build.cjs
node tests/cloudflare/auth-contract.cjs
node tests/cloudflare/auth-cors.cjs
```

La salida informa inventario, SHA-256 por archivo y huella del paquete. El mismo origen/base/configuración produce los mismos bytes; no se incluyen fechas ni identificadores de usuario. Los hashes de dos entornos diferentes pueden diferir por el runtime y los headers esperados.

## Proyecto Cloudflare y publicación futura

La conexión GitHub ya se completó manualmente. La instalación `171372329` autoriza solamente SIMPLE. El proyecto existente es `simple-staging-raulchulbi`; abrirlo en [Cloudflare Dashboard](https://dash.cloudflare.com/) y no crear otro equivalente.

Configuración aplicada: plan gratuito, preset None, raíz del repositorio y salida `dist`. La rama predeterminada de despliegue es `codex/cloudflare-migration`; las demás preview branches están en **None**. Los build watch paths excluyen `tests/**` y `docs/**`, pero el intento cancelado anterior no acredita que ese filtro funcionara. Para el siguiente commit limitado a evidencia/tests/docs se usará el prefijo oficial `[CF-Pages-Skip]`; ver [OPERATIONS.md](OPERATIONS.md).

**Ambos entornos de Pages utilizan staging**, aunque Pages llame a uno de ellos “Production”. Ese nombre de la interfaz no convierte SIMPLE en producción. El backend sigue siendo `dmqjexigdnfzobarhnib`.

Build command:

```sh
node scripts/hosting-build.cjs --target preview
```

Variables públicas, que no contienen secretos:

| Variable | Valor |
|---|---|
| `SIMPLE_DEPLOY_TARGET` | `preview` |
| `SIMPLE_PAGES_PROJECT` | `simple-staging-raulchulbi` |
| `SIMPLE_APP_URL` | `https://simple-staging-raulchulbi.pages.dev/` |
| `CF_PAGES_URL` | Variable automática de Cloudflare; no inventar ni sobrescribir |
| `CF_PAGES_BRANCH` | Variable automática; debe ser `codex/cloudflare-migration` |

Para publicar una modificación futura aprobada, comprobar el build, subirla a la rama autorizada y revisar el nuevo deployment de Pages. Contrastar su SHA y los archivos servidos; el mensaje “Deployment successful” no sustituye la verificación. La URL estable es la entrada preferida para QA funcional. Cada build tiene otra URL `D`: si se quiere utilizar su flujo Edge completo, su origen exacto necesita una adición CORS verificada. El retorno Auth permanece en `S`; no se registra un redirect Auth nuevo por cada hash.

No guardar `OPENAI_API_KEY`, service role, secretos OAuth ni tokens en Cloudflare para este frontend. El destino staging no contiene usuarios productivos. Si se necesita control de acceso adicional, utilizar el mecanismo oficial de preview Access tras verificar permisos y condiciones del plan; no confundir `noindex` con protección de acceso.

El runtime preparado admite únicamente el proyecto `pages.dev` verificado. Un dominio propio aún no elegido exige registrar expresamente ese dominio en la validación y repetir las pruebas afectadas antes del corte; no se acepta automáticamente cualquier hostname ni se configura DNS en esta fase.

## Auth y CORS

El detalle está en [AUTH-CORS.md](AUTH-CORS.md). Site URL productiva y entradas antiguas permanecen intactas. No se crean clientes Google nuevos; el callback Google sigue siendo el endpoint de Supabase del entorno correspondiente.

El 15/10/2026 se guardaron, con autorización expresa del propietario y sólo en staging, `https://simple-staging-raulchulbi.pages.dev/` y el patrón literal `https://simple-staging-raulchulbi.pages.dev/\?reset=1`. La interfaz confirmó dos entradas; la lista anterior estaba vacía y Site URL permanece en `http://localhost:3000`. El panel ya está conectado. El HTTP 303 previo hacia localhost corresponde al baseline anterior a guardar las URLs. Después pasaron **6/6 comprobaciones nuevas**: dos GET de verify con token inválido devolvieron 303 a la base/query correctas con `otp_expired`; cuatro callbacks nativos, Chromium/WebKit, cargaron el frontend con error de enlace, URL limpia, recovery oculto y sin sesión. No añadir `https://**.pages.dev/**` ni cambiar Site URL.

La página Emails muestra que se usan plantillas por defecto y que configurar SMTP propio habilita su edición. En recuperación se observó el asunto `Reset your password`, con Source deshabilitado: no se leyó ni verificó el HTML de la plantilla y no se cambió SMTP.

CORS de staging sí está desplegado: Basic v31, Premium v15, Chat v15 e inicial v4, con JWT obligatorio. Se añadieron exclusivamente los orígenes exactos de `S` y `D`, conservando las 34 entradas locales anteriores entre las cuatro funciones, incluidos `localhost:4280` y `127.0.0.1:4280`. Los 41 archivos descargados después coinciden con el plan. Producción no recibió estos ajustes. Los paquetes anteriores y el rollback están preservados; ver [AUTH-CORS.md](AUTH-CORS.md) y [OPERATIONS.md](OPERATIONS.md).

Google continúa OFF en staging. No se ha probado en Cloudflare registro con correo real, confirmación/SMTP, Google OAuth real ni recepción/cambio de contraseña por recovery. Los probes con tokens inválidos verifican enrutamiento o rechazo del gateway, nunca sustituyen esos recorridos. Las fixtures y su limpieza de esta fase se cierran y documentan en [CHECKPOINT.md](CHECKPOINT.md); no confundir el cierre de la fase local anterior con el de la nueva ejecución Cloudflare.

Al cambiar de origen, el usuario inicia sesión normalmente. No se copian sesiones, borradores o tokens desde GitHub Pages. Los datos remotos siguen en Supabase.

## Cabeceras y seguridad

HTML: `no-cache`. Assets de nombres mutables: `max-age=0, must-revalidate`; no `immutable`. `nosniff`, frame deny, referrer policy y permisos de cámara/micrófono/geolocalización restringidos. CSP inicialmente **report-only** porque existen scripts, estilos y eventos inline; se restringen orígenes al SDK fijado, backend del entorno y la imagen externa ya usada. Esta política no es una CSP de bloqueo ni prueba ausencia de XSS.

No hay redirección SPA general: el `404.html` raíz evita que rutas de tests/SQL/archivos privados respondan con un falso HTML 200. `robots.txt` y `X-Robots-Tag` evitan indexación; no autentican ni sustituyen RLS. HTTPS, headers, recursos, versión servida y exclusión de archivos internos ya tienen comprobaciones sobre las URLs reales de este deployment. Esas comprobaciones de hosting, por sí solas, no acreditan Google ni recuperación válidos.

Endurecimiento posterior: reemplazar progresivamente eventos inline y definir hashes/nonces reproducibles antes de activar CSP estricta. No se realiza ese refactor en esta migración.

## Despliegue, corte y rollback

Ver [OPERATIONS.md](OPERATIONS.md). La preparación y la PR no autorizan corte definitivo, DNS, retirada de GitHub Pages o cambio de Site URL. No se ha generado gasto de OpenAI, contratado plan ni comprado dominio.

El estado de pruebas está en [VALIDATION.md](../../tests/cloudflare/VALIDATION.md) y [CHECKPOINT.md](CHECKPOINT.md). Las evidencias privadas permanecen ignoradas y nunca entran en `dist`.

## Evidencia de esta fase

La fase local/staging anterior conserva **425/425** casos únicos. Son resultados previos a la publicación Cloudflare y no se vuelven a contar como pruebas nuevas de ese despliegue.

Sobre las URLs Cloudflare reales: **42/42 comprobaciones de hosting nativo** y **24/24 CORS nativos** en Chromium/WebKit, sin interceptación. En CORS, 16 respuestas 401 del JWT deliberadamente inválido fueron legibles desde `S`/`D`; ocho pruebas desde un origen ajeno quedaron bloqueadas. No se generaron sesiones firmadas ni llamadas OpenAI para esa verificación. Los resultados están en `tests/cloudflare/results/live-hosting-final.json` y `auth-live-cors-cloudflare-final.json`.

El consolidado de la misión es **635 casos únicos**: 425 de la fase local anterior, 202 de la fase HTTPS anterior y ocho del 15/10 (seis retornos inválidos nativos más dos guardas offline). No se reejecutaron hoy los 627 anteriores ni se suma otra vez la revalidación de los seis contra el script final. Evidencia nueva: `auth-return-native.json` y `auth-return-native-unit.json`, ignorados en `tests/cloudflare/results/`. No acreditan correo, Google ni recuperación válida.

Las **24 mediciones de rendimiento** de `live-performance.json` comparan la portada HTTPS sin sesión de GitHub y Cloudflare: tres muestras por sitio/tamaño/caché, 390/1280 px y CPU 4x. Son mediciones, no 24 casos funcionales adicionales. Cada hosting conserva sus políticas reales de compresión/caché y cada backend sus ajustes públicos de Auth.

| Mediana de carga | GitHub Pages | Cloudflare |
|---|---:|---:|
| 390 px, primera carga | 526 ms | 488 ms |
| 390 px, repetida | 181 ms | 295 ms |
| 1280 px, primera carga | 490 ms | 476 ms |
| 1280 px, repetida | 217 ms | 292 ms |

La muestra no demuestra una ventaja universal: Cloudflare cargó antes en las medianas frías, mientras GitHub reutilizó más contenido en las repetidas. No son métricas de usuarios reales ni una validación de INP o del rendimiento del interior autenticado.

## Costes y límites

Para esta aplicación estática no se requieren Functions/Workers de pago. La documentación oficial de Pages Free, consultada el 14/10/2026, describe 500 builds/mes, un build simultáneo, timeout de 20 minutos, 20.000 archivos y máximo de 25 MiB por archivo. El paquete de 36 archivos está dentro de esos límites. No se ha contratado nada y cualquier servicio futuro facturable requiere autorización separada.

No se promete disponibilidad ni una mejora universal de rendimiento. Supabase y OpenAI conservan sus costes existentes; no se activó un nuevo plan de pago ni se realizaron llamadas OpenAI para validar hosting/CORS. Un dominio propio tendría coste aparte y no se ha comprado. La privacidad y el corte comercial siguen pendientes.

Fuentes oficiales: [Static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Limits](https://developers.cloudflare.com/pages/platform/limits/), [Previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Headers](https://developers.cloudflare.com/pages/configuration/headers/), [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).
