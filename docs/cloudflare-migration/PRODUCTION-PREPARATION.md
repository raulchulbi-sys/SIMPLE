# Cloudflare producción: proyecto configurado, aplicación pendiente

Checkpoint actualizado el **16/10/2026**. Estado: **PRODUCTION PROJECT CONFIGURED — DEPLOYMENT PENDING**. La parte pendiente es el despliegue de la **aplicación conectada a producción**. El proyecto independiente ya existe y sirve públicamente un placeholder estático sin backend. **Cloudflare Access sigue pendiente; no hay una aplicación productiva protegida ni una validación funcional completa de esa aplicación.**

Este checkpoint sustituye las afirmaciones anteriores de CUTOVER/README que indicaban que el segundo proyecto todavía no se había creado. GitHub Pages conserva la aplicación vigente. Main permanece en `c818e35fcb0cfeddb61e8232aaaffba222ea8f4d`; la PR #1 continúa en borrador y no se ha fusionado.

## Identidad y configuración observadas

| Campo | Estado real |
|---|---|
| Proyecto independiente | `simple-raulchulbi`, creado en la cuenta Cloudflare existente |
| URL estable | https://simple-raulchulbi.pages.dev/ |
| URL exacta del deployment | https://170fea3b.simple-raulchulbi.pages.dev/ |
| Deployment ID | `170fea3b-05ea-426b-b482-af7749bd0218` |
| Commit fuente indicado por Cloudflare | `8b2f526edae136b43970dd9770f5b74db575e7e6` |
| Candidato local revisado | `4fbb82b5a4ccf9e65fdcd7dfd74bb3bff5db5705` |
| SHA-256 del paquete placeholder | `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399` |
| Integración Git | Exclusivamente `raulchulbi-sys/SIMPLE` |
| Rama actualmente configurada | `codex/cloudflare-production-preparation` |
| Build activo | `node scripts/hosting-build.cjs --target placeholder` |
| Output | `dist` |
| Variables públicas | `SIMPLE_DEPLOY_TARGET=placeholder`, `SIMPLE_PAGES_PROJECT=simple-raulchulbi`, `SIMPLE_APP_URL=https://simple-raulchulbi.pages.dev/` |
| Variables de Cloudflare | `CF_PAGES_BRANCH` y `CF_PAGES_URL`, automáticas |
| Despliegues automáticos de producción | **OFF**, comprobado en el panel |
| Preview branches | **None**, comprobado en el panel |
| Access | **No configurado** |
| Aplicación conectada a Supabase producción | **No desplegada** |
| Dominio comercial / DNS / corte | Pendientes; sin cambios |

El placeholder contiene exactamente `index.html`, `404.html`, `assets/preparation.css`, `_headers` y `robots.txt`. No publica el runtime, SDK, claves, formularios, scripts, archivos internos ni cliente Supabase. El enlace visible lleva a la aplicación vigente en GitHub Pages. Es seguro mantener este contenido público mientras Access está pendiente.

