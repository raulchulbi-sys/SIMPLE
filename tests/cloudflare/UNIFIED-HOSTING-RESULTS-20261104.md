# Artefacto unificado: hosting y recorrido comercial/Coach

Evidencia exclusivamente local. No se ha publicado ni abierto acceso en Supabase,
Stripe, Cloudflare o producción. Los resultados históricos de las candidatas
se conservan en sus informes originales; no sustituyen estas ejecuciones.

## Alcance

`tests/cloudflare/unified-browser.cjs` construye el artefacto `local` del árbol
unificado y sirve sus bytes desde `127.0.0.1:4381`. Repite el recorrido en Chromium
Edge y WebKit, a 390 px. El smoke existente añade 320/1280 px y claro/oscuro.

La primera navegación utiliza el runtime generado intacto: configuración
congelada, backend staging y comercio cerrado, incluso con parámetros de URL
manipulados. La segunda navegación intercala **únicamente en el harness**
`billingTest:true` dentro del runtime, conservando su comprobación real de origen.
El fichero de `dist` no se modifica. Se sustituye el SDK por un doble sintético.

La navegación real de «Mi suscripción» recibe Basic activo, 4,99 €/mes y periodo
pagado; generación y Premium siguen cerrados. Se abre Coach con un intake
`submitted` sin respuesta observable, se recarga por completo y se recupera
mediante lectura. El harness hace aparecer una operación `pending_review` para
comprobar su recuperación. No invoca generación, aprobación, rechazo ni aceptación.

Una rutina sintética preexistente conserva UUID de rutina/día/ejercicio, tres
series de 8–12 repeticiones, RIR 2 y descanso de 120 segundos. Se abre su sesión,
se recupera una nota personal por UUID y se consulta el workout previo en la UI
de historial. Se comparan las ocho tablas protegidas completas antes/después.
Las escrituras del SDK están rechazadas y se registra la actividad a través de
recargas, evitando perder la evidencia al cambiar de página.

El botón auténtico de Portal realiza una sola invocación al doble y navega al
origen oficial interceptado. El Portal es **HTML simulado**, no Stripe real.
Su enlace vuelve a una respuesta HTTPS interceptada cuyos cuatro archivos y
cabeceras provienen del artefacto real. El retorno necesita otra sesión sintética
en memoria, elimina parámetros de URL, consulta `access` y muestra Basic. Esto
no valida el certificado, Auth, CORS ni configuración del Cloudflare conectado.

Toda solicitud HTTP externa de la aplicación se satisface con un doble explícito
o se aborta antes de salir; los service workers están deshabilitados en el contexto
de prueba. No se usan identidades, credenciales ni JWT reales. Los datos `*.invalid`
y UUID incluidos son únicamente fixtures locales. El navegador y servidor se
cierran al terminar.

## Reproducibilidad

`tests/cloudflare/unified-builds.cjs` copia exclusivamente fuentes públicas
allowlisted y dependencias del ensamblador en cuatro directorios nuevos:
preview A/B y producción A/B. Ejecuta cuatro procesos Node separados, sin red,
con entradas explícitas. Compara inventarios completos, bytes y SHA-256 de cada
fichero y del árbol, cobertura de módulos, cierre comercial y aislamiento del
retorno TEST. No reutiliza `dist` ni un manifiesto histórico como resultado nuevo.

Los 43 archivos de preview se derivan de 35 fuentes públicas, el runtime generado,
tres archivos auxiliares y cuatro archivos de retorno. Producción lleva 39 y
excluye el retorno TEST. No se fija un número para ocultar dependencias ausentes:
la comparación deriva la lista del manifiesto, y el ensamblador valida el cierre
de referencias de las fuentes. Las dos salidas independientes quedan ignoradas
por Git; el inventario público no contiene rutas locales ni recibos privados.

Comandos reproducibles:

```text
node --test tests/cloudflare/build.cjs tests/cloudflare/commercial-build.cjs
node tests/cloudflare/runtime.cjs
node tests/cloudflare/auth-contract.cjs
node tests/cloudflare/placeholder-build.cjs
node tests/cloudflare/production-build.cjs
node tests/cloudflare/commercial-browser.cjs
node tests/cloudflare/unified-browser.cjs
node tests/cloudflare/unified-builds.cjs
```

No ejecutar concurrentemente los comandos que reemplazan `dist`. El conjunto
de CI local ampliado incluye los primeros seis grupos; repetirlos dentro de CI
no añade casos distintos.

## Límites

- Las denegaciones Basic/Premium de este recorrido provienen del SDK simulado;
  no son nuevas pruebas JWT ni evidencia del backend conectado.
