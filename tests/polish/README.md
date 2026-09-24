# Pulido final — temas, Ajustes, avisos y carga

Rama aislada: codex/interior-visual. Base: f0a4cfb1abdca38a4d95178659397428884eac77.
No hay publicación, merge a main, cambios de Supabase ni fixtures remotas nuevas.

## Resultado

Se mantiene la composición del interior aprobado. La paleta se centraliza en assets/theme.css: crema/piedra/antracita en claro y carbón/superficies grises/texto blanco roto en oscuro. Los componentes consumen los mismos tokens, sin una colección de overrides oscuros por pantalla.

- Toast compartido: superficie crema, borde fino, texto antracita y sombra mínima. Éxito/error se distinguen mediante el mensaje original, borde e indicador discretos. En oscuro usa los mismos tokens del tema. La capa de presentación añade aria-live y aria-atomic; la función toast, sus llamadas, texto y duración permanecen intactos. Se recorrieron sus 89 mensajes literales y los principales tipos de acción.
- Eliminar: conserva su handler, confirmación y permisos; ahora es un botón con borde rojo apagado, radio, padding y área táctil.
- Ajustes: engranaje en la cabecera y en cabeceras de modales largos, sin añadir pestañas. Diálogo con Sistema/Claro/Oscuro, correo y rol de solo lectura, componentes legales preparados y Cerrar sesión mediante logout() existente. No hay selector de rol ni opciones ficticias.
- Tema: Sistema por defecto; sigue cambios de prefers-color-scheme. Elección explícita en localStorage, clave simple_theme_v1, por navegador/dispositivo, no por cuenta ni base de datos. Sin recarga y con sincronización entre pestañas. Si el almacenamiento está bloqueado, el cambio sigue funcionando en la página, pero no puede persistir.
- Carga: mismo atlas.webp y logo aprobados, centrado, gris tenue y sin frases ni porcentajes. Solo se muestra durante la resolución real de Auth/perfil/datos. Respeta reduced-motion; transición breve al interior. El arranque se aplica antes de las hojas de estilo para evitar la primera pintura con otro tema.

Se retiró la espera artificial anterior de 750 ms. Eso expuso una carrera: INITIAL_SESSION podía llegar después de que bootstrap mostrase un enlace caducado y sustituir el mensaje usando la sesión previamente almacenada. El guard mínimo deja que bootstrap resuelva ese callback inválido e ignora exclusivamente aquella instantánea inicial tardía. No cambia login, logout, SDK, tokens, recuperación, OAuth ni acceso a datos. Los tests existentes de recuperación mantienen sus expectativas y pasan.

## Preview y capturas

- http://127.0.0.1:4182/review
- http://127.0.0.1:4182/polish-gallery

La preview usa datos ficticios locales y CSP connect-src none: permite navegar, pero no guardar en Supabase. Desde el engranaje se cambian los temas. El selector externo «Simular carga inicial» mantiene pendiente una respuesta del doble local para revisar Atlas; cambiar el selector termina esa simulación mediante una nueva vista. Esta espera no forma parte del producto.

492 capturas reales de Chromium/WebKit en ambos temas. La galería filtra por ancho/motor y tema, e incluye Inicio atleta, entrenador, Ajustes, carga con Atlas, toast, Eliminar, creación, edición, entrenamiento, historial, gráficas, papeleras, vacíos y errores. Las capturas y resultados están ignorados por Git.

## Validación de esta fase

| Suite | Aprobadas | Fallidas |
|---|---:|---:|
| Pulido: roles, temas, campos, entrenamiento, mensajes y pantallas | 132 | 0 |
| Carga: pendiente real, primera pintura, sesión existente y entrada rápida | 96 | 0 |
| Teclado, foco, pestañas y duración del toast | 8 | 0 |
| Contratos del pulido | 9 | 0 |
| Contratos del interior | 6 | 0 |
| Funciones protegidas de identidad/persistencia | 16 | 0 |
| Aislamiento visual del onboarding claro | 24 | 0 |
| Onboarding y logout lento | 276 | 0 |
| Recuperación con SDK real / HTTP interceptado | 28 | 0 |
| OAuth con SDK real / HTTP interceptado | 32 | 0 |
| Nombres largos, vacíos, foco y viewport reducido | 64 | 0 |
| Scroll de gráficas y UUID seleccionado | 10 | 0 |
| Regresiones generales existentes (16 suites) | 720 | 0 |
| **Total de esta fase, sin repeticiones** | **1421** | **0** |

