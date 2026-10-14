# Operación y rollback

## Antes de cualquier escritura

1. Verificar `git status`, rama, HEAD y main remoto. No sobrescribir cambios posteriores.
2. Leer CHECKPOINT y confirmar si el proyecto/despliegue/redirect/origen ya existe. Una respuesta perdida no autoriza repetir la operación.
3. Verificar que las pruebas locales pertenecen al árbol actual y reconstruir `dist` con el entorno explícito.
4. Capturar huellas de tablas, campos estables de Auth, funciones, permisos, RLS, políticas, triggers, Edge y presupuestos. `tests/cloudflare/database-snapshot.sql` es solo lectura. No usar `updated_at`/último acceso de Auth como prueba de alteración de identidad.

## Primera preview

La preview ya existe en el proyecto dedicado `simple-staging-raulchulbi`, rama `codex/cloudflare-migration`. No crear otro proyecto equivalente ni volver a instalar la App. La instalación GitHub 171372329 está limitada a `raulchulbi-sys/SIMPLE`. Su despliegue verificado es `4a8636ab-ec94-42db-b57e-cf43d01230b9`, fuente `0aa1d6b6dc6fe0165534b8c7610c1e8a56521709`.

URL estable: `https://simple-staging-raulchulbi.pages.dev/`. URL del despliegue: `https://4a8636ab.simple-staging-raulchulbi.pages.dev/`. Ambas usan exclusivamente `dmqjexigdnfzobarhnib`. Cloudflare llama «Production» a la rama predeterminada de este proyecto; esa etiqueta no significa Supabase productivo. Las demás ramas de preview están desactivadas. Se excluyen `tests/**` y `docs/**` de los disparadores de build: un commit limitado a evidencia no necesita desplegar otra vez la misma aplicación.

Los CORS exactos de esos dos hosts ya se añadieron en staging. No repetir esa escritura. Los dos redirects Auth siguen pendientes del acceso manual al panel; ver AUTH-CORS antes de añadirlos. Conservar Site URL y todas las entradas anteriores.

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

Para Auth, eliminar exclusivamente las entradas nuevas documentadas y conservar todas las anteriores. Para CORS, restaurar los paquetes LIVE exactos capturados **solo si no hubo otros cambios posteriores**; si los hay, retirar únicamente los orígenes añadidos sobre la nueva versión. Releer la función y comprobar JWT, guards y dependencias. No reaplicar migraciones, Financial P1 ni recetas antiguas de backend.

Hay dos rollbacks de CORS independientes y secuenciales. `tests/cloudflare/private/cloudflare-https-cors-plan-4a8636ab.json` revierte exclusivamente la adición HTTPS y restaura Basic/Premium/chat/inicial a versiones fuente 30/14/14/3, conservando los 34 orígenes locales anteriores. `tests/cloudflare/private/staging-local-cors-plan.json` corresponde a la fase local previa, versiones fuente 29/13/13/2; **no usarlo para revertir solo HTTPS**, porque también quitaría los dos orígenes locales de 4280. Las secciones `rollback` conservan los archivos exactos y JWT obligatorio. Antes de aplicar cualquiera, verificar que no haya publicaciones posteriores; las versiones de Supabase son crecientes aunque el contenido se restaure. Son evidencias privadas ignoradas, sin valores de secrets; no publicarlas como assets ni volcarlas completas a logs. El helper de prueba se retira a una respuesta 410 al terminar.

Si falla la primera versión de este nuevo proyecto, aún no existe otro deployment anterior al que hacer rollback. Desactivar sus builds automáticos y conservar GitHub Pages es la reversión de alojamiento disponible. No simular un rollback a un deployment inexistente. A partir del segundo deployment aprobado, la opción oficial de rollback puede restaurar una versión anterior del mismo proyecto; comprobar su runtime y backend antes de utilizarla.

## Cierre y monitorización

Registrar SHA público, resultado de GET con/sin caché, estado de Auth pendiente, backend intacto, flags y prueba de cleanup. No instalar analytics, logging de tokens, alertas con datos privados o nuevas automatizaciones de pago. Si una red falla, distinguir DNS/CDN/SDK de errores funcionales antes de alterar datos.
