# Corte definitivo de Cloudflare — plan, NO ejecutado

**Estado actual 21/10: BLOCKED para el corte.** Main vigente `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663` conserva ambos arreglos del reviewer y añade Bloq Mayús y el ciclo corregido. Hosting conserva recovery al recargar. El contraste directo REST con JWT productivo normal sigue pendiente; la ventana temporal acotada autorizada no se ha utilizado en este checkpoint. No emitir un recibo de seguridad PASS ni sustituir ese contraste por UI, SQL claims o staging. El despliegue independiente de staging sólo se permite tras releer sus controles y superar las regresiones; no autoriza el corte.

Vigente20/10/2026. Arquitectura autorizada para preparación: Pages público, Supabase Auth/JWT/grants/RLS/RPC existentes. Access NO es requisito y su alta se abandona; no tarjeta, checkout, suscripción o cargos. El corte requiere autorización separada. No se cambia Site URL, DNS, canónico, datos ni presupuestos en esta misión.

## Baseline que debe releerse

- Main vigente `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`, descendiente de los hotfixes de privacidad y compatibilidad, con Bloq Mayús y ciclo corregido. RPC `public.premium_reviewer_state(uuid)` MD5 `6442b03ced86d22c57dbf434898c6a9a`; projector `fc89c86e5a6fb56069bfbf777d9dd3e1`. GitHub Pages publica main desde / (root). **Fusionar PR sí dispara GitHub Pages**, aunque Cloudflare esté detenido. Releer main y la evidencia productiva del coordinador antes del corte; conservar cualquier trabajo posterior.
- PR#1 en borrador, codex/cloudflare-migration. Comparar árbol final contra main y preservar cualquier cambio posterior antes de aprobar.
- Staging: simple-staging-raulchulbi, backend dmqjexigdnfzobarhnib, autodeploy sólo rama de migración, previews None. No convertirlo en producción.
- Producción Pages: simple-raulchulbi, rama de preparación, target placeholder, autodeploy OFF, previews None. Deployment170fea3b-05ea-426b-b482-af7749bd0218, fuente8b2f526, artefacto47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399; cinco archivos sin backend.
- Supabase producción y Financial P1 se conservan. Las tres definiciones publicadas del ciclo son `get_client_routine_cycle_progress(uuid,uuid)` MD5 `2a8197e876ca69d5bb54124f40c06107`, `get_client_routine_stage_cycle_progress(uuid,uuid)` MD5 `5c6c56ae1ca187aefb37891e8664b9fb` y `get_client_custom_routine_cycle_progress(uuid,uuid)` MD5 `a936e5595f93366d74d41dcdbe0b6ea7`, confirmadas por lectura productiva del coordinador el20/10. Releer sus definiciones antes del corte y no reaplicar `tests/cycle-start/candidate.sql`: ya están publicadas. El antiguo hash `88c3564c...` sólo es referencia histórica, no un requisito actual. Premium directo sigue OFF.

Lectura autenticada del panel Cloudflare el21/10: staging mantiene autodeploy ON sólo para `codex/cloudflare-migration`, previews None, build preview, caché OFF y exclusiones `tests/**` y `docs/**`. Producción conserva autodeploy OFF, previews None, rama de preparación y build placeholder. El deployment de staging `a832bd9c-a09d-4046-991c-9930bf2593ae` corresponde a la fuente `4fdedd1db8086d0c7d2847135172c81603cc5be4`. No se guardó configuración. Releer estos controles antes de otro push o publicación; los cambios únicamente documentales excluidos del build no exigen regenerar una aplicación idéntica.

La preparación del contraste del21/10 utiliza una sesión normal del reviewer, sin exigir el login del propietario como dependencia del positivo/negativo principal. La falta de sesión Google disponible en el contexto temporal requiere intervención del titular; no demuestra un defecto OAuth. El control autenticado del propietario, si no se ejecuta, debe permanecer separado como pendiente. La elegibilidad temporal sólo puede abrirse después de disponer del JWT y restauración preparados, mediante la única ventana previamente autorizada.

## Puertas previas y orden seguro real