Su CSP se aplica en modo de bloqueo: `default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Las conexiones quedan bloqueadas por `default-src 'none'`; HTML y recursos usan `Cache-Control: no-store`. No confundir esta CSP del placeholder con la CSP report-only de la aplicación existente.

## Evidencia y alcance

Los resultados guardados, sin reejecutarlos para escribir este documento, son:

- **12/12** contratos offline del placeholder: inventario, reproducción, limpieza, identidad/rama, rechazo de contenido activo, enlaces no revisados y ampliaciones de CSP. Incluyen las dos regresiones de la segunda revisión.
- **31/31** contratos runtime: identidades staging/producción separadas, ramas restringidas y runtime GitHub conservado. Son 24 casos afectados existentes y siete contratos añadidos, no una batería funcional productiva.
- **28/28** comprobaciones del placeholder real: ocho casos HTTP sobre el origen estable y el deployment, más veinte combinaciones Chromium/WebKit, 320/360/390/430/1280 px y claro/oscuro. Verifican bytes, HTTPS, headers, rutas privadas, ausencia de scripts/formularios y tráfico limitado al alojamiento.
- **7/7** unidades del generador de propuesta CORS productiva, sin peticiones a funciones ni deploy; el plan permanece con `gate.passed=false` y `applyAllowed=false`.
- **17/17** regresiones del empaquetador compartido: 16 pasaron en sandbox; la prueba de junction se ejecutó aisladamente fuera del sandbox tras EPERM y pasó.
- **4/4** empaquetados offline del futuro perfil productivo, sin desplegar la aplicación.
- **4/4** comprobaciones específicas de staging tras la preparación: runtime real y navegación sin sesión en ambos motores. Staging conserva `dmqjexigdnfzobarhnib`; la comprobación no repite Google ni recovery reales.

**Total histórico de la fase del 15/10/2026: 103 comprobaciones únicas**, sin sumar intentos ni evidencia histórica anterior. No se repitieron para las lecturas de panel del 16/10 ni para esta actualización documental. El smoke de staging registró un mensaje de recurso 404 sin ubicación en Chromium y el aviso report-only sin report-to en WebKit. No hubo pageErrors, fallos de requests observados, escrituras ni acceso a producción; no se afirma una consola vacía.

La primera comprobación HTTPS del placeholder dejó un diagnóstico de propagación DNS del alias: cuatro éxitos y cuatro fallos de red. Se conserva en `tests/cloudflare/results/placeholder-live-first-dns.json`; la ejecución posterior completa está en `placeholder-live.json`. No sumar ambos intentos como casos distintos ni ocultar el diagnóstico. Los demás informes permanecen en `tests/cloudflare/results/`, ignorados por Git y excluidos del hosting.

El informe HTTPS toma el commit de los metadatos revisados de Cloudflare; la comparación HTTP prueba el contenido servido. Google y recuperación reales ya validados en staging son evidencia histórica independiente. No se ha probado Auth real desde el nuevo origen productivo, no se han enviado correos ni realizado llamadas OpenAI en esta validación. Estas medidas no constituyen una comparación de rendimiento entre proveedores.

## Integridad y configuración de Auth leídas al cierre

La comparación de sólo lectura entre las capturas iniciales (19:54 UTC) y finales (20:22 UTC) del 15/10/2026 coincide en las **34 entradas de producción y 34 de staging**, incluidas identidades y campos estables de Auth. Coinciden las definiciones y permisos de las 214 funciones productivas y 219 de staging, políticas, seguridad, triggers, presupuestos, reservas y contabilidad; también los metadatos Edge (cinco y diez funciones). Las huellas de las tablas completas cubren rutinas, asignaciones, workouts, notas, revisiones, recomendaciones y mesociclos. El RPC de ciclo mantiene `88c3564c3c49cf9c53fccba89a1e71b5`.

Raul conserva trainer; Patatasimple conserva client, R1/R2 y cinco workouts. No se crearon fixtures ni sesiones en esta fase. Premium directo sigue OFF: cero usuarios elegibles, capacidad, operaciones, llamadas y gasto. No se leyó ningún token, contraseña ni secret. Los informes privados permanecen ignorados y fuera del artefacto web. No se usa la huella de timestamps mutables de Auth como criterio de identidad.

El panel productivo se leyó sin guardar: Site URL y la única Redirect URL siguen siendo `https://raulchulbi-sys.github.io/SIMPLE/`. Las plantillas de confirmación y recuperación usan `{{ .ConfirmationURL }}`, sin destino GitHub incrustado en el enlace. No se editó ni envió ninguna plantilla y no se accedió a credenciales SMTP. Los backups y comprobaciones de plantillas son privados e ignorados.

## Access: alta con condiciones financieras pendiente y cobertura necesaria

