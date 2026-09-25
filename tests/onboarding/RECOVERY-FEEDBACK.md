# Confirmación de recuperación

Alcance: frontend de recuperación desde el login. El enlace conserva su condición
de visibilidad (tras un acceso fallido) y utiliza el mismo
`resetPasswordForEmail(email, {redirectTo: APP_URL + '?reset=1'})`.

La confirmación persistente solo aparece si la solicitud devuelve una respuesta
sin error. Su texto es genérico: no confirma la existencia de la cuenta ni la
entrega de correo. El título recibe el foco y describe el mensaje mediante
`aria-describedby`; la acción vuelve al login conservando el correo.

Los errores mantienen los campos, incluido el caso HTTP 429. No se reenvía
automáticamente. Volver atrás durante una solicitud invalida únicamente su
respuesta visual; no cancela un envío ya aceptado por el servicio. Una respuesta
antigua no reemplaza otra pantalla ni desbloquea un login posterior.

## Validación local

- `node tests/onboarding/recovery-feedback.cjs`: 72/72 escenarios.
  Vacío/formato, aceptación, texto exacto, foco/teclado, persistencia, error de
  red, HTTP 400/429/500, reintento manual, doble activación y navegación durante
  respuestas tardías de éxito/error. Claro/oscuro; 320 y 1280; Chromium/WebKit.
- `AUTH_WIDTHS=320,1280 node tests/onboarding/browser.cjs`: 92/92 comprobaciones
  de registro, login, roles, persistencia, logout lento, borradores y onboarding.
- `node tests/onboarding/recovery-sdk.cjs`: 28/28 escenarios de SDK:
  callbacks, enlace caducado, sesión ausente, JWT rechazado, respuesta tardía,
  validación de contraseña y contrato HTTP de recuperación.

Los dos scripts de recuperación usan supabase-js 2.115.0 y verifican su SHA-256.
El bundle de prueba va en `tests/onboarding/private/supabase-2.115.0.js`.
Todas las peticiones de Auth son interceptadas. No se crean cuentas, envían
correos ni cambian contraseñas reales. Resultados y capturas van a `results/`,
excluido por Git, y el bundle queda en `private/`, también excluido.

`RECOVERY_PUBLIC=1` permite comprobar el frontend público conservando la
interceptación de Auth. `RECOVERY_CASE=Accepted` limita esa comprobación al flujo
aceptado. La recepción real del correo y el cambio real de contraseña quedan
pendientes de autorización específica; estos tests no los acreditan.

No se cambia SMTP, Site URL, Redirect URLs, OAuth, permisos, RPC ni datos.
