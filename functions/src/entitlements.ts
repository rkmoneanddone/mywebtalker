export type PlanId="self"|"managed"|"pro";
export type SubscriptionStatus="trial"|"active"|"past_due"|"cancelled"|"expired";
export type Currency="INR"|"USD";
export interface Plan {
 id:PlanId; name:string; inrMinor:number; usdMinor:number;
 responsesPerMonth:number; websites:number; knowledgePages:number; managed:boolean;
 enabled:boolean;
}
export interface BillingState {
 status:SubscriptionStatus; planId:PlanId; periodEndMs?:number;
 trialEndMs:number; brandingEnabled:boolean; provider?:string;
 providerSubscriptionId?:string;
}
export interface AccessDecision {
 allowed:boolean; reason:"trial"|"paid"|"expired"|"disabled"|"quota";
 plan:Plan; remainingResponses:number;
}
export const DEFAULT_PLANS:Record<PlanId,Plan>={
 self:{id:"self",name:"Self Hosted",inrMinor:49900,usdMinor:500,responsesPerMonth:300,websites:1,knowledgePages:100,managed:false,enabled:true},
 managed:{id:"managed",name:"Managed",inrMinor:89900,usdMinor:1100,responsesPerMonth:500,websites:1,knowledgePages:250,managed:true,enabled:true},
 pro:{id:"pro",name:"Managed Pro",inrMinor:219900,usdMinor:2200,responsesPerMonth:2000,websites:3,knowledgePages:1000,managed:true,enabled:true}
};
/** Return a pure, auditable entitlement decision; payment data must come from trusted server state. */
export function evaluateAccess(billing:BillingState,plan:Plan,nowMs:number,used:number):AccessDecision{
 const paid=billing.status==="active" && typeof billing.periodEndMs==="number" && billing.periodEndMs>nowMs;
 const trial=billing.status==="trial" && billing.trialEndMs>nowMs;
 const reason=!plan.enabled?"disabled":!(paid||trial)?"expired":used>=plan.responsesPerMonth?"quota":paid?"paid":"trial";
 return {allowed:plan.enabled&&(paid||trial)&&used<plan.responsesPerMonth,reason,plan,remainingResponses:Math.max(0,plan.responsesPerMonth-used)};
}
/** Determine whether a subscription event may extend access; only backend adapters call this. */
export function paidStateFromVerifiedEvent(planId:PlanId,periodEndMs:number,provider:string,providerSubscriptionId:string):BillingState{
 if(!Number.isFinite(periodEndMs)||periodEndMs<=Date.now())throw Error("Invalid paid period");
 if(!provider||!providerSubscriptionId)throw Error("Missing verified provider reference");
 return {status:"active",planId,periodEndMs,trialEndMs:0,brandingEnabled:false,provider,providerSubscriptionId};
}
