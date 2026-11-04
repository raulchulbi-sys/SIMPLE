import { ensure, id, testObject, listComplete, planForPrice, PLANS } from './billing-test-contract.mjs';

// Input is freshly retrieved from Stripe, never the webhook body or the browser.
// This proof does not grant access. The existing paid-invoice contract does that.
export function completedCheckout(session, customer, subs, invoices, initialInvoiceIds, prices) {
  testObject(session, 'checkout.session');
  ensure(/^cs_test_[A-Za-z0-9]+$/.test(session.id)
    && id(session.customer) === customer && session.mode === 'subscription', 'billing_checkout_binding');
  ensure(['open','complete','expired'].includes(session.status)
    && ['paid','unpaid','no_payment_required'].includes(session.payment_status), 'billing_checkout_state_invalid');
  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    // Fail closed if two fresh provider responses contradict each other.
    ensure(!invoices.some(i => i.invoice_id === id(session.invoice)), 'billing_checkout_payment_inconsistent');
    return null;
  }
  const attempt = session.client_reference_id;
  ensure(typeof attempt === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(attempt)
    && session.metadata?.simple_attempt === attempt, 'billing_checkout_attempt_invalid');
  const sub = subs.find(s => s.subscription_id === id(session.subscription));
  const invoice = invoices.find(i => i.invoice_id === id(session.invoice));
  ensure(sub && invoice && invoice.subscription_id === sub.subscription_id
    && invoice.plan === sub.plan && initialInvoiceIds.has(invoice.invoice_id), 'billing_checkout_paid_invoice_required');
  const lines = listComplete(session.line_items);
  ensure(lines.length === 1, 'billing_checkout_items_invalid');
  const line = lines[0], plan = planForPrice(prices[id(line.price)]), cents = PLANS[plan].cents;
  ensure(plan === sub.plan && line.quantity === 1 && line.currency === 'eur'
    && line.amount_subtotal === cents && line.amount_total === cents
    && session.currency === 'eur' && session.amount_subtotal === cents && session.amount_total === cents
    && session.total_details?.amount_discount === 0 && session.total_details?.amount_tax === 0
    && session.total_details?.amount_shipping === 0
    && session.automatic_tax?.enabled === false && session.managed_payments?.enabled === false,
    'billing_checkout_amount_invalid');
  return { id: attempt, session_id: session.id, customer_id: customer, plan,
    subscription_id: sub.subscription_id, invoice_id: invoice.invoice_id,
    status: 'complete', payment_status: 'paid' };
}
