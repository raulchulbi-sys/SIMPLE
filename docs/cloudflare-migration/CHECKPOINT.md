# Checkpoint de Cloudflare — 14/10/2026

**CLOUDFLARE: PREVIEW DEPLOYED — FINAL CONFIGURATION PENDING**

Rama: `codex/cloudflare-migration`. Main inicial y final verificado: `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`. No merge, cutover, DNS ni publicación productiva. El checkout histórico y su trabajo previo se conservan. El SHA final de la rama se registra en la entrega; este documento evita un hash autorreferente.

## Despliegue real

| Propiedad | Valor verificado |
|---|---|
| Cuenta Cloudflare | `4efcd67b8630069e6844153f166781c7`, cuenta del propietario |
| Proyecto dedicado a staging | `simple-staging-raulchulbi` |
| URL estable | https://simple-staging-raulchulbi.pages.dev/ |
| URL inmutable comprobada | https://4a8636ab.simple-staging-raulchulbi.pages.dev/ |
| Deployment ID | `4a8636ab-ec94-42db-b57e-cf43d01230b9` |
| Fuente remota desplegada | `0aa1d6b6dc6fe0165534b8c7610c1e8a56521709` |
| Candidato local equivalente | `1369022d637815cd6b6d7af827d7f325208cc22a` |
| Árbol idéntico local/remoto | `b65f145876784388d3b3f05e9f094019a15eb58d` |
| Rama predeterminada del proyecto | `codex/cloudflare-migration`; builds automáticos ON |
| Otras ramas de preview | None / desactivadas |
| Watch paths | incluir `*`; excluir `tests/**` y `docs/**` |
| Build | `node scripts/hosting-build.cjs --target preview` |
| Salida | `dist`, 36 archivos permitidos |
| Variables públicas | target=preview, project=simple-staging-raulchulbi, APP_URL=URL estable anterior |
| Backend | SOLO `dmqjexigdnfzobarhnib` |
| GitHub App | instalación 171372329 limitada a `raulchulbi-sys/SIMPLE` |
| PR | https://github.com/raulchulbi-sys/SIMPLE/pull/1 — draft, sin merge |

El propietario había conectado la App a todos los repositorios; se redujo el alcance a SIMPLE y se reabrió la configuración para confirmar su persistencia. No se concedió acceso administrativo a otros repositorios. Los repositorios públicos continúan siendo públicamente legibles.

Cloudflare denomina «Production» a la rama predeterminada de este proyecto aislado. No significa Supabase productivo. Este proyecto y sus callbacks deben permanecer en staging; una futura producción utilizará otro proyecto/origen estable aprobado. No se configuraron Workers, proxy, facturación, dominios ni DNS. La preview es pública, sin Cloudflare Access: sólo sirve frontend/configuración pública y accede a staging mediante Auth/RLS; noindex no es control de acceso.

## Artefacto e integridad pública

HTML Cloudflare SHA-256: `3f5dbbb5e4a5b5b987db3c5bafd51b4713243b0a7675c37ad261ec4273e50fa1`. Runtime HTTPS SHA-256: `b555f1c712be3b657bb675b6b5dcc7e75c4cb947c0f9825431fdf95e427cbd73`. Los dos hosts sirven los mismos bytes. Los 31 assets existentes siguen idénticos a sus blobs Git; sólo se normalizan pares CRLF en texto. Dist, private, capturas e informes generados están ignorados y no entran en Git ni en los assets.

El runtime valida explícitamente origen/proyecto/rama/backend y falla cerrado antes del SDK. Local/preview no pueden seleccionar producción; no copia sesiones entre dominios. El único cambio de integración del HTML es leer las tres constantes públicas del runtime anterior al SDK. Las actualizaciones posteriores al despliegue 0aa son exclusivamente tests/documentación; no cambian la aplicación servida.

GitHub Pages sigue disponible en https://raulchulbi-sys.github.io/SIMPLE/ y sirve el HTML aprobado de main, SHA-256 `ec3ab5f1af7d75b1db71110bc9b520737382d503ad5dc3d2dc39cf189e16b946`.

## Auth: pendiente concreto

El panel de URL Configuration de SIMPLE Security Test pide iniciar sesión y aceptar sus condiciones. Se dejó abierto y se solicitó al propietario completar ese acceso; no se aceptaron términos ni se introdujeron credenciales por él. No se ha leído la lista completa actual ni se ha guardado ninguna URL.

Tras el acceso, añadir sin retirar entradas ni cambiar Site URL:

1. `https://simple-staging-raulchulbi.pages.dev/`
2. `https://simple-staging-raulchulbi.pages.dev/\?reset=1` — escapar el signo literal en la allowlist glob; el frontend envía la query normal.

