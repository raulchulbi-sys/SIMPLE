# Checkpoint de la migración — 14/10/2026

**CLOUDFLARE: LOCALLY READY — ACCOUNT CONNECTION REQUIRED**

Rama: `codex/cloudflare-migration`. Base exacta: `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`; árbol base `980b5d0203c5606facb66e3f4b7ad18fecd98675`. La promoción de esta rama a main no está autorizada. El SHA final de la rama se obtiene con `git rev-parse HEAD` y se registra en el informe de entrega, evitando un hash autorreferente en este documento.

## Estado de hosting

- GitHub Pages sigue siendo producción: `https://raulchulbi-sys.github.io/SIMPLE/`.
- Main remoto volvió a comprobarse y conserva el SHA base.
- Cloudflare está conectado a la cuenta del propietario. Se comprobó Workers & Pages: «No projects found». La integración oficial está ahora en el login vacío de GitHub; no se instaló la GitHub App ni se crearon proyectos. El agente no aceptó condiciones ni activó facturación.
- No hay URL Cloudflare, HTTPS, DNS, dominio o Git integration desplegados que se puedan declarar probados.
- No hay wrangler, token o account ID configurados para este trabajo. No se buscaron secretos en otros proyectos.
- Se prepara una rama remota y PR draft; no merge ni corte.

## Build validado

`node scripts/hosting-build.cjs --target local`, con destino explícito `http://127.0.0.1:4280/`, produce staging únicamente.

| Propiedad | Resultado |
|---|---|
| Archivos de dist | 36 |
| Árbol SHA-256 del artefacto | `24423fbbd4e2e7609c6deaada0b9a6b13da87f6cb31861032ddebf0a31a21f4f` |
| HTML SHA-256 | `3f5dbbb5e4a5b5b987db3c5bafd51b4713243b0a7675c37ad261ec4273e50fa1` |
| Runtime SHA-256 | `202f61a9655692982c33b095c15ae1675b321b3c768e7328fd6de71d6db7a60f` |
| Assets anteriores | 31/31 idénticos a sus blobs Git |
| Texto / binarios | CRLF→LF únicamente / binarios intactos |

No se publica dist en Git; se reconstruye. El único cambio en lógica del HTML es obtener las tres constantes de configuración del runtime cargado antes del SDK. Auth, OAuth, temas, lógica y assets existentes no se reescriben.

## Pruebas nuevas finales

Cada caso se cuenta una vez; las reejecuciones sustituyen resultados y no se suman. Total **425/425**:

| Suite / evidencia | Casos | Naturaleza |
|---|---:|---|
| runtime.cjs | 24 | Configuración explícita, mezcla de entornos, origen/base y claves |
| build.cjs | 17 | Inventario, rutas, secretos, enlaces, limpieza acotada, LF/CRLF |
| auth-contract.cjs | 18 | Contratos de handlers, retorno, error, reset y sesión |
| auth-cors.cjs | 20 | Prefijos CORS del código versionado, sin negocio |
| auth-stage-cors-test.cjs | 54 | Patch exacto de bundles LIVE y rollback |
| auth-browser.cjs | 84 | SDK 2.115.0 real; HTTP de Auth interceptado |
| browser.cjs | 48 | Ambas bases, motores, temas, tamaños y roles; datos simulados |
| browser-visual.cjs | 4 | 24 parejas PNG idénticas; no se cuentan como 24 tests extra |
| preview-http.cjs | 16 | GET/HEAD/405/404, MIME, query, ETag, headers locales |
| staging-helper-unit.cjs | 8 | Guards y limpieza exclusiva de fixtures |
| staging-runtime-unit.cjs | 7 | Compartición normal y denegaciones exactas |
| staging-cleanup-unit.cjs | 4 | Limpieza acotada y logout de sesión ya revocada |
| auth-probe.cjs: producción | 20 | HTTP real de lectura, callback inválido, configuración pública |
| auth-probe.cjs: staging 4280 | 20 | HTTP real de lectura y gateway JWT inválido |
| Orígenes staging anteriores + nuevo localhost | 30 | OPTIONS reales |
| auth-live-cors-browser.cjs | 24 | CORS nativo Chromium/WebKit, sin interceptación |
| staging-runtime.cjs: API | 7 | JWT reales de dos fixtures nuevas, compartir y leer/aislar |
| staging-browser.cjs | 20 | Login email real, workout UI, readback, persistencia y logout |

Chromium y WebKit; 320/360/390/430/768/1280; claro/oscuro; raíz y `/SIMPLE/`. La matriz amplia usa datos simulados; el recorrido remoto usa dos identidades sintéticas de staging. Se comprobó un único workout desde UI, con series 10 kg/8 reps/RIR 3 y 12 kg/9 reps/RIR 2, y nota sintética. Readback directo, historial, inputs y ciclo 1/1 coinciden tras recargar. WebKit vuelve a leer el mismo workout sin crear otro.

No son pruebas nuevas de Google real, confirmación de registro por SMTP, recepción de recuperación, contraseña cambiada ni login productivo. Se conservan como evidencia histórica las pruebas previas del producto al no cambiar sus fuentes; no se suman los 1.025 casos de la promoción anterior. El probe con token inválido acredita ruta/allowlist, no entrega ni consumo de un enlace válido.

## Integridad remota

