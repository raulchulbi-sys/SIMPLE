# Coach 1A — diseño previo a SQL
Solo staging dmqjexigdnfzobarhnib. Producción no es destino permitido de los scripts.
Seis tablas y schema privado sin tablas adicionales. Propiedad auth.users; FK RESTRICT para que la limpieza sea explícita, sin cascadas nuevas sobre históricos.
PK UUID, UNIQUE usuario/revisión, un draft por usuario, un grant activo por scope, una operación inicial reserved/ready/accepted por usuario, clave idempotente por usuario, una revisión por rutina y una rutina por operación.
Tablas con RLS SELECT propio; cero INSERT/UPDATE/DELETE directos incluso para service_role. Backend mediante funciones concretas con validaciones. Funciones de finalización/contexto solo service_role y comprueban operación+usuario+permisos+intake vigente.
Piloto: función privada pilot_config con mapa UUID→expiración opcional, vacía al instalar y tras limpiar. No tabla de billing ni autorización en navegador.
Intake enviado inmutable; editar crea revisión. Un draft nuevo invalida propuestas. Cambios de grants invalidan operaciones pendientes. Cada operación guarda IDs exactos de grants e intake/version.
Límites: 1..7 días; 1..8 ejercicios/día; 1..6 series; 1..30 reps; RIR0..5; descanso0..300 segundos; nombres100; schema cerrado. Son límites técnicos de la fixture, NO protocolo clínico ni validación de rutinas IA reales. Salud no vacía produce revisión requerida; mock no prescribe ante limitaciones.
Creación atómica: operación→rutina→días→ejercicios→revisión1→gestión→accepted. Errores abortan todo.
Guardas en las tres tablas de estructura bloquean rutas directas y RPC antiguos, únicamente para Coach. Se permiten ordenar/archivar la rutina, workouts y notas personales; no editar prescripción. Mantenimiento administrativo explícito sin usuario permite limpieza.
Orquestador mock único, verify_jwt=true, valida JWT real mediante Auth getUser; llama reserva con JWT del usuario; sus únicas llamadas privilegiadas son contexto/finalización con el UID verificado. No acepta propuestas ni UID del body.
Se reutilizan colores/tipografía/componentes de SIMPLE. Vista propia aislada, sin rediseño ni imágenes. CTA único por paso; resultado sintético identificado.
