# Operación y rollback

Estado vigente del 15/10/2026: [PRODUCTION-PREPARATION](PRODUCTION-PREPARATION.md). El proyecto independiente `simple-raulchulbi` sirve un placeholder sin backend; despliegues automáticos OFF y previews None. Access está pendiente; la aplicación productiva no está desplegada y Auth/CORS productivos no se han modificado. Staging sirve la fuente `8b2f526` en `4eef94ba`, con cuatro comprobaciones específicas superadas. Google/recovery reales permanecen validados con su alcance histórico. [CUTOVER](CUTOVER.md) prepara el corte sin ejecutarlo. Las referencias posteriores a deployments anteriores son históricas; no restaurarlos a ciegas.

## Antes de cualquier escritura

1. Verificar `git status`, rama, HEAD y main remoto. No sobrescribir cambios posteriores.
2. Leer CHECKPOINT y confirmar si el proyecto/despliegue/redirect/origen ya existe. Una respuesta perdida no autoriza repetir la operación.
3. Verificar que las pruebas locales pertenecen al árbol actual y reconstruir `dist` con el entorno explícito.
4. Capturar huellas de tablas, campos estables de Auth, funciones, permisos, RLS, políticas, triggers, Edge y presupuestos. `tests/cloudflare/database-snapshot.sql` es solo lectura. No usar `updated_at`/último acceso de Auth como prueba de alteración de identidad.

## Primera preview

La preview ya existe en el proyecto dedicado `simple-staging-raulchulbi`, rama `codex/cloudflare-migration`. No crear otro proyecto equivalente ni volver a instalar la App. La instalación GitHub 171372329 está limitada a `raulchulbi-sys/SIMPLE`. Su despliegue vigente verificado es `e829b4d6-2235-44e8-a7f4-a96d875d8946`, fuente `eb9eba59ca9589a94a6b09612b0acd4354e9bba7`.

URL estable: `https://simple-staging-raulchulbi.pages.dev/`. URL del despliegue: `https://e829b4d6.simple-staging-raulchulbi.pages.dev/`. Ambas usan exclusivamente `dmqjexigdnfzobarhnib`. Cloudflare llama «Production» a la rama predeterminada de este proyecto; esa etiqueta no significa Supabase productivo. Las demás ramas de preview están desactivadas. Los watch paths excluyen `tests/**` y `docs/**`, pero no se considera probado que el filtro haya evitado el último intento de build.

Registro histórico anterior al cierre Auth: el check/deployment `65d96659-8aab-41a1-9bd7-a3ae876c232e`, fuente remota `a39ec11f5c3476c20fedb6b4a21be6fe65ea0675`, figura cancelado. No está verde ni publicó assets; `S` conserva la fuente `0aa1d6b…`. En el checkpoint Git previo a esta reanudación, local `cf76bdfd0af1a523e48d602b50010c03f1a2bf78` y ese remoto tenían el árbol `c78dae8c23d4444bc3e9b58de04ba06150de66a6`, con checkout limpio entonces.

Para un commit **exclusivamente de evidencia, tests o docs**, usar el prefijo oficial `[CF-Pages-Skip]` en el mensaje. Pages omite su build sin desactivar las demás CI. No usarlo para cambios del producto ni para una publicación productiva: esos cambios requieren su build y validación. No apagar builds globales para evitar este build idéntico. [Cloudflare: Skipping a build via commit message](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-commit-message).

Los CORS exactos de esos dos hosts ya se añadieron en staging. El 15/10/2026 también se guardaron, tras autorización expresa, las dos Redirect URLs de staging: `https://simple-staging-raulchulbi.pages.dev/` y `https://simple-staging-raulchulbi.pages.dev/\?reset=1`. El panel conectado confirmó dos entradas sobre una lista previamente vacía; Site URL sigue en `http://localhost:3000`. No repetir esas escrituras. Pasaron los dos GET verify inválidos y los cuatro callbacks nativos, sin correo ni sesión nueva; ver AUTH-CORS para su alcance.

Revisar todos los archivos de `dist` mediante GET, MIME, HTTPS, ETag/caché, headers, console/network y hash. Los SQL/tests/private deben dar 404; `_headers` es configuración de la plataforma. Verificar móvil, escritorio, temas y rutas con query/hash de Auth. Nunca introducir una redirección general a GitHub que descarte el callback.

Con cuentas sintéticas de staging: login, recarga, logout, rutina asignada, un workout, lectura directa, historial, notas, Última sesión y ciclo. Mantener tokens en memoria de los procesos de prueba; no guardar storageState/HAR/trazas con credenciales. Limpiar solo las fixtures de esta misión y cerrar las sesiones. No modificar ni eliminar fixtures históricas que justifican pruebas anteriores.

