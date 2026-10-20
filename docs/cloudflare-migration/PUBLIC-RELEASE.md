# Publicación pública futura: preparación y simulación offline

**Estado actual 20/10: BLOCKED para el corte.** Main vigente incluye Bloq Mayús, ciclo corregido y ambos arreglos del reviewer; hosting conserva recovery al recargar. El contraste directo REST con JWT productivo normal sigue pendiente y la ventana temporal autorizada no se ha utilizado en este checkpoint. UI, SQL claims y staging no sustituyen su control positivo y negativo. No emitir un recibo de seguridad PASS para el corte mientras falte ese control. Actualizar staging tras sus controles y regresiones no sustituye esa validación productiva ni autoriza el corte.

Actualización20/10/2026: main `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663` conserva el hotfix de privacidad `520a98a`, compatibilidad histórica `b415e9f2`, Bloq Mayús y las tres funciones de ciclo actuales. RPC reviewer MD5 `6442b03ced86d22c57dbf434898c6a9a`; projector `fc89c86e5a6fb56069bfbf777d9dd3e1`. Los bytes públicos cambian legítimamente por Bloq Mayús, así que los artefactos anteriores no sustituyen el build de esta fuente integrada. **No se ha fusionado PR #1 ni realizado el corte Cloudflare.** La evidencia productiva del backend corresponde al coordinador y no se sustituye por los tests offline de este documento. No reaplicar SQL de ciclo/reviewer durante la publicación del frontend.

La arquitectura elegida es frontend público en Cloudflare Pages y autorización de cuentas/datos en Supabase Auth, JWT, RLS y permisos del servidor. Access no es una puerta de esta preparación. **Este helper no publica la aplicación:** `simple-raulchulbi` conserva su placeholder; main, Google, Auth/CORS productivos, Site URL, plantillas y datos permanecen fuera de sus acciones.

`scripts/hosting-release.cjs` prepara y comprueba artefactos locales. Todos sus modos son **OFFLINE_DRY_RUN**. Ejecutarlo sin argumentos sólo describe los comandos. No contiene fetch, API Cloudflare, executor Wrangler, credenciales, cambios Git, instalación de dependencias ni publicación. `--publish`, `deploy` y argumentos de credenciales se rechazan. Incluso un recibo de seguridad PASS deja `publicationPermitted=false` y exige autorización posterior explícita.

## Preparación reproducible

Se exige el SHA completo del commit y la huella Git del árbol aprobado. Se leen los blobs de ese commit, sin incorporar cambios de trabajo sin commit. El helper copia exclusivamente las entradas de la allowlist y la configuración/scripts necesarios a:

`tests/cloudflare/results/public-release-<SHA>/source/`

Reutiliza allí `hosting-runtime.cjs` y `hosting-build.cjs`; el output queda en `source/dist`. Una copia separada en `rollback-source/dist` reproduce el placeholder. Ambos directorios son acotados, se rechazan enlaces simbólicos y Git debe confirmar que están ignorados. **No se toca `dist/` en la raíz del worktree.**

El empaquetado comprueba proyecto `simple-raulchulbi`, host HTTPS estable exacto, perfil production, rama futura `main`, backend `yvguatdqncadkwewlepe` y clave pública aprobada mediante el validador runtime vigente. Hace dos builds, compara bytes con los blobs, comprueba el inventario de 36 archivos, runtime, headers y SHA-256. Después escanea el artefacto para detectar archivos internos, claves secretas reconocibles y JWT privados. La publishable key aprobada es pública y forma parte del runtime; no se guarda ninguna credencial privilegiada.

El recibo `release.json` guarda fuente, árbol, inventario, hashes y rollback; queda fuera del output web e ignorado por Git. Cada validación vuelve a comparar HTML/assets y archivos de plataforma con Git, genera la configuración pública esperada y compara los bytes reales. Editar un hash del recibo no basta para aprobar otro artefacto. El escáner no sustituye la revisión de código/datos ni prueba por sí solo RLS; esa evidencia pertenece al recibo PUBLIC FRONTEND SECURITY.

Obtener la fuente y árbol exactos tras el commit de integración; releer main remoto antes de utilizar su SHA. Estos comandos son offline y **no autorizan una futura publicación**:

```powershell
node scripts/hosting-release.cjs
$releaseSource = git rev-parse HEAD
$releaseTree = git rev-parse 'HEAD^{tree}'
node scripts/hosting-release.cjs prepare --source $releaseSource --tree $releaseTree
$releaseReceipt = "tests/cloudflare/results/public-release-$releaseSource/release.json"
node scripts/hosting-release.cjs validate --receipt $releaseReceipt --main 0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663
node scripts/hosting-release.cjs rollback --receipt $releaseReceipt
```

Después de un nuevo commit o merge aprobado, obtener los SHA/árbol reales y preparar un recibo nuevo. No reutilizar una declaración de fuente antigua como si describiera el commit posterior. La app puede mantener la misma huella si únicamente cambian documentación o guardas que no alteran los bytes generados; registrar esa relación expresamente.

## Puerta de seguridad y simulación

PREPARAR no exige PASS: sus archivos son necesarios para las pruebas locales. VALIDAR/PLAN sólo marcan `publicFrontendSecurityValidated=true` cuando un recibo externo contiene `status=PASS`, `sourceTree` y `artifactTreeSha256` coincidentes y una lista `evidence` no vacía. Se entrega mediante `--security` apuntando a un JSON local acotado al repositorio. Un recibo ausente, BLOCKED, sin evidencia o perteneciente a otra fuente/artefacto deja la preparación bloqueada. No generar un PASS a partir únicamente de mocks o de un status escrito manualmente; el operador debe reconciliar las evidencias reales y sus límites.

