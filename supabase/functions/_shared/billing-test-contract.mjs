// TEST-only adapter. Paid-period semantics follow the existing billing offline contract.
export const PROJECT = 'dmqjexigdnfzobarhnib';
export const ACCOUNT = 'acct_1UWwZP6soMMQB8IR';
export const API_VERSION = '2026-09-30.endive';
export const PLANS = Object.freeze({
  basic: Object.freeze({ price: 'price_1UWx9n6soMMQB8IRZp5nTwsE', product: 'prod_VY3GVLWgZ4MJFv', cents: 499 }),
  premium: Object.freeze({ price: 'price_1UWx9v6soMMQB8IRLixagQc6', product: 'prod_VY3GE7MJ9zTRXn', cents: 1299 }),
});
export const EVENTS = new Set(['checkout.session.completed', 'checkout.session.expired',
  'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  'invoice.paid', 'invoice.payment_failed', 'customer.subscription.created',
  'customer.subscription.updated', 'customer.subscription.deleted', 'charge.refunded',
  'charge.dispute.created', 'charge.dispute.closed']);
export function ensure(ok, code) { if (!ok) throw new Error(code); }
export const id = x => typeof x === 'string' ? x : x?.id;
export function testObject(x, kind) {
  ensure(x?.object === kind && x.livemode === false && typeof x.id === 'string', 'billing_test_object_required');
  return x;
}
export function planForPrice(p) {
  testObject(p, 'price');
  const plan = Object.keys(PLANS).find(k => PLANS[k].price === p.id);
  ensure(plan && p.active === true && id(p.product) === PLANS[plan].product && p.currency === 'eur'
    && p.unit_amount === PLANS[plan].cents && p.type === 'recurring'
    && p.recurring?.interval === 'month' && p.recurring.interval_count === 1
    && p.recurring.usage_type === 'licensed' && p.billing_scheme === 'per_unit'
    && !p.transform_quantity && p.tax_behavior === 'unspecified', 'billing_catalog_mismatch');
  return plan;
}
export function checkoutInput(body) {
  ensure(body && Object.keys(body).length === 1 && Object.keys(PLANS).includes(body.plan), 'billing_plan_required');
  return body.plan;
}
export function listComplete(list) {
  ensure(list?.object === 'list' && list.has_more === false && Array.isArray(list.data), 'billing_incomplete_list');
  return list.data;
}
export function subscription(s, customer, prices) {
  testObject(s, 'subscription');
  ensure(id(s.customer) === customer && s.collection_method === 'charge_automatically'
    && ['active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','trialing'].includes(s.status), 'billing_subscription_mismatch');
  const items = listComplete(s.items);
  ensure(items.length === 1 && items[0].quantity === 1 && !s.trial_end && !s.pause_collection
    && !s.schedule && !s.pending_update && !(s.discounts?.length), 'billing_unsupported_subscription');
  const plan = planForPrice(prices[id(items[0].price)]);
  return { subscription_id: s.id, plan, status: s.status, cancel_at_period_end: s.cancel_at_period_end === true };
}
export function paidInvoice(inv, sub, customer, prices, payment, charge) {
  testObject(inv, 'invoice');
  ensure(id(inv.customer) === customer && id(inv.parent?.subscription_details?.subscription) === sub.subscription_id,
    'billing_invoice_binding');
  if (inv.status !== 'paid') return null;
  const lines = listComplete(inv.lines);
  ensure(lines.length === 1, 'billing_unsupported_invoice');
  const l = lines[0], plan = planForPrice(prices[id(l.pricing?.price_details?.price)]), cents = PLANS[plan].cents;
  ensure(plan === sub.plan && l.parent?.type === 'subscription_item_details'
    && id(l.parent.subscription_item_details.subscription) === sub.subscription_id
    && l.parent.subscription_item_details.proration === false && l.quantity === 1
    && l.amount === cents && inv.currency === 'eur' && l.currency === 'eur'
    && inv.amount_paid === cents && inv.amount_due === cents && inv.amount_remaining === 0
    && !inv.paid_out_of_band && !(inv.amount_paid_out_of_band > 0)
    && !(inv.total_discount_amounts?.length) && !(inv.total_taxes?.some(t => t.amount !== 0))
    && inv.automatic_tax?.enabled !== true, 'billing_unverified_invoice_amount');
  const links = listComplete(inv.payments);
  ensure(links.length === 1 && links[0].status === 'paid' && links[0].amount_paid === cents
    && links[0].currency === 'eur' && links[0].livemode === false && id(links[0].invoice) === inv.id
    && links[0].payment?.type === 'payment_intent' && id(links[0].payment.payment_intent) === payment?.id,
    'billing_payment_link');
  testObject(payment, 'payment_intent'); testObject(charge, 'charge');
  ensure(payment.status === 'succeeded' && id(payment.customer) === customer && payment.currency === 'eur'
    && payment.amount_received === cents && payment.amount === cents && id(payment.latest_charge) === charge.id
    && id(charge.payment_intent) === payment.id && id(charge.customer) === customer
    && charge.paid === true && charge.captured === true && charge.status === 'succeeded'
    && charge.currency === 'eur' && charge.amount === cents
    && Number.isSafeInteger(charge.amount_refunded) && charge.amount_refunded >= 0 && charge.amount_refunded <= cents,
    'billing_payment_unverified');
  const start = l.period?.start, end = l.period?.end, paid = inv.status_transitions?.paid_at;
  ensure([start,end,paid].every(n => Number.isSafeInteger(n) && n > 0)
    && end > start && end - start >= 27*86400 && end - start <= 32*86400, 'billing_period_invalid');
  return { invoice_id: inv.id, subscription_id: sub.subscription_id, plan, amount: cents,
    period_start: start, period_end: end, paid_at: paid, payment_intent: payment.id,
    charge_id: charge.id, refunded: charge.amount_refunded, disputed: charge.disputed === true };
}
export function projection(invoices, { hold = false, now = Date.now()/1000 } = {}) {
  const selected = invoices.filter(i => i.period_start <= now).sort((a,b) => b.period_start-a.period_start || b.paid_at-a.paid_at)[0];
  const active = !hold && selected && now < selected.period_end && !selected.disputed && selected.refunded < selected.amount;
  return { plan: active ? selected.plan : null, state: hold ? 'review_required' : active ? 'active' : selected ? 'expired_or_revoked' : 'inactive' };
}
