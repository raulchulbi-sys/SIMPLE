# Basic V5 — avisos para revisión deportiva (29/10/2026)

Base remota: PR #2, e0e0fbd. Solo preparación local y actualización de la PR en borrador.
Sin despliegue, cambios de backend, activación, llamadas OpenAI ni gasto.

## Cambio de producto

Solo assets/coach-programming-v5.js. Se conservan contrato basic-initial-v5, catálogo,
cuestionario, instrucciones al modelo, parámetros, prescripción, fallos estructurales,
tiempos y reglas de aprobación/aceptación.

### Recuperación alrededor de actividad externa

Se conserva el criterio previo para mismo día y sesión más cargada inmediatamente antes.
Se añade sport_after_activity para una sesión con series de tren inferior el día natural
siguiente a running, fútbol, ciclismo, CrossFit, artes marciales o trabajo físicamente
exigente. Se usa la semana circular completa: domingo → lunes está incluido.

- Los tres códigos/relaciones distinguen mismo día, antes y después.
- Cada relación genera como máximo un aviso por sesión. Un Set elimina repeticiones en
  los días de actividad. Actividades en días distintos pueden justificar avisos distintos;
  no son duplicados de la misma relación.
- No se calcula una separación horaria exacta: la anamnesis solo aporta días.
- El mensaje no presupone intensidad, duración, fatiga, interferencia ni riesgo.
- Se pide al reviewer comprobar recuperación percibida y rendimiento esperado.
- No hay aviso posterior sin actividad conocida, sin días o sin tren inferior.
- Otro deporte no identificado no se clasifica automáticamente como exigente.
- La regla de sesión previa sigue siendo la existente: más de cuatro series inferiores
  y máximo inferior de la semana. No se amplía silenciosamente esa condición.

### Cobertura directa reducida de músculos pequeños

El informe conserva los números de directas, secundarias y sus frecuencias separados para
deltoides, bíceps, tríceps y gemelos. No se usan equivalencias ni créditos fraccionarios.
Se aclara que presses, remos y laterales pueden implicar regiones distintas del hombro.

Aviso small_direct_coverage exclusivamente para balanced_mass, cuando:
1. Hay al menos tres grandes grupos con trabajo directo, para poder comparar.
2. Existe una opción directa permitida por material/exclusiones.
3. El grupo pequeño no recibe series directas, o solo tiene una exposición directa y
   sus series directas son MENOS de la mitad de la mediana de grandes grupos cubiertos.

La mitad de esa mediana es una heurística explícita de selección para revisión:
identifica una diferencia interna marcada y evita imponer un número absoluto a rutinas
breves o de diferente volumen. No es un umbral fisiológico, una dosis mínima ni prueba
de insuficiencia. La condición de una sola exposición evita señalar automáticamente
dos exposiciones pequeñas distribuidas. Ninguna condición afirma que el aislamiento
sea obligatorio: el trabajo directo puede proceder de un compuesto del catálogo.

El mensaje muestra los recuentos y la referencia utilizada. Solicita revisar si selección
y participación indirecta encajan con el objetivo; no exige añadir ejercicios o series.
Si no hay una opción directa permitida se muestra esa limitación en el informe, sin
pedir ejercicios excluidos o material inexistente.

## Caso real reutilizado

basic-real-proposal.json contiene exclusivamente la anamnesis sintética y propuesta
real del 28/10, saneadas y exportadas de la evidencia privada. No contiene usuario,
UUID de operación, IDs de proveedor, recibos, tokens, claves ni datos de personas.
La evidencia original no se modifica; la propuesta de regresión tampoco se reprograma.

Resultado actualizado:
- Estructuralmente válida, sin fallos.
- 30 series, 12 ejercicios distintos / 15 apariciones.
- 21 series RIR 2; nueve RIR 1; cero RIR 0; media 1,7.
- Duraciones 46, 47 y 47 min; sin nuevos fallos de tiempo, material o exclusiones.
- Exactamente cinco avisos:
  - Lunes después del running dominical: recuperación por comprobar.
  - Deltoides: 2 directas / 10 participaciones secundarias.
  - Bíceps: 0 directas / 6 secundarias.
  - Tríceps: 0 directas / 6 secundarias.
  - Gemelos: 2 directas / 0 secundarias.
- Mediana interna de grandes grupos: 6 series.
- Ningún aviso entra en failures ni cambia ok.
- El recibo histórico sigue teniendo cero avisos con el evaluador de aquel día;
  este resultado es una reevaluación offline, no una nueva respuesta de OpenAI.

