# Coach piloto v2: frontend y validación

Cambios limitados a `assets/coach.js`, `assets/coach-reviewer.js` y `assets/coach.css`.
La dirección visual de SIMPLE se conserva: tipografía, colores, bordes y botones
usan los tokens existentes. No se cambia el interior ni la autenticación.

## Cambios funcionales del módulo

- La información de `pilot-supervised-v2` y el permiso A se presentan antes de
  las preguntas. Los permisos v1 no se convierten.
- Anamnesis con opciones estructuradas. No hay preguntas, lectura, payload ni
  presentación de salud. Se descarta de la interfaz cualquier texto arbitrario
  de una versión anterior; no se sobrescribe automáticamente el registro.
- Objetivos, experiencia, tiempo, material y nombres de ejercicios coinciden
  con la allowlist del servidor. No hay campo general de preferencias libres.
- Borrador propio no enviado: confirmación explícita antes de solicitar su
  eliminación. El backend valida propiedad, estado y versión.
- Generación y aceptación se bloquean frente a doble pulsación. Las respuestas
  de otra pantalla, logout o cierre no reabren el diálogo ni encadenan una
  llamada al proveedor. La recarga consulta la operación existente.
- La propuesta pendiente permanece pendiente; solo la propuesta aprobada tiene
  «Aceptar rutina». La estructura real no se crea antes de aceptar.
- Reviewer: contexto de entrenamiento por allowlist, propuesta completa,
  aprobar/rechazar con motivo, retry controlado y aviso solo a siete días o
  menos de caducidad. No se muestra un objeto `health` inesperado.
- Feedback únicamente tras un entrenamiento, sin apertura automática, con
  acceso explícito para consultar o actualizar una valoración existente.

## Defectos corregidos durante las pruebas

- El mensaje de borrador borrado se perdía al desbloquear los controles.
- El `hover` heredado desplazaba botones y provocaba inestabilidad en WebKit.
  Ahora se conserva el feedback de borde sin movimiento en hover.
- WebKit dibujaba algunos botones y textareas con apariencia nativa clara,
  ignorando visualmente los colores oscuros calculados. `appearance:none`
  exclusivamente en esos controles Coach conserva los colores del tema.

## Ejecución reproducible

```text
node tests/coach-v2/preview.cjs
node tests/coach-v2/ui.cjs
node tests/coach-v2/frontend-contract.cjs
node tests/coach-v2/expired-reviewer.cjs
```

Preview navegable: `http://127.0.0.1:4196/review`. Todos sus datos son ficticios.
La política CSP bloquea conexión a Supabase/OpenAI. No modifica configuración
ni datos externos. Los escenarios se conservan únicamente en sessionStorage
de la demo para comprobar la recarga.

La suite UI comprueba Chromium (Edge) y WebKit automatizados, 320/360/390/430
y 1280 px, claro/oscuro, consentimiento, anamnesis, revisión, generating,
pending_review, propuesta aprobada, reviewer y feedback. Incluye controles de
44 px, fuente de entrada de 16 px, foco/Tab, desbordamiento y contraste de
botones activos ≥4,5 tras finalizar las transiciones existentes del tema.

El teclado se aproxima reduciendo el viewport a 320×400 y enfocando el campo.
**No equivale a Safari en un iPhone físico ni prueba un teclado físico real.**

Las pruebas UI usan respuestas simuladas y no acreditan seguridad del backend,
JWT real ni calidad de OpenAI. Esas comprobaciones tienen suites independientes.
Las capturas y resultados generados están en `results/`, ignorado por Git.
`ui.json` contiene únicamente la última ejecución, sin sumar reintentos.

Las capturas `before-*` proceden de los archivos originales guardados al empezar
esta fase; si no existen en una clonación nueva, se omite únicamente esa captura.
Las capturas finales siempre se generan sobre el código actual.

## Delta: reserva expirada sin confirmación

La revisión independiente detectó que una reserva cuyo cierre de Edge no se
confirma podía permanecer `reserved` después de caducar, sin acción de recuperación
en la bandeja. Ahora se presenta como «Generación interrumpida» y permite solicitar
una autorización de retry con motivo. La interfaz no cambia el estado ni inicia
otra generación: el RPC valida la caducidad y normaliza el estado bajo bloqueo.

La suite dirigida `expired-reviewer.cjs` comprueba en Chromium y WebKit: reserva
vigente sin retry, reserva caducada con acción explícita, motivo obligatorio,
doble pulsación con un solo RPC, una sola operación, ningún envío al proveedor y
recarga sin nueva autorización. Son 14 comprobaciones sintéticas independientes;
no se repite ni vuelve a sumar la matriz general de 242.
