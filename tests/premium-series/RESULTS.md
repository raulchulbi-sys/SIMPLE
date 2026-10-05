# Cierre staging de Premium Fase 2 por serie

Fecha: 04/10/2026. Base `dde5dd8`, procedente de `72fc545 → 660dcb1 → dde5dd8`. Candidato: commit que contiene este informe, rama `codex/premium-series`. Main remoto observado al cierre: `b15968c73ab1b075c70f5456e6531733696c3bf5`. Sin push, merge, publicación ni escrituras productivas.

## Contratos reutilizados y ampliados

Se conservan los context grants, mesocycles/weeks, mapping UUID, trazabilidad, aceptación, KEEP, aislamiento JWT y protección stale de 660dcb1. Basic V5, segunda generación Basic, ciclo, Auth/OAuth, intake y los cuatro archivos UX de dde5dd8 permanecen intactos. `contract.mjs` v1 no cambió; la extensión usa `premium-analysis-v1.1`, `premium-prescription-v2` y `premium-recommendation-v2`. No se cambia el modelo.

Seis funciones existentes ampliadas: `coach_private.premium_bundle`, `premium_output_patches`, `premium_check_patch`, `premium_snapshot`, `public.premium_analysis_finish`, `premium_reserve_analysis`. Siete helpers privados nuevos: cuatro copias v1 de bundle/output_patches/check_patch/snapshot y sets_valid/revision_sets/series_uniform. Owner/ACL/search_path comprobados. Sin acceso cliente a helpers nuevos. No nuevas policies ni triggers. La única constraint cambiada es el techo del presupuesto staging (16 llamadas acumuladas).

## Prescripción e historial

Ejemplo anonimizado: S1 6–8 reps @ RIR 1 / 240 s; S2 8–10 @0 / 240 s; S3 10–12 @0 / 240 s. Se envían como objetos numéricos, no strings combinados. Una exposición contiene cada serie realizada y su `planned` histórico, `reps_in_range`, `rir_delta` y `prescription_source`. Ejemplo: S1 90 kg ×8 @1 frente a 6–8 @1; S2 82,5 kg ×10 @0 frente a 8–10 @0. Esas cargas no se mezclan como un mismo objetivo.

Se verifica UUID exacto y revisión de ese workout. Sin revisión inequívoca, `planned` es null y la UI lo reconoce. Series realizadas escasas/reordenadas conservan su ordinal histórico. Ordinales duplicados ⇒ identidad ambigua, no asociación arbitraria. Legacy uniforme se proyecta explícitamente; un plan individualizado malformado nunca se reconstruye desde el resumen escalar.

## MODIFY persistido y aceptado mediante RPC autenticados

Estas salidas son deterministas/mock; no son elecciones reales del modelo.

| Caso | Cambio | Resultado verificado después de aceptar |
|---|---|---|
| I | Quitar la S2 original de tres series distintas | N+1 conserva S1 6–8 @1 /240 s y antigua S3 10–12 @0 /240 s, ahora S2. N y workouts intactos. |
| J | Dos → tres series | S1/S2 intactas; S3 añadida con reps/RIR/descanso completos; se rechaza añadir sin prescripción. |
| K | Descanso solo de S2: 60 →240 s | S1 y todas las demás series/ejercicios permanecen exactos. |
| P | RIR solo de S1: 1 →2 | Reps/descanso de S1 y resto de series permanecen exactos. |
| O | Legacy uniforme tres →dos | Compatibilidad anterior conservada y nueva revisión correcta. |
| N | KEEP sobre top set/back-off | Cero revisiones nuevas; estructura y trazabilidad intactas. |

También pasan cambio de reps por serie, `from` obsoleto, ordinal inexistente, adición fuera de N+1, campos extra, límites, supresión de todas las series, cambios uniformes que aplastarían un plan heterogéneo y mezcla de volumen con cambios del mismo ejercicio. La proyección live debe coincidir con la revisión antes de aplicar.

