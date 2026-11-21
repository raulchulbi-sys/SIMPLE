// Display only. No URL input and no entitlement writes.
export function accessMessage(access) {
  if (!access || access.environment !== 'STRIPE_TEST' || access.aiQuotaChanged !== false)
    throw Error('No se pudo verificar el estado de esta cuenta.');
  if (access.state === 'active') {
    if (!['basic','premium'].includes(access.plan) || !Number.isFinite(Date.parse(access.paidUntil)))
      throw Error('El estado recibido está incompleto.');
    return { title: `SIMPLE ${access.plan === 'basic' ? 'Basic' : 'Premium'} activo`,
      detail: `Periodo pagado hasta ${new Date(access.paidUntil).toLocaleString('es-ES')}.` };
  }
  if (access.plan !== null) throw Error('El estado recibido es inconsistente.');
  if (access.state === 'inactive') return {title:'Todavía no consta una suscripción activa',detail:'Si acabas de pagar, espera unos segundos y actualiza el estado. No repitas la compra.'};
  if (access.state === 'review_required') return {title:'Estado pendiente de revisión',detail:'No repitas la compra. Conserva tu confirmación de pago y solicita revisión.'};
  if (access.state === 'expired_or_revoked') return {title:'Sin periodo activo',detail:'Consulta el estado de tu suscripción antes de realizar otra operación.'};
  throw Error('No se pudo verificar el estado de esta cuenta.');
}
