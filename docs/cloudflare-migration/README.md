# SIMPLE: migración del frontend a Cloudflare

La migración está preparada en una rama independiente desde `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`. GitHub Pages sigue siendo producción. La cuenta Cloudflare ya está conectada, sin proyectos existentes; su integración Git está detenida en el login oficial de GitHub y todavía no hay URL de despliegue. No se ha cambiado `main`, DNS, Site URL, Google Cloud ni configuración productiva de Supabase.

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
| `production` | `yvguatdqncadkwewlepe` | Proyecto Pages verificado y rama `main`; requiere decisión posterior de corte |

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

## Primera conexión Cloudflare

Abrir [Cloudflare Dashboard](https://dash.cloudflare.com/). El propietario debe iniciar sesión y completar por sí mismo cualquier aceptación contractual o verificación requerida. No se han leído ni solicitado credenciales de Cloudflare.

Estado actual: ya se pudo consultar la cuenta del propietario y Workers & Pages confirma «No projects found». La conexión oficial de GitHub presenta un formulario vacío de login. El propietario debe completar ese acceso; la concesión nueva de la App se revisará y confirmará en el paso concreto, limitada al repositorio SIMPLE.

Después: Workers & Pages → Create application → Pages → Import an existing Git repository. Comprobar primero proyectos existentes para no duplicar. Conectar únicamente `raulchulbi-sys/SIMPLE`; cualquier instalación de GitHub que amplíe acceso exige aprobación en ese punto. Usar plan gratuito, preset None, raíz del repositorio y salida `dist`.

Para el primer proyecto aislado, seleccionar la rama `codex/cloudflare-migration`; configurar **ambos entornos de Pages para staging**, aunque Pages llame a uno de ellos “Production”. No activar todavía el backend productivo.

Build command:

```sh
node scripts/hosting-build.cjs --target preview
```

Variables públicas, que no contienen secretos:

| Variable | Valor |
|---|---|
| `SIMPLE_DEPLOY_TARGET` | `preview` |
| `SIMPLE_PAGES_PROJECT` | Nombre real del proyecto elegido/verificado en Cloudflare |
| `SIMPLE_APP_URL` | URL HTTPS estable real de ese proyecto, terminada en `/` |
| `CF_PAGES_URL` | Variable automática de Cloudflare; no inventar ni sobrescribir |
| `CF_PAGES_BRANCH` | Variable automática; debe ser `codex/cloudflare-migration` |

No guardar `OPENAI_API_KEY`, service role, secretos OAuth ni tokens en Cloudflare para este frontend. Limitar previews a la rama aprobada y deshabilitar ramas ajenas. El destino staging no contiene usuarios productivos. Si se necesita control de acceso adicional, utilizar el mecanismo oficial de preview Access tras verificar permisos y condiciones del plan; no confundir `noindex` con protección de acceso.

El runtime preparado admite únicamente el proyecto `pages.dev` verificado. Un dominio propio aún no elegido exige registrar expresamente ese dominio en la validación y repetir las pruebas afectadas antes del corte; no se acepta automáticamente cualquier hostname ni se configura DNS en esta fase.

## Auth y CORS

La configuración definitiva depende de la URL **real** de Cloudflare. El detalle está en [AUTH-CORS.md](AUTH-CORS.md). Site URL productiva y entradas antiguas permanecen intactas. No se crean clientes Google nuevos; el callback Google sigue siendo el endpoint de Supabase del entorno correspondiente.

Se deben probar primero en staging las dos entradas exactas de Auth para la URL base y recuperación `?reset=1`, y el origen exacto en los cuatro Edge. No añadir `https://**.pages.dev/**`. El retorno con un token inválido prueba enrutamiento/allowlist, no recepción de correo, login Google ni cambio real de contraseña.

Único ajuste remoto de esta misión: staging conserva sus cuatro bundles LIVE y sus guards, añadiendo los orígenes exactos `http://127.0.0.1:4280` y `http://localhost:4280`. No se añadieron URLs Auth ni orígenes Cloudflare inexistentes. El helper sintético terminó retirado con HTTP 410; las fixtures se eliminaron y los datos vuelven a su baseline. El detalle y el rollback están en CHECKPOINT y OPERATIONS.

Al cambiar de origen, el usuario inicia sesión normalmente. No se copian sesiones, borradores o tokens desde GitHub Pages. Los datos remotos siguen en Supabase.

## Cabeceras y seguridad

HTML: `no-cache`. Assets de nombres mutables: `max-age=0, must-revalidate`; no `immutable`. `nosniff`, frame deny, referrer policy y permisos de cámara/micrófono/geolocalización restringidos. CSP inicialmente **report-only** porque existen scripts, estilos y eventos inline; se restringen orígenes al SDK fijado, backend del entorno y la imagen externa ya usada. Esta política no es una CSP de bloqueo ni prueba ausencia de XSS.

No hay redirección SPA general: el `404.html` raíz evita que rutas de tests/SQL/archivos privados respondan con un falso HTML 200. `robots.txt` y `X-Robots-Tag` evitan indexación; no autentican ni sustituyen RLS. HTTPS y entrega de headers reales deben verificarse una vez exista despliegue; no se afirman como comprobados localmente.

Endurecimiento posterior: reemplazar progresivamente eventos inline y definir hashes/nonces reproducibles antes de activar CSP estricta. No se realiza ese refactor en esta migración.

## Despliegue, corte y rollback

Ver [OPERATIONS.md](OPERATIONS.md). La preparación y la PR no autorizan corte definitivo, DNS, retirada de GitHub Pages o cambio de Site URL. No se ha generado gasto de OpenAI, contratado plan ni comprado dominio.

El estado de pruebas está en [VALIDATION.md](../../tests/cloudflare/VALIDATION.md) y [CHECKPOINT.md](CHECKPOINT.md). Las evidencias privadas permanecen ignoradas y nunca entran en `dist`.

## Costes y límites

Para esta aplicación estática no se requieren Functions/Workers de pago. La documentación oficial de Pages Free, consultada el 14/10/2026, describe 500 builds/mes, un build simultáneo, timeout de 20 minutos, 20.000 archivos y máximo de 25 MiB por archivo. El paquete de 36 archivos está dentro de esos límites. No se ha contratado nada y cualquier servicio futuro facturable requiere autorización separada.

No se promete disponibilidad, rendimiento de una URL inexistente ni condiciones comerciales más amplias que los términos aceptados por el propietario. Supabase y OpenAI conservan sus costes existentes; esta misión no los aumenta. Un dominio propio tendría coste aparte y no se ha comprado.

Fuentes oficiales: [Static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Limits](https://developers.cloudflare.com/pages/platform/limits/), [Previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Headers](https://developers.cloudflare.com/pages/configuration/headers/), [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).
