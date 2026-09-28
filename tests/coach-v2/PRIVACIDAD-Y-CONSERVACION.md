# Piloto Basic v2: privacidad técnica y conservación

Documento técnico de trabajo. No es la política de privacidad definitiva ni una afirmación de cumplimiento del RGPD. El primer piloto usa únicamente entrenamiento estructurado y revisión humana, con acceso manual y temporal. La capacidad de salud permanece instalada pero inactiva.

## Contexto del proveedor

`requestBody` construye explícitamente `{training:{goal,experience,days,minutes,equipment,preferred,avoided,preferences:""},allowed_exercises}`. `allowed_exercises` procede del catálogo estático, filtrado por material y ejercicios evitados. Objetivo, experiencia, material y ejercicios son opciones cerradas; no se admite texto libre general. El modelo, instrucciones y schema son constantes del servidor. Nunca se incluyen identidad, UUID, rol, historial, notas, asignaciones ni salud. Los motivos de review y feedback no entran en este payload.

El API request usa `store:false`; eso no equivale a Zero Data Retention. OpenAI indica que los datos de API no se usan por defecto para entrenamiento salvo adhesión expresa, y distingue almacenamiento de aplicación de registros de control de abuso, que pueden conservarse hasta 30 días, con excepciones. No hemos verificado ZDR, residencia europea ni acuerdos específicos de esta organización. Fuente consultada: [OpenAI, controles de datos](https://developers.openai.com/api/docs/guides/your-data).

Las opciones cerradas impiden incorporar texto identificativo arbitrario a este contexto; no se presenta como anonimización perfecta. La aplicación conserva internamente la relación de cada operación con su propietario para permisos, revisión e idempotencia.

## Consentimiento y revocación

`pilot-supervised-v2` requiere un acto explícito sobre A. No convierte recibos anteriores. B no se muestra ni se simula: concederlo devuelve `coach_health_disabled`. Guardar incluso un borrador requiere A v2 vigente. Los campos de salud no se recogen, no se leen por el frontend, no se guardan por el RPC ni se muestran al reviewer.

Revocar A invalida operaciones reservadas/propuestas pendientes dependientes de ese recibo. Una respuesta posterior no las reactiva. La rutina aceptada, su versión y workouts se conservan. Revocar B elimina salud de borradores propios y solo invalida operaciones dependientes de B; no afecta una operación A-only. La revocación no deshace procesamiento externo ya realizado.

## Conservación implementada

| Elemento | Comportamiento técnico y dependencia |
|---|---|
| A. Borrador no enviado | El propietario puede borrarlo mediante RPC con control de versión si no tiene operaciones vinculadas. Se elimina cualquier fila de salud dependiente del borrador. No hay borrado por fechas. |
| B. Anamnesis enviada | Se conserva la revisión que fundamenta una operación. Cambiarla produce nueva revisión; el contexto anterior no se reutiliza silenciosamente. No se ofrece borrado indiscriminado porque rompería la trazabilidad. |
| C. coach_operation | Conserva propietario, clave idempotente, estado, versiones de consentimiento/intake, modelo/prompt, métricas, revisión y referencia de rutina. Se mantiene para impedir replay, doble consumo y doble aceptación. |
| D. Propuesta pendiente | Revocación del contexto o cambio de intake la invalida. El reviewer pierde el acceso al contexto revocado. No crea ninguna fila de estructura de rutina antes de aceptar. |
| E. Propuesta rechazada | Se conserva estado y motivo para trazabilidad y retry único autorizado por reviewer. No hay reintentos automáticos ni eliminación por un plazo inventado. |
| F. Rutina aceptada | Aceptación atómica, UUID definitivos, routine_management y revision 1. Revocar no borra esta estructura ni modifica workouts. |
| G. Feedback | Solo tras workout propio; una fila por usuario/rutina, actualizable. Se conserva su relación con la rutina; no se mezcla con consentimiento, intake ni workouts. |

Los recibos revocados se conservan como prueba del cambio de permiso. No se ha implementado una supresión completa de cuenta, de operaciones ni un cron de retención. Hasta aprobar una política, esas solicitudes requieren un procedimiento específico que respete FKs, trazabilidad e históricos; no se promete un borrado automático inexistente.

## Pendiente antes del lanzamiento comercial

- Identificar responsable jurídico, contacto y canal de ejercicio de derechos.
- Validar bases jurídicas y separar cualquier futura categoría especial; salud seguirá deshabilitada hasta esa revisión.
- Revisar acuerdos con OpenAI/Supabase, subencargados y transferencias internacionales aplicables.
- Aprobar periodos y procedimiento de conservación/supresión, incluidas copias y registros del proveedor.
- Preparar información por capas, política definitiva y tratamiento de solicitudes de acceso/supresión.
- Valorar y documentar si procede EIPD/DPIA según el tratamiento y sus riesgos; no afirmar que ya está realizada.

Estas decisiones no están sustituidas por el aviso de piloto. El aviso identifica honestamente la versión supervisada pendiente de revisión legal final. No se habilita a ningún participante real mediante esta entrega.
