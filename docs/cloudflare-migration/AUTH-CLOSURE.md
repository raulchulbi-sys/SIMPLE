# Autenticación real Cloudflare — 15/10/2026

## Resultado

- **GOOGLE OAUTH: REAL PASS**, en Chromium del navegador integrado. Alta y acceso posterior reales; no mocks/interceptación/sesiones sembradas. No nueva prueba OAuth en WebKit, Safari físico o producción.
- **PASSWORD RECOVERY: BLOCKED**, por transporte de correo de staging. Cero correos enviados/recibidos, cero contraseñas cambiadas. Una aceptación HTTP no demostraría entrega.
- **CLOUDFLARE STAGING: DEPLOYED**: `https://simple-staging-raulchulbi.pages.dev/`, deployment `4a8636ab-ec94-42db-b57e-cf43d01230b9`, fuente de aplicación `0aa1d6b6dc6fe0165534b8c7610c1e8a56521709`.
- **CLOUDFLARE PRODUCCIÓN: CONFIGURATION PENDING**. Perfil y cuatro pruebas offline en CUTOVER; sin hosting productivo, merge, DNS o corte.

## Reconciliación

Main `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`; HEAD remoto inicial PR #1 `2800dbfb317e7f579406b525a4412cc406768629`, local `6d6433c9c91f14986588cd59827f1e6a7e5f7ee6`, mismo árbol `9649eab77a202324af4272c251046a57d79f312c`; worktree de migración limpio inicialmente. Checkout raíz con su trabajo histórico conservado.

Cloudflare confirma 0aa activo, intento a39 cancelado sin publicar, y 2800 skipped, sin nuevo deployment. GET iniciales: HTML staging SHA-256 `3f5dbbb5e4a5b5b987db3c5bafd51b4713243b0a7675c37ad261ec4273e50fa1`; runtime `b555f1c712be3b657bb675b6b5dcc7e75c4cb947c0f9825431fdf95e427cbd73`. GitHub conserva HTML `ec3ab5f1af7d75b1db71110bc9b520737382d503ad5dc3d2dc39cf189e16b946`.

## Google: cambios autorizados y aplicados

Lectura previa: Google OFF y credenciales vacías en staging. Cloud SIMPLE `simple-509717` sólo tenía SIMPLE Web productivo, con origen GitHub y callback Supabase productivo. No se modificó ni se regeneró su secreto.

1. Formulario preparado, captura sin credenciales y confirmación en el momento de crear acceso: «Sí, crear solo el cliente de staging».
2. Creado **SIMPLE Staging Web**, aplicación web: origen `https://simple-staging-raulchulbi.pages.dev`, callback `https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/callback`. Sin cambios en audiencia/publicación/scopes ni facturación.
3. Segunda confirmación expresa del propietario para transferir sus credenciales exclusivamente a Google de SIMPLE Security Test y habilitarlo. Transferencia mediante referencias en memoria y campos del panel, sin clipboard, descarga JSON, archivos, código, capturas de secreto ni Git. Referencia temporal puesta a null inmediatamente.
4. Guardado y lectura posterior: Google ON; Skip nonce checks OFF; Allow users without an email OFF. Settings públicos HTTP200: Google/email true, Apple/Facebook false. Site URL/Redirect URLs/SMTP/linking y otros proveedores intactos.

La solicitud real utiliza email/profile, cliente y callback Supabase de staging, retorno estable Cloudflare. Supabase conserva state/intercambio; sin sistema OAuth nuevo. No apareció una contraseña/verificación/consentimiento que hubiera que eludir en las dos selecciones de cuenta autenticada; si apareciera, lo completaría el titular.

## Dos escenarios reales

Se eligió el buzón de Patata entre los dos autorizados. Antes: cero usuarios/identidades de ese correo en staging. La identidad Supabase productiva no se movió ni modificó.

| Escenario | Evidencia |
|---|---|
| Alta Google | Crear cuenta → Atleta → Google → cuenta autorizada → callback real → completar rol Atleta. Un Auth user, una identidad Google y un perfil client. UUID exacto en evidencia privada. |
| Aislamiento observado | Interfaz cliente sin rutinas ajenas; SQL: rutinas propias 0, asignaciones 0, workouts 0. Coach no aparece. No equivale a una nueva auditoría exhaustiva de ataques RLS; permisos/JWT anteriores conservados. |
| Persistencia / primer logout | Recarga conserva client; Salir y recarga vuelven a bienvenida. |
| Segundo acceso | Login → Google real → misma cuenta; mismo UUID, una identidad y un perfil client. |
| Cierre | Logout y recarga vuelven a bienvenida; SQL auth.sessions para ese UUID: 0. |

No se guardaron entrenamientos, notas, rutinas, asignaciones, intakes u operaciones Coach. El usuario de staging se conserva: esta misión no autoriza borrar cuentas. Tokens sólo en almacenamiento normal del SDK para comprobar persistencia, nunca copiados a resultados/HAR/logs/storageState/Git; sesión finalmente cerrada. No capturas de credenciales.

