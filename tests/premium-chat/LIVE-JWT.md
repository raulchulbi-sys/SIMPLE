# Premium Chat — pruebas con JWT de staging

`live.cjs` usa cuatro cuentas controladas que ya existen en SIMPLE Security Test. No crea usuarios Auth, no modifica producción y bloquea las rutas Edge Functions: sus pruebas no llaman a OpenAI. El coordinador aplica exclusivamente los SQL locales de fixtures y finalización `mock`. La validación con proveedor real se documenta por separado; un resultado mock no se presenta como respuesta de IA real.

Dos rutinas nuevas con UUID exactos separan la conversación real de la prueba de recomendación. Cada una tiene dos días, cuatro ejercicios, ocho workouts sintéticos y una revisión N con prescripción por serie, incluida hack con top/backoff heterogéneo. Ningún ejercicio, workout o perfil previo se utiliza como fixture. El manifiesto, los JWT, las proyecciones capturadas y los SQL de alta/limpieza están en `private/`, excluido de Git.

## Comprobaciones

- El propietario debe consentir Chat por separado de intake, historial y check-in.
- Entradas médicas, correo, UUID, teléfono y peso personal se rechazan antes de persistirse. Se comprueban también vacío, longitud excesiva y HTML.
- Dos pulsaciones con la misma clave devuelven un solo turno; una clave con texto distinto se rechaza. La deduplicación inmediata de texto, los turnos concurrentes y una revisión obsoleta se prueban sobre una conversación poblada.
- Otro cliente, trainer normal, reviewer y anon no pueden leer, reservar ni consentir la conversación ajena. Incluso el propietario no puede leer el bundle, receipt, digest ni reserva económica, ni escribir directamente las tablas. Claim/finish quedan fuera del alcance de los cinco actores JWT.
- Una explicación finalizada como mock conserva revisión, ejercicios y workouts exactamente.
- Un candidato de recomendación se valida con Chat y el contrato de series existente. Permanece `pending_review`; no modifica la rutina antes de reviewer y aceptación del atleta.
- Revocar el consentimiento oculta el candidato al reviewer y bloquea aprobación/aceptación. Un consentimiento nuevo no revive la captura antigua.
- Un segundo candidato capturado bajo el consentimiento nuevo requiere reviewer asignado y aceptación. Doble aceptación crea un único N+1, conserva N, las otras prescripciones, UUID y workouts, y mantiene la semana actual.
- Tras N+1, una pestaña que aún presenta N no puede reservar otro turno. La captura nueva contiene las dos series aceptadas del hack y la decisión estructurada 3→2; no reutiliza mensajes ni resumen de N como datos actuales. El check-in de N conserva su etiqueta de revisión capturada y declara que no pertenece a la revisión activa.

## Evidencias y limpieza

Los informes de ejecución están en `results/chat-live-*.json`, excluidos de Git. Las repeticiones para diagnóstico sobrescriben el informe de su fase; no se suman artificialmente al total. La limpieza exige el propietario, UUID y nombre exactos de cada rutina, y elimina solamente sus registros y los grants nuevos capturados en el manifiesto. Las cuentas Auth existentes permanecen. El coordinador verifica la igualdad del baseline central y cierra el presupuesto Chat después de las pruebas.

Resultado final: **125/125 comprobaciones únicas superadas**: 118 aserciones sobre solicitudes con JWT reales y siete validaciones locales del esquema/contexto capturado por SQL. Explicación, candidatos y finalizaciones de este harness están declarados como `mock`. Un turno de coordinación expiró sin proveedor y sin modificar la rutina; se reservó un turno nuevo sin extender su TTL, sin alterar administrativamente su estado y sin sumar la repetición al contador. La prueba con API real y su coste tienen un informe separado.

Cuatro sesiones controladas cerradas con alcance local; `private/chat-sessions.json` eliminado. El coordinador ejecutó el SQL de limpieza exacta y confirmó que las nueve tablas centrales de staging vuelven a coincidir con el baseline. Conversaciones, mensajes, mesociclos, recomendaciones, revisiones, check-ins y grants públicos de Premium quedan en cero. No se eliminaron las cuentas Auth existentes.

El coordinador también probó el rollback completo: restauró exactamente las 102 definiciones/configuraciones de seguridad de Phase 3, reaplicó la migración final y obtuvo **72/72 comprobaciones backend** sobre ese estado final. Son una batería separada del total de 125 de este harness.
