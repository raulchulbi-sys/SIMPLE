# Accesos sociales — preparado, no activado

Lectura del 24/09/2026 de `/auth/v1/settings`: email habilitado; Google,
Apple y Facebook deshabilitados en producción y SIMPLE Security Test. No se
han leído secrets ni cambiado configuración. El estado público no permite
determinar si existen credenciales externas guardadas pero desactivadas.

`assets/oauth.js` usa `signInWithOAuth` del SDK ya fijado en 2.115.0. El proveedor
solo se ofrece cuando su bandera de verificación explícita está habilitada y
Supabase anuncia que está activo. Las tres banderas están en `false`.
El retorno utiliza la URL raíz aprobada, sin añadir parámetros ni rutas.
El SDK procesa la sesión; la aplicación revalida el usuario y consulta su perfil.
Un perfil existente siempre conserva su rol. Sin perfil, el usuario confirma
Atleta/client o Entrenador/trainer en Completar registro. No se hereda un rol de
metadata OAuth ni de una elección anterior, y no se fusionan perfiles por email.

Se prueba el SDK real con respuestas HTTP locales, incluyendo cancelación,
callback inválido y registro nuevo. Eso NO valida consentimiento, credenciales,
entrega de email ni vinculación real del proveedor. Supabase documenta vinculación
automática por email verificado; queda pendiente comprobarla con cuentas
controladas tras autorizar/configurar cada proveedor. Apple Hide My Email puede
devolver otro email: no debe fusionarse desde el frontend.

## URLs exactas

| Entorno | Callback que se registra en el proveedor | Retorno a la aplicación |
|---|---|---|
| Producción | `https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback` | `https://raulchulbi-sys.github.io/SIMPLE/` |
| SIMPLE Security Test | `https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/callback` | URL HTTPS de revisión a decidir y autorizar antes de OAuth real |

La preview `http://127.0.0.1:4182/review` tiene red bloqueada y SDK ficticio;
no es un destino para OAuth real. No se ha añadido ninguna Redirect URL.

## Única lista de intervención por proveedor

- **Google — preparado sin configuración activa; OAuth real no verificado.**
  Confirmar un proyecto Google Auth Platform propio, audiencia y usuarios de
  prueba; configurar branding, privacidad/condiciones y scopes básicos
  `openid`, email y profile. Crear/confirmar cliente OAuth tipo Web, origen
  `https://raulchulbi-sys.github.io` y callback de producción de la tabla.
  Usar credenciales separadas y callback de staging para la prueba previa.
  Introducir Client ID/secret únicamente en el panel de Supabase y habilitar
  Google cuando se autorice. Probar cliente existente, entrenador existente,
  nuevo usuario, denegación, sesión persistente y logout; solo entonces cambiar
  su bandera de frontend. La verificación de marca/dominio puede requerir
  revisión de Google; no se ha contratado ni habilitado ningún servicio de pago.
- **Apple — preparado sin configuración activa; OAuth real no verificado.**
  Confirmar Apple Developer Program, App ID primario con Sign in with Apple,
  Services ID para web, Team ID, Key ID y clave `.p8` custodiada fuera del repo.
  Registrar dominios/return URLs exigidos por Apple y el callback exacto de la
  tabla. Configurar Services ID y secret firmado en Supabase, solo con autorización.
  El secret del flujo web exige rotación como máximo cada seis meses. Revisar
  el relay privado de correo si se usa Hide My Email. No se asume que Apple
  devuelva nombre en OAuth: se mantiene el comportamiento existente de perfiles.
  Probar las mismas identidades/roles, denegación y relay antes del gate.
  Apple anuncia 99 USD/año (precio regional/exenciones según cuenta); no se ha
  dado de alta ni comprado la membresía.
- **Facebook — preparado sin configuración activa; OAuth real no verificado.**
  Confirmar app Meta propia, producto/caso de uso Facebook Login para web,
  dominio de la aplicación, privacidad y mecanismo/URL de eliminación de datos.
  Registrar el callback exacto en Valid OAuth Redirect URIs. Revisar permisos
  `public_profile`/`email`, usuarios de prueba, requisitos de revisión y paso a
  modo público que correspondan a esa app. Configurar App ID/secret y habilitar
  Facebook en Supabase únicamente con autorización. Probar consentimiento sin
  email, cancelación y cuentas/roles antes del gate. No se han aceptado acuerdos
  ni contratado productos; requisitos comerciales/revisión pendientes de
  comprobar en la cuenta Meta. Su documentación web no fue accesible desde el
  lector durante esta revisión; se contrastó la integración con la guía oficial
  de Supabase y no se presupone aprobación de Meta.

SMTP, recuperación por email, Site URL y Redirect URLs se mantienen. Las URLs
de privacidad/condiciones reales de SIMPLE siguen pendientes de facilitar;
no se inventaron documentos ni URLs para superar verificaciones externas.

## Fuentes oficiales consultadas

- [Supabase: Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google: OAuth web](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Supabase: Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Apple: configuración web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
- [Apple: membresía](https://developer.apple.com/programs/enroll/)
- [Supabase: Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook)
- [Meta: flujo de login](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [Supabase: vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking)