1. **Autorizar el corte y conservar seguridad**: completar primero el contraste productivo de proyección positiva frente a REST privado con el mismo JWT y scope legítimamente vigente. La elegibilidad actual caducó; no extenderla automáticamente ni interpretar esa denegación como prueba negativa completa. Comprobar los dos arreglos publicados, sus consumidores y el alcance de los checks ya registrados; no fabricar scopes ni repetir el canary. Aprobar el árbol exacto. Capturar LIVE de datos estables, RLS/grants/funciones/Edge, flags/finanzas, URLs Auth/Google y deployments; conservar backups ignorados. No sustituir esto por un recibo escrito a mano.
2. **Validar/build antes del merge**: ejecutar regresiones afectadas y construir localmente el artefacto Cloudflare productivo desde blobs del candidato. Inventario, reproducibilidad, runtime sólo backend productivo, headers/cache, sin secretos/archivos privados. El artefacto NO se sube aún. El runtime del repositorio debe seguir sirviendo GitHub /SIMPLE/; no copiar sobre él el runtime de Cloudflare.
3. **Aprobación y merge autorizados PR#1**: comprobar main actual, dependencias y conflictos; si hay trabajo nuevo incompatible, detenerse. Mantener la PR como borrador hasta ese momento. Tras merge verificar GitHub Pages, SHA/árbol y entrenamiento existente. No confiar sólo en workflow verde.
4. **Reconstruir desde main final**: repetir comparación exacta del artefacto. Guardar manifest/hashes y recibos vinculados a sourceTree y artifactTreeSha256. Cambiar un recibo o código invalida las evidencias correspondientes.
5. **Ajustes aditivos autorizados antes de exponer la app**: añadir sólo base Cloudflare y patrón recovery a Supabase Redirect URLs; preservar Site URL y GitHub. Añadir únicamente el origen estable exacto a las cuatro Edge usando fuentes LIVE propias de producción, sin tocar JWT/guards/finanzas. Releer cada cambio y OPTIONS. Añadir el origen JavaScript Google si se autoriza/requiere según PUBLIC-AUTH-CORS, manteniendo callback Supabase. No tocar SMTP/templates, scopes/secrets ni RLS. Respetar confirmaciones obligatorias de herramientas.
6. **Configurar y publicar manualmente** Pages producción desde main final, target production, output dist, URL estable correcta. Mantener autodeploy OFF y previews None; comprobar configuración antes de pulsar deployment. Ninguna preview pública conectada a producción como atajo.
7. **Comprobar antes de declarar corte**: HTTPS, todos los hashes/recursos/MIME, runtime backend correcto, rutas privadas404, cache y nueva sesión. OAuth/recovery productivos necesitan titular/buzón y autorización específica; nunca inferir su PASS de los mocks o de staging. Roles/client/trainer, rutinas/workouts/historial/notas/Última sesión/ciclo/gráficas/reviewer y Coach protegido sin escribir entrenamiento ni consumir IA. Verificar flags/finanzas y datos estables después.
8. **Establecer URL de referencia sólo tras verificación**: autorizar explícitamente anunciar pages.dev como entrada principal. GitHub sigue disponible de respaldo; no cambiar Site URL/DNS ni redireccionar permanentemente GitHub durante este primer corte. Inicio de sesión nuevo por origen es normal: no transportar tokens ni storage entre dominios.

El orden evita exponer una app con CORS/retornos no preparados y reconoce que el merge ya publica en GitHub. No requiere comprar dominio: pages.dev HTTPS sirve provisionalmente. La revisión comercial/legal es distinta de la preparación técnica.

## Respuesta ante incidencias

| Fallo | Diagnóstico y decisión |
|---|---|
| Backend incorrecto o datos de otro usuario | **STOP inmediato**. Restaurar placeholder, retirar referencia al nuevo origen; no intentar corregir perfiles/roles o copiar datos. Investigar runtime/seguridad antes de otra publicación. |
| Google OAuth | Comparar origen y callback Supabase exactos, redirectTo y allowlist; no regenerar credenciales ni fusionar usuarios. Si login crítico falla, detener corte/volver a GitHub. No atribuir cancelación del titular a bug. |
| Recovery | Verificar query real ?reset=1 frente al patrón escapado, ConfirmationURL y limpieza de URL; no reenviar automáticamente ni cambiar contraseña por el usuario. Si falla retorno, detener corte; no cambiar SMTP como atajo. |
| Recursos404/HTML antiguo | Comparar bytes/hash con manifest, status/MIME y deployment estable/hash; una propagación CDN aislada no prueba fallo de código. No añadir redirect SPA general que exponga tests/private como200. |
| CORS | Distinguir OPTIONS/origin de JWT/RLS. Sólo parche aditivo LIVE autorizado; nunca wildcard, quitarJWT o ampliarRLS. Si Coach no funciona en origen nuevo, detener corte aunque login funcione. |
| Sesión no persiste | Origin/storage/navegador/callback; un primer login nuevo es esperado. Si recargar pierde una sesión válida, rollbackfrontend y conservar usuarios. |
| Rol/datos no aparecen | Comprobar usuario/proyecto con lectura limitada; no otorgar rol desde selector OAuth ni cambiar cuentas para ajustar pantalla. STOP si discrepancia de identidad. |
| Build/deploy falla | No actualizar URL de referencia. Mantener placeholder y GitHub, conservar diagnóstico; comprobar si deploy sí ocurrió antes de repetirlo. |
| Caché obsoleta | Releer deployment SHA y assets sin caché, comprobar headers. Nunca declarar pérdida de datos por HTML viejo ni borrar almacenamiento de otro origen. |
| Finanzas/flags/permisos cambian | STOP. Preservar entrenamiento y comparar baseline; no resetearconsumos, ampliarcuotas o reinstalarFinancialP1. |

