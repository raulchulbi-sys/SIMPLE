# Trabajar en SIMPLE

SIMPLE permite preparar y compartir rutinas, entrenar y conservar el historial.
Mantén la compatibilidad y el aislamiento de datos al cambiar cualquier flujo.

## Mapa

- `index.html`: aplicación principal; incluye lógica y scripts de interfaz.
- `index_cliente_editor_final_v25.html`: variante histórica; no sincronizarla por inercia.
- `assets/`: autenticación, rutinas, estadísticas y módulos de Coach.
- `supabase/`: SQL, configuración y código de Edge Functions; leer código no autoriza aplicarlo.
- `tests/`: scripts heterogéneos; muchos requieren entornos reales o material privado.
- `scripts/ci-offline.cjs`: lista cerrada de comprobaciones locales auditadas.
- `docs/development-workflow.md`: protocolo, auditoría de CI y límites de cobertura.

## Ciclo autónomo

1. Lee el encargo/issue completo y estas instrucciones. Comprueba la base y el estado de Git.
2. Crea una rama independiente desde la base indicada, preferiblemente en una copia o worktree nuevo. Conserva cambios ajenos. Una rama/PR por objetivo; no incorpores otras PR.
3. Diagnostica, implementa el cambio mínimo autorizado y ejecuta las pruebas pertinentes. Audita antes cualquier script que no esté en la lista offline.
4. Corrige los fallos atribuibles al cambio y repite los controles afectados. No rebajes aserciones ni alteres tests para ocultar regresiones.
5. Revisa diff, alcance y privacidad; prepara una PR en borrador cuando esté autorizado. Entrega evidencia concisa y límites reales.

Completa este ciclo sin esperar prompts intermedios por decisiones menores. Detente
ante un bloqueo real, riesgo importante, discrepancia de entorno o acción fuera de
la autorización. Prepara antes el resultado local que permita decidir. No hagas
merge, actives auto-merge ni publiques por deducirlo del permiso de implementar.

## Comandos verificados

Desde la raíz, con Node **24.19.0** y Git, sin instalar paquetes:

```text
node scripts/ci-offline.cjs
git diff --check
git status --short
git diff --stat
```

No existe `package.json` raíz: no supongas `npm test` ni un build. La suite de ciclo
compara hashes de SQL con finales LF; en Windows usa una copia nueva con LF según
el protocolo, sin normalizar un árbol ajeno. CI no ejecuta SQL ni autentica usuarios.

## Seguridad y revisión crítica

- Repositorio público: no abras `private/`, `results/`, credenciales ni volcados sin autorización específica. No publiques secretos, JWT, tokens, datos personales, URLs de sesión ni fixtures privados, tampoco en logs, capturas o PR.
- No uses credenciales ni llames a Supabase, Stripe, Cloudflare o proveedores de IA en una tarea offline. Cambios de entornos, despliegues, migraciones, compras y operaciones económicas necesitan autorización explícita y acotada, incluso en TEST.
- Aislamiento: comprueba propietario, rol y ámbito en el servidor; nunca confíes en identificadores o parámetros URL del cliente. Revisa accesos cruzados y denegaciones, sin ampliar JWT, RLS, CORS ni permisos para pasar una prueba.
- Idempotencia y contabilidad: preserva identificadores, importes, moneda, histórico y conciliación. Ante un resultado incierto, comprueba mediante lecturas; no repitas una operación para forzar éxito ni concedas derechos antes de la evidencia autoritativa.
- Workout e historial: conserva identidad por UUID, orden, versiones, notas, borradores, series, RIR y descansos. Renombrar no debe reasignar historial; protege respuestas tardías, doble envío y separación entre usuarios/rutinas.

## Criterios de aceptación

Diff limitado al encargo, sin cambios ajenos ni secretos; pruebas pertinentes con
resultado y limitaciones explícitos; errores con salida no cero; revisión del
diff completada. Distingue sintaxis, modelos/dobles offline y validación real de
backend/navegador. No declares ejecutadas pruebas omitidas ni validado un entorno
que no has comprobado. No cambies ajustes de GitHub sin aprobación específica.
