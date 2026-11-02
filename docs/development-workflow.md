# Desarrollo y revisión de SIMPLE

## Encargo y responsabilidades

El usuario define objetivo, alcance y autorizaciones mediante una issue de GitHub.
ChatGPT puede ayudar a concretarla; el encargo puede ser simplemente objetivo +
enlace a la issue. Codex lee la versión actual de la issue y `AGENTS.md`, audita,
implementa, prueba, se autocorrige y prepara una PR en borrador. Work se utiliza
cuando una comprobación necesita navegador o un entorno conectado y existe una
autorización específica. GitHub conserva el diff, la revisión y el resultado de CI.
No es necesario trasladar cada decisión menor entre estas herramientas.

Una rama/PR por objetivo, desde la base indicada. Una copia/worktree independiente
evita tocar trabajo sin confirmar. Antes de actuar, registra base, rama y estado;
no supongas que informes anteriores acreditan el estado actual. No integres otras
ramas ni cambies PR ajenas. Para este primer incremento, PR #1 y #2 permanecen
intactas, abiertas y en borrador; no se cambia el comportamiento de SIMPLE.

### Plantilla de encargo

```text
Objetivo y criterio de aceptación:
Issue y repositorio/base:
Alcance permitido y exclusiones:
Entorno permitido y operaciones autorizadas:
Pruebas y evidencia esperadas:
Puntos que requieren aprobación independiente:
Entrega: PR en borrador, pruebas ejecutadas y límites pendientes; sin merge.
```

### Tres niveles de actuación

| Nivel | Trabajo y límite |
| --- | --- |
| Local no sensible | Diagnóstico, documentación, cambios mínimos y pruebas offline dentro del encargo. Autocorregir y completar sin consultar decisiones menores. Publicar rama/PR solo si el encargo lo autoriza y sin activar despliegues. |
| Sensible con revisión | Autenticación, roles/RLS, aislamiento, historial, facturación, idempotencia y contratos de proveedores. Si están incluidos en el encargo, preparar y probar localmente; explicar riesgos y obtener revisión antes de integrar. No aplicar al entorno conectado por inferencia. |
| Entornos/pagos con aprobación explícita | Despliegues, SQL/migraciones, Secrets, permisos, cambios en staging/producción, compras/pagos TEST o reales, operaciones de suscripción y llamadas con coste a proveedores. Requieren autorización puntual de destino, acción y límites; preparar preflight, evidencia y reversión antes de solicitarla. |

La autonomía local no equivale a permiso para publicar la aplicación. Si una
operación queda incierta, detente y contrasta con lecturas autorizadas; no repitas
compras, eventos o generaciones. Ante un bloqueo, completa lo independiente y
explica la intervención mínima que falta. No eludas controles de acceso.

## Ciclo y entrega

1. Auditar árbol, instrucciones, contratos y scripts antes de ejecutarlos.
2. Implementar solo el alcance; preservar producto y tests existentes en una tarea de infraestructura.
3. Ejecutar las pruebas relevantes. Corregir el cambio y repetir lo afectado sin debilitar comprobaciones.
4. Revisar `git diff --check`, archivos tocados y diff completo, incluidos archivos nuevos. Buscar datos sensibles solo en el diff autorizado, sin abrir carpetas privadas.
5. Publicar la rama independiente y abrir PR **draft** contra la base autorizada. Sin merge, auto-merge ni cambios de ajustes. Si GitHub exige habilitar Actions o aprobar un workflow, documentarlo; no cambiar ajustes automáticamente.

Informe final de hasta 15 líneas: enlace a PR y commit; archivos y comportamiento
resultante; comandos y resultados realmente ejecutados; pruebas excluidas y
motivo; riesgos, bloqueos y aprobación concreta pendiente si la hay. Una prueba
con dobles no acredita JWT, RLS ni operaciones reales. No adjuntar material
privado ni URLs de sesión sensibles.

## Auditoría inicial de CI offline — 02/11/2026

Base verificada: `main` en `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`,
repositorio público. No había `AGENTS.md`, workflows ni `package.json` raíz.
Esta fase añade instrucciones/CI; no incorpora los cambios de las PR #1 y #2.

Se inventariaron los scripts públicos de `tests/`, excluyendo de la lectura
`private/` y `results/`. Se buscaron indicadores de HTTP, SDK, proveedores,
variables de entorno, procesos, escritura de archivos y fixtures privados. Esa
búsqueda sirve para seleccionar candidatos, no demuestra por sí sola que un test
sea seguro. La revisión detallada se limita a las cuatro entradas siguientes,
sus lecturas, imports y funciones ejecutadas. No se ejecutan suites por glob.