El 16/10/2026 Cloudflare One volvió a cargar. Se continuó desde Get started y se seleccionó **Free** dentro de la autorización ya concedida para inspeccionar el siguiente paso. El checkout real **Activate Zero Trust Free** mostró base de **0 dólares y 50 usuarios**, campos de tarjeta y dirección de facturación, una casilla de aceptación de Terms/Privacy y otra para autorizar cargos mensuales por uso que exceda los límites gratuitos. **Se detuvo antes de introducir datos, seleccionar wallets, marcar casillas o pulsar Activate.** No se completó el alta ni existe una política o aplicación Access configurada. [Cloudflare One: setup](https://developers.cloudflare.com/cloudflare-one/setup/).

Las autorizaciones limitadas para seleccionar Free y leer Google ya están resueltas; no hay que pedirlas otra vez. Los errores Session Expired/Loading del 15/10 quedan como antecedentes superados. La dependencia actual es distinta: completar el alta requiere método de pago y aceptación de condiciones/cargos, y el encargo original prohíbe activar facturación. Ese paso necesita intervención del titular y una **nueva autorización explícita** que cubra esas condiciones; la selección Free autorizada no la sustituye. No se extrajeron ni conservaron códigos SMS, credenciales o tokens de Link, ni URLs de iframes de pago.

Antes de servir la aplicación real, completar el procedimiento oficial para proteger tanto `simple-raulchulbi.pages.dev` como `*.simple-raulchulbi.pages.dev`. La documentación de Pages distingue la protección de previews de la del hostname raíz y describe la preparación de las aplicaciones Access correspondientes; no dar por protegida la raíz al activar solamente previews. Verificar también la ruta raíz y todas las rutas de cada hostname, sin excepciones públicas que permitan descargar el frontend conectado a producción. [Pages: known issues](https://developers.cloudflare.com/pages/platform/known-issues/), [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Access: application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

La comprobación deberá hacerse sin sesión y con el titular autorizado sobre el hostname principal, el hash actual, aliases de rama y hashes históricos que existan. Confirmar denegación antes de entregar HTML/JS de la aplicación; verificar luego el acceso permitido. Un wildcard de subdominios no debe suponerse equivalente a cubrir el hostname raíz. Si no puede verificarse esa cobertura con los permisos y el plan autorizados, mantener el placeholder y detener únicamente la publicación de la aplicación.

La futura interacción Access/Supabase OAuth debe comprobarse sin desactivar la protección: retorno legítimo al host estable, sesión de Access y ausencia de bucles. No usar el resultado de Google de staging como prueba de esa combinación productiva.

## Seis puertas para Auth/CORS productivos

Las propuestas exactas son la base `https://simple-raulchulbi.pages.dev/`, el patrón de Redirect URL `https://simple-raulchulbi.pages.dev/\?reset=1` y el origen CORS `https://simple-raulchulbi.pages.dev`. El backslash pertenece al patrón de allowlist; la URL real de recuperación usa `?reset=1`. Estas adiciones **no se han aplicado en producción**.

1. **Propiedad e identidad:** releer proyecto, deployment y origen exactos; confirmar el proyecto Supabase productivo `yvguatdqncadkwewlepe` y que staging conserva `dmqjexigdnfzobarhnib`.
2. **Protección real previa:** Access configurado y comprobado en raíz, aliases y rutas relevantes. Un placeholder público por sí solo no satisface la condición de acceso para publicar después la aplicación.
3. **Backup verificable y rollback:** capturar Site URL, Redirect URLs, fuentes LIVE, versiones/hashes y CORS antes de escribir. Definir reversión de las entradas nuevas y comprobar que no haya cambios posteriores antes de aplicarla.
4. **Validación de staging:** contrastar el diff mínimo con la versión LIVE, validar el mecanismo aditivo y los rechazos de orígenes ajenos en staging. Los ensayos y fuentes antiguos no sustituyen esa comparación contra el estado vigente.
5. **Alcance aditivo:** conservar todos los orígenes anteriores, Site URL, callback Google Supabase, Auth de los usuarios, roles, RLS, JWT, lógica financiera y controles de acceso. No desplegar bundles antiguos de staging sobre producción ni ampliar la allowlist con comodines. Mantener Premium directo OFF y comprobar su elegibilidad mediante lectura al preparar la promoción.
6. **Aprobaciones y comprobación posterior:** respetar las confirmaciones obligatorias que aparezcan; aplicar sólo los valores exactos autorizados, leerlos después y registrar el diff. Las pruebas Auth que alteren sesiones o contraseñas productivas necesitan una cuenta expresamente autorizada. Sin alguna puerta cumplida, conservar la propuesta sin aplicar.

La falta actual de Access mantiene cerrada la segunda puerta; no se realizaron escrituras productivas de Auth/CORS. Tampoco se cambiaron Site URL, configuración Google, Edge Functions, datos deportivos/financieros, cuentas o roles. Esto describe el alcance de las acciones realizadas; no afirma una nueva auditoría completa de toda la base productiva.

Google Auth Platform volvió a cargar el 16/10/2026 y se completó únicamente la lectura acotada autorizada del cliente existente **SIMPLE Web**, proyecto **simple-509717**. Se observó una URI en cada sección:

| Campo Google verificado | Único valor actual |
|---|---|
| Authorized JavaScript origins | `https://raulchulbi-sys.github.io` |
| Authorized redirect URIs | `https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback` |

La adición preparada es **sólo** `https://simple-raulchulbi.pages.dev` en Authorized JavaScript origins, conservando el origen GitHub y el callback Supabase. **No está autorizada por la aprobación de sólo lectura y no se aplicó.** La guía oficial de Supabase incluye la URL de la aplicación y el callback en esos campos; no sustituir el callback Supabase por Cloudflare. [Supabase: Google social login, Project setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

No se abrió ningún secreto, guardó configuración ni creó clientes, scopes o secretos. Los errores de carga anteriores no son el estado actual. La modificación Google propuesta necesita autorización separada; no bloquea el placeholder. **OAuth real desde Cloudflare producción permanece pendiente**; el PASS real de staging se conserva con su alcance original.

## Orden para la siguiente promoción

1. Conservar el placeholder y los controles actuales. Resolver con el titular la nueva autorización financiera/contractual antes de completar el alta Access; después configurar sus políticas y verificar la cobertura sin sesión, incluyendo aliases.
2. Reconciliar main, PR, fuentes LIVE, flags e integridad mediante lecturas; preparar backup y reversión contra ese estado. Validar el diff aditivo en staging, releer los dos campos Google ya verificados y aplicar su adición exacta únicamente si recibe autorización separada. Satisfacer las seis puertas.
3. Aplicar únicamente Redirect URLs/CORS exactos autorizados, conservando GitHub Pages y el callback Google `https://yvguatdqncadkwewlepe.supabase.co/auth/v1/callback`. No cambiar Site URL ni SMTP.
4. Tras autorización separada de merge, incorporar el árbol revisado a `main`. Antes de publicar, comprobar cómo se despliega GitHub Pages y conservar su compatibilidad. Configurar la promoción manual de Cloudflare con `--target production`, rama `main` y runtime productivo, manteniendo Access activo y las publicaciones automáticas apagadas.
5. Publicar la aplicación bajo Access y contrastar deployment, SHA, runtime, backend, allowlist, headers y recursos. Validar Auth/OAuth/recovery con una cuenta autorizada, sin entrenamientos sintéticos, generación AI ni cambios de usuarios reales. Una limitación pendiente se documenta como tal.
6. Presentar el resultado para la autorización del corte. Dominio comercial, DNS, canónico, retirada del hosting anterior y apertura a terceros siguen fuera de esta preparación.

**Efectos verificados del futuro merge:** GitHub Settings → Pages utiliza `Deploy from a branch`, `main`, carpeta `/ (root)`; por tanto, un merge sí activaría su publicación existente. La última ejecución mostrada es `38479333757`. Staging mantiene autodeploy ON sólo en `codex/cloudflare-migration` y previews None, releídos sin guardar; main no activaría staging.

**Un merge en main no activa hoy producción Cloudflare:** los builds automáticos están OFF, las previews están en None y el proyecto mantiene rama/build de placeholder. Releer esos controles antes de cualquier merge o publicación manual; una modificación posterior del panel puede cambiar esta conclusión. Staging sigue siendo un proyecto independiente con su rama de migración. [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

## Rollback de alojamiento y configuración

El punto seguro actual es el placeholder del deployment `170fea3b-05ea-426b-b482-af7749bd0218`, fuente `8b2f526edae136b43970dd9770f5b74db575e7e6`, paquete SHA-256 `47ba45ce844af2c62569d60c8d622f5e8c8b864c807f465cf3037cd74e662399`. Guardar esta identidad antes de publicar la aplicación. Actualmente es el primer deployment: no inventar una versión anterior disponible.

Si una publicación futura de la aplicación falla, mantener Access, detener cualquier nueva publicación y restaurar este deployment aprobado mediante Rollback de Pages, o volver a desplegar manualmente su artefacto revisado si procede. Comprobar de nuevo bytes, rutas y backend ausente. Mantener GitHub Pages disponible.

Un rollback del hostname estable no elimina las URLs de deployments anteriores. **Los hashes antiguos y aliases que hayan servido una aplicación productiva deben seguir protegidos**, también después de restaurar el placeholder. Verificar sus accesos directos; no retirar Access mientras pueda alcanzarse una versión con backend productivo. [Pages: preview deployment URLs](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

Si se hubieran aplicado adiciones Auth/CORS, releer el estado LIVE y retirar sólo las entradas añadidas por esta promoción, conservando cambios posteriores legítimos y las URLs GitHub. No restaurar indiscriminadamente una función antigua. Site URL y DNS no requieren reversión si nunca se cambiaron. No ejecutar rollback SQL amplio, restaurar entrenamientos ni borrar cuentas, perfiles, identidades Google o usuarios de prueba conservados.

No se ha ensayado un rollback productivo: el placeholder tiene un único deployment y no se ha publicado la aplicación.

## Próximas acciones del titular

1. Decidir si autoriza expresamente el alta Zero Trust Free con método de pago, condiciones y posibles cargos por excedentes; si continúa, completar personalmente ese paso. Sin esa autorización se mantiene el placeholder.
2. Autorizar por separado, si desea continuar, la adición Google exacta `https://simple-raulchulbi.pages.dev` a Authorized JavaScript origins; conservar el origen y callback actuales.
3. Cuando se cumplan las puertas, identificar la cuenta de validación productiva y autorizar el merge del árbol revisado; el corte requerirá una aprobación posterior independiente. No es necesario elegir ni comprar un dominio para conservar esta preparación segura.