Aceptación N→N+1 atómica: dos solicitudes simultáneas de la misma recomendación devuelven la misma revisión. Dos recomendaciones concurrentes sobre N producen un ganador y un stale. Un fallo en un segundo patch después de una sustitución revierte íntegramente el primer cambio y no crea revisión. N, UUID de workouts y planes de ejercicios no afectados permanecen exactos.

## REVIEW y permisos

Se persistieron `pending_review` con historial insuficiente (L mock), output no aplicable (M mock) y ambigüedad histórica (M mock posterior). K produjo además un REVIEW real de OpenAI. El atleta no puede aceptar REVIEW sin resolución. Solo reviewer asignado al mesociclo puede resolver/aprobar/rechazar por el flujo existente; trainer normal, otro cliente y anon no pueden. No acceso global a workouts. Una respuesta obsoleta o con consentimiento revocado termina superseded; errores de proveedor/red conservan estado failed.

Los outputs inseguros conservan trazabilidad privada, pero sus cambios no se presentan como aplicables. UI muestra el problema y contexto factual seguro. Warnings de descanso/fatiga se conservan antes de revisión; no se eliminan silenciosamente ni equivalen por sí solos a aplicación automática.

## Ejecuciones finales

Recuento de aserciones por suite, no de escenarios funcionales únicos. Se excluyen intentos de preparación fallidos/corregidos y repeticiones parciales.

| Suite | Resultado |
|---|---:|
| Contrato por serie | 34/34 |
| Login JWT staging | 5/5 |
| Intake/grants staging | 16/16 |
| Contexto por serie | 36/36 |
| Nuevas llamadas reales | 4/4 |
| RPC funcionales autenticados | 97/97 |
| Concurrencia/atomicidad | 10/10 |
| REVIEW ambiguo | 3/3 |
| UI por serie | 114/114 |
| UI regresión errores/stale/teclado | 54/54 |
| SQL determinista | 39/39 |
| SQL ciclo de petición/presupuesto | 13/13 |
| SQL cierre V5/live | 9/9 |
| SQL invariantes | 8/8 |
| Basic V5 unit | 35/35 |
| Intake v2 unit | 50/50 |
| Premium v1 unit | 28/28 |
| **Total ejecución seleccionada** | **555/555** |

Controles adicionales de preservación: 24/24 archivos congelados; 46/46 funciones no afectadas (definición/owner/ACL). Total de preservación: 70/70, separado del total anterior. Rollback: 52/52 definiciones originales restauradas sin diferencias, también separado.

Histórico válido de 660dcb1: 437/437, 10 llamadas, 0,1077695 USD. Hay solapamiento con regresiones actuales; no se suman como 992 escenarios únicos. No se repitieron esas diez llamadas. No se afirma una nueva prueba autenticada completa de producción ni Safari/iPhone físico. Chromium (Edge) y WebKit automatizados: 320/360/390/430/1280, claro/oscuro, área táctil >=44 px, teclado/foco, comparaciones compactas, error/reintento y respuesta antigua.

## OpenAI real adicional

Cuatro llamadas, modelo `gpt-5.4-2026-03-05`, HTTP 200 en las cuatro, sin error ni reintentos. Tokens adicionales: 27.335 input, 1.214 output, 0 cached. Coste adicional: **0,0865475 USD**. Acumulado Fase 2: **14 llamadas / 0,194317 USD**. Presupuesto adicional autorizado: seis llamadas /0,25 USD; no se consumió el resto para forzar MODIFY.

| Caso | Contexto | Decisión | Input/output | USD | Evaluación |
|---|---|---|---:|---:|---|
| K | Hack, descansos 60 s, objetivos por serie y rendimiento estable | REVIEW | 7436/396 | 0,0245300 | Facts estables existentes. Señala incoherencia de descanso como hipótesis; no inventa caída ni aplica cambios. |
| I | Tres series distintas, descenso comparable de reps | KEEP | 7448/386 | 0,0244100 | Descenso real; justifica prudencia porque aún se cumplen varios objetivos. No afirma fatiga como hecho. |
| L | Una exposición | KEEP | 5015/210 | 0,0156875 | Reconoce insufficient_data; no inventa tendencia. REVIEW por insuficiencia cubierto por output mock persistido. |
| N | Top set/back-off estable | KEEP | 7436/222 | 0,0219200 | Objetivos individualizados conservados; sin comparar como idénticas las cargas top/back-off. |