Google y recuperación completa requieren participación de un titular autorizado/buzón de prueba. Documentar exactamente lo comprobado y lo pendiente. No sustituirlos por mocks etiquetados como reales.

## Promoción posterior a producción

Requiere que la preview real pase, que el propietario decida URL canónica/dominio/corte y que se verifique main nuevamente. Crear o reutilizar entonces un **proyecto separado y un origen estable diferente** para producción: rama `main`, `SIMPLE_DEPLOY_TARGET=production`, su `SIMPLE_PAGES_PROJECT` y URL aprobada. No convertir `simple-staging-raulchulbi` a producción: sus retornos Auth y las pruebas de staging deben seguir apuntando al mismo backend aislado. No permitir que previews de ramas conecten a producción. El artefacto conserva la misma aplicación y cambia solo configuración/headers del backend.

Los únicos ajustes adicionales de Supabase serían redirects exactos y orígenes CORS aditivos. Capturar LIVE source, verificar hashes/permisos, probar staging y conservar rollback. No desplegar un antiguo entrypoint de staging como si fuera producción: los guards y versiones de producto pueden ser distintos. Mantener Google callback Supabase, presupuesto, flags y RLS.

El cambio de Site URL, dominio/DNS, redirecciones permanentes y retirada del alojamiento anterior se presentan por separado para decisión del propietario. Comunicar que en el origen nuevo se necesita login; no trasladar tokens entre dominios.

## Rollback sin pérdida de datos

Antes del corte, basta con desactivar builds de la rama de migración o retirar su preview. GitHub Pages continúa sirviendo main y Supabase no se migra. No ejecutar SQL de datos para volver de hosting.

Tras un corte autorizado, usar el rollback oficial de Pages a un deployment aprobado y comprobar sus archivos/configuración. Si se vuelve temporalmente a GitHub Pages, servir su versión aprobada y comunicar el enlace; restaurar DNS solo si fue cambiado con autorización y se conserva su estado previo. No borrar cuentas ni copiar sesiones.

Para Auth de staging, eliminar exclusivamente `https://simple-staging-raulchulbi.pages.dev/` y `https://simple-staging-raulchulbi.pages.dev/\?reset=1`, añadidas el 15/10/2026. La lista previa estaba vacía; conservar cualquier entrada añadida después y Site URL `http://localhost:3000`. No tocar Auth productivo, Google ni SMTP. Para CORS, restaurar los paquetes LIVE exactos capturados **solo si no hubo otros cambios posteriores**; si los hay, retirar únicamente los orígenes añadidos sobre la nueva versión. Releer la función y comprobar JWT, guards y dependencias. No reaplicar migraciones, Financial P1 ni recetas antiguas de backend.

Hay dos rollbacks de CORS independientes y secuenciales. `tests/cloudflare/private/cloudflare-https-cors-plan-4a8636ab.json` revierte exclusivamente la adición HTTPS y restaura Basic/Premium/chat/inicial a versiones fuente 30/14/14/3, conservando los 34 orígenes locales anteriores. `tests/cloudflare/private/staging-local-cors-plan.json` corresponde a la fase local previa, versiones fuente 29/13/13/2; **no usarlo para revertir solo HTTPS**, porque también quitaría los dos orígenes locales de 4280. Las secciones `rollback` conservan los archivos exactos y JWT obligatorio. Antes de aplicar cualquiera, verificar que no haya publicaciones posteriores; las versiones de Supabase son crecientes aunque el contenido se restaure. Son evidencias privadas ignoradas, sin valores de secrets; no publicarlas como assets ni volcarlas completas a logs. El helper de prueba se retira a una respuesta 410 al terminar.

Si falla la primera versión de este nuevo proyecto, aún no existe otro deployment anterior al que hacer rollback. Desactivar sus builds automáticos y conservar GitHub Pages es la reversión de alojamiento disponible. No simular un rollback a un deployment inexistente. A partir del segundo deployment aprobado, la opción oficial de rollback puede restaurar una versión anterior del mismo proyecto; comprobar su runtime y backend antes de utilizarla.

## Cierre y monitorización

Registrar SHA público, resultado de GET con/sin caché, las dos URLs Auth guardadas y el alcance de las pruebas de retorno inválido, backend intacto, flags y prueba de cleanup. La lectura de Emails sólo confirmó plantillas por defecto, asunto de recuperación `Reset your password` y Source deshabilitado; no se leyó HTML ni se cambió SMTP. Google real y recuperación válida ya comprobados en staging; producción requiere validación del nuevo origen cuando se autorice el corte. No instalar analytics, logging de tokens, alertas con datos privados o nuevas automatizaciones de pago. Si una red falla, distinguir DNS/CDN/SDK de errores funcionales antes de alterar datos.