Snapshot de lectura: `tests/cloudflare/database-snapshot.sql`. Antes/después coinciden las 32 tablas públicas/privadas y dos agregados de identidad estable Auth: **34/34 huellas y recuentos**. La comparación Auth excluye timestamps de último acceso y otros campos mutables normales; no modifica Auth para hacer coincidir hashes.

| Producción | Antes = después |
|---|---:|
| Usuarios / identidades / perfiles | 7 / 10 / 7 |
| Rutinas / días / ejercicios | 5 / 15 / 86 |
| Asignaciones / notas / workouts | 2 / 218 / 63 |
| Funciones SQL: definición, owner, ACL, security, search_path | 214 idénticas |
| Políticas / RLS y ACL / triggers | Huellas idénticas |
| Ciclo | `88c3564c3c49cf9c53fccba89a1e71b5` |

Patatasimple, R1/R2, workouts, notas, otras rutinas y asignaciones no se tocaron. Financial P1 y presupuestos/reservas/consumos coinciden exactamente. Chat y análisis mantienen sus flags independientes. Premium directo conserva OFF, 0 llamadas/capacidad, 0 USD, 0 elegibles, 0 operaciones y 0 intakes.

Las cinco funciones Edge de producción conservan metadata, versión y ezbr_sha256: helper v15, Basic v3, Premium v4, Chat v5, Premium inicial v1. Los bundles actuales descargados conservan su contenido. No se desplegó producción, ni cambió Auth/OAuth/SMTP/URLs/RLS/SQL/DNS.

Staging vuelve a 9 usuarios, 9 perfiles, 19 rutinas, 33 días, 98 ejercicios, 12 asignaciones, 4 notas y 22 workouts; sus 34 huellas, 219 funciones y políticas coinciden con el baseline. Cero usuarios/rutinas de esta misión, cero reservas, cero incidencias nuevas y cero entitlements Premium activos. Las cuatro muestras iniciales históricas A–D y 225 filas de auditoría anteriores se conservan. Los presupuestos existentes no cambian; generación inicial OFF, 4 consumidas y 0,197165 USD ya registrados.

## Únicas escrituras staging

1. Cuatro bundles LIVE, sin tocar guards/negocio/permisos, añaden exclusivamente `http://127.0.0.1:4280` y `http://localhost:4280` a CORS. Versiones finales: Basic 30, Premium 14, Chat 14, Premium inicial 3; JWT obligatorio. Los 41 archivos coinciden con el plan esperado.
2. Un helper de QA staging, restringido a un reviewer sintético ya autorizado y a fixtures nuevas identificadas por metadata. Al terminar se retiró: versión 2, HTTP 410 `qa_retired`, sin cliente admin, rutas de creación o lectura de secrets. Se verificó su respuesta real. El registro de esa función retirada permanece; no es un helper operativo ni una fixture de datos.
3. Cuentas/estructura sintéticas exclusivamente de esta tarea, eliminadas al concluir. No se crearon tablas, esquemas, SQL RPC o migraciones de negocio.

No quedó un access/refresh token nuevo materializado en archivos, logs, storageState, HAR, trazas, snapshots, resultados o Git. El SDK usó solo contextos efímeros para verificar recarga; se cerraron. Los procesos de sesión se cerraron, las credenciales nuevas se mantuvieron en RAM y se borraron con las fixtures. No se copió ni borró el archivo histórico de credenciales sintéticas previamente existente.

## Hallazgos y límites

- Corregido un bypass local de metadatos Cloudflare: local rechaza `CF_PAGES_URL/BRANCH/PROJECT` y no hereda un origen ajeno.
- Corregida reproducibilidad de LF/CRLF en el builder, sin cambio de fuentes del producto.
- Fallos iniciales de harness: INSERT directo de asignación no autorizado (sustituido por RPC normal de compartir); error de contexto de workout HTTP 400/P0001 (se valida ese rechazo real); dos lecturas legítimas omitidas del guard de red; logout de sesión revocada. Ninguno exigió ampliar RLS o cambiar producto.
- Las primeras pruebas CORS con interceptación de documento no eran evidencia nativa; se sustituyeron por las 24 pruebas sin interceptación.
- CSP permanece report-only, por eventos/scripts inline existentes. No demuestra ausencia de XSS. SDK externo fijado y Tenor existente no se sustituyeron.
- No existe medición de rendimiento Cloudflare. Los 24 ensayos de laboratorio comparan empaquetado local; no prueban una ventaja de CDN.
- Privacidad/legal siguen pendientes para clientes externos; no se activa comercialización.

## Continuación segura

Primero completar el login de GitHub en el panel abierto y la autorización concreta de la App solo a SIMPLE. Ya se revisó la cuenta Cloudflare y no hay proyectos; volver a comprobarlo antes de crear uno si se retoma tras un corte. Después desplegar esta rama con backend staging y dist. Solo cuando exista la URL real, añadir/probar redirects y CORS exactos; el panel Supabase también solicita login para leer su configuración completa. Mantener Site URL y GitHub Pages intactos. El corte, dominio, DNS y merge a main requieren decisión posterior.

Rollback completo de los cuatro bundles staging: sección `rollback` de `tests/cloudflare/private/staging-local-cors-plan.json` (ignorado). Antes de usarlo, comprobar que no haya cambios posteriores; no sobrescribirlos. Ver [OPERATIONS.md](OPERATIONS.md) para reversión de hosting/Auth sin SQL de datos.
