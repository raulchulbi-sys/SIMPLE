# PR#1 — revisión y mantenimiento (16/10/2026)

Mantener [PR#1](https://github.com/raulchulbi-sys/SIMPLE/pull/1) en borrador. No crear otra PR de migración, no fusionar. Base mainc818e35; el checkout principal tiene cambios históricos ajenos y no se usa para esta misión. Worktree aislado codex/cloudflare-migration.

## Clasificación del diff

| Área | Archivos/superficie | Decisión |
|---|---|---|
| Frontend | index.html,assets/auth.js | Sólo conexiónruntime y fixrecovery ya validado. No redesign, roles, entrenamiento/edición/Coach nuevos. |
| Runtime | assets/runtime-config.js,scripts/hosting-runtime.cjs,config/public-backends.json | Config pública explícita pororigen/backend; guardasfailclosedy pinclave pública. El runtimeGitHub se conserva. |
| Build | scripts/hosting-build.cjs,static-public-manifest.json | Allowlist compartida,36filesapp/5placeholder; reproducible, sindependencia nueva. |
| Cloudflare | config/cloudflare/**,hosting-preview/release | Distaislado,headerscache404,placeholderactual. Releaseoffline nodeployimplícito. |
| Auth | auth-contract/browser/return ydocsAuth | Email/Google/recovery compatibilidad; casosrealeshistóricos separadosdemocks. NingunaAuthproductivamodificada. |
| CORS | generadores/units/testsprobes | Propuestasaditivas contraLIVE,JWT/negocioconservados; noapplyproductivo. |
| Tests | tests/cloudflare/** | Evidenciaunidades,integración,simulationybrowserreal separada. No SQL/fixtures dentrodist. |
| Documentación | docs/cloudflare-migration/** | GuíasvigentesREADME/CUTOVER/OPERATIONS/PUBLIC*, historiafechadanoautorizaciónactual. |

## Deuda revisada y decisiones

- README contenía Google stagingOFF y versiones antiguas mezcladas con el cierre real. Sustituido por índice vigente; historia detallada queda en AUTH-CLOSURE/VALIDATION y checkpoints con sufecha.
- Access aparecía como puerta obligatoria de corte. Eliminado de las guías operativas y del plan actual, conservando la inspección histórica como descartada; no se sustituye por otro login oservicio.
- Helpers de alta/retirada de fixtures y bundles CORS antiguos se conservan porque justifican regresiones previas. **No son comandos rutinarios para esta misión**. Las cuentas existentes/financieras no son desechables. Mantener separación entre auth-stage-cors, HTTPS-stage yproductionplan; tienen baselines/distintosalcances y no son duplicados intercambiables.
- staging-production-prep-smoke fija hashes de su fase histórica. No actualizarlo sólo para hacer pasarunHEADnuevo; cualquier repetición debe identificar versión/hash que valida. La nueva simulación enlaza artifactTreeSha256 explícitamente.
- browser-support y SDK simuladohistórico se reutilizan. Los mocksdeget_*vacío no siempre coincidencon boolreviewer y notaautosave noes lectura; el NUEVOharness adaptaformasdeprueba/documentalímites, sin cambiarproducto ni falsificarJWT.
- No nueva dependencia runtime/package manager/globalinstall. No framework, proxy, Worker o CLIbillable nuevo. Toolingdebrowserexistente sólo pruebas.
- El directoriorootdist puede seguir siendo placeholder; release usa resultsaislado. Evita que un build local se interprete como app publicada.
- No borrado masivo de scripts para reducir difflíneas: no se encontró evidencia que permitiese declarar inútiles y eliminables los tests históricos. Se indexan y marcan sus riesgos; evidencia privada remainsignoradaynofrontend.
- No CIproductiva nueva que escribaSupabase. GitHubPages publica main; stagingautobuildramaexacta; CloudflareproducciónOFF/previewsNone. Los checksdocumentales no pruebanOAuthreal productivo.
- Rollbackvigente apunta alplaceholderreal170fea3b y detectadrift; referenciasanteriorese829/eb9quedanhistóricas. No rollbackbase de datos porhosting.

## Revisión antes de actualizar la PR

Comparar sólo archivos de esta misión; gitdiff--check, revisar nueva prosa/código sin correos de clientes, contraseñas, tokens, secrets o IDsprivadosinnecesarios. El manifest delhostingexcluyedocs/tests/backendSQL. Preservar identificadoresUUIDdecompatibilidad existentesenproducto porinstrucción, documentándoloscomohallazgopreexistentedeminimización.

Actualizar rama con árbol local exacto; si connectorcreaSHAequivalente, confirmarigualdaddetreeantesdemoverref conlease. No force, no main. Commitscódi/build no usanCF-Pages-Skip para saltartests; docs-onlysípuedenusarlo segúnreglaoficial. Releer deploydeSTAGING despuésdelpush; la producciónplaceholdernoautodeploya.

El resultado de pruebas y estado de seguridad se registran en CHECKPOINT. Una captura móvil o un HTTP401sinJWT no prueba aislamientoentreusuarios. No listar uncheckhistóricocomoejecutadonuevo.
