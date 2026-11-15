# Decisiones pendientes para 30/11/2026

Documento de trabajo técnico; no constituye textos legales aprobados ni una
declaración de cumplimiento. El sprint no decide fiscalidad, identidad del vendedor
o derechos comerciales. Un pago TEST correcto no habilita cobros LIVE.

| Prioridad | Decisión/verificación | Impacto | Responsable |
|---|---|---|---|
| P0 | Prestaciones exactas de Basic, cantidad/caducidad de generaciones, revisiones, soporte y uso razonable | Oferta comprobable y cuotas exigibles en servidor; generación sigue cerrada | Producto (Raul) + desarrollo |
| P0 | Tratamiento fiscal de la suscripción automatizada y Coaching humano separado; impuestos incluidos/excluidos y países de venta | `tax_behavior=unspecified` de TEST no es una decisión fiscal válida para LIVE | Titular + asesor fiscal |
| P0 | Identidad legal/fiscal, domicilio y contacto del vendedor | Información de contratación y facturación; no inventada | Titular + revisión profesional |
| P0 | Condiciones de contratación, periodicidad, renovación y consentimiento requerido | Checkout/Portal y comunicación coherentes con el contrato | Titular + asesor jurídico |
| P0 | Política de cancelación, derechos de consumidores, desistimiento si procede, reembolsos y disputas | Definir fechas, comunicación y acceso; no asumir que basta cancelar en Stripe | Titular + asesor jurídico |
| P0 | Derechos server-side y gate/reviewer por operación con JWT reales | Revisar y autorizar ensayo acotado de staging; pruebas SQL locales no lo sustituyen | Seguridad + Work con autorización |
| P0 | Credenciales, productos/precios y webhooks LIVE separados y mínimos permisos | No trasladar identificadores TEST, no hacer un cambio a LIVE implícito | Titular + operación autorizada |
| P0 | Integración del retorno aprobado en build de staging/PR #1 | Evitar su pérdida por un autodeploy futuro; esta rama no cambia hosting | Desarrollo + autorización de despliegue |
| P1 | Portal visual y acceso autenticado a facturas/cancelación | Pendiente: no declarado validado en el sprint | Work con alcance TEST autorizado |
| P1 | Renovación/pago fallido, recuperación y eventual suspensión | Elegir periodo de gracia y política de acceso; simularlo y luego ensayarlo separadamente | Producto + desarrollo |
| P1 | Premium: oferta, cuotas, activación, upgrades/downgrades y prorrateos | No anunciarlo disponible hasta validación y decisión explícita | Producto + desarrollo |
| P1 | Privacidad, bases jurídicas, conservación, derechos, encargados, transferencias e incidentes | Revisar datos tratados por Supabase/Stripe/OpenAI/hosting; no añadir salud ni tracking | Titular + asesor privacidad |
| P1 | Soporte, monitorización mínima, conciliación e incidencias | Responsables, plazos, evidencias saneadas y rollback ensayado | Operación |
| P2 | Texto y presentación adicionales de oferta | Mejorar claridad después de cerrar el contrato, sin prometer funciones no habilitadas | Producto/diseño |

TEST usa métodos simulados y objetos no LIVE; los ensayos no acreditan impuestos,
contratos, autorizaciones ni liquidaciones reales. Coaching humano debe tener
su oferta y tratamiento revisados de forma independiente. No se han activado
servicios, cobros, suscripciones, analítica o nuevas condiciones.