Evidencia ignorada `tests/cloudflare/results/`: auth-closure-real.json, google-staging-client-prepared.png, google-staging-client-created.png, stage-google-enabled.png y staging-google-atleta-first.png. El JSON conserva buzón/UUID exactos para continuidad; no se publican como assets.

## Recovery: bloqueo sin consumir el envío

SMTP personalizado OFF. Team tiene exactamente un miembro, el propietario; ninguno de los dos buzones autorizados pertenece al equipo. El servicio por defecto sólo entrega a miembros y limita actualmente a dos mensajes/hora. [Fuente oficial](https://supabase.com/docs/guides/auth/auth-smtp).

No se invitó a Patata al equipo administrativo como atajo. No se copiaron secretos SMTP productivos ni se cambiaron remitente/plantillas/URLs/cuotas. No se envió una petición que no permite completar la entrega al destinatario autorizado. La cuenta nueva es Google-only: tampoco existe una contraseña anterior cuyo rechazo se pueda afirmar probado.

Para continuar con el buzón elegido hace falta SMTP de pruebas autorizado: host, puerto, usuario, secreto introducido en el panel, remitente verificado y nombre. No inventar valores, contratar servicios o modificar DNS. Alternativa: autorizar expresamente una cuenta de staging y el buzón del miembro existente; no está autorizado todavía. No ampliar miembros para sortear restricciones.

Con transporte listo: solicitar un único correo desde Cloudflare; recepción por titular; revisar origen/path del enlace sin revelar token; abrir y reconocer sesión recovery. El titular escribe/confirma/envía la contraseña personalmente; verificar confirmación/logout/login. No SQL/Admin API para cambiarla ni tokens/contraseñas en archivos. Enlace usado, recarga de recovery y contraseña nueva siguen pendientes de un enlace legítimo.

### Escape del signo de interrogación

UI: base y `https://simple-staging-raulchulbi.pages.dev/\?reset=1`. En glob, `?` es metacarácter y `\?` exige el carácter literal; no es el destino de navegación. [Sintaxis oficial](https://supabase.com/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls).

Repetidos sólo los dos GET verify inválidos históricos: HTTP303/otp_expired, origen estable; segundo conserva `?reset=1`. **Location crudo sin backslash** ni token válido. Ningún cambio de allowlist; Site URL `http://localhost:3000`. Evidencia auth-closure-native-readonly.json; no sumar esos casos otra vez. No es prueba de correo válido.

## Integridad

Baseline 15/10 08:56:38Z producción / 08:56:40Z staging → lectura 09:35:12Z / 09:35:13Z. Exclusivamente SELECT, sin credenciales.

| Ámbito | Resultado |
|---|---|
| Producción, 34 entradas centrales/identidad estable | 34/34 recuentos y hashes iguales |
| Producción SQL | 214 funciones/owner/grants/search_path, políticas, RLS/ACL y triggers iguales |
| Producción Edge / finanzas | 5 funciones/versiones/metadatos iguales; presupuestos, consumos, reservas y flags iguales |
| Ciclo, ambos | `88c3564c3c49cf9c53fccba89a1e71b5` |
| Staging | 31 entradas iguales; user/identity/profile +1 autorizado cada uno |
| Staging excluyendo sólo UUID nuevo | 34/34 exactamente iguales al baseline |
| Staging backend | 219 funciones/seguridad y 10 Edge sin cambios |
| Patata productivo, R1/R2, historial | En huellas productivas iguales; cero escrituras productivas |

Auth compara identidad/campos estables, sin exigir updated_at/last_sign_in_at iguales ni alterar usuarios para cuadrar huellas. Staging conserva el nuevo usuario de prueba con sesiones cerradas.

## Pruebas, seguridad y continuidad

- **635 casos históricos reutilizados**, no reejecutados en masa. Código de aplicación/backend sin cambios.
- **2 escenarios nuevos Google reales**, interactivos en Chromium integrado: alta y retorno con perfil/persistencia/logout. No inflar cada paso como un caso nuevo.
- **4/4 nuevas pruebas offline** de perfil productivo, production-build.cjs. Artefacto sólo local, no servido; dist reconstruido luego al perfil staging original.
- 2 verify históricos repetidos y settings públicos, evidencia de configuración sin duplicar contadores.
- No nuevas pruebas masivas de entrenamiento, Google WebKit/físico, recuperación válida, DNS, deploy/rollback productivo o llamadas OpenAI.

Cambios de repositorio sólo en plan de revisión, prueba y documentación. Sin lógica Auth/entrenamiento/Basic/Premium/Financial P1. Staging público con Auth/RLS; noindex no es protección; CSP sigue report-only. No se retienen referencias a secretos transferidos; no descargas de credenciales. Cliente OAuth/usuario de staging autorizados se conservan.

Rollback de Google, si se autoriza después: desactivar únicamente proveedor de staging y comprobar settings; no borrar/desvincular cuentas ni tocar cliente productivo. El cliente separado puede conservarse desactivado. Hosting/redirects/CORS: CUTOVER y OPERATIONS; no se ejecutó rollback productivo.
