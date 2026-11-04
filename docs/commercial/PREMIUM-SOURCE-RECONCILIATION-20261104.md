# Reconciliación Premium sobre Basic — 04/11/2026

Este documento describe la candidata local de `codex/premium-security-reconciled`.
**APTO PARA REVISIÓN. Commit exclusivamente local, sin push ni despliegue.**
Base exacta: `5f7031b60665d31e77d6112d3d5c8f2d999bb4cc`, HEAD de PR #7
comprobado en GitHub, abierta y borrador. No se publica ni instala en esta tarea.
Los informes anteriores conservados son evidencia histórica, no describen el
estado remoto actual ni cuentan como ejecuciones nuevas.

## Composición y trazabilidad

Un único commit hijo de la base. No cherry-pick de `fffbc16`, no merge y no
incorporación de `9f1ec22`, frontend, hosting, generación o facturación.
Se extraen diez blobs exactos del árbol final
`d58064215de2457448a52dfaad3c5fed63541992`, que incorpora la corrección inicial
`6bb4596270034e74d5c30abd949410243de4e346` y el cierre del error de validación:

- SQL Premium incremental y rollback cerrado.
- Runner PostgreSQL Premium.
- Cinco archivos de pruebas Premium: README, esquema, utilidades, batería
  principal y frontera de errores.
- Informes Premium de auditoría independiente y frontera de errores.

Se añade este informe y un control local de instalación con sus regresiones y
consulta de postcondiciones. Los seis archivos Basic aprobados, sus dos tests
de huellas y su informe de reconciliación quedan intactos respecto a la base.
Las migraciones históricas, checkpoints A/B, helpers, ACL/RLS, V5, Edge Functions,
catálogo, modelos, costes y automatizaciones no cambian.

| RPC | MD5 exacto del cuerpo `prosrc` (LF) |
|---|---|
| `public.review_coach_proposal(uuid,boolean,text)` | `d94b96ae65e69997a37ae83b521ec16b` |
| `public.authorize_coach_retry(uuid,text)` | `cdf6200bb140563a96ddc472cc0ac9b7` |
| `public.premium_initial_review(uuid,boolean,text)` | `c16541b25d191997fce42c2024784c7d` |

SQL Premium SHA-256 (bytes LF):
`1dd35ba1a36dfcf1d11f6d0a07ec53540c20326ca1818cf89010a26890ad2458`.
Rollback SHA-256:
`4d2b33ed2b6770dfc1eb76dd17581ab004f6779334219a1a022e433819604428`.

No se vuelve a diseñar el RPC: los blobs son los ya validados. Conserva la
autorización antes del lookup protegido, cuatro revalidaciones y locks ordenados.
Los 14 errores de dominio conocidos esperan a la última comprobación; acceso
caducado/revocado obtiene `42501 premium_initial_reviewer_required`. Los errores
inesperados se propagan. Se mantienen aprobación humana, replay idempotente y
proyección segura. No cambia `premium_entitled` ni su wrapper/interruptor global.

## Riesgo de reinstalación y medida mínima

El historial no es un instalador incremental seguro para staging. Inventario:

| Ruta | Riesgo/uso |
|---|---|
| `20260928182139_coach_phase1c_supervised_pilot.sql` | crea Basic histórico; solo construcción inicial |
| `20260928223506_coach_pilot_training_only_v2.sql` | reemplaza ambos RPC Basic por versiones anteriores |
| `20261001180800_coach_generation_allowance.sql` | reemplaza retry por versión anterior |
| `20261011154036_coach_premium_initial.sql` | crea Premium vulnerable; CREATE sin OR REPLACE falla si ya existe, pero una reconstrucción o extracción manual puede recuperarlo |
| `rollback-coach-pilot-v2.sql`, `rollback-coach-generation-allowance.sql` | recuperan Basic anterior; no son rollbacks válidos del checkpoint de seguridad actual |
| `coach-reviewer-scope.sql` | contiene Basic corregido, pero también instalación A; no reaplicarlo en staging ya configurado |
| `premium-initial-review-uniform-denial.sql` | delta estrecho aprobado; omitir si cuerpo y metadatos ya coinciden |
| rollbacks `*-uniform-denial.sql` | cierre estrecho; no restauran el cuerpo vulnerable |

No se edita ese historial. `scripts/reviewer-sql-check.mjs` hace solo lectura
local, exige las tres huellas y ambos SHA Premium, inventaría los writers conocidos
y detecta un writer nuevo con la sintaxis versionada. No es un parser SQL general.

Puede comprobar un JSON local con exactamente `mode` y `files`:

```json
{"mode":"configured","files":[]}
```

Para staging ya coincidente el plan es no-op. `configured` solo admite ese plan
vacío o el delta Premium exacto: rechaza A/B, migraciones y rollbacks históricos.
No presume que la base remota coincida: el preflight conectado es independiente.
`bootstrap` permite revisar el orden de archivos del repositorio y exige que los
tres últimos cuerpos efectivos sean los corregidos. Una secuencia histórica
sola, o sobrescribir después un parche, falla. **No certifica dependencias ni
autoriza instalar una base nueva**: no es un instalador completo de SIMPLE.

```text
node scripts/reviewer-sql-check.mjs
node scripts/reviewer-sql-check.mjs --plan ruta/al/plan-local.json
node --test tests/commercial/basic-source-lock.test.mjs tests/premium-review-security/reconciliation.test.mjs
```

`supabase/verify-reviewer-security.sql` es una SELECT independiente, no migración
ni reparación. En una futura transacción autorizada, antes de COMMIT, exigir
tres `matches=true`; ausentes o cuerpos antiguos producen false. Además comparar
OID, owner, ACL, atributos, helpers, switches, RLS y datos con el preflight.
No basta con la huella del cuerpo. Un rollback cerrado tiene huellas distintas
y requiere sus propias postcondiciones, no se acepta como actualización normal.

