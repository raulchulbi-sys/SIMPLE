import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, checkoutInput, planForPrice, subscription, paidInvoice, projection, listComplete } from '../../supabase/functions/_shared/billing-test-contract.mjs';
const list=data=>({object:'list',has_more:false,data});
export function fixture(plan='basic'){
  const p=PLANS[plan], price={id:p.price,object:'price',active:true,livemode:false,product:p.product,currency:'eur',unit_amount:p.cents,
    type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',tax_behavior:'unspecified'};
  const s={id:'sub_test',object:'subscription',livemode:false,customer:'cus_test',collection_method:'charge_automatically',status:'active',
    cancel_at_period_end:false,items:list([{price:p.price,quantity:1}])};
  const inv={id:'in_test',object:'invoice',livemode:false,customer:'cus_test',parent:{subscription_details:{subscription:s.id}},status:'paid',
    currency:'eur',amount_paid:p.cents,amount_due:p.cents,amount_remaining:0,status_transitions:{paid_at:1800000001},
    lines:list([{parent:{type:'subscription_item_details',subscription_item_details:{subscription:s.id,proration:false}},quantity:1,amount:p.cents,
      currency:'eur',pricing:{price_details:{price:p.price}},period:{start:1800000000,end:1802592000}}]),
    payments:list([{invoice:'in_test',livemode:false,status:'paid',amount_paid:p.cents,currency:'eur',payment:{type:'payment_intent',payment_intent:'pi_test'}}])};
  const pi={id:'pi_test',object:'payment_intent',livemode:false,customer:'cus_test',status:'succeeded',currency:'eur',amount:p.cents,amount_received:p.cents,latest_charge:'ch_test'};
  const ch={id:'ch_test',object:'charge',livemode:false,payment_intent:'pi_test',customer:'cus_test',currency:'eur',amount:p.cents,amount_refunded:0,
    status:'succeeded',paid:true,captured:true,disputed:false};
  return {price,prices:{[p.price]:price},s,inv,pi,ch};
}
const normalize=f=>paidInvoice(f.inv,subscription(f.s,'cus_test',f.prices),'cus_test',f.prices,f.pi,f.ch);
for(const plan of ['basic','premium'])test('verified TEST graph '+plan,()=>{
  const f=fixture(plan); assert.equal(checkoutInput({plan}),plan); assert.equal(normalize(f).amount,PLANS[plan].cents);
});
for(const body of [{plan:'live'},{plan:'basic',price:PLANS.premium.price},{plan:'basic',user:'other'},{plan:'basic',coupon:'free'},null])
  test('client fields fail closed '+JSON.stringify(body),()=>assert.throws(()=>checkoutInput(body)));
const badPrices={live:p=>p.livemode=true,currency:p=>p.currency='usd',amount:p=>p.unit_amount=1,product:p=>p.product='prod_other',
  interval:p=>p.recurring.interval='year',quantity:p=>p.transform_quantity={divide_by:2},tax:p=>p.tax_behavior='inclusive',archived:p=>p.active=false};
for(const [name,mutate] of Object.entries(badPrices))test('reject unexpected catalog '+name,()=>{const f=fixture();mutate(f.price);assert.throws(()=>planForPrice(f.price));});
const faults={
  'foreign subscription owner':f=>f.s.customer='cus_other', 'second item':f=>f.s.items.data.push(f.s.items.data[0]),
  'quantity':f=>f.s.items.data[0].quantity=2,'trial':f=>f.s.trial_end=1800000000,
  'pause':f=>f.s.pause_collection={},'schedule':f=>f.s.schedule='sub_sched_test',
  'foreign invoice owner':f=>f.inv.customer='cus_other','foreign invoice subscription':f=>f.inv.parent.subscription_details.subscription='sub_other',
  'invoice live':f=>f.inv.livemode=true,'out of band':f=>f.inv.amount_paid_out_of_band=499,
  'credit/free invoice':f=>f.inv.amount_paid=0,'tax':f=>f.inv.total_taxes=[{amount:10}],
  'discount':f=>f.inv.total_discount_amounts=[{amount:10}],'proration':f=>f.inv.lines.data[0].parent.subscription_item_details.proration=true,
  'another price':f=>f.inv.lines.data[0].pricing.price_details.price='price_unknown',
  'missing line':f=>f.inv.lines.data=[], 'partial pagination':f=>f.inv.lines.has_more=true,
  'unpaid payment':f=>f.inv.payments.data[0].status='open','other payment owner':f=>f.pi.customer='cus_other',
  'failed PI':f=>f.pi.status='requires_payment_method','live PI':f=>f.pi.livemode=true,
  'wrong charge':f=>f.ch.payment_intent='pi_other','uncaptured':f=>f.ch.captured=false,'unpaid charge':f=>f.ch.paid=false,
  'invalid period':f=>f.inv.lines.data[0].period.end=1800000001,'refund overflow':f=>f.ch.amount_refunded=500,
};
for(const [name,mutate] of Object.entries(faults))test('receipt rejects '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>normalize(f));});
test('unpaid renewal cannot create a paid period',()=>{const f=fixture();f.inv.status='open';assert.equal(normalize(f),null);});
test('bounded complete provider lists',()=>assert.throws(()=>listComplete({object:'list',has_more:true,data:[]})));
test('cancel at period end retains paid time and expires at boundary',()=>{
  const f=fixture();f.s.cancel_at_period_end=true;const i=normalize(f);
  assert.equal(projection([i],{now:i.period_end-1}).plan,'basic');assert.equal(projection([i],{now:i.period_end}).plan,null);
});
test('failed renewal retains only already paid time',()=>{
  const f=fixture();f.s.status='past_due';const i=normalize(f);assert.equal(projection([i],{now:i.period_end-1}).plan,'basic');
});
test('fully refunded source cannot revive an older plan',()=>{
  const b=normalize(fixture()),p=normalize(fixture('premium'));p.period_start+=100;p.refunded=p.amount;
  assert.equal(projection([b,p],{now:p.period_start+1}).plan,null);
});
test('dispute and reconciliation hold revoke billing access without touching training',()=>{
  const i=normalize(fixture());assert.equal(projection([i],{now:i.period_start+1,hold:true}).plan,null);
  i.disputed=true;assert.equal(projection([i],{now:i.period_start+1}).plan,null);
});
test('partial refund retains remainder policy',()=>{
  const f=fixture();f.ch.amount_refunded=100;const i=normalize(f);assert.equal(projection([i],{now:i.period_start+1}).plan,'basic');
});