- La conservación de datos cubre una rutina, un día, un ejercicio, un workout
  y una nota. Las asignaciones y revisiones están vacías: no representa todas
  las combinaciones históricas ni sustituye pruebas de integridad en staging.
- La CSP de la aplicación sigue siendo `Report-Only`; la del retorno es
  restrictiva y obligatoria. El informe no presenta ambas como equivalentes.
- El cambio de origen exige una nueva autenticación en el retorno. El test no
  transfiere una sesión local a otra web ni interpreta el retorno como pago.
- No se ejecuta la lógica de Stripe, renovaciones, cancelaciones ni webhooks.
- El inventario de producción es preparación offline; no sustituye el
  placeholder y no autoriza un corte de hosting.
- Antes de publicar, deben revisarse nuevamente los disparadores externos de
  Pages/Cloudflare, los hashes del árbol definitivo y el destino de build.

## Resultados finales

Resultado sobre el producto unificado definitivo, después de los fixes de gate
Basic y recarga Premium: **155/155 controles del área hosting**, desglosados sin
sumar las reejecuciones:

| Grupo | Casos | Resultado |
|---|---:|---|
| Build base y composición comercial | 17 + 23 | PASS; dentro de CI consolidado final |
| Runtime y contrato Auth | 32 + 18 | PASS; dentro de CI consolidado final |
| Placeholder y empaquetado producción | 12 + 4 | PASS; dentro de CI consolidado final |
| Smoke del artefacto, dos motores, dos tamaños y temas | 8 | PASS; reejecutado tras congelación |
| Recorrido cruzado nuevo | 33 | PASS; 16 por motor + runtime intacto en disco |
| Controles nuevos de dos builds independientes por target | 8 | PASS; suite reproducible versionada |

Los 114 anteriores son regresiones existentes, ejecutadas en este árbol. Los
33 son regresiones cruzadas nuevas; los ocho restantes se presentan como controles
de build nuevos. Los ocho también forman parte del CI consolidado final: **no
sumarlos de nuevo** al total general de la misión. Tampoco se suman las corridas
previas a la congelación ni los reintentos de desarrollo del propio arnés.

Node 24.19.0; Chromium Edge 156.0.4314.50; WebKit 26.5. El smoke cubre 320/1280 px
y los dos temas; la cruzada, 390 px. No aparecieron errores JavaScript ni
solicitudes externas imprevistas. Contadores cruzados acumulados a través de las
recargas: cero escrituras de tablas, cero aprobación/aceptación/retry y cero
invocaciones a proveedor. Cada motor abrió exactamente un Portal **simulado**.

La huella del estado sintético protegido antes y después fue, en ambos motores:
`85a41cb1e91286351bfdfca761bba6d2d0b451b2ad1d823999dbfcdb21593e20`.

| Artefacto | Archivos | SHA-256 del inventario completo |
|---|---:|---|
| Preview staging | 43 | `37c896b9ca70f054dd7031d8b452e9ea9a2098f47b057ec748e02bd753137d71` |
| Producción offline | 39 | `feb47ddf6474503d49470597536fa444f0505b6a3f8e1412103f27e07b31f309` |
| Local 4381 utilizado por ambos navegadores | 43 | `114ca35689c4e47507c5b86457cea62afd7930b04afe53934fac69f8dce51e5b` |

Las 50 entradas copiadas en los directorios independientes tienen inventario
SHA-256 `73a7dc408b17f3bcaf3f910c86c9a25444031ed74cc6a69aa90d741cc336f4e0`.
Esta huella de entradas representa los bytes de este checkout Windows; el
ensamblador normaliza los textos públicos pertinentes a LF y las huellas de
salida son las que identifican los artefactos reproducibles.

El inventario completo saneado está en
`docs/commercial/UNIFIED-ARTIFACT-INVENTORY-20261104.json`. Los recibos de esta
misión quedan ignorados en `tests/cloudflare/results/unified-browser-20261104.json`
y `unified-builds-20261104.json`. El último identifica las cuatro salidas
independientes. Al finalizar se ha dejado `dist` con preview, comercio cerrado.
Servidor 4381 y contextos de navegador cerrados. No se ha hecho commit desde este
frente; el coordinador consolidará el árbol local.

La revisión independiente del arnés no encontró un falso PASS bloqueante. Durante
su desarrollo se corrigieron únicamente fixtures/esperas: prefijo UUID de la nota,
campo `state` del doble de retorno y espera explícita a su módulo inicializado en
WebKit. No fueron defectos de producto ni dieron lugar a modificaciones de hosting.
