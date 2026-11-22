> HISTÓRICO FECHADO. Para el estado vigente y la arquitectura pública sin Access, consultar README.md, PUBLIC-AUTH-CORS.md y CHECKPOINT.md (16/10/2026). No ejecutar instrucciones antiguas como autorización actual. La inspección de Zero Trust queda descartada; no se requiere completar su alta.

# Autenticación real Cloudflare — cierre 15/10/2026

Actualización de infraestructura posterior: este documento conserva los recorridos reales de Auth ejecutados en `eb9eba5`. La preparación productiva posterior endureció las identidades del builder/runtime, sin cambiar Auth. Staging sirve ahora `8b2f526` (deployment `4eef94ba`), revalidado con cuatro comprobaciones HTTP/nativas sin sesión. No se repitieron Google ni recovery. El proyecto productivo independiente ya existe, pero sólo expone un placeholder sin backend y Access sigue pendiente. El estado vigente está en [PRODUCTION-PREPARATION](PRODUCTION-PREPARATION.md). Los IDs siguientes son evidencia del cierre Auth, no los del deployment actual.

## Resultado

- **GOOGLE OAUTH: REAL PASS**, en Chromium integrado. Alta y retorno reales; revalidación de acceso, recarga y logout sobre el frontend final. Sin mocks, interceptación o sesiones sembradas. No una nueva prueba Google en WebKit/Safari físico o producción.
- **PASSWORD RECOVERY: REAL PASS**, con el buzón de staging autorizado. Dos correos expresamente autorizados recibidos; enlace legítimo, formulario, cambio manual de contraseña, confirmación, login por contraseña, persistencia y logout comprobados. La cuenta era Google-only y carecía de contraseña anterior: invalidar una contraseña previa no es un caso aplicable, no se declara probado.
- **CLOUDFLARE STAGING: DEPLOYED AND VERIFIED**: https://simple-staging-raulchulbi.pages.dev/ . Fuente remota eb9eba59ca9589a94a6b09612b0acd4354e9bba7; deployment e829b4d6-2235-44e8-a7f4-a96d875d8946; URL exacta https://e829b4d6.simple-staging-raulchulbi.pages.dev/ .
- **CLOUDFLARE PRODUCCIÓN: CONFIGURATION PENDING**. Perfil y pruebas offline preparados, pero no proyecto productivo, merge, DNS, Site URL o cutover. GitHub Pages sigue en main c818e35fcb0cfeddb61e8232aaaffba222ea8f4d.

## Reconciliación y publicación de staging

Main y el trabajo histórico del checkout raíz se conservan. La rama remota de migración estaba en 7564b882eac8dbf083f0a667c0af2997f4a4e9a8, equivalente al árbol del padre local 5e1d51f. El fix local ed4b32be266ba6de3c4b0f70861f3430d2b3a0d4 y el remoto eb9eba5 comparten exactamente el árbol 10a89b3e426a9c0fa995ba8741e7536a0f7d87b3. Se verificaron nueve blobs y el árbol antes de mover exclusivamente codex/cloudflare-migration, con lease y sin force.

No se actualizó staging mientras el titular usaba el formulario válido. Tras su confirmación se publicó el fix. El check de Cloudflare finalizó success y los archivos de ambos hosts coinciden con la fuente. HTML SHA-256 3f5dbbb5e4a5b5b987db3c5bafd51b4713243b0a7675c37ad261ec4273e50fa1; runtime d33463ec680b2034bd34e9146fe3531cf6a0b856da876016900770889aaf0d6b. Producción GitHub conserva ec3ab5f1af7d75b1db71110bc9b520737382d503ad5dc3d2dc39cf189e16b946.

Los siguientes cambios documentales pueden tener otro SHA sin alterar el artefacto publicado. PR #1 permanece abierta y en borrador. No confundir el último commit documental con la fuente servida.

## Google: configuración autorizada

Staging no tenía proveedor Google operativo. En el proyecto Google Cloud existente se creó exclusivamente SIMPLE Staging Web tras confirmación en el momento de crear acceso, con origen estable Cloudflare staging y callback Supabase staging. No se modificó el cliente SIMPLE Web productivo ni se regeneró su secreto.