La petición preparada mantiene 10.467 bytes y la misma huella SHA-256 que el ensayo.
La prueba utiliza el orden original de las claves de basic-real-intake.json: PostgreSQL
JSONB reordena las claves al devolverlas. Los contenidos son iguales aunque el orden
de serialización del recibo no sea el de la petición enviada.

## Reviewer

No fue necesario editar assets/coach-reviewer.js. Ya recalcula la evaluación y muestra:
- Mensajes y contexto de cada aviso.
- Series directas/frecuencia y participación secundaria/frecuencia separadas.
- Notas de interpretación por músculo.

Se probó openCoachReviewer real, su HTML, CSS y botones con backend en memoria.
Aprobar y Rechazar siguen habilitados y se exige motivo. No se pulsaron decisiones ni
se llamó a RPC. No se modifica el estado de la propuesta y no aparece aceptación automática.
Prueba de interfaz local, NO JWT ni revisión autenticada de staging.

## Pruebas

**56 casos nuevos únicos, todos superados:**
- sports-review.cjs: 30 pruebas offline (siete transiciones semanales, relaciones antes/
  después/mismo día, duplicados, ausencia de actividad, sesiones sin pierna, actividad
  no clasificada, objetivos diferentes, cobertura suficiente/distribuida, planes de bajo
  volumen, material/exclusiones, contenido de avisos, invariantes y petición idéntica).
- sports-review-ui.cjs: 26 comprobaciones con Chromium/Edge y WebKit: lectura real del
  reviewer, decisiones humanas, 320/360/390/430/1280 px, claro/oscuro, ausencia de
  desbordamiento horizontal, errores JS y peticiones externas.

**79 regresiones existentes reejecutadas, todas superadas:**
- tests/coach-quality-v5/unit.cjs: 35; contrato, programación y proveedor con transporte simulado.
- tests/coach-flow/basic-cost-guard.cjs: 44; límites, recibos, configuración e idempotencia,
  sin llamadas al proveedor.

No se suman reejecuciones ni los 24 checks JWT históricos a las pruebas nuevas.
Los recibos de ejecución locales están en tests/coach-flow/results/ (ignorados por Git).

Incidencias del arnés:
- La primera comprobación de bytes usó el orden JSONB del recibo; se corrigió para
  comparar el cuerpo original, comprobando también igualdad semántica de la anamnesis.
  No hubo cambio de producto para alterar el hash.
- Edge no arrancó dentro del sandbox. La ejecución autorizada fuera del sandbox pasó
  con perfil efímero, sin red ni sesiones. No se hizo diagnóstico de Computer Use.
- La última modificación fue únicamente de redacción y uso del enum real other_sport
  en el caso negativo; se repitieron los 56 casos afectados sin contarlos como nuevos.

Comandos offline:
node tests/coach-flow/sports-review.cjs
node tests/coach-flow/sports-review-ui.cjs
node tests/coach-quality-v5/unit.cjs
node tests/coach-flow/basic-cost-guard.cjs

## Limitaciones y falsos positivos posibles

- Un running suave puede permitir entrenar pierna al día siguiente sin problema.
  El aviso pide revisión; no diagnostica interferencia.
- Días adyacentes no implican exactamente 24 horas entre sesiones.
- Cero aislamiento de brazos puede ser apropiado con suficiente trabajo compuesto.
  El aviso expone la diferencia; no la corrige automáticamente.
- La mediana puede verse elevada por una rutina con volumen principal alto; la revisión
  humana debe decidir si el contraste importa. No se ha calibrado clínicamente.
- Dos exposiciones pequeñas pueden seguir siendo insuficientes individualmente y no
  activar esta heurística. No pretende detectar todas las programaciones mejorables.
- La metadata sigue agregando deltoides; se aclara su interpretación sin cambiar catálogo.
- La ausencia de una opción directa evita un aviso imposible de atender, pero no
  garantiza cobertura óptima.
- Sin intensidad/duración de running ni historial previo no puede juzgarse recuperación
  o dosis óptima. No se inventa ninguna de esas variables.

## Antes de otro piloto

Hace falta autorización separada para desplegar esta versión en staging: v32 continúa
sin cambios. Debe verificarse la evaluación actualizada en el despliegue y reviewer
autenticado, manteniendo guard, permisos y parámetros existentes. Después podrá
autorizarse un solo ensayo con límites explícitos y revisión humana. No hace falta
cambiar cuestionario, modelo, presupuesto ni añadir ejercicios para probar estos avisos.

Main y PR #1 no se modifican. No hay activaciones, escrituras Supabase, Cloudflare,
migraciones, nuevos permisos ni llamadas OpenAI en esta fase.
