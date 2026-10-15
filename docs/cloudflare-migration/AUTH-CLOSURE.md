# Autenticación real Cloudflare — 15/10/2026

## Resultado

- **GOOGLE OAUTH: REAL PASS**, en Chromium del navegador integrado. Alta y acceso posterior reales; no mocks/interceptación/sesiones sembradas. No nueva prueba OAuth en WebKit, Safari físico o producción.
- **PASSWORD RECOVERY: BLOCKED**, únicamente por cambio de contraseña/login manual aún pendientes. Dos correos reales autorizados recibidos; enlace legítimo y formulario comprobados. SMTP intacto. No declarar todavía cambio de contraseña ni recorrido completo.
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

No se guardaron entrenamientos, notas, rutinas, asignaciones, intakes u operaciones Coach. El usuario Patata de staging se conserva y sus sesiones quedaron cerradas. Posteriormente el propietario autorizó otro perfil client de staging para recovery con su propio buzón: una única identidad Google/perfil, sin entrenamientos. Este segundo perfil mantiene una sesión válida de recuperación para la intervención manual; no se confunde con el entrenador productivo. No borrar cuentas. Tokens sólo en almacenamiento normal del SDK, nunca copiados a resultados/HAR/logs/storageState/Git. No capturas de credenciales.

Evidencia ignorada `tests/cloudflare/results/`: auth-closure-real.json, google-staging-client-prepared.png, google-staging-client-created.png, stage-google-enabled.png y staging-google-atleta-first.png. El JSON conserva buzón/UUID exactos para continuidad; no se publican como assets.

## Recovery: entrega y enlace real comprobados; contraseña pendiente

