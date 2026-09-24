# Interior completo de SIMPLE y preparación OAuth

Base publicada: 36dc00f734d9b7db84e98e2f7e11678342a3d1cd. Rama aislada codex/interior-visual.
Cierre del 24/09/2026; sin merge, push ni despliegue.

## Diseño y alcance

Se conserva la primera entrega y se extiende su paleta crema, piedra y antracita a Crear rutina, ambos editores, Ver cliente, entrenamiento, historial, gráficas, papeleras y modales existentes. Logo aprobado, tipografía del onboarding, campos legibles, acciones principales/secundarias/destructivas y foco visible. Sin nuevos indicadores, vistas de producto, imágenes interiores o tipografías externas. El progreso sigue siendo X/N del ciclo actual.

assets/interior.css centraliza tokens y componentes bajo #app, modales interiores, descanso y toast. Las reglas estructurales antiguas se conservan en la capa simple-legacy; se retiran prioridades de presentación y reglas de decoración de papelera sustituidas. Auth y recuperación quedan fuera del ámbito interior. La comparación de estilos calculados de Auth con la versión publicada pasa 24/24.

Crear rutina y ambas papeleras ya usan el sistema completo. Papelera vacía/llena responde a su contenido; restaurar parcialmente mantiene el estado lleno. Los errores de restauración/eliminación no muestran éxito. La eliminación definitiva se probó únicamente con una rutina sintética, verificando que sus workouts permanecen intactos.

No se cambian payloads, consultas, UUID, aliases, fórmulas, RLS, RPC ni lógica interior. Las funciones de identidad/persistencia conservan su código exacto. Entrenamiento mantiene duración desde el primer check, nodo estable del cierre de descanso y un solo guardado estático al final. Reordenación y scroll conservan los controladores existentes.

## OAuth

assets/oauth.js centraliza Google, Apple y Facebook mediante signInWithOAuth. Dos condiciones para mostrar un proveedor: verificación explícita y disponibilidad anunciada por Supabase. Las tres banderas están desactivadas, por lo que siguen ocultos en producto.

Un perfil existente conserva su rol. Un usuario sin perfil confirma el rol en Completar registro antes de insertarlo. No hay fusión de cuentas por email en frontend. Se corrigió un defecto mínimo del callback: cuando el SDK consumía un enlace inválido antes de inicializar la UI, ahora se muestra el error correspondiente, conservando solo un booleano de intención, nunca tokens.

Ver [OAUTH.md](OAUTH.md) para la única lista de configuración externa, callbacks exactos, autorizaciones y pruebas reales pendientes por proveedor. Los 32 casos del SDK real usan HTTP interceptado; no equivalen a OAuth real. No se activó ningún proveedor ni se cambió SMTP, Site URL o Redirect URLs.

## Preview y capturas

Desde este worktree: node tests/interior/preview.cjs

- Preview: http://127.0.0.1:4182/review
- Galería: http://127.0.0.1:4182/gallery

El selector permite atleta/entrenador, nombres largos, vacío, papelera llena, historial/gráficas y estados de carga/error. Para ver los botones sociales preparados: Onboarding + OAuth preparado. Están desactivados y etiquetados como no configurados.

Datos ficticios en memoria, SDK local y CSP connect-src none. Los botones navegan por componentes reales; la preview no guarda ni se conecta a Supabase. Los guardados se verificaron por separado en staging autenticado. Hay 312 capturas finales y 3 anteriores de Crear rutina y Papeleras, fuera del commit. La galería permite compararlas.

Chromium y WebKit a 320, 360, 390, 430, 768 y 1280 px; los casos específicos de foco usan 320/390/430/1280, y Auth comparado usa 320/1280.

## Validación

| Suite | Aprobadas | Fallidas |
|---|---:|---:|
| Interior: navegación y estados | 276 | 0 |
| Interior: bordes, foco y nombres largos | 64 | 0 |
| Interior: contratos de aislamiento | 6 | 0 |
| Interior: pantallas completas | 120 | 0 |
| Auth: estilos publicados preservados | 24 | 0 |
| OAuth: SDK real con HTTP interceptado | 32 | 0 |
| Staging: persistencia autenticada | 15 | 0 |
| Onboarding: navegación, roles, logout y persistencia | 276 | 0 |
| Recuperación: SDK real con HTTP interceptado | 28 | 0 |
| Aliases de ejercicio | 348 | 0 |
| Identidad | 248 | 0 |
| Identidad: funciones protegidas | 16 | 0 |
| Edición: contratos | 40 | 0 |
| Gráficas: scroll | 10 | 0 |
| Regresiones generales (16 suites) | 720 | 0 |
| **Total único** | **2223** | **0** |