Los probes previos prueban que ambos retornos nuevos aún caen en `http://localhost:3000`. Google staging está desactivado; email está habilitado. Login email con fixtures sintéticas sí pasó. Google real desde Cloudflare, recepción/confirmación de email y recuperación completa con cambio de contraseña NO están probados. No se enviaron correos ni se cambiaron contraseñas, SMTP, Google Cloud, proveedores o configuración Auth productiva. El callback del proveedor sigue siendo el endpoint de Supabase, no Pages.

## Pruebas, sin sumar reejecuciones

La fase local inicial pasó **425/425** casos. Evidencia y métodos están en VALIDATION/README/AUTH-CORS: runtime24, build17, AuthVM18, CORSrepo20, patchstage54, SDK con HTTP interceptado84, matriz visual/funcional simulada48, comparaciónvisual4, HTTPlocal16, helper8, runtime7, cleanup4, probeproducción20, probestaging4280=20, OPTIONS retenidos30, CORSnativo local24, API JWT sintética7 y navegador local20.

La fase HTTPS añade **202 casos únicos**, para **627 casos superados de la misión**, sin sumar las repeticiones de unidades, el setup API repetido, intentos fallidos de harness ni diagnósticos previos de Auth:

| Suite nueva | Casos únicos | Naturaleza |
|---|---:|---|
| auth-https-config | 19 | configuración exacta estable/despliegue/backend |
| cloudflare-cors-unit | 9 | plan acotado y fail-closed |
| cloudflare-cors-test | 62 | bundles LIVE, 34 entradas locales conservadas, JWT/guards/rollback |
| live-hosting | 42 | 34 HTTP + 8 navegaciones, ambos hosts/motores/temas y 320/1280 |
| auth-live-cors-browser HTTPS | 24 | 16 respuestas 401 legibles + 8 bloqueos de origen ajeno |
| staging-runtime-unit, incremento | 9 | 16 actuales menos 7 ya contadas en fase local |
| staging-cloudflare-browser + resume | 37 | 29 conservadas + 8 pendientes completadas; no 29+37 |

Los 70 cotejos de assets, 64 PNG y 24 mediciones reales de rendimiento son evidencia adicional, no casos extra. Las 24 parejas PNG de la comparación local tampoco inflan el contador. No se reejecutaron las cientos de pruebas históricas de producto ni se suman los 1.025 casos de otra promoción.

### Recorrido autenticado real de staging

SDK 2.115.0 descargado de su CDN, sin routes/interceptación, mocks, SDK offline, siembra de sesión o servidor local. Dos cuentas nuevas con email reservado example.com, cliente/entrenador. Login desde formulario en Chromium y WebKit; rutina compartida mediante el flujo autorizado de RPC. Un único workout UI: dos series 10 kg/8 reps/RIR3 y 12 kg/9 reps/RIR2, nota sintética. El readback nativo y el coordinador compararon UUID y JSON persistido. Recarga, Última sesión, historial, nota y ciclo 1/1 coincidieron. WebKit volvió a leer el mismo workout. El entrenador sólo vio su cliente, rutina, historial y gráfica; logout real comprobado.

El test original leyó el body al actualizarse el contador, antes del await de días y del render: se corrigió sólo su espera, exigiendo historial/controles/SVG visibles. Se reanudaron únicamente lecturas del entrenador con las credenciales ya en RAM; no hubo un segundo guardado. Los informes original e intento 1 se conservaron, y el informe final registra 37 checks únicos.

Límite de observación: cuatro requestfailed iniciales no capturaron el código y cuatro rechazos iniciales de la cola protegida no capturaron el body; siguen sin clasificación retrospectiva. El check de finalización de red de la reanudación cubre sólo ese nuevo recorrido del entrenador. Allí se observaron cancelaciones exactas ERR_ABORTED con otra respuesta 200/204 equivalente y rechazo 403/42501/premium_initial_reviewer_required de la cola a un no-reviewer. No se ignoraron globalmente 403 ni se declara consola/red totalmente vacía. Los errores iniciales no invalidan los readbacks y resultados funcionales observados, pero tampoco se convierten en éxitos inventados.

Evidencias ignoradas: live-hosting-final.json, live-performance.json, auth-live-cors-cloudflare-final.json, staging-cloudflare-browser.json, staging-cloudflare-trainer-resume-attempt1.json y staging-cloudflare-trainer-resume.json.

## Cambios remotos de staging y limpieza

