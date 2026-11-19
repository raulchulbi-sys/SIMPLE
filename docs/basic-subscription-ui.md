# Suscripción Basic: interfaz de prueba cerrada por defecto

Base: main `b2f77c6`. Se recuperan los componentes comerciales locales de
`f393d29e`, sin incorporar los cambios de Auth ni de las PR #1/#2.

## Comportamiento

«Mi suscripción» se integra en Ajustes. Solo se monta con
`SimpleAppRuntime.billingTest === true`, backend exacto de Security Test y un
perfil client. Main no define esa activación y mantiene su configuración actual.
No basta con una query de la URL ni con declarar un plan en el navegador.

Basic se presenta a 4,99 €/mes en TEST. Premium no tiene botón de contratación.
Se puede representar un plan Premium ya verificado por el backend, sin ofrecerlo.
Las prestaciones y cuotas comerciales siguen pendientes de aprobación; Coaching
humano se identifica como servicio separado.

El estado se consulta después de `auth.getUser` y se vuelve a contrastar la
identidad al recibirlo. Caducidad de sesión, red, proyección inválida y cambio de
cuenta eliminan la vista de derechos anteriores. La interfaz muestra periodo
pagado, próxima facturación, cancelación programada y acceso al Portal para
gestión y facturas. Un fallo de renovación puede coexistir con un periodo ya
pagado; el backend decide sus derechos. La fecha local es solo una denegación
adicional de presentación, nunca una concesión.

Checkout y Portal reciben únicamente acciones permitidas. Un doble clic produce
un solo envío; un resultado incierto deshabilita una nueva compra hasta conciliar.
Recargar consulta estado: no repite Checkout. Solo se navega a los orígenes HTTPS
oficiales previstos, sin usuario/contraseña en la URL. Las URLs sensibles no se
persisten. El backend debe seguir garantizando idempotencia y aislamiento.

La generación está cerrada incluso con Basic pagado salvo capacidad explícita,
revisión humana obligatoria y cuotas intactas. Esto no sustituye las comprobaciones
de reserva, admisión, consentimiento y cuota del servidor. No se amplían cuotas.

## Dependencias y retorno

La rama de backend comercial aporta `action=status`, `billing_test_read_customer`
y la capacidad cerrada de generación. Es necesaria antes de habilitar esta UI
en un entorno conectado. El retorno mínimo aprobado de la rama A usa `access` y
continúa siendo compatible con el backend actualmente documentado.

`staging/subscription/return.html` es una fuente **no publicada** de la futura
pantalla completa. Necesita ensamblado explícito de staging, configuración pública
validada y revisión de CSP. No reemplaza el retorno mínimo aprobado ni su hash.
PR #1 conserva su build: su reconciliación futura debe adaptar el runtime y añadir
estos recursos de forma explícita. No copiar Auth de otra rama para habilitarlo.

## Pruebas de este sprint

- 38 casos offline nuevos de estado, autenticación simulada, doble envío,
  respuestas tardías, red, capacidades y redirecciones.
- 72 comprobaciones de navegador local con dobles, Chromium y WebKit, sin
  conexiones externas. Incluyen 320/360/390/430/1280 px, claro/oscuro, áreas
  táctiles, retorno manipulado e integración real del componente en `index.html`.
- 88 regresiones anteriores ejecutadas y 44 análisis sintácticos. No se repite
  ni se cuenta el recorrido completo Coach histórico de 40 casos.
- Ninguna compra, sesión Portal, JWT real ni validación nueva de Stripe.

```text
node scripts/ci-offline.cjs
node tests/subscription/browser.cjs
```

El navegador es opcional, fuera de CI: necesita Playwright y navegadores ya
instalados. El servidor escucha únicamente 127.0.0.1:4276, usa fixtures
declaradas y el runner intercepta todas las salidas de red. No admite credenciales.

CI añade solo `offline.cjs`: Node estándar, DOM mínimo y SDK simulados en VM,
sin red, variables secretas, instalaciones ni escritura persistente. El workflow
conserva permisos mínimos. Reversión: revertir el commit de UI; no borra datos.

## Antes de activar

Revisión humana del backend y de la oferta, pruebas JWT/Portal autorizadas en
staging, integración explícita con build/headers de PR #1 y conservación del
retorno aprobado. Esta rama no acredita una oferta lista para LIVE.