| Suite general | Aprobadas |
|---|---:|
| 26-test-duration | 30 |
| test-concurrency | 33 |
| test-navigation-history | 26 |
| history-tests (contrato versionado de aliases) | 19 |
| test-session-drafts | 7 |
| test | 40 |
| test-ux-robustness | 26 |
| 23-test-features-browser | 105 |
| test-trainer-structure | 92 |
| 26-test-unified-editor | 34 |
| test-duration-entry | 8 |
| test-training-modes | 16 |
| test-training-flash | 10 |
| 26-phase2-browser | 100 |
| 26-phase3-browser | 124 |
| 26-browser-tests | 50 |

Los resultados locales quedan en tests/*/results/, ignorados por Git. Los 315 checks de la primera entrega y las ejecuciones diagnósticas/repetidas no se añaden al total. No quedan fallos en las últimas ejecuciones.

Staging: 15 casos autenticados con SDK real en Chromium/WebKit; formulario → payload → filas persistidas → recarga/reapertura. Incluyen objetivo, series y repeticiones, RIR y descanso en cero, notas, reordenación de 12 ejercicios sin cambiar UUID ni otros campos, workout y ambas papeleras. Se creó un par mínimo de cuentas sintéticas sin correo; se registraron sus UUID y se eliminaron únicamente sus datos/sesiones al terminar. Las 9 tablas de aplicación, usuarios Auth, 17 funciones, 28 policies y 9 estados RLS coinciden con las huellas de partida. Se conservaron fixtures preexistentes.

Producción: solo lectura; mismas huellas y recuentos al final, RPC de ciclo 88c3564c3c49cf9c53fccba89a1e71b5. Main continúa en la base y los candidatos originales mantienen los 30 hashes del manifiesto. No se enviaron emails ni modificaron credenciales, configuraciones o datos reales.

## Comandos de cierre

- node tests/interior/contracts.cjs
- node tests/interior/browser.cjs
- node tests/interior/edge-cases.cjs
- node tests/interior/screens.cjs
- node tests/interior/auth-isolation.cjs
- node tests/interior/oauth-sdk.cjs
- node tests/onboarding/browser.cjs
- node tests/onboarding/recovery-sdk.cjs
- node tests/identity/protected.cjs
- node -r ./tests/integration/legacy-browser.cjs tests/exercise-alias/browser.cjs
- node -r ./tests/integration/legacy-browser.cjs tests/identity/browser.cjs
- node -r ./tests/integration/legacy-browser.cjs tests/session-edit/contracts.cjs
- node -r ./tests/session-edit/regression-hook.cjs tests/integration/chart-scroll.cjs
- node tests/session-edit/regressions.cjs

La suite staging.cjs requiere cuentas nuevas autorizadas, manifiesto privado y limpieza. No se relanza sobre usuarios reales ni con los UUID ya limpiados. prepare-staging.cjs solo genera credenciales aleatorias locales ignoradas y SQL para revisión; no aplica SQL ni envía correos. Los tests generales conservan dependencias locales históricas descritas en AGENTS.md; no son un paquete CI portátil.

## Incidencias de validación y límites

- Se corrigieron los harnesses para crear sus directorios de resultados y cargar CSS/OAuth externos en pruebas históricas de HTML único.
- La expectativa histórica «CSS sin cambios» se retiró porque esta tarea autoriza el rediseño; siguen intactas las 14 comparaciones exactas de funciones de identidad/persistencia, más aislamiento de Auth en navegador.
- El test visual de Crear comprobaba un contenedor transparente; ahora comprueba la superficie visible. El fixture de papelera cliente se separó del borrado de la rutina del entrenador. No se relajaron expectativas funcionales.
- Un primer test de toque tuvo un timeout transitorio; la última ejecución consolidada pasó completa. La cascada de reduced-motion y el control de contraseña se ajustaron para conservar exactamente el onboarding publicado.
- No ejecutado: consentimiento OAuth real, vinculación real de cuentas externas, entrega real de email y prueba en iPhone físico. Los proveedores están desactivados; WebKit automatizado no acredita hardware físico.

## Publicación y rollback (pendientes de autorización)

1. Aprobar esta preview; comprobar si main avanzó y revisar cualquier conflicto sin sobrescribir otros candidatos.
2. Publicar el commit local aprobado con los cinco archivos de producto juntos, manteniendo los tres gates sociales en false. No necesita migración de Supabase.
3. Verificar SHA/árbol en Pages y assets evitando caché; revisar móvil/escritorio y acceso cliente/entrenador, logout/persistencia y recorridos interiores con cuentas autorizadas.
4. Ante regresión, revertir el commit de frontend y volver a desplegar el árbol publicado anterior. Mantener RPC de aliases y datos sin cambios. No resetear ramas con trabajo ajeno.
5. Activación OAuth en una fase separada, primero entorno de prueba autorizado y luego cada proveedor tras evidencia real; no está incluida en la publicación visual.
