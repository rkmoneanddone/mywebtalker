import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
import {onRequest} from "firebase-functions/v2/https";
import {DEFAULT_PLANS,evaluateAccess} from "./entitlements.js";
import type {Plan,PlanId,BillingState} from "./entitlements.js";

if(!getApps().length)initializeApp();
const store=getFirestore();
const region="asia-south1";
const validPlanIds:PlanId[]=["self","managed","pro"];

/** Require a verified Google/Firebase identity before handling customer data. */
function requireUid(auth:{uid:string;token:{email_verified?:boolean}}|undefined):string{
 if(!auth?.uid||auth.token.email_verified!==true)throw new HttpsError("unauthenticated","Verified sign-in required");
 return auth.uid;
}
/** Restrict admin changes to a Firebase custom claim granted outside the browser. */
function requireAdmin(auth:{token:{admin?:boolean}}|undefined):void{
 if(auth?.token.admin!==true)throw new HttpsError("permission-denied","Admin access required");
}
/** Validate a plan document from trusted Firestore config before using its quotas. */
function asPlan(value:unknown,id:PlanId):Plan{
 const fallback=DEFAULT_PLANS[id];
 if(!value||typeof value!=="object")return fallback;
 const p=value as Partial<Plan>;
 if(p.id!==id||!Number.isSafeInteger(p.inrMinor)||!Number.isSafeInteger(p.usdMinor)||!Number.isSafeInteger(p.responsesPerMonth)||!Number.isSafeInteger(p.websites)||!Number.isSafeInteger(p.knowledgePages)||p.inrMinor<0||p.usdMinor<0||p.responsesPerMonth<1||p.websites<1||p.knowledgePages<1||typeof p.enabled!=="boolean"||typeof p.managed!=="boolean"||typeof p.name!=="string")return fallback;
 return {...fallback,...p};
}
/** Read server-controlled plans; no frontend price can affect checkout or access. */
async function getPlan(id:PlanId):Promise<Plan>{
 const snap=await store.doc(`publicConfig/plans/entries/${id}`).get();
 return asPlan(snap.data(),id);
}
/** Create a customer once; transaction ensures concurrent first logins share one trial. */
export const ensureCustomer=onCall({region,enforceAppCheck:false},async request=>{
 const uid=requireUid(request.auth);
 const ref=store.doc(`customers/${uid}`);
 await store.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(snap.exists)return;
  tx.create(ref,{email:request.auth?.token.email||"",createdAt:FieldValue.serverTimestamp(),settings:{companyName:"Your Company",botName:"Your AI Assistant",color:"#6d5efc",position:"bottom-right"}});
 });
 return {ok:true};
});
/** Return public prices and quotas, cached by clients; prices remain configurable in Firestore. */
export const listPlans=onCall({region},async()=>{
 const plans=await Promise.all(validPlanIds.map(getPlan));
 return {plans,branding:{inrMinor:49900,usdMinor:700,enabled:false,frequency:"unconfigured"},checkoutEnabled:false};
});
/** Evaluate server-side trial and subscription state without accepting a client-paid flag. */
export const getMyEntitlements=onCall({region},async request=>{
 const uid=requireUid(request.auth);
 const customer=await store.doc(`customers/${uid}`).get();
 if(!customer.exists)throw new HttpsError("failed-precondition","Customer profile missing");
 const created=customer.get("createdAt") as Timestamp|undefined;
 if(!created)throw new HttpsError("failed-precondition","Trial timestamp unavailable");
 const billingSnap=await store.doc(`privateBilling/${uid}`).get();
 const data=billingSnap.data();
 const billing:BillingState=data?{
  status:data.status==="active"?"active":data.status==="trial"?"trial":data.status==="past_due"?"past_due":data.status==="cancelled"?"cancelled":"expired",
  planId:validPlanIds.includes(data.planId)?data.planId:"managed",
  trialEndMs:created.toMillis()+7*86400000,
  periodEndMs:data.periodEnd?.toMillis?.(),
  brandingEnabled:data.brandingEnabled===true
 }:{status:"trial",planId:"managed",trialEndMs:created.toMillis()+7*86400000,brandingEnabled:false};
 const plan=await getPlan(billing.planId);
 const period=new Date().toISOString().slice(0,7);
 const usage=await store.doc(`usage/${uid}/months/${period}`).get();
 const used=Number(usage.get("responses")||0);
 return {access:evaluateAccess(billing,plan,Date.now(),used),trialEndMs:billing.trialEndMs,subscriptionStatus:billing.status,brandingEnabled:billing.brandingEnabled};
});
/** Permit an admin to update validated public plan configuration without deploying frontend code. */
export const adminUpdatePlan=onCall({region},async request=>{
 requireAdmin(request.auth);
 const data=request.data as Plan;
 if(!data||!validPlanIds.includes(data.id))throw new HttpsError("invalid-argument","Unknown plan");
 const plan=asPlan(data,data.id);
 if(JSON.stringify(plan)!==JSON.stringify(data))throw new HttpsError("invalid-argument","Invalid plan configuration");
 await store.doc(`publicConfig/plans/entries/${data.id}`).set(plan);
 return {ok:true};
});
/** Reject checkout until a payment provider is configured; never grant paid access from a browser request. */
export const createCheckout=onCall({region},async request=>{
 requireUid(request.auth);
 throw new HttpsError("failed-precondition","Payment provider not configured. No charge was made.");
});
/** Payment webhook endpoint intentionally refuses requests until signature verification is implemented. */
export const paymentWebhook=onRequest({region},(_request,response)=>{
 response.status(503).send("Payment provider not configured");
});
