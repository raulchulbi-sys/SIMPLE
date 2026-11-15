# Primera generación real Basic V5 — resultados y auditoría deportiva

Ensayo: 28/10/2026. Recuperación documental y auditoría: 29/10/2026.
Entorno exclusivo: SIMPLE Security Test. PR #2 permanece en borrador.

Seguimiento posterior: [avisos contextuales del evaluador](BASIC-SPORTS-REVIEW.md).
La reevaluación offline añade cinco avisos sin cambiar la rutina. Este informe conserva
el resultado original del ensayo: no se reescribe su recibo de cero warnings.

## Dictamen

**Éxito técnico de una generación real; rutina inicial plausible, con revisión humana necesaria.**
No constituye evidencia suficiente para anunciar calidad equivalente a un entrenador personal
de pago autónomo. Es una sola muestra, sin aplicación, seguimiento ni resultados del atleta.
No se ha modificado V5, su prompt, el catálogo ni el algoritmo durante esta auditoría.

La prescripción respeta días, material, exclusiones y tiempo disponible; reparte trabajo
general de tren superior e inferior. Sus principales puntos mejorables son la cobertura
directa de músculos pequeños y la evaluación explícita de recuperación tras running.
No se ha demostrado una rutina peligrosa, una incompatibilidad con running ni un volumen
individualmente insuficiente: faltan datos para esas afirmaciones.

## Procedencia y alcance de la evidencia

Se recuperaron los originales ignorados por Git de
tests/coach-flow/private/basic-real-20261028/: plan, baseline, recibo SDK, recibo de uso
del proveedor, reconciliación, SQL exacto y referencias finales de datos y seguridad.
Los identificadores de usuarios/operación/solicitud y los recibos privados no se publican.

- 24/24 checks SDK/JWT reales del 28/10: cuatro identidades y roles, acceso propietario,
  consentimiento/anamnesis, operación única, recuperación por propietario/anamnesis/clave,
  denegación de lectura privada a otro atleta, trainer y reviewer, proyección autorizada
  de reviewer, estado pendiente y consumo de un intento sin reintentos concedidos.
- El caso denominado “real” en el runner es la etiqueta de otro cliente SINTÉTICO.
- La recuperación fue una relectura real tras respuesta; no una nueva prueba de pérdida
  de red o recarga completa del navegador. No se convierten simulaciones anteriores en
  evidencias de fallos de red reales.
- No se aprobó ni aceptó. No se creó rutina, revisión, workout ni nota.
- Cuatro cierres de sesión locales registrados.
- 10/10 comprobaciones NUEVAS offline del 29/10 verifican coherencia de los recibos,
  integridad y preservación de archivos. No son nuevas pruebas autenticadas ni se suman
  a las 24 para presentar “34 checks JWT”.
- No se repitieron las baterías históricas, el ensayo, el conteo ni la generación.

Reproducción documental sin red ni escritura:
node tests/coach-flow/basic-real-evidence-audit.cjs
Requiere los originales privados; no son fixtures públicas ni deben subirse a Git.

## Modelo, solicitud y coste

| Dato | Evidencia |
|---|---|
| Modelo devuelto | gpt-5.4-2026-03-05 |
| Contrato / anamnesis | basic-initial-v5 / basic-intake-v2 |
| Edge | simple-coach-mock v32, JWT requerido |
| Modalidad | service_tier=default |
| Parámetros preparados y fuente desplegada | store=false; truncation=disabled; reasoning=low; JSON estricto; sin herramientas |
| Petición final | 10.467 bytes UTF-8 |
| Límites | 16.384 bytes; 12.000 tokens de entrada contados; 5.120 de salida |
| Llamadas | 1 conteo y 1 envío de generación; sin reintento |
| Conteo | 2.454 tokens |
| Uso devuelto | 2.454 entrada, 2.050 salida, 0 entrada cacheada |
| Resultado | HTTP 200; receipt_within_limits |
| Latencia proveedor/conteo | 27.587 ms |
| Ida/vuelta Edge en runner | 28.308 ms |
| Estado antes de limpiar | pending_review |
| Coste tokens calculado | 0,036885 USD |

Cálculo: 2.454 × 2,50 / 1.000.000 = 0,006135 USD de entrada;
2.050 × 15 / 1.000.000 = 0,030750 USD de salida.
Coincide con estimated_cost de la operación. El uso procede del recibo real del proveedor,
recogido por la Edge y conciliado con la operación. No se verificó una factura ni un
cargo definitivo de la cuenta. La facturación independiente del conteo, impuestos y
condiciones contractuales no está certificada. La limpieza no anula el consumo incurrido.

