import {PLANS} from '../../supabase/functions/_shared/billing-test-contract.mjs';
export const OWNER='11111111-1111-4111-8111-111111111111', OTHER='22222222-2222-4222-8222-222222222222';
export const ATTEMPT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const NOW=1800000100000;
export const copy=x=>structuredClone(x);
export const list=data=>({object:'list',has_more:false,data});
export function fixture(plan='basic'){
  const p=PLANS[plan], price={id:p.price,object:'price',active:true,livemode:false,product:p.product,currency:'eur',unit_amount:p.cents,
    type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',tax_behavior:'unspecified'};
  const s={id:'sub_Synthetic',object:'subscription',livemode:false,customer:'cus_Synthetic',collection_method:'charge_automatically',status:'active',
    cancel_at_period_end:false,items:list([{price:p.price,quantity:1}])};
  const inv={id:'in_Synthetic',object:'invoice',livemode:false,customer:s.customer,billing_reason:'subscription_create',parent:{subscription_details:{subscription:s.id}},status:'paid',
    currency:'eur',amount_paid:p.cents,amount_due:p.cents,amount_remaining:0,status_transitions:{paid_at:1800000001},
    lines:list([{parent:{type:'subscription_item_details',subscription_item_details:{subscription:s.id,proration:false}},quantity:1,amount:p.cents,
      currency:'eur',pricing:{price_details:{price:p.price}},period:{start:1800000000,end:1802592000}}]),
    payments:list([{invoice:'in_Synthetic',livemode:false,status:'paid',amount_paid:p.cents,currency:'eur',payment:{type:'payment_intent',payment_intent:'pi_Synthetic'}}])};
  const pi={id:'pi_Synthetic',object:'payment_intent',livemode:false,customer:s.customer,status:'succeeded',currency:'eur',amount:p.cents,amount_received:p.cents,latest_charge:'ch_Synthetic'};
  const ch={id:'ch_Synthetic',object:'charge',livemode:false,payment_intent:pi.id,customer:s.customer,currency:'eur',amount:p.cents,amount_refunded:0,
    status:'succeeded',paid:true,captured:true,disputed:false};
  const session={id:'cs_test_Synthetic',object:'checkout.session',livemode:false,customer:s.customer,mode:'subscription',client_reference_id:ATTEMPT,
    metadata:{simple_attempt:ATTEMPT},subscription:s.id,invoice:inv.id,status:'complete',payment_status:'paid',
    currency:'eur',amount_subtotal:p.cents,amount_total:p.cents,total_details:{amount_discount:0,amount_tax:0,amount_shipping:0},
    automatic_tax:{enabled:false},managed_payments:{enabled:false},
    line_items:list([{price:p.price,quantity:1,currency:'eur',amount_subtotal:p.cents,amount_total:p.cents}])};
  return {plan,price,prices:{[p.price]:price},s,inv,pi,ch,session};
}