1. Se conservan los CORS locales de la fase anterior (4280). La fase HTTPS añadió exactamente los orígenes estable y de deployment de este proyecto, sin comodines. Basic v31, Premium v15, Chat v15 e inicial v4. Los 41 archivos descargados coinciden byte a byte con el payload previsto; se conservan guards de staging, JWT, negocio y 34 entradas locales.
2. Helper QA exclusivamente staging reabierto con caducidad breve para esas dos fixtures, luego retirado de nuevo: v4, HTTP410 qa_retired comprobado. Sin cliente admin/ruta privilegiada en su versión final. El registro Edge retirado permanece; no es un helper operativo.
3. Se eliminaron exclusivamente los dos usuarios sintéticos nuevos y su estructura/asignación/workout/nota. SQL independiente: task_users=0, task_routines=0, task_workouts=0, task_notes=0. El coordinador cerró sesiones, borró las referencias RAM y terminó. Ningún access/refresh token nuevo se guardó en archivos, HAR, trazas, storageState, resultados o Git; sólo storage efímero del SDK para comprobar recarga. No se copió ni borró el archivo histórico de credenciales sintéticas que ya existía.

Staging final: 9 usuarios/perfiles, 19 rutinas, 33 días, 98 ejercicios, 12 asignaciones, 4 notas, 22 workouts. **34/34 huellas/recuentos iguales** al baseline de esta reanudación; 219 funciones SQL y huellas de RLS/ACL/políticas/triggers iguales. Presupuestos, consumos, reservas y muestras históricas anteriores iguales. Sin migraciones, SQL RPC o tablas de negocio nuevos; sin llamadas OpenAI.

## Producción: comparación read-only

Baseline de esta reanudación 13:35:43Z → final 14:33:30Z: **34/34 huellas/recuentos iguales**, 214 funciones SQL iguales, RLS/ACL/políticas/triggers iguales, cinco Edge con idénticas versiones y hashes. 7 usuarios, 10 identidades, 7 perfiles, 5 rutinas, 15 días, 86 ejercicios, 2 asignaciones, 218 notas y 64 workouts. Auth compara únicamente identidad/campos estables y no exige igualdad de updated_at/last_sign_in_at.

Entre el checkpoint local anterior y esta reanudación ya se había observado 63→64 workouts y cambios agregados de notas/ejercicios con igual recuento. No existe aquí evidencia suficiente para atribuir esos cambios previos a una edición concreta. No se reescribieron ni restauraron datos para hacer coincidir esa huella antigua; la comparación final conserva exactamente el estado actual capturado antes de esta fase.

Ciclo conserva `88c3564c3c49cf9c53fccba89a1e71b5`. Financial P1 sin cambios: análisis consumidas1/cargo0,0307175 USD; Chat consumidas10/cargo0,243427 USD; reservas0, límites y flags existentes iguales. Premium inicial directo OFF, cap0, USD0, elegibles/operaciones/intakes0. Patatasimple R1/R2 y sus datos permanecen en las mismas huellas. No hubo escritura productiva.

## Rendimiento y seguridad

24 navegaciones reales (tres pares por tamaño/origen, CPU4x) muestran menos transferencia HTML en Cloudflare con Brotli, pero GitHub más rápido en caliente por caché600s. No hay mejora universal demostrada. Los datos completos y límites de medición están en VALIDATION.

HTML revalidado, assets con ETag/304, rutas privadas 404/no-store y traversal codificado cerrado con400. CSP sigue report-only por los scripts/eventos inline existentes; no demuestra ausencia de XSS. SDK externo fijado y Tenor existente conservados. No se añadieron analytics, logging de tokens ni secretos Cloudflare. Una revisión de siete informes sanitizados no encontró credenciales/JWT privados/tokens en query.

La revisión automática rechazó una salida que habría volcado payloads privados de despliegue completos. Se abandonó esa salida; la alternativa aceptada comparó sólo hashes/metadatos y el delta CORS, enviando las fuentes exclusivamente a la API de despliegue del proyecto staging. No se eludió la protección.

## Continuación y rollback

Completar únicamente el acceso manual a Supabase para revisar/añadir los dos redirects stage; después comprobar retorno de registro/recuperación y el flujo Google con titular autorizado cuando corresponda. Elegir dominio/URL canónica y aprobar corte es una decisión posterior. GitHub Pages permanece disponible. Privacidad/legal no están listos para clientes externos; no activar comercialización.

Rollback HTTPS exacto en `tests/cloudflare/private/cloudflare-https-cors-plan-4a8636ab.json` (ignorado), distinto del rollback local anterior. Verificar LIVE hashes antes de restaurar; no sobrescribir publicaciones posteriores. No borrar datos ni revertir Financial P1. Si falla este primer deployment, desactivar builds y conservar GitHub Pages; todavía no existe un deployment anterior del nuevo proyecto. Ver OPERATIONS para los pasos posteriores y rollback oficial cuando exista una segunda versión aprobada.
