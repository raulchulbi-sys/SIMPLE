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

El tamaño es esencialmente el mismo. La dispersión, el orden de ejecución y el servidor loopback impiden atribuir las diferencias a una mejora de hosting. En esta fase local todavía no había una URL Cloudflare verificada; esos números no miden su CDN. La fase HTTPS real posterior figura a continuación y no sustituye ese límite metodológico.

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

## Despliegue HTTPS real posterior

Proyecto de staging `simple-staging-raulchulbi`; fuente remota `0aa1d6b6dc6fe0165534b8c7610c1e8a56521709`, árbol idéntico al commit local `1369022d637815cd6b6d7af827d7f325208cc22a`. Deployment `4a8636ab-ec94-42db-b57e-cf43d01230b9`:

- Estable: `https://simple-staging-raulchulbi.pages.dev/`.
- Exacto: `https://4a8636ab.simple-staging-raulchulbi.pages.dev/`.
- Runtime servido SHA-256 `b555f1c712be3b657bb675b6b5dcc7e75c4cb947c0f9825431fdf95e427cbd73`, exclusivamente Supabase staging; el HTML conserva el hash de esta validación.

`live-hosting.cjs`: **42/42 casos nuevos**, 34 HTTP y ocho navegaciones nativas (Chromium/WebKit × 320/1280 × claro/oscuro). Comprueban ambos hosts. Se compararon 70 archivos públicos byte a byte y se guardaron 64 capturas; esas comparaciones y PNG no son casos adicionales. No hay routes/interceptación, mocks, SDK offline, siembra de sesión, envíos Auth, llamadas de generación ni escrituras. Los 20 accesos normales a rutas privadas devolvieron 404/no-store; dos intentos de traversal codificado devolvieron 400 del edge, igualmente cerrados. `_headers` es configuración de Pages, no un asset servido.

Se verificaron MIME, HTTPS, headers efectivos, ETag/304 de assets, revalidación del documento, query de callback y ausencia de peticiones a producción/OpenAI. Chromium emitió un 404 de favicon y WebKit advirtió que CSP report-only no tiene destino de reportes; no se presentan como consola completamente vacía ni como CSP enforced. No hubo excepciones JavaScript ni tráfico backend no autorizado. Evidencia: `results/live-hosting-final.json`; el diagnóstico inicial se conserva separado.

`live-performance.cjs`: **24 navegaciones medidas**, separadas del contador funcional. URLs reales, SDK/CDN reales, Chromium a 390/1280, CPU 4x y tres pares frío/caliente por sitio. Son muestras pequeñas en la misma máquina, sin aislamiento de DNS/sockets/CDN ni afirmación de Core Web Vitals de campo.

| Escenario real (mediana) | GitHub Pages | Cloudflare |
|---|---:|---:|
| 390 frío: TTFB / FCP / load | 24,4 / 680 / 526,2 ms | 60,7 / 312 / 488,1 ms |
| 1280 frío: TTFB / FCP / load | 19,1 / 340 / 490 ms | 66 / 336 / 475,7 ms |
| 390 caliente: load | 181,1 ms | 294,6 ms |
| 1280 caliente: load | 217,1 ms | 292,2 ms |

Cloudflare transfirió aproximadamente 203 KB del HTML con Brotli frente a 318,7 KB gzip de GitHub. GitHub fue más rápido en caliente con su caché de 600 s; el candidato revalida HTML y usa 304 para assets. No hay una mejora universal de velocidad demostrada. Evidencia: `results/live-performance.json`.

CORS HTTPS nativo: **24/24 casos** nuevos, 16 POST sin JWT válido con 401 legible y ocho bloqueos desde un origen ajeno en ambos motores. Configuración HTTPS: **19/19** casos; plan de CORS: **9/9** unidades y **62/62** verificaciones offline sobre los bundles LIVE, conservando sus 34 orígenes locales. Los errores de redirects de la medición previa al ajuste Auth son diagnósticos pendientes, no éxitos.

Los 425 casos de la fase local son la base de esta misión, no pruebas repetidas de esta fase HTTPS. Los siete checks API se reutilizaron para preparar dos nuevas fixtures nativas y no se suman de nuevo. El cierre autenticado y la limpieza final se registran en CHECKPOINT. Las respuestas Auth simuladas de las suites locales no prueban Google real, recepción de email o cambio real de contraseña.