Una segunda confirmación autorizó transferir ID/secret exclusivamente a Google de SIMPLE Security Test y habilitarlo. Transferencia sólo en memoria y campos del panel, sin clipboard, descarga JSON, archivos, logs, capturas del secreto o Git; referencias eliminadas. Google ON, Skip nonce checks OFF, Allow users without an email OFF. Email ON; Apple/Facebook OFF. Sin cambios de SMTP, audiencia, publicación, scopes ampliados, facturación o Auth productivo.

El proveedor real usa email/profile, callback Supabase de staging y retorno Cloudflare estable. Supabase gestiona state/intercambio; no se añadió un sistema OAuth paralelo. Dos altas client autorizadas se conservan, con UUID exactos sólo en evidencia local ignorada; no se trasladaron identidades productivas.

| Recorrido | Resultado observado |
|---|---|
| Alta Patata | Crear cuenta → Atleta → Google → cuenta autorizada → callback real → perfil client. Un usuario, una identidad y un perfil. |
| Aislamiento observado | Inicio cliente vacío, sin rutinas/entrenamientos ajenos; rutinas propias y workouts 0. Coach no aparece. No equivale a una nueva auditoría exhaustiva RLS. |
| Acceso posterior | Mismo UUID y rol; recarga conserva sesión; logout y recarga vuelven a bienvenida. |
| Frontend final | Google real repetido sin nueva alta en eb9eba5; mismo perfil, URL sin credenciales, persistencia y logout. |
| Cierre | Ambas cuentas autorizadas tienen auth.sessions=0, una identidad y un perfil client cada una. No eliminadas. |

## Recuperación real

SMTP personalizado OFF, sin modificación. El SMTP por defecto limita destinatarios a miembros del equipo y actualmente dos correos por hora; los dos buzones inicialmente propuestos no estaban admitidos. No se invitó a nadie ni se cambió SMTP. El propietario autorizó otro perfil client sólo en staging con su buzón admitido para esta prueba.

Primer POST /recover 200 a las 09:58:23Z y recepción real en ese buzón. El enlace fue utilizado primero en iPhone: formulario confirmado por el titular, sin guardar contraseña. Logs de verificación y login/logout y su confirmación permiten explicar el enlace después utilizado/caducado; no se atribuye sin evidencia a SIMPLE o a un escáner.

Se autorizó un único correo adicional: recepción a las 10:07:09Z. Se verificaron origen de Supabase staging, /auth/v1/verify, type recovery y redirect_to estable ?reset=1; token sólo en memoria. Se abrió una vez y la verificación válida quedó registrada a las 10:10:52Z. La herramienta de navegador se bloqueó durante la navegación; al recuperar conexión había formulario y sesión válidos. No se repitió la apertura ni se envió otro correo.

El titular introdujo, confirmó y guardó la contraseña personalmente. Logs: PUT /user 200/user_modified a las 11:13:02Z, seguido de logout204. UI: «Contraseña actualizada. Ya puedes iniciar sesión». SQL: password_is_set=true y sesiones0, sin leer hash ni contraseña. El login manual posterior registró POST /token con grant_type=password, login200 (11:18:03Z y 11:18:40Z). Se comprobó interfaz client, mismo UUID/perfil y persistencia al recargar sobre la versión final; no duplicados. No se conoce ni se guardó la contraseña.

## Defecto real de recarga y fix mínimo

Se reprodujo localmente con frontend/SDK reales y HTTP interceptado: callback válido abría reset y borraba todo el marcador; reload conservaba sesión, pero abría la aplicación en lugar del formulario. Falló en los tres perfiles GitHub/Cloudflare/local. No era un fallo de transporte o de credenciales.

Único cambio de producto, assets/auth.js: conservar sólo ?reset=1 mientras está abierto el formulario y retirarlo al terminar/cerrar/salir. En reload se revalidan getSession/getUser. Sin tokens/hash en URL, flags de autorización en storage o aceptación de un callback inválido con una sesión vieja. OAuth, roles, SDK, backend y entrenamiento intactos.

Postdeploy nativo: con la sesión válida de staging ya establecida por contraseña se abrió ?reset=1; formulario visible, reload conservó formulario y query; Cerrar limpió URL y sesión; otra recarga mostró bienvenida. No se reutilizó el enlace consumido, no se envió un tercer email ni se cambió otra vez la contraseña. Esta revalidación de reload usa sesión real existente; el callback por email real fue validado antes del fix. Las pruebas interceptadas cubren además el callback y reload combinados.

### Redirects

