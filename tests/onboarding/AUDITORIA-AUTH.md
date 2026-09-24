# Auditoría y revisión visual de Auth — actualizada el 24/09/2026

Estado: preparado para revisión manual visual local. Auditoría de configuración realizada en lectura. Pendientes correo real, integración con identidad y validación final de publicación. No publicado.

## Repositorio y cambios previos

- Base publicada y base de la rama `codex/onboarding-auth`: `b774d2508816967669591e14a9bd8dba36f978ba`.
- Desarrollo aislado en `.worktrees/onboarding`; no se ha integrado en el candidato de identidad del directorio principal.
- Cambios de producto ya presentes: `index.html`, `assets/auth.css`, `assets/auth.js`, `assets/atlas.webp`.
- Soporte de revisión: `tests/onboarding/.gitignore`, `browser.cjs`, `recovery-sdk.cjs`, `visual-check.cjs`, `preview.cjs` y este `AUDITORIA-AUTH.md`.
- El diff acumulado de `index.html` tiene 64 inserciones y 487 eliminaciones. Principalmente extrae y sustituye el Auth inline por `assets/auth.js`, elimina el bootstrap duplicado y añade las superficies de bienvenida, selección de rol y credenciales. Añade CSS externo, el enlace de logout y el cierre del modal de recuperación. No se debe interpretar el volumen eliminado como eliminación de funciones de entrenamiento.
- La última corrección antes de la petición de continuidad aisló el botón de submit del bloqueo global temporal de clics; Auth conserva su propio bloqueo mientras hay una petición en curso. También corrigió mayúsculas heredadas, el icono nativo de contraseña y el contraste del fondo detrás del logo.
- `git diff --check` del worktree sin errores.
- El directorio principal conserva sus cambios anteriores de identidad: `index.html`, `tests/session-edit/regression-hook.cjs`, `tests/session-edit/regressions.cjs` y los directorios no versionados de identidad/aliases y contexto. No se modificaron durante esta reanudación.
- SHA-256 de su `index.html`: `B84B9089AFB44E2A5786210D334D2E99553FE9A2555F5A1874B2FAC4263BE881`, igual al registrado antes de onboarding.
- Lectura HTTP 200 del HTML publicado: SHA-256 `2B1EB12298893DE6D30A7C2F1F1D60AE1682AC018F0916578DAD0C6BD292B6B9`, igual a la versión publicada de referencia.

El resumen incremental de siete archivos (+219/-25) no es el diff acumulado contra HEAD. Los siete archivos de esa fase eran `index.html`, `assets/auth.css`, `assets/auth.js`, `tests/onboarding/browser.cjs`, `tests/onboarding/recovery-sdk.cjs`, `tests/onboarding/visual-check.cjs` y `tests/onboarding/preview.cjs`: todos dentro del worktree aislado. El árbol principal sigue con sus tres archivos versionados pendientes (+157/-201) y sus archivos anteriores de identidad/contexto; no está limpio y no se han revertido esos cambios.

Antes del último corte se corrigieron el peso heredado del input, la presencia de Atlas detrás del logo, el aspecto y las etiquetas del modal de recuperación, y las carreras de callback/cierre de sesión. El botón de guardar contraseña también conserva bloqueo propio sin heredar la espera global de doble clic. Se añadieron las pruebas con SDK real y la vista local protegida.

Tras el último corte solo se añade una regla CSS de foco (más su comentario) a `assets/auth.css` y se actualiza este informe. La regla específica vence el `outline:0 !important` heredado del botón de contraseña, sin cambiar los estilos del interior de la app. No se reaplican las correcciones anteriores. No hay commit, merge, push ni deploy.

## Configuración observada en el panel

Proyecto inspeccionado: producción, `yvguatdqncadkwewlepe`, PPL-UL app. Inspección de páginas y diálogos, sin escribir campos, pulsar Reveal, cambiar interruptores ni guardar.

| Elemento | Estado observado |
|---|---|
| Site URL | `https://raulchulbi-sys.github.io/SIMPLE/` |
| Redirect URLs | Una sola entrada: `https://raulchulbi-sys.github.io/SIMPLE/` |
| Registro de usuarios | Permitido |
| Confirmación de email | Obligatoria |
| Email | Habilitado |
| Google | Desactivado; Client IDs no muestra valor |
| Apple | Desactivado; Client IDs no muestra valor |
| Facebook | Desactivado; Facebook client ID no muestra valor |
| Resto de proveedores de la lista | Desactivados; no hay proveedores personalizados |
| Acceso anónimo / vinculación manual | Desactivados |
| SMTP personalizado | Activado |
| Host / puerto | `smtp.resend.com` / `465` |
| Nombre del remitente | `SIMPLE` |
| Intervalo mínimo por usuario | 60 segundos |
| Dirección del remitente / usuario SMTP | `no-reply@sim-ple.es` / `resend`, comprobados visualmente |
| Contraseña SMTP | Oculta por el panel; no se reveló ni se verificó su validez |
| Recuperación | Plantilla `Reset your password`, enlace construido con `{{ .ConfirmationURL }}` |
| Caducidad de OTP/enlace por email | 3600 segundos |
| Longitud OTP | 8 dígitos |
| Cambio seguro de email | Activado |
| Cambio seguro de contraseña / exigir contraseña actual | Desactivados |
| Protección contra contraseñas filtradas | Desactivada |

