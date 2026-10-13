# Contrato financiero Premium

El parche parcial de `ecb72e9` se sustituye por el ledger y procedimiento de [READINESS.md](READINESS.md).

Un recibo no verificado no se convierte en gasto real: conserva exposición reservada, evidencia e incidencia que bloquea nuevo gasto. Un coste externo verificado superior se incorpora completo, con delta y autorización separada de reapertura. Repetir o reiniciar no borra la incidencia.

Código canónico: `supabase/migrations/20261007230107_premium_analysis_receipt_bounds.sql`. Sin backfill. Modelo/tarifas/máximos capturados por envío; response_id y tier de respuesta real, dispatch_id añadido en servidor.

El exceso de prueba proviene de una fuente controlada de staging, no facturable. No hubo llamadas ni facturas nuevas reales de OpenAI. Evidencia externa requiere revisión autorizada: hash y tipo documental no prueban autenticidad por sí solos.

Pruebas: `financial-regression.sql`, `financial-safety.sql`, `provider-receipt.cjs`, `concurrency.cjs`. Rollback unificado: `rollback-financial.sql`; proveedores apagados, evidencia conservada.