No hubo MODIFY real nuevo. Target/set/from/to no aplican a estas cuatro salidas, que tienen changes vacío; no atribuirles validación de un cambio inexistente. Los MODIFY sí se ejecutaron de extremo a extremo con datos controlados y lectura directa de Supabase. Cada fact del modelo coincidió con el claim calculado por servidor; schema y validación SQL aceptaron las cuatro salidas. No causalidad inventada identificada; las hipótesis se diferencian explícitamente de observaciones.

## Limpieza, integridad y rollback

Eliminados exclusivamente por IDs/propiedad/prefijo del manifiesto de esta fase: ocho rutinas, dieciséis días, treinta y dos ejercicios, cincuenta y ocho workouts, revisiones, recomendaciones, semanas, mesociclos, asignaciones reviewer y grants sintéticos. Cero nuevos usuarios Auth; las cinco cuentas controladas preexistentes se conservan. Staging final: cero fixtures propias, cero acceso Premium activo, cero recomendaciones, cero mesociclos, cero grants Premium y whitelist Basic vacía. No se confunde whitelist=0 de staging con producción.

Siete tablas centrales: counts y MD5 de JSON ordenado por ID idénticos antes/después en staging y producción. Policies y triggers idénticos. Identidad estable Auth (id/email/role/created_at/cantidad) idéntica; timestamps de accesos normales no se utilizan como único criterio. Producción: 22 funciones seleccionadas exactas, incluyendo RPC de ciclo MD5 `88c3564c3c49cf9c53fccba89a1e71b5`. No se afirma una huella de cada función pública ajena a la selección.

Patatasimple sigue client, UUID `284d6bb6-e798-44a9-b72c-f31d3e27deef`; ninguna escritura a su perfil, rutinas, workouts ni notas. No escrituras a producción, Auth, OAuth, secrets, RLS o configuración comercial. No publicación.

Rollback SQL ensayado tras limpieza: 52 funciones originales exactas (hash/owner/ACL), sin helpers nuevos residuales. Candidato reaplicado solo en staging. Edge original restaurada y candidata desplegada finalmente como versión 5, verify_jwt=true: los seis archivos coinciden con los locales finales. Piloto cerrado: enabled=false, dispatched=14, charged=0,194317, reserved=0; se conserva la contabilidad, no se borra consumo.