| Entrada auditada y comando individual | Dependencias y efectos | Cobertura offline |
| --- | --- | --- |
| `node tests/client-routine/unit.cjs` | Node estándar; lee `assets/client-routine.js` en VM; `db.rpc` es un doble en memoria. Sin red, SDK, secretos ni escritura de archivos. | 18 comprobaciones de validación, propietario/rutina, versiones y verificación tras reordenar. |
| `node tests/training-reset/unit.cjs` | Node estándar; lee texto de `index.html` y `assets/coach-prescription.js`. `tests/integration/function-source.cjs` analiza declaraciones; solo ejecuta las seleccionadas en VM, con `db` simulado. | 13 comprobaciones de presentación, notas, respuestas tardías y espacios de borradores. |
| `node tests/statistics-stage/unit.cjs` | Node estándar; lee `assets/statistics-stage.js` en VM; RPC y almacenamiento simulados. Sin backend ni borrado real. | 26 comprobaciones de límites temporales, aislamiento, caché y doble envío. |
| `node tests/cycle-start/unit.cjs` | Node estándar; modelo sintético con fechas fijas. Lee `candidate.sql` y `rollback.sql` de su carpeta como texto para hashes y contratos; no los ejecuta. | 31 comprobaciones del modelo de ciclo y contratos estáticos SQL; ninguna prueba PostgreSQL real. |

Las cuatro suites usan aserciones que propagan errores; las asíncronas fijan
`process.exitCode=1`. No leen variables de entorno ni datos externos. La lista
cerrada del orquestador añade análisis sintáctico `node --check` de sí mismo,
de `assets/**/*.js` y de `supabase/functions/**/*.{js,mjs}`. Analizar sintaxis no
importa ni ejecuta esos módulos. Se omiten directorios `private/`, `results/`,
`node_modules/` y `.git/` en esa enumeración.

### Exclusiones deliberadas

| Grupo / ejemplo | Motivo de exclusión; no ejecutado por CI |
| --- | --- |
| Scripts de autenticación, `live`, `real`, `security`, `cleanup`, `prepare`, despliegue y generación de SQL | Pueden usar HTTP, SDK, claves, material privado o escribir/aplicar cambios. El nombre del archivo no garantiza seguridad. |
| Navegador, UI, preview y pruebas con Playwright/servidores locales | Requieren dependencias, navegadores, puertos o fixtures fuera de esta batería. No se instalan para esta fase. |
| `tests/coach-ai/unit.mjs` | Aunque inyecta dobles del proveedor, escribe `results/unit.json` y `schema.json`; se excluye de esta CI sin modificar el test. |
| Resto de scripts, incluidas otras suites llamadas `unit` o `contract` | No tienen cerrada aquí su auditoría de dependencias y efectos; no se ejecutan automáticamente. Ampliar la lista requiere otra revisión del código transitivo. |
| TypeScript/Deno, SQL, HTML completo, JWT/RLS y proveedores reales | Sin compilador Deno, base de datos, navegador ni servicios. El chequeo sintáctico de JS/MJS y los dobles no sustituyen estas verificaciones. |

### Reproducción y comportamiento ante fallos

Requisitos: Git y Node **24.19.0**, sin paquetes npm ni secretos. Desde la raíz:

```text
node scripts/ci-offline.cjs
git diff --check
```

En Windows, la suite de ciclo exige LF para sus hashes literales. Para una
**copia nueva**, sin tocar un árbol de trabajo existente:

```text
git clone --config core.autocrlf=false https://github.com/raulchulbi-sys/SIMPLE.git SIMPLE-offline
```

El orquestador fija la raíz del repositorio, ejecuta cada entrada con Node sin
shell, limita su duración y termina con código no cero ante error, señal o timeout.
No genera informes, fixtures ni artefactos. No descubre ni ejecuta otros tests.
No es una barrera de red: la ausencia de llamadas externas procede de la auditoría
de la lista cerrada. Si cambian las entradas o sus dependencias, hay que volver a
auditarlas antes de ejecutar; no añadas suites por su nombre.

El workflow se activa con `pull_request` y `workflow_dispatch`, usa runner alojado
`ubuntu-24.04`, `permissions: contents: read`, checkout sin credenciales persistidas
y Node fijado. Las dos acciones oficiales se fijan por SHA íntegro; caché de paquetes
desactivada. No hay `push`, `pull_request_target`, secretos, servicios, despliegues,
instalación de dependencias ni publicación de artefactos. GitHub descarga el checkout,
las acciones y, si hace falta, Node; las pruebas de SIMPLE no acceden a servicios.

La primera ejecución alojada se comprobará en la nueva PR; no se afirma validada
por ejecutar solo Windows local. El despacho manual requiere que el workflow
exista en la rama predeterminada, sin que esto autorice fusionarlo. Si faltan permisos
o una aprobación de Actions, ese paso queda pendiente de intervención autorizada.

Referencias oficiales: [sintaxis y permisos de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[seguridad y fijación por SHA](https://docs.github.com/en/actions/reference/security/secure-use),
[checkout v6.0.2](https://github.com/actions/checkout/tree/de0fac2e4500dabe0009e67214ff5f5447ce83dd) y
[setup-node v6.5.0](https://github.com/actions/setup-node/tree/249970729cb0ef3589644e2896645e5dc5ba9c38).