Site URL staging sigue en http://localhost:3000. Base y expresión glob exacta /\?reset=1 conservadas. El backslash escapa el signo literal en la allowlist, no forma parte de la navegación. GET verify inválidos históricos repetidos:303/otp_expired al origen correcto, Location sin backslash. No hubo otra edición de URLs.

## Pruebas y límites

- 635 casos históricos conservados; no reejecutados masivamente ni garantía de cada edición posterior.
- Regresiones locales finales del fix: **48/48 recovery**, **24/24 OAuth client/trainer**, **18/18 contrato VM**, **4/4 build productivo offline**. Total de esa ejecución:94. Recovery incluye12 nuevos escenarios de reload; las repeticiones no se suman como casos nuevos.
- Postdeploy real: **42/42 live-hosting** (34 HTTP, ocho navegaciones Chromium/WebKit ×320/1280 ×claro/oscuro). 70 comparaciones de archivos y64 capturas son evidencia, no checks extra. Es revalidación de una suite ya existente, no42 casos nuevos añadidos a635.
- Primer postdeploy41/42: WebKit320/claro canceló la carga de google-g.png; mismo recurso respondió200 y no hubo excepción JS. Se conservó el informe inicial y se repitió únicamente ese recorrido, sin cambiar producto/criterios:42/42 final. No declarar retrospectivamente la cancelación como un éxito inicial.
- Google real: alta/retorno anteriores y revalidación final; recovery real con intervención del titular. No mocks presentados como pruebas reales.
- Sin nuevas pruebas masivas de entrenamiento, Google real WebKit/Safari físico, corte/rollback productivo, DNS o OpenAI. El formulario recovery sí fue visto por el titular en iPhone.

## Integridad y seguridad

Baseline 15/10 08:56:38Z producción y08:56:40Z staging; comparación11:19:30Z/11:19:31Z:34/34 entradas de producción iguales;34/34 de staging iguales al excluir únicamente los dos UUID nuevos autorizados. 214 funciones SQL productivas/219 staging, owner/grants/search_path, RLS/ACL/policies/triggers y presupuestos/consumos/reservas/flags iguales. Ciclo conserva88c3564c3c49cf9c53fccba89a1e71b5. Cinco Edge productivas y diez staging con idénticas versiones/metadatos. Auth compara identidad/campos estables, excluyendo updated_at/last_sign_in_at y sin leer secretos.

Patata productivo, R1/R2, notas, workouts y demás clientes permanecen dentro de las huellas iguales; cero escrituras productivas. No entrenamientos, rutinas, asignaciones, intakes u operaciones Coach creadas en esta fase. Las dos cuentas de staging autorizadas se conservan, sin datos de entrenamiento; password establecido sólo en la cuenta de recovery y sesiones finales0. Las fixtures financieras A–D no se tocaron.

Staging público con Auth/RLS; noindex no es protección. CSP sigue report-only. El nuevo alias de deployment sirve assets, pero no se amplió CORS de Edge a cada build: los flujos operativos usan el origen estable ya autorizado. No afirmar que las funciones Edge acepten el alias nuevo. Sin credenciales/queries de verify/HAR/storageState/refresh tokens materializados. Evidencias y capturas ignoradas, fuera del artefacto público.

## Continuación y rollback

Preparación productiva en CUTOVER y production-plan.json; no configuración externa aplicada. Requiere elegir origen canónico y autorizar un corte posterior. No crear frontend productivo público sin aislamiento previo comprobado; no contratar Access/pagos como atajo. Cambios futuros de Redirect URLs/CORS siempre aditivos y conservando GitHub; Google mantiene callback Supabase. SMTP productivo no se cambia ni se considera validado por esta prueba de staging.

Rollback frontend staging disponible: deployment anterior4a8636ab, fuente0aa1d6; verificar runtime/backend antes de usar la opción oficial de Pages. No SQL ni borrado de cuentas. La corrección de reload se perdería al revertir y debe constar. Rollback exacto de CORS capturado en el plan privado4a8636ab, distinto del plan local4280. No restaurar bases de datos por problemas de hosting.

Si se autoriza revertir Google staging después, desactivar exclusivamente ese proveedor, preservando cuentas y cliente productivo. No se ejecutó rollback. La revisión automática rechazó anteriormente una descripción demasiado detallada para la PR pública; se mantuvo allí un resumen sin datos personales/evidencia interna. Los informes detallados permanecen locales.
