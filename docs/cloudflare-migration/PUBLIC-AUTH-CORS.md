# Frontend público: preparación de Auth y CORS

Estado a **16/10/2026**: **PROPUESTA DE PRODUCCIÓN, SIN APLICAR**. Cloudflare Pages puede servir los archivos públicos; Auth, JWT, RLS, RPC y permisos del backend deben proteger las cuentas y los datos. CORS limita el uso desde navegadores y no sustituye esa autorización: un cliente HTTP puede omitir o inventar `Origin`.

La decisión actual no exige Cloudflare Access, tarjeta, suscripción ni facturación. El proyecto `simple-raulchulbi` sigue con su placeholder inerte; GitHub Pages mantiene la aplicación vigente. Este trabajo no publica la aplicación, fusiona main ni cambia Google, Auth, SMTP, plantillas, Edge, RLS, datos, cuotas o finanzas. La validación de seguridad del frontend público y la autorización posterior de corte siguen siendo puertas independientes.

## Identidades que deben conservarse

| Entorno | APP_URL / hosting | Backend |
|---|---|---|
| Producción vigente | `https://raulchulbi-sys.github.io/SIMPLE/` | `yvguatdqncadkwewlepe` |
| Producción futura, provisional | `https://simple-raulchulbi.pages.dev/` | `yvguatdqncadkwewlepe` |
| Staging independiente | `https://simple-staging-raulchulbi.pages.dev/` | `dmqjexigdnfzobarhnib` |

El hostname `pages.dev` puede ser la entrada principal si recibe aprobación posterior. No necesita un dominio de pago. Staging conserva su proyecto y sus callbacks; no se convierte en producción. No se publicará una preview alternativa con backend productivo para eludir los límites de esta misión.

## Contrato real del frontend

`index.html` obtiene `APP_URL` del runtime antes de crear el cliente Supabase y captura el propósito del callback antes de que el SDK consuma el fragmento. `assets/auth.js` y `assets/oauth.js` ya centralizan los siguientes destinos; no necesitan cambios de producto para cambiar el hosting:

| Flujo | Valor enviado por el frontend | Destino futuro solicitado |
|---|---|---|
| Login con contraseña | `signInWithPassword({email,password})`; sin `redirectTo` | Permanece en el origen donde se inició el login |
| Google | `signInWithOAuth(...options.redirectTo=APP_URL)` | `https://simple-raulchulbi.pages.dev/` |
| Alta y confirmación de correo | `signUp(...options.emailRedirectTo=APP_URL)` | `https://simple-raulchulbi.pages.dev/` |
| Solicitud de recuperación | `resetPasswordForEmail(...redirectTo=APP_URL+'?reset=1')` | `https://simple-raulchulbi.pages.dev/?reset=1` |
| Callback fallido o caducado | Captura de error y arranque Auth existentes | Login con aviso; reset oculto; URL limpiada |

El modal válido de recuperación y el cambio de contraseña pertenecen al flujo existente. No se añade un callback `/auth/confirm`, un flujo PKCE nuevo, un proveedor, ni una ruta ficticia. La pantalla «Revisa tu correo» conserva su contrato de éxito/error. Los roles se obtienen de `profiles`; el metadato de alta no concede permisos por sí mismo.

El cambio de origen no transporta la sesión de `localStorage`: el usuario iniciará sesión en el origen nuevo mediante el mismo proyecto Auth. No copiar tokens entre dominios, sembrar sesiones ni crear perfiles/cuentas nuevos para simular esa continuidad. Google y recuperación reales de staging ya tienen evidencia histórica; no se repitieron aquí.

## Google Cloud: adición preparada, no guardada

Lectura acotada del **16/10 a las 08:41:48 UTC**, proyecto `simple-509717`, cliente existente **SIMPLE Web**:

| Campo | Valor actual conservado | Adición propuesta |
|---|---|---|
| Authorized JavaScript origins | `https://raulchulbi-sys.github.io` | `https://simple-raulchulbi.pages.dev` |
| Authorized redirect URIs | `https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback` | Ninguna |