## Rollback preparado, no ejecutado

- Restaurar el placeholder mediante rollback oficial al deployment170fea3b-05ea-426b-b482-af7749bd0218; comprobar exactamente cinco archivos, hash47ba45ce… y ausencia de SDK/runtime. Los aliases de hashes anteriores pueden seguir existiendo: inventariar sus URLs; un rollback de alias no retira todos los deployments antiguos.
- Volver a dar GitHub como entrada conocida; no requiere restaurar base de datos. Releer su versión antes de anunciarlo. Mantener autodeploy OFF/previews None para detener nuevos errores.
- Si se autorizó retirar configuración recién añadida: quitar sólo las dos Redirect URLs y el origen CORS/Google nuevos, contra LIVE y backup verificados; conservar GitHub, Site URL y cualquier cambio legítimo posterior. No usar un bundle antiguo completo sin comprobar drift.
- No rollbackSQL, Authusers, rutinas, historial, identidadesGoogle, FinancialP1, cuotas o entrenamientos por un problema de hosting.
- El backend conserva la proyección cerrada del reviewer, su compatibilidad histórica y las tres funciones actuales del ciclo; nunca restaurar las policies amplias ni funciones antiguas. GitHub debe conservar main vigente, incluyendo Bloq Mayús; no regresar a JavaScript anterior para resolver un fallo de Cloudflare. El helper vuelve a comprobar los pins del reviewer y el rollback Cloudflare utiliza sólo el placeholder inerte, sin restaurar la base de datos.

## Reanudar tras una interrupción

Un checkpoint no demuestra que una operación remota falló ni que terminó. Releer los valores efectivos antes de repetir; distinguir `YA COMPLETADO`, `PENDIENTE DE AUTORIZACIÓN` y `DRIFT`. Los ensayos del helper son locales y no ejecutan estas operaciones externas.

| Paso interrumpido | Observación necesaria y reanudación segura |
|---|---|
| Hotfix de seguridad | Releer policies/RPC/grants y consumidores servidos. Si coinciden, omitir SQL; no restaurar políticas amplias. Drift: detener la operación afectada. |
| Merge PR #1 | Releer SHA/árbol de main y estado de PR. Si ya contiene la fuente y los consumidores aprobados, no repetir merge. Main posterior distinto exige reconciliar. |
| Build o copia | Comparar fuente, runtime y todos los bytes con el receipt. Si falta un archivo, rechazar y repetir sólo PREPARAR en su workspace local acotado. |
| Redirect URLs | Releer la lista completa y Site URL. Omitir las dos adiciones exactas ya presentes; conservar todas las entradas previas y la Site URL. |
| Google | Releer SIMPLE Web, orígenes y callback. Omitir el origen estable ya presente. No crear otro cliente, cambiar callback ni abrir secretos. |
| Edge CORS | Releer versiones y fuentes LIVE completas. Si sólo consta el par exacto GitHub/Cloudflare, omitir redeploy. Otra modificación exige rebasar el pequeño diff, nunca sobrescribir con un bundle antiguo. |
| Configuración Pages | Confirmar proyecto, rama, target, autodeploy OFF y previews None. No repetir ajustes correctos ni exponer una app con configuración inesperada. |
| Deployment | Releer deployment, fuente y bytes servidos. Si ya sirven el artefacto aprobado, verificar sin publicar otro. Backend incorrecto: contención y STOP. |
| Verificación y referencia | Repetir sólo checks incompletos. OAuth/recovery pendientes o fallidos en el nuevo origen no son PASS. No anunciar corte sin autorización y verificación. |
| Rollback hosting | Si el placeholder aprobado ya está activo y carece de backend, no duplicar rollback. Mantener protección backend y GitHub corregido; reconciliar cualquier deployment posterior. |

Consultar [PUBLIC-RELEASE](PUBLIC-RELEASE.md) para comandos offline y simulación; [PUBLIC-AUTH-CORS](PUBLIC-AUTH-CORS.md) para valores exactos y límites; [PRIVACY-READINESS](PRIVACY-READINESS.md) para pendientes comerciales. Ningún script de esta preparación ejecuta escrituras productivas al invocarlo sin argumentos.
