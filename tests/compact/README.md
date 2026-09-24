# Última sesión compacta y apariencia explícita

Base de producción: `c6bf40072248ba9b5d2d98521aeb2c735693c7e8`.

## Alcance

- Referencia de Última sesión en dos líneas: etiqueta/fecha y todas las series. Si no caben, la segunda línea permite desplazamiento horizontal nativo, también con teclado y foco visible. No se descartan series, valores cero ni campos vacíos. No cambia la resolución por UUID/alias ni la consulta de históricos. Las notas permanecen en su ubicación original, sin resumir ni modificar su contenido.
- Ajustes ofrece Claro/Oscuro con los mismos controles accesibles. Claro es el valor inicial; `system` almacenado se convierte en `light` antes de aplicar estilos. Ambas elecciones persisten; cambiar tema no recarga ni sustituye el entrenamiento activo. Con almacenamiento bloqueado se mantiene el comportamiento en memoria.
- Sin cambios en autenticación, OAuth, navegación, backend o datos. No se instala ninguna skill adicional.

## Ejecución local

Desde este worktree, iniciar `INTERIOR_PORT=4183 node tests/interior/preview.cjs` (asignar la variable según el shell). La preview usa SDK y datos ficticios locales; no permite escrituras remotas.

- `node tests/compact/browser.cjs`: 110 casos, Chromium/WebKit, 320/360/390/430/1280, ambos roles, tonos, primera pintura, migración, persistencia, ocho series completas, cero/vacío, notas largas, foco, contraste, estado activo y ausencia de escrituras.
- `SIMPLE_PREVIEW_URL=http://127.0.0.1:4183/ POLISH_WIDTHS=320,360,390,430,1280 node tests/polish/browser.cjs`: 110 casos de pantallas y navegación visual.
- `SIMPLE_PREVIEW_URL=http://127.0.0.1:4183/ node tests/polish/accessibility.cjs`: 8 casos.
- `SIMPLE_PREVIEW_URL=http://127.0.0.1:4183/ node tests/polish/loading.cjs`: 96 casos de carga/primera pintura.
- `node tests/polish/contracts.cjs`: 9 contratos; `node tests/interior/contracts.cjs`: 6; `node tests/identity/protected.cjs`: 16.
- `node tests/compact/regressions.cjs`: 215 comprobaciones existentes: duración 30, concurrencia 33, navegación/historial 26, borradores 7, modos 16, editor 34, contrato histórico de aliases 19 y navegador 50.

Total de la ejecución final: **570 comprobaciones únicas**; las repeticiones diagnósticas y de capturas no se suman. Los scripts conservan las rutas locales de Playwright y de las suites históricas de este entorno Windows; no son dependencias de ejecución del producto.

## Evidencia y límites

Los resultados y capturas antes/después se guardan exclusivamente en `results/`, ignorado por Git. El «antes» usa la CSS de la base de producción sobre los mismos datos ficticios. Durante la revisión se recuperó la etiqueta del estado vacío, detectada por la regresión de navegación, y se corrigió la restauración de CSS en el generador de capturas.

`SIMPLE_PUBLIC_URL` permite ejecutar los mismos casos contra los assets publicados, interceptando el SDK y bloqueando cualquier petición a Supabase. Esto comprueba la interfaz servida realmente por Pages; **no equivale a un login autenticado real**. No crea usuarios, sesiones históricas ni fixtures remotas. Las verificaciones de integridad de producción son consultas de solo lectura y sus informes quedan fuera del commit.
