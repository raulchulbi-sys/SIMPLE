# Preparación de producción — sin ejecutar el corte

Estado a 15/10/2026: **CONFIGURATION PENDING**. La aplicación vigente sigue en GitHub Pages, main `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`. PR #1 continúa en borrador. No se han fusionado cambios, creado hosting productivo, comprado dominio, cambiado DNS, Site URL ni configuración productiva de Auth/CORS.

## Perfil de despliegue para revisión

`config/cloudflare/production-plan.json` es un documento de configuración revisable; no es configuración aplicada ni lo consume la aplicación. Nombre propuesto y sujeto a disponibilidad: **simple-production-raulchulbi**. URL propuesta, **no provisionada ni verificada por HTTPS**: `https://simple-production-raulchulbi.pages.dev/`.

| Campo | Valor propuesto |
|---|---|
| Cuenta Cloudflare | 4efcd67b8630069e6844153f166781c7 |
| GitHub | raulchulbi-sys/SIMPLE; reutilizar App 171372329, sólo este repositorio |
| Rama productiva | main, después de un merge expresamente autorizado y nueva comprobación de HEAD |
| Ramas preview | Ninguna; nunca construir previews contra producción |
| Framework / raíz | None / raíz del repositorio |
| Build | `node scripts/hosting-build.cjs --target production` |
| Salida | dist |
| SIMPLE_DEPLOY_TARGET | production |
| SIMPLE_PAGES_PROJECT | simple-production-raulchulbi |
| SIMPLE_APP_URL | https://simple-production-raulchulbi.pages.dev/ |
| CF_PAGES_BRANCH / CF_PAGES_URL | Automáticas de Cloudflare; no introducirlas manualmente |
| Backend | yvguatdqncadkwewlepe; clave pública revisada en public-backends.json |
| Secretos Cloudflare | Ninguno; no API keys OpenAI, OAuth secrets, service role o sesiones |

Staging permanece en su proyecto/origen actual, con target preview y `dmqjexigdnfzobarhnib`. El build rechaza rama experimental con target production, proyecto/URL discordantes, backend/key cruzados y recursos fuera de la allowlist. La selección del proyecto explícito es una protección de configuración, no una ACL de Cloudflare: hay que conservar las restricciones de rama y acceso en el panel.

Sólo existe el proyecto de staging en Workers & Pages. La cuenta muestra Zero Trust aún sin configurar. El asistente Git de Pages inicia un deployment al crear el proyecto; no hay aquí un perímetro previo comprobado para proteger una primera versión productiva. Por eso **no se crea el segundo proyecto ahora**. No asumir que noindex, CSP report-only o desactivar previews protegen el hostname principal. Si posteriormente se autoriza Access, deberá proteger origen estable y aliases antes de exponer el artefacto productivo. Sin esa garantía, aplazar el proyecto hasta el corte autorizado. No añadir un proxy o una suscripción como atajo.

## Artefacto offline comprobado

`node tests/cloudflare/production-build.cjs` ejecuta cuatro comprobaciones específicas, sin red, servidor ni deploy. Construye dos veces el perfil propuesto; 36 archivos y árbol SHA-256 `09491d852087f21b8796532366aa1add47184bf1bc70ac233c97bff60027d8d6`. Todos los archivos originales de aplicación conservan bytes (sólo CRLF→LF en texto). Cambian el runtime generado y los headers según backend. Ningún SQL, test, informe, credencial, fixture, backup, este plan o documento forma parte del artefacto.

El hostname propuesto se usa exclusivamente como fixture offline. Este resultado no demuestra que exista, esté libre o funcione como deployment. El runtime productivo empaquetado rechaza los orígenes de staging y GitHub; GitHub conserva su runtime de repositorio independiente y sigue funcionando. No copiar el runtime específico de Cloudflare sobre los assets de GitHub.

Headers conservados: HTTPS gestionado por Pages cuando exista, nosniff, DENY, Referrer-Policy, Permissions-Policy; CSP **report-only** por inline existente. HTML no-cache, assets revalidables con ETag, 404 no-store. No declarar CSP enforced ni ausencia de XSS. Las rutas privadas se excluyen por construcción, no sólo por robots.txt. El perfil mantiene noindex durante la preparación; indexación pública queda fuera del corte técnico.

## Cambios externos a presentar antes del corte

Son propuestas; **ninguna aplicada en producción**:

1. Añadir, conservando todas las existentes, las Redirect URLs de Supabase: base productiva nueva y `https://simple-production-raulchulbi.pages.dev/\?reset=1`. El backslash pertenece a la expresión glob de la allowlist; el enlace real será `...?reset=1`, sin backslash. No usar comodines amplios. Si cambia el nombre/dominio aprobado, regenerar plan, runtime y pruebas antes de guardar.
2. CORS: añadir sólo `https://simple-production-raulchulbi.pages.dev` a las funciones LIVE necesarias de Basic, Premium, Chat e inicial, conservando código/guards/JWT y los orígenes vigentes. No desplegar bundles de staging sobre producción. Releer fuentes LIVE y diff mínimo antes de preparar su rollback. No habilitar todos los aliases de deployment ni `*`; si se necesita probar uno, identificarlo y autorizarlo exactamente o usar el host estable protegido.
3. Google: el callback de proveedor permanece `https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback`, no Pages. No cambiar Client Secret, scopes ni cliente productivo por el cambio de hosting. Se usa OAuth mediante Supabase; no se introduce Google Identity Services. Cualquier origen adicional que se considere necesario deberá presentarse aparte, nunca añadirse por suposición. Google real debe verificarse posteriormente desde el origen productivo definitivo.
4. Site URL productiva, si se decide cambiarla como fallback/URL canónica, requiere autorización independiente. Primero capturar su valor y lista de redirects vigentes. Conservar GitHub Pages; no establecer redirecciones permanentes durante la validación.
5. SMTP productivo queda intacto. La prueba de recuperación pendiente de staging no equivale a entrega desde producción ni acredita su plantilla. Validar el enlace de correo real en el host definitivo con buzón/autorización específicos.

