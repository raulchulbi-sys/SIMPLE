# Validación de la migración estática

Ejecución nueva de 14/10/2026. Base pública comprobada: `c818e35`. El HTML descargado de GitHub Pages coincide byte a byte con ese commit: SHA-256 `ec3ab5f1af7d75b1db71110bc9b520737382d503ad5dc3d2dc39cf189e16b946`. El HTML del paquete validado tiene SHA-256 `3f5dbbb5e4a5b5b987db3c5bafd51b4713243b0a7675c37ad261ec4273e50fa1`.

Paquete final: 36 archivos, árbol SHA-256 `24423fbbd4e2e7609c6deaada0b9a6b13da87f6cb31861032ddebf0a31a21f4f`; configuración de staging SHA-256 `202f61a9655692982c33b095c15ae1675b321b3c768e7328fd6de71d6db7a60f`. El build elimina únicamente CR de pares CRLF en entradas de texto, conservando todos los demás bytes y los binarios. Los 31 assets existentes del paquete coinciden byte a byte con los blobs de Git; el HTML mixto tenía 89 pares CRLF que también se normalizaron. La repetición tras esa normalización LF reemplaza los resultados previos; no se suma al contador de 48.

## Navegador

`browser.cjs`: **48/48 recorridos**. Chromium/Edge y WebKit; 320, 360, 390, 430, 768 y 1280 px; claro y oscuro; entrada `/` y `/SIMPLE/`. Cada recorrido comprueba atleta y entrenador, recursos relativos, configuración de staging y sus orígenes congelados, ciclo actual, UUID, separación entre editor y entrenamiento, borrador local, temporizador al cambiar tema, historial por día y selector de progreso con ejercicios actuales. Comprueba también que Premium inicial OFF conserve la entrada y la apertura del seguimiento Premium anterior con la sesión sintética existente.

El servidor entrega los archivos reales de `dist`. `/` carga la configuración de staging compilada para `http://127.0.0.1:4280/`. Para `/SIMPLE/`, solo `assets/runtime-config.js` se genera con `createRuntimeConfig` para esa base y el mismo origen local. El resto de los archivos es idéntico. El SDK se sustituye por el mock histórico de interior; los datos y UUID son ficticios. La única consulta HTTP de configuración social se responde localmente. Los demás endpoints remotos y las escrituras HTTP están bloqueados. No hubo errores JavaScript, archivos estáticos ausentes ni tráfico API inesperado.

`browser-visual.cjs`: **4/4 escenarios de comparación**, más cuatro fixtures de referencia. Las **24 parejas de capturas PNG** son byte idénticas: inicio del atleta, entrenamiento, ajustes, historial, clientes del entrenador y progreso; 390/1280 px y ambos temas. Fecha fijada, animación reducida, datos simulados. Se revisaron además las capturas de entrenamiento oscuro a 390 y progreso claro a 320.

`assets/coach-premium-weekly.js` publica el contrato `PremiumWeekly`, pero su demostración HTTP solo se inicializa si existe `#weekly-app`; ese elemento no existe en el producto. La ruta `/weekly-api` queda inactiva. El adaptador de producto conserva el transporte existente `simple-coach-premium` con modo `weekly`.

Estos resultados **no son un login real, OAuth real, dispositivo iPhone físico, ejecución de OpenAI ni prueba de permisos/datos remotos**. La suite de autenticación específica de la migración tiene su evidencia separada.

## Rendimiento

`browser-performance.cjs --snapshot` descargó **33 archivos públicos** mediante GET, incluido el SDK fijado. Tres lecturas del documento público dieron TTFB 405,5 / 30,3 / 19,7 ms; incluyen los efectos de la primera conexión y la caché. No miden Cloudflare.

El laboratorio usa esos archivos descargados y `dist`, con el mismo SDK 2.115.0 servido localmente. Solo cambia la resolución de la URL del SDK para impedir descargas del navegador. Chromium bloquea endpoints externos con CDP; no usa mocks de sesión. Se miden la pantalla pública sin sesión y tres pares de carga fría/repetida por tamaño, con CPU 4x. El servidor aplica compresión gzip y una aproximación de las políticas de caché, con ETag/304: el runtime se sirve conservadoramente con `no-store`, mientras el `_headers` candidato exige revalidación de los assets. No es una réplica de la entrega de Cloudflare. Los números son medianas de tres muestras, en una máquina compartida.

| HTML | GitHub publicado | Candidato |
|---|---:|---:|
| Sin comprimir | 677.252 B | 677.186 B |
| Gzip local | 314.786 B | 314.649 B |
| Brotli local | 183.740 B | 183.758 B |

| Escenario | FCP público local | FCP candidato local | Load público local | Load candidato local |
|---|---:|---:|---:|---:|
| 390, frío | 260 ms | 232 ms | 420 ms | 421 ms |
| 390, repetido | 192 ms | 212 ms | 208 ms | 245 ms |
| 1280, frío | 252 ms | 248 ms | 398 ms | 426 ms |
| 1280, repetido | 176 ms | 212 ms | 189 ms | 246 ms |

El tamaño es esencialmente el mismo. La dispersión, el orden de ejecución y el servidor loopback impiden atribuir las diferencias a una mejora de hosting. **No existe todavía URL Cloudflare desplegada verificada**, por lo que no se afirma una mejora de TTFB, Core Web Vitals ni rendimiento real de esa red.

## Evidencia y repetición

Los informes y capturas están en `results/`, y la copia pública y el laboratorio están en `private/`; ambos directorios están ignorados. No se empaquetan ni publican.

```powershell
$env:SIMPLE_DEPLOY_TARGET='local'
$env:SIMPLE_APP_URL='http://127.0.0.1:4280/'
node scripts/hosting-build.cjs --target local
node tests/cloudflare/browser.cjs
node tests/cloudflare/browser-visual.cjs
node tests/cloudflare/browser-performance.cjs --snapshot
node tests/cloudflare/browser-performance.cjs --lab
```

La comparación visual y el laboratorio requieren primero `--snapshot`. Los arneses de navegador siguen las rutas del runtime de Node/Playwright y el cache de navegadores usados en las pruebas históricas del proyecto. El laboratorio cambia únicamente la URL del SDK en una copia separada de sus archivos de entrada.
