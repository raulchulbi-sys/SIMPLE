# Próximo encargo propuesto a Work — no ejecutado

Objetivo: cerrar el Portal visual de la suscripción Basic TEST existente y preparar
el ensayo conectado de «Mi suscripción», sin repetir la compra ni alterar el plan.

1. Obtener autorización expresa para **crear una única sesión efímera Customer
   Portal TEST**, abrirla con la identidad sintética que ya tiene Basic y consultar
   suscripción/facturas. No cancelar, cambiar tarjeta/plan, renovar ni reembolsar.
   La sesión Portal es una operación nueva: este sprint no la autoriza.
2. Preflight de lectura: cuenta Stripe TEST prevista, Security Test, identidad
   sintética propietaria, Customer vinculado, versiones y hashes efectivos,
   configuración Portal sin cambios de plan y cancelación al final del periodo,
   permisos y referencias de integridad. Si hay divergencias, detener la acción.
   Usar recibos históricos privados como evidencia; no volver a comprar.
3. Crear la sesión por el flujo autenticado permitido, comprobar que muestra el
   Customer correcto, importe mensual y facturas, y volver al retorno HTTPS
   aprobado. No publicar ni conservar su URL efímera en informes o Git.
4. Verificar que suscripción, pagos, cuotas y referencias continúan intactos.
   Ante timeout no repetir la sesión a ciegas; documentar la incertidumbre.
   Reversión: cerrar la sesión de navegador; no deshacer la suscripción existente.

La pantalla completa de la rama B requiere antes una revisión y autorización
separadas del delta backend `status`/Customer RPC y del ensamblado HTTPS. Preparar
ese cambio exacto con el retorno mínimo como rollback; no mezclarlo con el gate
de generación ni asignaciones reviewer. Verificar `main`, PR #1/#2 y controles de
autodeploy antes de cualquier publicación futura. Nunca activar comercialmente
las generaciones mientras las prestaciones/cuotas no estén decididas.

Entrega: PASS/BLOCKED del Portal visual, datos mínimos saneados, ausencia de
mutaciones de suscripción y propuesta concreta del ensayo de UI. No avanzar a
Premium, LIVE, pagos, cancelaciones ni OpenAI sin otra autorización.
