# Operación segura — vigente16/10/2026

Arquitectura pública aprobada: Pages estático, Supabase Auth y autorización servidor. **Access descartado en esta misión**; no checkout ni facturación. Fuente operativa actual: README, PUBLIC-RELEASE, PUBLIC-AUTH-CORS y CUTOVER. No usar una instrucción histórica como autorización de escritura.

## Comandos y riesgos

| Operación | Efecto |
|---|---|
| git status / diff / show | Sólo lectura; comprobar worktree y rama antes de editar. |
| node tests/cloudflare/runtime.cjs | Contratos offline; no backend. |
| node tests/cloudflare/production-cors-plan-unit.cjs | Propuesta/rollback offline, sin deploy. |
| node tests/cloudflare/public-anonymous-security.cjs | HTTP real a staging con clave pública; no cuentas/fixtures/IA. Reporte sin cuerpos/tokens. |
| node scripts/hosting-release.cjs | Preparación/plan seguro offline por defecto; consultar --help. No ejecutor productivo incorporado. |
| node scripts/hosting-build.cjs --target ... | **Reemplaza dist** del sourceRoot después de validar; no publica. No usar sobre el dist del placeholder si sólo se desea una simulación. |
| git push a codex/cloudflare-migration | Puede desplegar STAGING real automáticamente. No sustituye verificar SHA/assets. |
| Merge/push main | **Publica GitHub Pages** según configuración actual. Requiere autorización de merge/publicación. |
| Dashboard Deploy / Wrangler pages deploy | **Puede publicar Cloudflare**; fuera del alcance actual. Necesita proyecto/artefacto/cuenta/autorización verificados. |
| Supabase Save URLs / Deploy function | **Escritura Auth/Edge**; sólo futura autorización exacta. No aplicar por ejecutar preflight. |

No incorporar credenciales a scripts, argumentos, archivos o resultados. Tokens de pruebas sintéticas sólo en memoria. No storageState/HAR ni localStorage de tokens de test. No renovar cuentas reales para esta misión.

## Verificar versiones

Releer main/PR#1 por GitHub y contrastar árboles, no sólo SHA del commit si la publicación por connector crea un SHA equivalente. El registro del deployment contiene commitfuente, entorno, rama y output. Descargar assets públicos y comparar con manifest/hashes; un workflow verde no prueba contenido servido. Los headers difieren entre placeholders/aplicación y proveedor; no interpretar caché como pérdida de datos.

Los snapshots tests/cloudflare/database-snapshot.sql son sólo lectura y contienen huellas/recuentos, no deben publicarse. Comparar tablas y campos estables Auth, grants/RLS/policies/triggers/funciones/finanzas/ciclo; actividad normal puede cambiar timestampsAuth. No tocar usuarios para ajustar una huella.

## Publicación y rollback futuros

Seguir CUTOVER paso a paso. Capturar LIVE, aprobar seguridad y árbol, buildoffline, autorizarmerge (publicaGitHub), reconstruir main y añadir Auth/CORS exactos antes de mostrar la app en Cloudflare. No transferir sesiones ni cambiar SiteURL. Google callback sigue en Supabase. Autodeployproductivo sigueOFF y previewbranchesNone.

Restaurar mediante Pages el placeholder170fea3b-05ea-426b-b482-af7749bd0218 si falla la primera app. Verificar cincoarchivos/hash47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399, sinSDK/runtime/backend. MantenerGitHub disponible y no restaurarDB por un fallohosting. Aliaseshashantiguos pueden sobrevivirrollback: inventariarlos y retirar referencia segúnalcanceautorizado.

Auth/CORSrollback: sólo retirar adiciones de ese corte contraLIVE y backup confirmado; conservarGitHub/SiteURL/cambiosposteriores. Nunca redeployde un bundle viejo sin detectar drift. No reinstalarFinancialP1 ni alterar consumos/usuarios.

## Evidencias y cleanup

results y private están ignorados. Sólo fixturespropias explícitas de staging pueden limpiarse. No eliminarusuarios/cuentas existentes, fixturesfinancieras o datosreales. No publicar snapshotsprivados, tokens, credenciales o mensajes de usuarios.

[CF-Pages-Skip] se reserva para commits exclusivamente documentales/tests sin cambiosruntime/build/producto. No se usa para eludir pruebas de cambiosreales. La configuración hoy tiene producciónautodeployOFF; no cambiar controles sólo para evitar unbuildstaging legítimo.

No hay nuevas dependenciasruntime ni CI que ejecuteSQL/deployproductivo. Los tests de red requieren autorización y acceso; los contratos offline no sustituyen JWTreal/Google/recovery real. Si falta una sesión se deja BLOCKED, no se creaunPASSconmocks.