Fuente de tarifa: [modelo GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4).
Se utilizó el endpoint global, sin selección regional en la petición. No se asume que la
región de Supabase cause por sí sola un recargo regional de OpenAI.
[Documentación del conteo](https://developers.openai.com/api/docs/guides/token-counting).
No se presenta 0,12 USD como garantía contractual. En esta auditoría hubo cero llamadas
a OpenAI, incluidos endpoints de conteo, y cero accesos de escritura al backend.

## Anamnesis sintética efectivamente enviada

- Experiencia: 1–2 años (y1_2).
- Objetivo: ganancia de masa equilibrada (balanced_mass).
- Disponibilidad: lunes, miércoles y viernes, 60 minutos por sesión.
- Estimación del esfuerzo: confident.
- Actividad externa: running los domingos. No se conocen duración, intensidad, distancia
  ni horario; no se inventan.
- Excluidos: Dead bug y Bird dog.
- Inventario: press de pecho en máquina, jalón, remo con pecho apoyado, prensa 45º,
  extensión de cuádriceps, curl femoral sentado, gemelo sentado, mancuernas, banco y poleas.
- Ningún aparato personalizado; sin datos identificativos ni de salud.
- El atleta NO seleccionó ejercicios a incluir. El inventario declara disponibilidad,
  no preferencia. No hay lesiones ni preferencias adicionales registradas.

## Rutina real completa

Nombre: **Basic · rutina inicial**. Dos series por ejercicio.
RIR S1/S2 indica el objetivo exacto de cada serie. Reps y descanso son iguales en ambas.

### Lunes — 5 ejercicios, 10 series

| Orden | Ejercicio | Series × reps | RIR S1 / S2 | Descanso |
|---|---|---|---|---|
| 1 | Prensa de piernas | 2 × 8–10 | 2 / 2 | 3 min |
| 2 | Press de pecho en máquina | 2 × 8–10 | 2 / 2 | 2,5 min |
| 3 | Remo con pecho apoyado | 2 × 8–10 | 2 / 2 | 2,5 min |
| 4 | Extensión de cuádriceps | 2 × 12–15 | 2 / 1 | 2 min |
| 5 | Crunch en polea | 2 × 12–15 | 1 / 1 | 1,5 min |

Estimación del evaluador: **46 min**. Cuatro series de tren inferior.

### Miércoles — 5 ejercicios, 10 series

| Orden | Ejercicio | Series × reps | RIR S1 / S2 | Descanso |
|---|---|---|---|---|
| 1 | Peso muerto rumano con mancuernas | 2 × 8–10 | 2 / 2 | 3 min |
| 2 | Jalón al pecho | 2 × 8–12 | 2 / 2 | 2,5 min |
| 3 | Press de pecho en máquina | 2 × 8–12 | 2 / 2 | 2,5 min |
| 4 | Curl femoral sentado | 2 × 10–15 | 2 / 1 | 2 min |
| 5 | Elevaciones laterales | 2 × 12–15 | 1 / 1 | 1,5 min |

Estimación: **46 min 32 s**, mostrada como 47 min. Cuatro series de tren inferior.

### Viernes — 5 ejercicios, 10 series

| Orden | Ejercicio | Series × reps | RIR S1 / S2 | Descanso |
|---|---|---|---|---|
| 1 | Press de suelo con mancuernas | 2 × 8–12 | 2 / 2 | 2,5 min |
| 2 | Remo con pecho apoyado | 2 × 8–12 | 2 / 2 | 2,5 min |
| 3 | Sentadilla goblet | 2 × 10–12 | 2 / 2 | 2,5 min |
| 4 | Curl femoral sentado | 2 × 10–15 | 2 / 1 | 2 min |
| 5 | Gemelo sentado | 2 × 10–15 | 1 / 1 | 2 min |

Estimación: **46 min 48 s**, mostrada como 47 min. Seis series de tren inferior.

### Instrucción conservada en la propuesta

“Respeta el RIR de cada serie. RIR 0 significa no poder completar otra repetición con
técnica estable; no fuerces repeticiones. Progresa cada serie o bloque por separado:
cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta
ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos.
No se automatizan pesos ni cambios de rutina.”

Esta descripción de progresión la incorpora determinísticamente la aplicación al
decodificar el contrato. No es una explicación individual escrita por el modelo.
No hay kg prescritos, calentamiento individual, tempos específicos ni justificación
narrativa adicional en la respuesta.

### Cómo interpretar el tiempo

El cálculo del evaluador suma 5 min iniciales + 2 min por ejercicio + por serie
(reps máximas × 4 s + descanso), con ajustes para unilateral si corresponde.
No hay unilateral en esta rutina. Incluye un descanso también tras la última serie:
es una heurística, no una medición real. No certifica tiempos de calentamiento,
colas ni transiciones personales. Quedan aproximadamente 13–14 min respecto a 60;
no es obligatorio llenarlos con más volumen. Total estimado semanal: 139 min 20 s.

## Volumen y frecuencia

Atribución aproximada del catálogo, por semana. Una serie compuesta puede aparecer
en varios músculos. Las secundarias NO equivalen a una serie directa ni se convierten
en medias series sin un criterio adicional. “Espalda alta” es subconjunto de espalda;
no se suman ambas filas. Frecuencia = días con estímulo directo / secundario.

| Grupo | Directas | Secundarias | Frecuencia directa / secundaria | Valoración |
|---|---:|---:|---|---|
| Pectoral | 6 | 0 | 3 / 0 | Adecuado como inicio conservador |
| Espalda | 6 | 0 | 3 / 0 | Adecuado |
| Espalda alta (incluida arriba) | 4 | 0 | 2 / 0 | Adecuado |
| Cuádriceps | 6 | 0 | 2 / 0 | Adecuado, revisar lunes tras running |
| Isquiosurales | 6 | 0 | 2 / 0 | Adecuado: bisagra y flexión de rodilla |
| Glúteos | 6 | 0 | 3 / 0 | Adecuado como atribución de compuestos |
| Deltoides | 2 | 10 | 1 / 3 | Mejorable: solo 2 directas laterales |
| Bíceps | 0 | 6 | 0 / 3 | Mejorable si se busca cobertura directa equilibrada |
| Tríceps | 0 | 6 | 0 / 3 | Mejorable con la misma salvedad |
| Gemelos | 2 | 0 | 1 / 0 | Mejorable: dosis directa baja, solo sentado |
| Zona media | 2 | 4 | 1 / 2 | Mejorable: directo solo flexión de tronco |
| Aductores | 0 | 0 | 0 / 0 | Sin asignación explícita; no demuestra estímulo nulo en sentadillas/prensa |

Los 10 sets secundarios de deltoides mezclan presses y remos: no son 10 sets de
deltoides lateral. Los 6 sets glúteos son prensa, RDL y goblet, no seis aislamientos
ni garantía de un estímulo idéntico en todas las ejecuciones. La zona media secundaria
corresponde a estabilización en RDL/goblet, distinta de flexión cargada.

Por clasificación de ejercicios, sin doble conteo: **14 series inferiores, 14 superiores
y 2 de zona media** (46,7%, 46,7%, 6,7%). Relación inferior/superior 1:1.
Cada sesión contiene 10 series; semana 30. Hay 12 ejercicios distintos en 15 apariciones.

### Patrones

| Patrón | Series/semana |
|---|---:|
| Dominante de rodilla compuesto (prensa/goblet) | 4 |
| Extensión de rodilla aislada | 2 |
| Bisagra de cadera | 2 |
| Flexión de rodilla | 4 |
| Empuje horizontal | 6 |
| Tracción horizontal | 4 |
| Tracción vertical | 2 |
| Abducción de hombro | 2 |
| Flexión plantar | 2 |
| Flexión de tronco | 2 |

**Adecuado:** incluye los patrones principales sin especialización innecesaria.
No hay press vertical, aislamiento de brazos ni trabajo unilateral. Su ausencia no
es automáticamente un defecto: no existe obligación de incluir todos en una semana.
No hay duplicaciones dentro de una sesión. Repetir máquina de pecho, remo apoyado
y curl sentado en distintos días facilita una progresión consistente; es razonable.

## Evaluación técnica y deportiva

| Apartado | Calificación | Justificación y límites |
|---|---|---|
| Estructura y catálogo | Adecuado | 15 apariciones válidas, 30 objetivos por serie, sin omisiones de reps/RIR/descanso, material disponible y exclusiones respetadas |
| Distribución semanal | Adecuado | Full-body tres días, principales a frecuencia 2–3; 48 h entre L–X y X–V, 72 h V–L si se entrenase a la misma hora |
| Balance superior/inferior | Adecuado | 14/14 series, sin predominio injustificado de una mitad corporal |
| Volumen principal | Adecuado como inicio | Seis series directas nominales por grupo principal: conservador; no demuestra dosis óptima para esta persona |
| Músculos pequeños | Mejorable | 2 laterales, 2 gemelos, 2 abdominales y ningún aislamiento de brazos; el estímulo indirecto existe pero no sustituye automáticamente el directo |
| Experiencia 1–2 años | Mejorable | RIR 1–2 y compuestos son coherentes; no se conoce volumen previo tolerado, rendimiento o progreso, por lo que el ajuste al nivel es poco profundo |
| Running dominical | Mejorable / por revisar | Viernes tiene 6 series inferiores, domingo running y lunes 4 de cuádriceps. No hay actividad concurrente el mismo día, pero lunes sigue al running; intensidad/duración desconocidas |
| Descansos | Adecuado | 3 min prensa/RDL, 2,5 en compuestos moderados, 1,5–2 en accesorios; no se comprimieron para meter volumen |
| Repeticiones | Adecuado | 8–15 en movimientos congruentes con el material; no hay rango extremo ni salida del contrato |
| Esfuerzo/proximidad al fallo | Adecuado | 21 series RIR 2, 9 RIR 1, ninguna RIR 0; media 1,7. Conservador en prensa/RDL, más próximo en accesorios |
| Progresión | Adecuado como regla inicial; mejorable como seguimiento | Doble progresión por serie, respeta técnica/RIR. No programa incrementos exactos, criterios de estancamiento ni ajustes por fatiga; no se han probado resultados |
| Tiempo | Adecuado como estimación | 46–47 de 60 min; no evidencia real de duración ni motivo para completar obligatoriamente los 60 |
| Justificación de selección | Mejorable | Las familias son compatibles con objetivo/material; no se conserva una razón específica para elegir suelo frente a banco/máquina |
| Garantía comercial autónoma | Problemático declararla demostrada | Un caso y un JSON válido no validan calidad longitudinal, generalización o seguridad para todos los perfiles |

### Running y recuperación: incertidumbre concreta

No se sabe si el domingo es un rodaje suave o una sesión larga/exigente.
La compatibilidad es razonable de forma condicional, pero no se certifica.
Separar viernes/domingo por dos días de calendario no garantiza recuperación; tampoco
demuestra interferencia. El lunes coloca prensa y extensión de cuádriceps tras el running.
Propuesta de revisión: comprobar tolerancia y carga del domingo antes de elevar volumen
o acercar más al fallo. No reducir descansos ni reprogramar automáticamente por esta muestra.

**Limitación comprobada del evaluador:** sus avisos de actividad externa cubren el mismo
día y la víspera de la actividad con la sesión inferior más cargada (>4 series).
No cubren la sesión posterior a running; por ello este lunes no produce un aviso.
Esto es una laguna de revisión, no una prueba de daño o de mala recuperación real.

### Personalización dato por dato

- Días y minutos: respetados literalmente, con margen estimado.
- Ganancia equilibrada: trabajo general de principales, aunque cobertura directa pequeña desigual.
- Experiencia: programación moderada y RIR controlado; no deriva volumen individual a partir de historial.
- Estimación del esfuerzo: RIR utilizable para un perfil que declara confianza; precisión real no comprobada.
- Inventario: todos los ejercicios requieren material disponible; no se añadió equipamiento.
  Tener banco no obliga a usarlo ni hace inválido el press de suelo.
- Exclusiones: ningún Dead bug ni Bird dog; Crunch en polea es una selección permitida,
  sin afirmar que sea una equivalencia funcional exacta.
- Running domingo: la rutina evita coincidir ese día, pero no explica el efecto del lunes.
- No utiliza puntos débiles, lesiones ni preferencias inventadas. No puede inferirse del
  output el razonamiento interno del modelo ni por qué eligió exactamente cada aparato.

## Defectos comprobados, hipótesis y propuestas (NO implementadas)

| Prioridad | Origen | Hallazgo | Ajuste propuesto |
|---|---|---|---|
| 1 | Evaluación/revisión | Falta comprobación del día posterior a actividad externa; 0 warnings oculta incertidumbre relevante | Aviso contextual para revisión sobre recuperación previa/posterior, sin bloqueo automático ni asumir running intenso |
| 1 | Evaluación/revisión y prompt | Cobertura directa pequeña baja en esta muestra; secundarios agregados pueden dar falsa impresión de cobertura | Mostrar directas/secundarias por separado y exigir revisión/justificación de baja cobertura para objetivo equilibrado; no mínimos universales ni añadir series automáticamente |
| 2 | Catálogo/evaluador | Una sola etiqueta deltoids agrupa cabezas y patrones distintos | Distinguir atribuciones relevantes para la auditoría; revisar también gemelo sentado y estímulo de gastrocnemio, sin invalidar el ejercicio |
| 2 | Cuestionario Basic | Se sabe el día de running, no duración/intensidad; tampoco volumen previo tolerado | Valorar campos mínimos de entrenamiento o una pregunta de reviewer cuando afecte a la decisión; sin datos de salud ni rehacer cuestionario todavía |
| 2 | Instrucciones/revisión | No hay motivo específico visible para elecciones como suelo o para 2 series uniformes | Pedir una justificación breve de prioridades/compromisos si resulta útil; no cadenas internas de razonamiento ni decoración textual |
| 3 | Contrato/seguimiento | Progresión inicial genérica, sin respuesta a estancamiento probada | Definir criterios humanos de seguimiento antes de atribuir a Basic adaptación autónoma |
| No cambio justificado | Límites de salida/contexto | JSON completo, 2.050 de 5.120 tokens; entrada 2.454 de 12.000 | Mantener límites; no se observa truncamiento ni razón para aumentarlos |
| No fallo demostrado | Programación | 6 series principales, cero RIR 0, repeticiones entre días | No corregir solo porque exista otra programación razonable; contrastar tolerancia/resultados y más muestras autorizadas |

No se demuestra que el prompt siempre infraentrene brazos ni que aumentar volumen sea
lo correcto para todos. Las recomendaciones son hipótesis de mejora salvo las cifras
de esta rutina y la laguna de avisos comprobada en el código.

## Contexto científico de la valoración

El volumen semanal influye en hipertrofia en promedio, pero no convierte un número
concreto de series en un mínimo universal ni permite diagnosticar respuesta individual
sin seguimiento: [Schoenfeld et al., metaanálisis](https://pubmed.ncbi.nlm.nih.gov/27433992/).
Seis series se califican aquí como inicio conservador, no como dosis óptima demostrada.

La investigación de entrenamiento concurrente depende del resultado medido y del
contexto: [Lundberg et al., hipertrofia de fibras](https://pubmed.ncbi.nlm.nih.gov/35476184/).
No extrapolamos sus promedios a un running dominical cuya carga no conocemos.
Las valoraciones de esta auditoría son inferencias de programación sobre una propuesta,
no resultados clínicos ni efectos observados en un atleta.

## Limpieza y estado conservado

La referencia final, capturada el 28/10 a las 22:13:48 UTC, coincide con la inicial:
27/27 pares de cantidad/huella; 16/16 funciones críticas (definición, propietario y ACL),
configuraciones y huella de seguridad. También coinciden las huellas adicionales de
roles, membresías, esquemas, triggers y funciones.

- pilot_config y reviewer_config vacíos.
- Cero anamnesis Basic y cero operaciones Basic residuales.
- Eliminados exclusivamente 1 consentimiento, 1 anamnesis y 1 operación sintéticos,
  con UUID exactos del recibo y comprobación de referencias.
- Conservados 19 rutinas, 4 revisiones, 22 workouts y 4 notas preexistentes.
- No rutina/revisión/workout nuevos. Ninguna aprobación o aceptación.
- Financial P1, cuotas y presupuestos sin cambios.
- Identidades/roles estables iguales. No se afirma igualdad de timestamps mutables
  de Auth tras los logins legítimos.
- Recibo de proveedor y respuesta conservados en evidencia privada; no quedan llamadas
  en vuelo según el cierre conciliado. No se reconsultó el backend en esta auditoría.
- Un primer intento de limpieza devolvió error de transporte/requestState. Se comprobó
  en lectura que los tres registros seguían presentes y los accesos desactivados antes
  de repetir la misma transacción exacta. La referencia final demuestra restauración.
- v32 se conservó sin nuevo despliegue. Producción y Cloudflare no intervenidos.

“Staging restaurado” describe la referencia verificada al cierre del ensayo, no una
nueva auditoría online del 29/10. Los originales permanecen byte a byte intactos.

## Decisión antes de una segunda prueba

Revisar primero los avisos de recuperación y la cobertura directa de músculos pequeños.
No elevar tokens, volumen o cercanía al fallo por defecto. Acordar criterios de revisión,
evaluar después más perfiles con autorización separada y mantener aprobación humana.
No hay aceptación automática, nueva generación ni despliegue autorizados por este informe.