## ANTES — puertas obligatorias

1. Cerrar recuperación real de staging: envío único, recepción, enlace legítimo, sesión recovery, cambio manual, logout y login con nueva contraseña. Los retornos inválidos y Google real ya observados no sustituyen este requisito.
2. Confirmar nombre/dominio y aprobación de corte. Verificar nuevamente main, PR, árbol, cambios posteriores y evidencia aplicable; no usar un main antiguo. El main vigente aún carece del builder/runtime de esta PR: no conectar su branch y esperar que el comando funcione antes del merge autorizado.
3. Capturar configuración productiva real: Site URL/redirects, fuentes y hashes Edge/JWT/CORS, presupuesto/flags, funciones/RLS/ACL/policies/triggers, conteos y campos estables de usuarios, rutinas, workouts/notas y R1/R2. Preparar diff y rollback **contra ese estado**, no contra una antigua descarga.
4. Aislamiento del proyecto/origen listo. Auth/CORS aditivos preparados para el hostname exacto, sin retirar GitHub. Mínimo dos artefactos identificados si se pretende rollback interno de Pages; en el primer deployment el fallback es GitHub, no una versión previa inexistente.
5. Revalidar build y scan de archivos/secretos; código de entrenamiento/Auth/Coach sin cambios. No llamadas OpenAI ni writes de prueba productivos.

## DURANTE — sólo tras autorización posterior

1. Aprobar y fusionar el árbol exacto revisado con lease/HEAD comprobado. Conservar GitHub Pages como fallback funcional; revisar su workflow también.
2. Crear/reutilizar proyecto productivo separado y protegido; aplicar variables/branch/no previews. Obtener deployment real y runtime y verificar proyecto/backend antes de abrir acceso. Publicar allowlist únicamente.
3. Aplicar sólo ajustes Auth/CORS expresamente autorizados; comprobar lectura posterior. HTTPS, rutas, assets/hash, headers, caché, ausencia de archivos privados, callback y limpieza de URL.
4. Pruebas reales con titular autorizado: email y Google, roles/persistencia/logout y recovery. Lecturas de entrenamiento e historial. Cuentas productivas sin guardar workouts de prueba; no usar Patata para nuevas generaciones.
5. Si hay dominio elegido, DNS/certificado y redirecciones se ejecutan sólo según autorización específica. No sacrificar parámetros query/hash para enviar usuarios al host nuevo. En un origen nuevo hay que iniciar sesión; no copiar tokens entre dominios.

## DESPUÉS

Comprobar atleta/entrenador, rutinas, historial, Última sesión, notas, gráficas/ciclo, edición/arrastre sin guardar, Coach/reviewer protegidos y compatibilidad Basic/Premium. Reutilizar pruebas históricas donde el código no cambió. Comparar integridad con baseline y separar cambios normales de campos mutables de Auth. Comprobar presupuestos/reservas/incidencias/flags intactos, cero llamadas AI. Revisar errores, CDN/caché y assets sin instalar nuevos analytics o logging de credenciales. Una prueba real sólo se marca PASS cuando fue completada.

## Rollback preciso, sin restaurar bases de datos

| Situación | Acción |
|---|---|
| Antes del corte | No hay producción Cloudflare que revertir. GitHub sigue activo. No tocar datos. |
| Falla el primer deployment | Detener builds de ese proyecto y mantener/recomunicar GitHub; no inventar deployment anterior. |
| Falla una versión posterior | Pages → Deployments → deployment aprobado previo → Rollback; verificar runtime, hashes y backend. Volver a aprobar cualquier escritura obligatoria del panel. |
| Auth/CORS nuevos fallan | Comparar LIVE con backup previo; retirar únicamente destinos/orígenes añadidos por ese corte. Mantener cualquier cambio posterior legítimo y las URLs GitHub. Nunca restaurar bundles completos antiguos sobre producto posterior. |
| Site URL/DNS cambiados con autorización | Restaurar exactamente valores/TTL/registros capturados, verificar HTTPS y recuperación en GitHub. Si nunca se cambiaron, no ejecutar este paso. |
| Backend | No revertir SQL, Financial P1, entrenamientos, asignaciones, revisiones ni usuarios por un problema de hosting. |

Prueba de rollback realizada en esta fase: comprobación offline de aislamiento y disponibilidad actual de GitHub, más revisión del procedimiento. **No se ejecutó un rollback productivo ni un ensayo de un proyecto productivo inexistente**.
