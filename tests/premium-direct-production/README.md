# Premium directo: promoción cerrada

Base: árbol productivo de `83a9d9c8`, equivalente a `f2c908f`.
Origen funcional: `b39dc24`, conservado en su rama original. Esta entrega excluye billing experimental.

Cambios de compatibilidad: proyectos explícitos en adapter/UI/Edge inicial; cinco URLs JS nuevas para evitar caché del lifecycle antiguo; elegibilidad inicial condicionada a su presupuesto independiente. Los entrypoints de Chat/análisis son los ya existentes en producción; solo sus contratos de lectura admiten `premium_initial`.

La migración canónica es `supabase/migrations/20261011154036_coach_premium_initial.sql`. Amplía cinco funciones existentes exclusivamente para el origen inicial y el presupuesto compartido, añade tablas/RPC iniciales y protege la coexistencia con entrenadores. No reinstala Financial P1. La nueva capacidad queda OFF/0; no asigna reviewer, usuarios, cuotas o consentimientos. No apaga Chat/análisis anteriores.

## Verificación

- 1.025 comprobaciones offline: contrato 23, Edge 60, adapter 25, revisión histórica 11, compatibilidad/caché 27 y UI 879. Todos los fetch de esas pruebas están interceptados; no equivalen a login o modelo reales.
- Chromium/WebKit, 320/360/390/430/1280, claro/oscuro. La espera histórica 60/60 se reutiliza sin sumarla.
- `independent-switch.sql`: nueve assertions en staging, positivo ON y rechazo OFF mientras legacy está ON. Transacción revertida; cuotas/configuración idénticas después.
- Comparación de paquetes legacy: sus módulos y dependencias se conservan salvo el enum de provenance. JWT permanece exigido.
- El procedimiento productivo exige CAS de las 29 tablas previas y 190 dependencias. Tras la migración protege 185 funciones no ampliadas, sus ACL y todas las políticas anteriores. Nueva superficie: 15 condiciones de permisos/flags.

Fuentes de pruebas se versionan; resultados, capturas, manifiestos y backups lógicos permanecen en `private/` o `results/`, ignorados. No contiene credenciales ni una cuenta preconfigurada. `build-initial-pack.cjs` empaqueta exclusivamente código local.

## Restauración

Rollback SQL guardado privadamente antes de promover: rechaza pérdida de auditoría, gasto/reserva o rutinas iniciales entregadas; restaura las cinco definiciones/ACL anteriores y retira únicamente los objetos iniciales sin uso. Si el recorrido ya tiene actividad, usar primero su interruptor OFF y conservar evidencia, no ejecutar borrado ciego.

Backups de ambos paquetes Edge y referencia Git anterior se conservan fuera del candidato público. No restaurar contadores, Auth, rutinas o entrenamientos para hacer coincidir huellas. El cierre del despliegue y las limitaciones de pruebas autenticadas se documentan en el informe separado de la misión.