La medida es un control explícito de release, **no intercepta SQL ejecutado
manualmente ni cambios futuros en otra sesión**. No se modifica CI ni ninguna
automatización. Incorporarlo a una automatización requeriría un encargo separado.

## Verificación local de esta candidata

Node 24.19.0, PostgreSQL 17.11. Resultados ejecutados sobre esta reconciliación:

| Batería | Resultado | Naturaleza |
|---|---:|---|
| Premium PostgreSQL | 91/91 | regresiones del candidato definitivo, concurrencia, errores, caducidad, revocación y rollback |
| Basic PostgreSQL | 89/89 | RPC corregidos, scopes, aislamiento, revocación, idempotencia y rollback |
| Facturación PostgreSQL | 24/24 | conciliación, RLS, renovación/expiración sintéticas, concurrencia y rollback |
| CI offline de esta rama | 267/267 | 9 suites sin servicios; no es la composición 339 histórica |
| Contratos Premium frontend/proveedor | 23/23 | dobles offline, cero tráfico proveedor |
| Huellas Basic existentes | 2/2 | fuente aprobada |
| Nuevos controles de reconciliación/orden SQL | 24/24 | mutaciones, reinstalación, orden vulnerable, writer nuevo y artefactos exactos |
| **Total distinto ejecutado** | **520/520** | **24 casos nuevos**, 496 regresiones existentes reejecutadas |

Además, 44 análisis sintácticos del CI y tres de los scripts/test incorporados;
no se suman al número de casos. `git diff --check` y revisión de archivos limpios.
No se detectaron credenciales, tokens ni archivos privados en el delta. El escáner
de patrones no es una garantía matemática de ausencia de secretos; se revisó
también el origen y contenido de los catorce archivos añadidos.

Todos los runners PostgreSQL usan clústeres nuevos limitados a loopback, con comprobación de host,
puerto, directorio, rol y marcador. Las claims SQL no equivalen a JWT reales.
No se conectan a Supabase, Stripe ni proveedores de modelos.
Los cuatro clústeres creados (dos arranques restringidos y dos ejecuciones
completas) finalizaron detenidos. TAP y datos sintéticos de esos clústeres se
conservan solo en ubicaciones locales ignoradas. No se reutilizó ningún clúster
de Work ni se modificó otro worktree.

Los dos primeros arranques PostgreSQL no ejecutaron casos: la conexión loopback
fue denegada por el entorno restringido (10013). Sus clústeres se detuvieron en
finally; se repitieron los mismos comandos con el permiso normal de ejecución
local. No se cambió el arnés ni se desactivó un control de seguridad.

## Compatibilidad con staging

Fuente: recibo privado del checkpoint instalado el 04/11/2026, último snapshot
12:32:07 UTC. SQL y cuerpo Premium coinciden exactamente, junto con Basic.
Ese recibo registra OID 29151 conservado, propietario postgres, ACL existente,
234 funciones ajenas intactas, 27/27 referencias y 5/5 huellas de facturación,
reviewer y gates cerrados y 20/20 comprobaciones JWT de identidad/denegación/cierre.
**Son evidencias anteriores reutilizadas**, no lecturas ni pruebas conectadas
de esta reconciliación. No se incorpora ningún recibo privado o UUID de usuario.

La publicación Git futura reconcilia la fuente y no requiere volver a instalar
el parche en staging. Cualquier deriva posterior exige lectura autorizada y
comparación; no se debe reponer todo el código remoto desde esta rama.

## Publicación futura, no ejecutada

1. Autorizar el SHA completo del único commit local resultante para PR #7.
   Volver a comprobar HEAD remoto `5f7031b`, relación padre/hijo, árbol limpio,
   diff, huellas y ausencia de privados. Si el HEAD cambia, detenerse y reconciliar.
2. Leer controles actuales de despliegue antes de enviar. El workflow versionado
   `ci-offline.yml` responde a `pull_request`/`workflow_dispatch`, con contents:read
   y pruebas locales; no tiene deploy. GitHub Pages depende de main. El control
   histórico de Cloudflare limitaba staging a `codex/cloudflare-migration`,
   producción a su rama de preparación, previews None y autodeploy productivo
   apagado. **No se ha refrescado Cloudflare en esta tarea**; no asumirlo vigente.
3. Si todo sigue correcto, push sin force del SHA autorizado a
   `refs/heads/codex/commercial-backend-review`. No cambiar draft, no merge,
   no desplegar SQL ni Edge. Verificar SHA remoto exacto y checks del nuevo HEAD;
   pendientes no equivalen a aprobación. No publicar otro commit sin autorización.

Autorización que falta: publicar exclusivamente ese SHA mediante fast-forward
en la rama existente, manteniendo PR #7 en borrador, condicionado a controles
actuales de CI/despliegue. No incluye instalar, activar ni probar cuentas.

## Pendientes y límites

- P1 operativo: la rama remota sigue sin Premium hasta el push autorizado.
  Reinstalar SQL histórico fuera del procedimiento puede recuperar vulnerabilidades.
- Prueba Premium positiva conectada y revocación Basic con el mismo JWT siguen
  siendo encargos separados; esta ejecución local no las sustituye.
- La composición con #1/#2/#5/#6/#8, hosting definitivo y facturación LIVE no
  forman parte de esta candidata. No declara Premium listo para comercializar.
- No garantiza tiempo constante ni todas las intercalaciones administrativas.
  Cambiar validadores obliga a revisar los errores conocidos y sus regresiones.
- Cero cambios remotos, Auth, permisos, Secrets, pagos, generaciones o despliegues.