Corrección del informe anterior: la representación textual/accesible y la lectura DOM de la herramienta omitían valores que sí estaban visibles en la captura del panel. El remitente y el usuario no estaban vacíos. No se ha demostrado un fallo de configuración SMTP. La contraseña se mantiene oculta; su validez y la entrega real no se acreditan con una captura. No se ha enviado ningún correo ni cambiado contraseñas/cuentas para esta auditoría.

## Recuperación: límite de la verificación

El código publicado y el candidato local solicitan `APP_URL + '?reset=1'`. Aunque la allowlist solo muestra la URL base, el servidor real acepta el retorno. Se hizo un único GET de `/auth/v1/verify` con tipo `recovery`, un token deliberadamente inválido (`onboarding-readonly-invalid-token`) y el destino `https://raulchulbi-sys.github.io/SIMPLE/?reset=1`, sin seguir la redirección. Respondió HTTP 303 con:

`https://raulchulbi-sys.github.io/SIMPLE/?reset=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=`

Esto verifica el destino efectivo y el caso negativo real, sin emitir correo ni consumir tokens de una cuenta. El código oficial de Supabase Auth admite el mismo origen que Site URL; la query no exige una entrada adicional. **No hace falta añadir Redirect URL para `?reset=1`.** No equivale a haber probado un enlace válido entregado por email.

El frontend captura la intención de recuperación antes de que el SDK retire el fragmento de la URL, sin copiar tokens. Comprueba el usuario con el servidor antes de abrir el formulario. Un callback caducado no aprovecha otra sesión existente para mostrar un reset. Al completar el cambio, `SIGNED_OUT` no borra el mensaje de éxito; los eventos tardíos solo se aplican si su sesión sigue vigente. Los errores tardíos de un intento anterior no sustituyen la pantalla actual.

La plantilla utiliza el enlace de verificación estándar, sin un callback personalizado. La interfaz local muestra un mensaje genérico para no enumerar cuentas y solo ofrece recuperación tras un fallo de login. La entrega del email, el consumo del enlace, su expiración y el cambio real de contraseña siguen pendientes. No hay autorización implícita para cambiar SMTP o las URLs como consecuencia de este informe.

## Qué falta para habilitar OAuth posteriormente

No se han auditado las consolas externas de Google Cloud, Apple Developer o Meta. Los requisitos siguientes son una lista de configuración que debe aportarse o verificarse, no una afirmación de que las aplicaciones externas no existan. No se solicitan secretos en el chat; deben introducirse únicamente en el panel correspondiente.

Callback mostrado por Supabase para los tres proveedores:
`https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback`

- **Google:** cliente OAuth de tipo web, Client ID y Client Secret en Supabase; origen autorizado `https://raulchulbi-sys.github.io`; callback anterior en Google; consentimiento, audiencia y scopes de identidad/email/perfil. Verificar el estado de publicación de la app y sus usuarios de prueba.
- **Apple:** cuenta Apple Developer, App ID con Sign in with Apple, Services ID web, dominio y callback de Supabase registrados, clave de firma y secreto OAuth generado. Introducir el Services ID y secreto en Supabase y prever renovación del secreto como máximo cada seis meses.
- **Facebook:** aplicación Meta con Facebook Login, App ID y App Secret en Supabase; callback exacto en Valid OAuth Redirect URIs; permisos de perfil/email, política de privacidad y requisitos de datos de la aplicación; verificar Live y revisión/verificación aplicable antes de abrirla al público.
- **Común:** probar primero un entorno de staging con callback propio; cuenta nueva, cuenta existente, cancelación, denegación y callback fallido. El rol persistido manda; sin perfil/rol inicial confirmado, el frontend debe pedir completar registro. Solo después de validar cada método deben mostrarse sus botones.

El candidato actual no contiene botones Google/Apple/Facebook. La lectura del perfil y el paso de completar registro están preparados para cuentas que lleguen por otro proveedor, pero esto no equivale a haber implementado y validado un flujo OAuth completo.

## Pruebas y conservación de estado

Resultados vigentes de esta fase (no sumados a las baterías históricas):