Una autorización posterior permitiría añadir exclusivamente el origen Cloudflare a la primera sección y releer las dos listas. El origen no lleva `/SIMPLE/`, path ni barra final. El callback sigue siendo Supabase; no se sustituye por Pages. No se abrieron secretos, crearon clientes ni guardaron campos. La documentación oficial distingue el origen de la aplicación y el callback del proyecto. [Supabase: Google, Project setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Supabase: URLs exactas futuras

La lectura productiva del **16/10** confirma Site URL y única Redirect URL como `https://raulchulbi-sys.github.io/SIMPLE/`, iguales al baseline del 15/10. Se conserva esa configuración; cualquier lectura posterior del panel tiene prioridad sobre esta evidencia fechada.

Después de una autorización específica, añadir únicamente estas dos entradas a Redirect URLs de **producción**:

```text
https://simple-raulchulbi.pages.dev/
https://simple-raulchulbi.pages.dev/\?reset=1
```

El segundo valor es un patrón: `\?` representa el carácter literal `?`. La URL enviada por el navegador es `https://simple-raulchulbi.pages.dev/?reset=1`, sin backslash. Supabase usa glob: `?` sin escapar representa un carácter, y recomienda rutas exactas en producción. No añadir `**.pages.dev`, hashes de deployments, aliases, paths abiertos ni destinos arbitrarios. El runtime conserva APP_URL estable aunque admita el origen exacto de su build. [Supabase: Redirect URLs y patrones](https://supabase.com/docs/guides/auth/redirect-urls).

La Site URL es el destino por defecto cuando no se solicita otro retorno; no se cambia durante esta preparación. Mantener GitHub en la allowlist permite continuar y volver al hosting anterior. Tras un cambio autorizado, el probe de token deliberadamente inválido deberá conservar la base y `?reset=1`, rechazar un origen ajeno y no entregar credenciales. Eso verifica enrutamiento, no sustituye una confirmación, Google o recuperación válidos con un titular autorizado.

## Plantillas: evidencia y propuesta

La relectura productiva del **16/10** confirma que confirmación y recuperación utilizan `{{ .ConfirmationURL }}` y no contienen hosts de aplicación escritos de forma absoluta. Recovery conserva el asunto «Reset your password» y confirmación «Confirm your email address». La vista Source estaba disponible y «Save changes» deshabilitado; no se modificó ni envió nada. Coincide con las capturas/hashes del 15/10. No se obtuvo configuración Auth completa que pudiera revelar secretos OAuth/SMTP.

| Construcción del enlace | Comportamiento relevante | Propuesta |
|---|---|---|
| `{{ .ConfirmationURL }}` | URL de verificación generada por Auth, con el retorno solicitado y permitido | Conservar el enlace verificado |
| `{{ .SiteURL }}` en un enlace de acceso | Apunta al Site URL actual, que continúa en GitHub | Identificar usos reales antes del corte; no sustituir a ciegas |
| `{{ .RedirectTo }}` | Representa el destino solicitado por la operación Auth | Revisar el contexto si se utiliza; no sustituye por sí solo la verificación |
| URL absoluta escrita en plantilla | Seguiría apuntando a ese dominio | Inventariar y proponer una corrección sólo si se observa |

Las variables y la generación de ConfirmationURL están documentadas por Supabase. Un enlace directo a RedirectTo no verifica automáticamente el token. SIMPLE no tiene una nueva ruta servidor para consumir un `token_hash`; no se propone introducirla. [Supabase: Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

El changelog actual se descargó como Markdown y se revisó el cambio de personalización de plantillas Free del 03/06/2026: afecta a proyectos Free nuevos con SMTP predeterminado, mientras los existentes conservan sus plantillas. No exige cambiar estas plantillas existentes ni autoriza contratar SMTP o facturación. [Changelog: cambios en Email Templates Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

## Edge LIVE y changeset CORS

Se descargaron los **ocho bundles** y se contrastaron con una segunda lectura independiente de metadatos el **16/10 a las 09:16:47 UTC**. Producción y staging conservan **41 archivos cada uno**, `verify_jwt=true`, identidades y hashes correspondientes. No se desplegó ninguna función.

| Función | Versión producción actual | Siguiente versión estimada* | Archivos | Versión staging actual |
|---|---:|---:|---:|---:|
| `simple-coach-mock` — Basic | 3 | 4 | 10 | 31 |
| `simple-coach-premium` — Premium, incluidos contratos semanales/directos | 4 | 5 | 9 | 15 |
| `simple-coach-chat` — chat y sus políticas | 5 | 6 | 11 | 15 |
| `simple-coach-initial-premium` — generación inicial | 1 | 2 | 11 | 4 |

*No hay versiones propuestas desplegadas: Supabase asignará las reales después de una autorización y una nueva lectura. Si existe una publicación intermedia, se detiene el plan y se revisa otra base. La tabla no autoriza consumo de proveedores ni prueba los recorridos de negocio. Reviewer, recomendaciones, análisis y check-in también dependen de RPC/contratos de autorización; no se crean rutas CORS nuevas por cada pantalla ni se confunde el preflight con una prueba de esas operaciones.

Las cuatro ramas productivas aceptan actualmente sólo el origen `https://raulchulbi-sys.github.io`. El changeset añade **exclusivamente** `https://simple-raulchulbi.pages.dev`, preservando GitHub. Cambia una declaración CORS en cada `index.ts`: **cuatro archivos cambian y 37 quedan byte a byte iguales**. Los guards de entorno, JWT, cuerpos, cuotas, finanzas, imports y negocio permanecen iguales. No se desplegarán bundles de staging sobre producción.

Staging conserva sus 34 entradas locales, el origen estable `https://simple-staging-raulchulbi.pages.dev` y el origen exacto histórico `https://4a8636ab.simple-staging-raulchulbi.pages.dev`. El origen productivo propuesto continúa denegado allí. Este changeset no altera ninguna rama ni bundle de staging.

`production-cors-plan.cjs` fija proyecto, origen, versiones, hashes de bundle y fuente completa; necesita metadatos independientes con menos de 30 minutos. Rechaza drift, otro backend/origen y modificaciones adicionales. `patchEntry` repetido sobre el par exacto GitHub/Cloudflare devuelve los mismos bytes y ninguna adición; listas desconocidas se rechazan. El preparador sigue exigiendo la base LIVE fijada: si ya se aplicó el cambio, la futura operación debe comprobar el estado deseado y omitir el redeploy, no ignorar el bloqueo de drift.

El plan permanece siempre `reviewOnly=true` y `applyAllowed=false`, incluso con recibos de revisión sintéticos completos. No contiene cliente de red ni comando de deploy. El gate `originProtected` se sustituye por **`publicFrontendSecurityValidated`**, ligado al origen exacto y pendiente hasta la evidencia real del coordinador. Access deja de ser requisito. Se mantienen propiedad, staging, backup, rollback y aprobaciones obligatorias; pasar validaciones técnicas no autoriza el corte.

## Comprobaciones nuevas y límites

**8/8 unidades del plan afectadas**: siete casos existentes revalidados y un caso nuevo de gate público. Cubren origen exacto, adición idempotente en las cuatro funciones, GitHub conservado, rechazo ajeno, guards de staging, 41 archivos, rollback exacto, drift y ausencia de autorización implícita. Son pruebas offline de prefijos/serialización; no cruzan RPC ni llaman a un proveedor.

**32/32 OPTIONS HTTP reales**, sin POST, sesión, correo o llamadas de negocio:

| Origen enviado | Producción, cuatro funciones | Staging, cuatro funciones |
|---|---|---|
| Entrada vigente de cada entorno: GitHub / Cloudflare staging | 204, ACAO exacto | 204, ACAO exacto |
| Cloudflare producción propuesto | 403 | 403 |
| Ajeno reservado `.invalid` | 403 | 403 |
| Sin cabecera Origin | 204, sin comodín | 204, sin comodín |

Se comprobó `Vary: Origin` en los preflights admitidos y ausencia de reflexión del origen ajeno en los denegados. Un OPTIONS sin Origin permitido no autentica una llamada posterior. Estas lecturas demuestran estado HTTP actual, no enforcement CORS de navegador ni acceso autorizado a datos. No se repitieron las 635 pruebas históricas, las 103 posteriores ni Google/recovery reales.

## Evidencia y reversión futura

Todos los archivos siguientes están en `tests/cloudflare/private/` o `results/`, ignorados por Git y excluidos del hosting:

- `private/public-auth-cors-production-before-20261016.json`, SHA256 `3dfc29ca5f6fc0f34ebe0399df949b071209b158f161b9b54da0089e39856660`.
- `private/public-auth-cors-staging-before-20261016.json`, SHA256 `4740b37dda07df2a2745e76b5e01d930d6c0c54af0070adc9bd7a2716fdb59bb`.
- `private/public-auth-cors-{production,staging}-live-read-20261016.json`: metadatos independientes, sin fuentes ni secretos.
- `private/public-auth-cors-production-plan-review-20261016.json`: payload aditivo completo, originales y rollback de los 41 archivos; ninguna aplicación remota.
- `results/public-auth-cors-source-inventory-20261016.json`: hashes completos de snapshots, bundles, fuentes y entrypoints por función.
- `results/public-auth-cors-options-20261016.json`: los 32 estados/cabeceras observados.
- `private/public-production-email-templates-readonly-20261016.json`: relectura UI de Site URL, Redirect URL y enlaces/asuntos de ambas plantillas el 16/10, sin cambios ni correo.
- `private/google-production-origins-readonly-2026-10-16.json`: campos públicos Google del 16/10. `production-auth-urls-before.json` y `production-{signup,recovery}-template-readonly.json` conservan el baseline del 15/10; no secretos.

Tras una autorización posterior: releer todas las fuentes/metadatos y configuración, comparar la base, conservar backups, aplicar únicamente el diff aprobado y registrar versiones/hashes reales. Volver a leer los 41 archivos y comprobar tanto GitHub como Cloudflare. El rollback usa los originales exactos sólo si versión, identidad y fuentes actuales siguen siendo las del plan aplicado (`assertRollbackSafe`); si hay una publicación posterior, se rebasa una reversión sólo de origen. Nunca sobrescribir negocio posterior ni restaurar la base de datos por un incidente de hosting.

Para Auth/Google, una reversión autorizada retiraría exclusivamente las entradas nuevas, tras comprobar que siguen siendo las del cambio; Site URL, origen GitHub y callback Supabase permanecen. El placeholder y GitHub siguen disponibles. No hay retirada del hosting anterior, cambio DNS, autorización de email real, producción Google Save ni corte implícito en este documento.