SMTP personalizado OFF. Team tiene exactamente un miembro, el propietario; ninguno de los dos buzones autorizados pertenece al equipo. El servicio por defecto sólo entrega a miembros y limita actualmente a dos mensajes/hora. [Fuente oficial](https://supabase.com/docs/guides/auth/auth-smtp).

El propietario autorizó después usar su buzón de miembro, crear exclusivamente en staging un perfil client mediante Google y solicitar un correo real. No se invitó a Patata al equipo ni se cambió SMTP, remitente, plantillas, URLs o cuotas. Ambas cuentas nuevas son inicialmente Google-only; no existe una contraseña anterior cuya invalidación se pueda afirmar comprobada.

Primer correo: POST /recover HTTP200 el 15/10 a las 09:58:23Z; recepción en Gmail del titular con remitente Supabase Auth y cabecera de proyecto staging. El titular abrió el enlace en iPhone a las 10:00:40Z, vio el formulario y lo confirmó en el chat; no cambió la contraseña y cerró sesión a las 10:01:06Z. El posterior reuso en Codex fue rechazado correctamente. Logs de sólo lectura distinguen los agentes iPhone/Windows y login/logout; no se atribuye a un fallo de SIMPLE ni a un escáner sin evidencia. No se imprimieron queries de verify/tokens.

El propietario autorizó un único correo adicional. Segundo recibido el 15/10 a las 10:07:09Z, mismo proyecto/destinatario. En Gmail se abrió sólo ese mensaje; se comprobó origen `https://dmqjexigdnfzobarhnib.supabase.co`, path `/auth/v1/verify`, type recovery y retorno estable `?reset=1`, manteniendo token sólo en memoria. Verificación válida a las 10:10:52Z. La herramienta de navegador quedó bloqueada durante esa navegación; al recuperar conexión el formulario estaba abierto, sesión SQL=1 y password_is_set=false. No se repitió la navegación ni se envió otro correo por el bloqueo. Referencias al enlace borradas; Gmail cerrado.

Formulario real entregado al titular para que escriba, confirme y envíe la contraseña personalmente. Pendiente verificar confirmación, logout, login manual con contraseña nueva y persistencia. No SQL/Admin API para cambiarla. Ningún correo adicional sin autorización. Confirmación visual y recepción reales son PASS parciales, no un PASSWORD RECOVERY REAL PASS completo.

## Defecto de recarga reproducido y corrección mínima preparada

Prueba local con frontend y SDK 2.115.0 reales, HTTP completamente interceptado, sin cuentas remotas: el callback válido abría reset y borraba todo el marcador. Tras reload conservaba sesión pero abría la aplicación normal; falló en los tres perfiles GitHub/Cloudflare/local. No es un fallo de transporte Cloudflare ni de contraseña.

`assets/auth.js` ahora conserva únicamente `?reset=1` mientras el reset está abierto; no tokens/hash. Tras reload vuelve a validar getSession/getUser antes de abrir formulario. Cerrar/salir o éxito retiran el marcador. No guarda un flag de autorización en storage ni acepta un callback inválido con una sesión antigua. No modifica OAuth, backend, perfiles, permisos o entrenamiento.

Pruebas finales locales: **48/48** recovery (incluyen **12 nuevos** de reload: tres perfiles × dos motores × móvil/escritorio), **24/24** regresiones OAuth client/trainer, **18/18** VM y **4/4** empaquetado productivo actualizado. El primer lanzamiento de Edge dentro del sandbox falló antes de ejecutar tests; la ejecución autorizada fuera del sandbox reprodujo el fallo, y la final pasó tras el cambio. SDK/HTTP interceptado no se presenta como recovery real. El deployment de esta corrección se mantiene pendiente mientras el titular usa el formulario actual; no forzar su recarga. El código servido sigue siendo 0aa hasta nueva comprobación de Pages.

### Escape del signo de interrogación

UI: base y `https://simple-staging-raulchulbi.pages.dev/\?reset=1`. En glob, `?` es metacarácter y `\?` exige el carácter literal; no es el destino de navegación. [Sintaxis oficial](https://supabase.com/docs/guides/auth/redirect-urls#use-wildcards-in-redirect-urls).

Repetidos sólo los dos GET verify inválidos históricos: HTTP303/otp_expired, origen estable; segundo conserva `?reset=1`. **Location crudo sin backslash** ni token válido. Ningún cambio de allowlist; Site URL `http://localhost:3000`. Evidencia auth-closure-native-readonly.json; no sumar esos casos otra vez. No es prueba de correo válido.

## Integridad

Baseline 15/10 08:56:38Z producción / 08:56:40Z staging. Primer cierre 09:35:12Z/09:35:13Z, confirmado otra vez a las 09:51Z antes de crear la cuenta adicional autorizada para recovery. Exclusivamente SELECT, sin credenciales.

| Ámbito | Resultado |
|---|---|
| Producción, 34 entradas centrales/identidad estable | 34/34 recuentos y hashes iguales |
| Producción SQL | 214 funciones/owner/grants/search_path, políticas, RLS/ACL y triggers iguales |
| Producción Edge / finanzas | 5 funciones/versiones/metadatos iguales; presupuestos, consumos, reservas y flags iguales |
| Ciclo, ambos | `88c3564c3c49cf9c53fccba89a1e71b5` |
| Staging en el primer cierre | 31 entradas iguales; user/identity/profile +1 autorizado cada uno |
| Staging excluyendo UUID Patata en el primer cierre | 34/34 exactamente iguales al baseline |
| Staging backend | 219 funciones/seguridad y 10 Edge sin cambios |
| Patata productivo, R1/R2, historial | En huellas productivas iguales; cero escrituras productivas |

Comparación final adicional, **11:04:04Z producción / 11:04:05Z staging**: 34/34 entradas productivas iguales al baseline inicial; excluyendo únicamente los dos UUID de pruebas autorizados, 34/34 de staging iguales. SQL/owner/grants/search_path, RLS/ACL/policies/triggers, presupuestos y ciclo iguales en ambos. La cuenta de recovery seguía sin contraseña y con una sesión válida pendiente de intervención. No se fuerza su logout por limpieza.

Auth compara identidad/campos estables, sin exigir updated_at/last_sign_in_at iguales ni alterar usuarios para cuadrar huellas. La cuenta de recovery adicional y su sesión pendiente se registran explícitamente; no afirmar después de su creación que sólo hay un usuario nuevo.

## Pruebas, seguridad y continuidad

- **635 casos históricos conservados**, no reejecutados en masa. Tras detectar el defecto se ejecutaron sólo las regresiones Auth afectadas; no afirmar que el antiguo contrato de URL sin marcador sea el vigente.
- **2 escenarios nuevos Google reales**, interactivos en Chromium integrado: alta y retorno con perfil/persistencia/logout. No inflar cada paso como un caso nuevo.
- **4/4 pruebas offline** de perfil productivo, production-build.cjs; repetidas tras el fix de Auth, sin inflar el contador. Artefacto sólo local, no servido; reconstruir dist al perfil staging al cerrar.
- 2 verify históricos repetidos y settings públicos, evidencia de configuración sin duplicar contadores.
- No nuevas pruebas masivas de entrenamiento, Google real WebKit/físico, cambio real de contraseña, DNS, deploy/rollback productivo o llamadas OpenAI. El titular confirmó el formulario recovery en iPhone; esto no acredita Google OAuth móvil.

Cambios de repositorio: plan, pruebas, documentación y la corrección acotada de continuidad del formulario recovery. Sin cambios de sistema OAuth/roles, entrenamiento/Basic/Premium/Financial P1. Staging público con Auth/RLS; noindex no es protección; CSP sigue report-only. No se retienen referencias a secretos transferidos; no descargas de credenciales. Cliente OAuth y dos usuarios de staging autorizados se conservan. La recuperación pendiente permanece abierta para intervención manual.

Rollback de Google, si se autoriza después: desactivar únicamente proveedor de staging y comprobar settings; no borrar/desvincular cuentas ni tocar cliente productivo. El cliente separado puede conservarse desactivado. Hosting/redirects/CORS: CUTOVER y OPERATIONS; no se ejecutó rollback productivo.

Continuación del fix: candidato local sobre `5e1d51f`, aún no enviado a la rama que autodespliega mientras se utiliza el formulario. Una vez finalizada la intervención, reconciliar main/PR, publicar sólo staging y verificar reload real con sesión válida, cierre, callback usado y Google sin nuevo alta. No pedir/leer la contraseña ni enviar un tercer email. Si hiciera falta otro enlace, necesita autorización expresa nueva. Rollback del frontend de staging, una vez exista segundo deployment: volver al 0aa validado y verificar runtime/backend; no SQL ni cambios de cuentas. La versión productiva permanece c818.
