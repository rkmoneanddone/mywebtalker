import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {getConfiguredPlan} from "./plan-config.js";
import type {PlanId} from "./entitlements.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
/** Reserve one AI-generation slot in the same monthly usage document as total responses. */
export async function reservePlanAiResponse(uid:string):Promise<string>{
 const billing=await db.doc("privateBilling/"+uid).get();
 const id=billing.get("planId");
 const planId:PlanId=id==="self"||id==="pro"?id:"managed";
 const plan=await getConfiguredPlan(planId);
 const month=new Date().toISOString().slice(0,7);
 const ref=db.doc("usage/"+uid+"/months/"+month);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(Number(snap.get("aiResponses")||0)>=plan.aiResponsesPerMonth)throw Error("Monthly AI response allowance exhausted");
  tx.set(ref,{aiResponses:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()},{merge:true});
 });
 return month;
}
export async function releasePlanAiResponse(uid:string,month:string):Promise<void>{
 await db.doc("usage/"+uid+"/months/"+month).update({aiResponses:FieldValue.increment(-1)});
}