El empaquetado y la revalidación también comprueban los SHA-256 de los tres consumidores del reviewer validados; un árbol que restaure los anteriores se rechaza antes de empaquetar. Una modificación posterior legítima de esos consumidores requiere revisión del contrato y renovación explícita de sus pins. `plan`/`validate` necesitan `--main FULL_SHA` para considerar preparada la integración: ese commit debe existir, ser ancestro de la fuente de hosting y conservar los mismos consumidores. El operador debe haber obtenido el SHA de una lectura remota actual; ancestry local no prueba por sí sola el estado remoto ni los permisos del backend. Sin main verificado, la preparación sigue bloqueada aunque se aporte un recibo de seguridad PASS.

Para el siguiente corte, el recibo privado debe vincular además la ABI productiva anterior con la lectura actual de owner, grants, search_path y policies cerradas, y con el contraste JWT pendiente. La instalación del hash correcto por sí sola no autoriza ese PASS. La compatibilidad SQL no cambia la allowlist, runtime o consumidores: las 13 guardas nuevas, 17 regresiones existentes y 8 comprobaciones de build se reutilizan con su fuente/fecha; una nueva vinculación de árbol no aumenta el contador de pruebas.

Regresión reutilizable: `node tests/cloudflare/reviewer-release-unit.cjs FULL_MAIN_SHA`. Sus escenarios de interrupción vuelven a comprobar receipts y bytes, detectan un archivo incompleto y repiten PREPARAR de manera determinista. Los recibos PASS sintéticos de esas unidades se limitan a `results/`, se eliminan al terminar y no constituyen evidencia de seguridad real. Ningún escenario aplica Google/Auth/CORS o publica. La tabla de reanudación externa está en CUTOVER.

El plan conserva las etapas PREPARAR → VALIDAR → DEPLOY SIMULADO → COMPROBAR → ROLLBACK SIMULADO. No aplica propuestas Google/Auth/CORS. La simulación de navegador separada usa este artefacto y dobles de proveedor con todas las peticiones interceptadas; no equivale a login, correo, backend o deployment productivos reales. Los 103 checks anteriores se reutilizan con su fecha y alcance; las nuevas guardas de release se cuentan separadamente.

El runtime offline admite sólo el origen estable previsto; no añade hashes públicos alternativos ni comodines. La CSP de la aplicación permanece report-only conforme a su fuente existente. No confundirla con la CSP de bloqueo del placeholder ni declarar una CSP estricta que no existe.

## Publicación futura y límite actual de automatización

Antes de una publicación autorizada: revisar main y su efecto en GitHub Pages, exigir evidencia PUBLIC FRONTEND SECURITY, contrastar los ajustes Google/Auth/CORS exactos y sus backups, confirmar proyecto/ramas y conservar autodeploy OFF y previews None. Los ajustes externos de esta misión son propuestas; el helper no los aplica. Reconciliar el artefacto con el commit aprobado y resolver cualquier fallo antes de la indicación explícita de publicar.

La documentación oficial permite publicar un directorio preconstruido con Wrangler y también usarlo con un proyecto Git integrado manteniendo las publicaciones automáticas deshabilitadas. **No se cambia el tipo del proyecto ni se crea otro.** No se encontró Wrangler en el PATH durante esta preparación; no se instaló ni se probó una sesión/API de publicación. Por ello no se presenta un comando de producción localmente validado ni se inventa un executor. Una futura ejecución requiere herramienta disponible, ayuda oficial de su versión, sesión/autorización válida y revisión del comando concreto. No poner tokens en archivos, argumentos, recibos, logs o ejemplos. [Git integration y controles de rama](https://developers.cloudflare.com/pages/configuration/git-integration/), [Direct Upload con CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

Tras un deployment futuro, verificar metadatos, SHA y archivos servidos usando las primitivas existentes de `tests/cloudflare/live-hosting.cjs` para GET/HEAD, redirecciones del mismo origen, MIME, hashes y headers. Su CLI actual está fijada a staging: no ejecutarla sin adaptar explícitamente su configuración al perfil productivo revisado. Los contratos de build/runtime ya preparan el inventario esperado. Las pruebas funcionales reales deben usar una cuenta autorizada; no entrenamientos sintéticos productivos, correos indiscriminados ni llamadas OpenAI. No se automatiza monitorización ni se añaden servicios.

## Rollback sin restaurar datos

La copia local de rollback debe coincidir con el placeholder aprobado: deployment `170fea3b-05ea-426b-b482-af7749bd0218`, fuente remota `8b2f526edae136b43970dd9770f5b74db575e7e6`, paquete `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399`. El modo rollback revalida sus cinco archivos; no llama a Cloudflare ni mueve el hostname.

El recibo local exige conservar intactos los dos outputs de simulación. Si faltan o cambiaron, repetir PREPARAR desde el mismo commit aprobado antes de validar el plan; el rollback remoto del panel sigue siendo una operación independiente contra el deployment identificado.

Ante un incidente futuro autorizado: detener publicaciones automáticas, seleccionar en Pages el deployment productivo aprobado anterior y confirmar Rollback, comprobar contenido/headers/backend ausente y mantener GitHub disponible. Cloudflare sólo admite deployments productivos correctamente construidos como destinos de rollback; las previews no sirven. Releer el estado real antes de actuar. [Cloudflare: Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

Un rollback no elimina aliases/hashes anteriores. Revisar qué versiones siguen accesibles y preservar controles backend. Si se revierten adiciones Auth/CORS, retirar únicamente los valores añadidos y conservar GitHub, Site URL y cambios posteriores legítimos. No restaurar SQL amplio, finanzas, entrenamientos ni borrar cuentas, perfiles o identidades. No se ha ensayado un rollback remoto; sólo se reprodujo y verificó el artefacto local de retorno.