- **176/176** contratos locales de onboarding: 22 casos × Chromium/WebKit × 320, 390, 430 y 1280 px. `results/browser.json`. Ya terminados antes del último corte; no reejecutados tras un cambio limitado al contorno de foco.
- **28/28** casos de recuperación: 7 escenarios × Chromium/WebKit × 320 y 1280 px, usando el SDK oficial 2.115.0 con respuestas HTTP locales controladas. `results/recovery-sdk.json`. Incluye callback con query/hash, hash solo, error con sesión previa, ausencia de sesión, token rechazado, respuesta tardía tras salir, petición de email, error de envío, validación y un único cambio de contraseña. Ya terminados antes del corte; no repetidos por un cambio CSS.
- **48/48** comprobaciones visuales y de teclado, ejecutadas después de la corrección final de foco: cuatro pantallas, controles táctiles, ausencia de overflow, foco visible, OAuth oculto, ausencia de peticiones remotas y ventana de altura reducida; ambos motores y los cuatro anchos solicitados. `results/visual-check.json`.
- **1/1** comprobación real del destino de recuperación con token inválido: HTTP 303 conserva `?reset=1`.
- Compilación de ocho scripts inline y `assets/auth.js`, y `git diff --check`, sin errores. El bloque de lógica interior desde `reload()` hasta antes del antiguo bootstrap conserva exactamente sus 255.111 caracteres respecto a la base publicada (SHA-256 `da55507c7809a8ed6f61eafb31935b42a68d8856caf743325644cdd283498088`).

Total funcional/visual: **252/252 locales y 1/1 de redirección real**. El conteo local coincide numéricamente con una batería anterior, pero corresponde a las tres suites detalladas aquí; no son resultados antiguos reutilizados como nuevas ejecuciones.

Incluye navegación, rol de registro, confirmación pendiente, login sin elección de rol, mostrar contraseña, error genérico, petición de recuperación, doble envío, perfil existente frente a metadatos, logout, sesión persistente lenta, perfil concurrente, ausencia de botones OAuth, reducción de movimiento y errores JavaScript.

Los contratos de onboarding usan un doble explícito del SDK; las pruebas de recuperación usan el SDK real con HTTP simulado; la revisión visual utiliza el frontend y SDK reales con las conexiones API bloqueadas. Ninguna acredita entrega SMTP o cambio de contraseña de una cuenta real. No se repitió la batería de identidad. No se crearon fixtures remotas, no hubo escrituras de datos de la aplicación ni cambios de schema, RPC, RLS, permisos o configuración Auth en staging o producción. El único acceso de recuperación al servidor real fue el GET negativo descrito arriba.

## Revisión visual y prueba manual

Se mantiene la dirección de las referencias: marfil `#F7F5F1`, piedra `#E9E5DE`, blanco, tinta `#252929` y texto secundario `#666A68`; Helvetica Neue/Arial, marca SIMPLE espaciada y Atlas como única ilustración protagonista. Un panel de acción, sin slogans, anatomía técnica ni marco de teléfono. En móvil, marca arriba y formulario debajo; en escritorio, Atlas a la izquierda y marca/formulario alineados a la derecha.

La crítica visual detectó y resolvió mayúsculas/peso heredados, segundo control de contraseña, fondo excesivo detrás de la marca, modal de recuperación con estilos oscuros y foco invisible. Las capturas finales esperan a que termine la transición de entrada; no presentan el estado intermedio casi transparente de Atlas.

Capturas: `results/final-{chromium|webkit}-{320|390|430|1280}-{welcome|roles|signup|login|short}.png`. Recuperación: `results/{chromium|webkit}-{320|1280}-recovery.png`. Los PNG/JSON, el SDK descargado y archivos privados siguen excluidos de Git. La verificación de altura reducida no sustituye una prueba con teclado físico de iPhone/Android.

Vista manual: `node tests/onboarding/preview.cjs`, dirección `http://127.0.0.1:4180/`. Sirve la interfaz real y la copia verificada del SDK, con `connect-src 'none'` y `form-action 'none'`: permite revisar pantallas, responsive y controles sin escribir en Supabase. No simula un login exitoso; no sirve para probar autenticación real. Solo sirve los recursos expresamente permitidos, nunca el directorio privado ni el repositorio completo.

## Autorizaciones y pendientes concretos

- **Ningún cambio demostrado como necesario en Site URL, Redirect URLs ni SMTP de producción.** No se propone añadir `?reset=1`, sustituir claves o rellenar campos que ya tienen valor.
- Para probar un correo real falta una cuenta de prueba y un buzón controlado, autorización para emitir esa recuperación y completar manualmente recepción/enlace/cambio. Así se verificarían la clave guardada, el remitente/dominio en Resend y la entrega efectiva. No hacen falta secrets en el chat.
- Para comprobar el correo contra el candidato, el destino debe cargar este candidato en un entorno de prueba autorizado; abrir el enlace en la URL pública actual verifica el frontend publicado anterior. Cualquier configuración de ese entorno/callback se propondrá antes de aplicarla.
- Google/Apple/Facebook siguen ocultos. Configurarlos/activarlos más adelante requiere autorización independiente y pruebas reales; este informe no lo autoriza.
- Antes de publicar también faltan las URLs definitivas de Términos/Privacidad y la integración controlada con el candidato de identidad, con sus regresiones pertinentes. No se ha hecho merge.

**Sí está preparado para una revisión manual visual/navegación. No se declara listo para publicación ni verificado de extremo a extremo por correo.**

## Referencias oficiales consultadas

- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Validación de redirects en Supabase Auth](https://github.com/supabase/auth/blob/master/internal/utilities/request.go)
- [Valores del formulario SMTP de Supabase Studio](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Auth/SmtpForm/SmtpForm.utils.ts)
- [Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook)
