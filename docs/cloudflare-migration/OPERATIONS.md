# Operación y rollback

## Antes de cualquier escritura

1. Verificar `git status`, rama, HEAD y main remoto. No sobrescribir cambios posteriores.
2. Leer CHECKPOINT y confirmar si el proyecto/despliegue/redirect/origen ya existe. Una respuesta perdida no autoriza repetir la operación.
3. Verificar que las pruebas locales pertenecen al árbol actual y reconstruir `dist` con el entorno explícito.
4. Capturar huellas de tablas, campos estables de Auth, funciones, permisos, RLS, políticas, triggers, Edge y presupuestos. `tests/cloudflare/database-snapshot.sql` es solo lectura. No usar `updated_at`/último acceso de Auth como prueba de alteración de identidad.

## Primera preview

Conectar la cuenta Cloudflare y GitHub, verificar proyecto y rama y configurar el build de README. Registrar URL estable y `CF_PAGES_URL` reales, deployment ID, SHA y backend. Probar URLs Auth exactas y CORS **en staging**. No modificar el Site URL productivo.

Revisar todos los archivos de `dist` mediante GET, MIME, HTTPS, ETag/caché, headers, console/network y hash. Los SQL/tests/private deben dar 404; `_headers` es configuración de la plataforma. Verificar móvil, escritorio, temas y rutas con query/hash de Auth. Nunca introducir una redirección general a GitHub que descarte el callback.

Con cuentas sintéticas de staging: login, recarga, logout, rutina asignada, un workout, lectura directa, historial, notas, Última sesión y ciclo. Mantener tokens en memoria de los procesos de prueba; no guardar storageState/HAR/trazas con credenciales. Limpiar solo las fixtures de esta misión y cerrar las sesiones. No modificar ni eliminar fixtures históricas que justifican pruebas anteriores.

Google y recuperación completa requieren participación de un titular autorizado/buzón de prueba. Documentar exactamente lo comprobado y lo pendiente. No sustituirlos por mocks etiquetados como reales.

## Promoción posterior a producción

Requiere que la preview real pase, que el propietario decida URL canónica/dominio/corte y que se verifique main nuevamente. Cambiar el destino Cloudflare a rama `main`, `SIMPLE_DEPLOY_TARGET=production` y URL estable real aprobada. No permitir que previews de ramas conecten a producción. El artefacto conserva la misma aplicación y cambia solo configuración/headers del backend.

Los únicos ajustes adicionales de Supabase serían redirects exactos y orígenes CORS aditivos. Capturar LIVE source, verificar hashes/permisos, probar staging y conservar rollback. No desplegar un antiguo entrypoint de staging como si fuera producción: los guards y versiones de producto pueden ser distintos. Mantener Google callback Supabase, presupuesto, flags y RLS.

El cambio de Site URL, dominio/DNS, redirecciones permanentes y retirada del alojamiento anterior se presentan por separado para decisión del propietario. Comunicar que en el origen nuevo se necesita login; no trasladar tokens entre dominios.

## Rollback sin pérdida de datos

Antes del corte, basta con desactivar builds de la rama de migración o retirar su preview. GitHub Pages continúa sirviendo main y Supabase no se migra. No ejecutar SQL de datos para volver de hosting.

Tras un corte autorizado, usar el rollback oficial de Pages a un deployment aprobado y comprobar sus archivos/configuración. Si se vuelve temporalmente a GitHub Pages, servir su versión aprobada y comunicar el enlace; restaurar DNS solo si fue cambiado con autorización y se conserva su estado previo. No borrar cuentas ni copiar sesiones.

Para Auth, eliminar exclusivamente las entradas nuevas documentadas y conservar todas las anteriores. Para CORS, restaurar los paquetes LIVE exactos capturados **solo si no hubo otros cambios posteriores**; si los hay, retirar únicamente los orígenes añadidos sobre la nueva versión. Releer la función y comprobar JWT, guards y dependencias. No reaplicar migraciones, Financial P1 ni recetas antiguas de backend.

Esta sesión prepara un rollback byte exacto de los cuatro paquetes de staging en la evidencia ignorada `tests/cloudflare/private/staging-local-cors-plan.json`. Su sección `rollback` conserva los archivos anteriores y `verify_jwt=true`. No contiene valores de secrets; no debe publicarse como asset. El helper de prueba se retira a una respuesta 410 al terminar.

## Cierre y monitorización

Registrar SHA público, resultado de GET con/sin caché, estado de Auth pendiente, backend intacto, flags y prueba de cleanup. No instalar analytics, logging de tokens, alertas con datos privados o nuevas automatizaciones de pago. Si una red falla, distinguir DNS/CDN/SDK de errores funcionales antes de alterar datos.