Advisors ejecutados: deny-all de tabla privada de presupuesto y RPC SECURITY DEFINER guardados corresponden al diseño privado existente; nuevas funciones sin EXECUTE cliente. Avisos heredados de protección de contraseñas y rendimiento no se cambiaron, al estar fuera de alcance. No nueva ampliación RLS. Referencia: [linter SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Preview y revisión final

Preview navegable: `http://127.0.0.1:4240/review`. Solo loopback, offline; acciones simuladas indicadas. Capturas locales finales ignoradas: `results/remove-390-light.png`, `remove-390-dark.png`, `remove-1280-light.png`, `remove-1280-dark.png`, `J-390.png`, `K-390.png`, `multiple-390-light.png`, `multiple-390-dark.png`.

Pendientes de decisión: promoción autorizada en otra fase, revisión visual del candidato y planificación de Fase 3. No se han añadido check-in, chat, adaptación longitudinal, pagos, salud o nutrición. Este cierre no declara probado un MODIFY real nuevo del modelo ni enrolamiento automático de una rutina Basic ya gestionada.

## Salidas reales nuevas completas (anonimizadas)

### Caso K
```json
{
  "kind": "REVIEW",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "La observación es estabilidad comparable. La hipótesis es que los descansos de 60 s en exercise_1 no encajan con una sentadilla hack pesada y con RIR bajos, por lo que la aplicación automática no es prudente aunque no haya caída de rendimiento.",
  "changes": [],
  "confidence": "high",
  "interpretation": "El rendimiento comparable se mantiene estable en todos los ejercicios observados. Aun así, hay una incoherencia en la prescripción de descanso de un multiarticular demandante que conviene revisar antes de mantenerla sin cambios.",
  "schema_version": "premium-recommendation-v2"
}
```
### Caso I
```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "reps_decreasing_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "La observación principal es un descenso reciente con condiciones comparables. La hipótesis de fatiga o mala recuperación es posible, pero no está demostrada por estos datos. Como la mayoría de ejercicios siguen cumpliendo objetivo y el descenso todavía es limitado en tiempo, es más prudente mantener y volver a observar antes de modificar.",
  "changes": [],
  "confidence": "medium",
  "interpretation": "Hay una bajada comparable de repeticiones en varios ejercicios, pero la evidencia aún no obliga a cambiar la revisión base. En tres ejercicios el rendimiento sigue dentro del rango objetivo; en hack hubo una sesión por debajo, pero con un historial reciente previo adecuado.",
  "schema_version": "premium-recommendation-v2"
}
```
### Caso L
```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "insufficient_data",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: las series registradas cumplen la prescripción actual y no aparecen contradicciones de seguridad. Hipótesis: con más exposiciones comparables podría valorarse si conviene progresar o modificar, pero ahora sería prematuro.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Hay una sola exposición registrada por ejercicio, así que no existe una base comparable suficiente para inferir tendencia ni justificar ajustes.",
  "schema_version": "premium-recommendation-v2"
}
```
### Caso N
```json
{
  "kind": "KEEP",
  "facts": [
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_1"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_2"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_3"
    },
    {
      "claim": "stable_comparable",
      "exercise_ref": "exercise_4"
    }
  ],
  "reason": "Observación: el rendimiento comparable está estable y la ejecución registrada coincide con la prescripción por serie. Hipótesis: mantener la revisión actual es prudente porque la evidencia disponible no muestra necesidad clara de cambio.",
  "changes": [],
  "confidence": "high",
  "interpretation": "Las exposiciones comparables se mantienen estables en todos los ejercicios revisados. No hay una señal verificable de mejora o deterioro que por sí sola justifique ajustar volumen, RIR, repeticiones o descansos.",
  "schema_version": "premium-recommendation-v2"
}
```

## Huellas centrales al cierre

Counts/MD5 siguientes coinciden con sus respectivas lecturas iniciales.

| Entorno | Tabla | Recuento | MD5 |
|---|---|---:|---|
| stage | profiles | 5 | 800fdd39d10ad1533800db3fc351e05e |
| stage | routines | 15 | f3d7ec34f8f285888b35103efb4a71a7 |
| stage | routine_days | 17 | f1ffab308dd85514df51033e27bc8735 |
| stage | routine_exercises | 23 | b66548eb1f53f3e8c4558e448fc7069a |
| stage | workouts | 22 | 04ef2c75b1078399e35b5d474a12f83e |
| stage | routine_assignments | 12 | 2c1ccfa43723609b3ed2d9431b5822b9 |
| stage | routine_user_notes | 4 | 101e53237a08353d8a2261278156bcfe |
| prod | profiles | 6 | 637df9a833b8a381132f9236a0aa663d |
| prod | routines | 5 | c92a36bfe1c1ee9b533d92b36ff91192 |
| prod | routine_days | 15 | ca0a10c5d5458d894edf4a17bce7aa01 |
| prod | routine_exercises | 84 | 96ba8463bfb04d48d4a346d798f5440c |
| prod | workouts | 69 | edb4c27f8d1ef9f8635ee4beba21103a |
| prod | routine_assignments | 3 | ea13114353b6cd55aa4444d25ea40b8f |
| prod | routine_user_notes | 248 | d9ae06d4c6c190ef7336f23765d41f2c |