Matriz principal: Chromium y WebKit, 320/360/390/430/768/1280 px, atleta y entrenador, Sistema/Claro/Oscuro. Se comprueba contraste de texto ≥4.5 en los componentes seleccionados, foco visible, límites del viewport y esquema nativo de controles. El recuento es de casos de suite, no de cada aserción interna.

Cambiar de tema conserva inputs, estructuras por UUID y la referencia del entrenamiento activo. Continúan un único botón Guardar estático, duración desde el primer check y el mismo nodo de cierre del temporizador. Se verifican diálogo con teclado, recorrido Tab y Escape, regreso del foco, persistencia tras recarga/cierre de pestaña, cambio real de storage entre pestañas y logout con invalidación inmediata del contexto.

Las 2223 comprobaciones de la fase anterior no se suman a este total. Sus pruebas autenticadas de staging son evidencia histórica: no se han repetido ni creado usuarios o datos nuevos en esta fase. Tampoco se ha probado un iPhone físico, OAuth real ni entrega real de correo.

## Correcciones y ajustes de pruebas

- Se conservaron los colores calculados del onboarding claro, incluido el error de recuperación; no se aceptó una diferencia para hacer pasar la comparación.
- Se corrigieron foco del radio en WebKit y cierre/ciclo Tab del diálogo; se mantuvieron las expectativas de accesibilidad.
- Los tests esperan el evento real de cambio de media query, no un número arbitrario de milisegundos. El snapshot de edición se toma después del blur que ya comprometía el campo en el código original.
- El test del splash mantiene pendiente la lectura Auth simulada: tras retirar el mínimo artificial, ya no puede asumir que toda página permanece en splash. La expectativa de ausencia de formularios durante carga sigue intacta.
- Los contratos solo exceptúan las dos modificaciones autorizadas de presentación inline: color del estado vacío y markup del loader. La lógica interior completa y las funciones protegidas siguen comparándose exactamente.
- La regresión de callback caducado se corrigió y volvió a pasar 28/28 en la suite completa, con expectativas originales.

## Archivos de producto

- index.html
- assets/interior.css
- assets/auth.css
- assets/auth.js
- assets/theme.css (nuevo)
- assets/theme.js (nuevo)
- assets/settings.css (nuevo)
- assets/settings.js (nuevo)

Pruebas/preview/documentación:
- tests/integration/legacy-browser.cjs
- tests/interior/contracts.cjs
- tests/interior/mock-sdk.js
- tests/interior/preview.cjs
- tests/onboarding/browser.cjs
- tests/polish/.gitignore
- tests/polish/README.md
- tests/polish/browser.cjs
- tests/polish/loading.cjs
- tests/polish/accessibility.cjs
- tests/polish/contracts.cjs
- tests/polish/gallery.cjs

El adaptador histórico carga los nuevos assets en los harnesses de HTML único. No se añaden frameworks ni dependencias.

## Integridad y siguientes pasos

Main remoto conserva 36dc00f734d9b7db84e98e2f7e11678342a3d1cd. El HTML público sigue con SHA256 ff2232ff7d754526cffde64be40de89532e070a5968cc004d10ed43e316b42cc. Los 30 hashes del manifiesto de candidatos originales coinciden.

No hubo accesos a Supabase en esta fase: ninguna modificación de schema, RLS, policies, RPC, funciones, configuración, usuarios o datos. No hay nuevas fixtures que limpiar. OAuth permanece intacto, desactivado y oculto. No se enviaron correos.

Faltan las URLs legales reales; los textos no simulan enlaces. El siguiente paso es la aprobación visual del usuario. No publicar todavía.

Tras autorización futura: revisar main nuevamente, integrar el commit local aprobado sin sobrescribir otros candidatos, publicar juntos los assets y verificar Pages. No se necesita SQL. Ante regresión, revertir solo el commit de frontend correspondiente, conservando RPC y datos.
