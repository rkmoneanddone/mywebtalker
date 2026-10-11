import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
import {getConfiguredPlan} from "./plan-config.js";
import type {PlanId} from "./entitlements.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
export const registerWebsite=onCall({region:"asia-south1"},async request=>{
 const uid=request.auth?.uid;
 if(!uid||request.auth?.token.email_verified!==true)throw new HttpsError("unauthenticated","Verified login required");
 const url=request.data?.url;
 if(typeof url!=="string"||url.length>255||!/^https:\/\/[a-zA-Z0-9.-]+$/.test(url))throw new HttpsError("invalid-argument","Enter a public HTTPS domain");
 const host=url.slice(8).toLowerCase();
 if(!host.includes(".")||host==="localhost"||host.endsWith(".local")||host.endsWith(".localhost")||/^(10|127|169\.254|192\.168)\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host))throw new HttpsError("invalid-argument","Public domain required");
 const customerRef=db.doc(`customers/${uid}`);
 const billingRef=db.doc(`privateBilling/${uid}`);
 const [customer,billing]=await Promise.all([customerRef.get(),billingRef.get()]);
 const created=customer.get("createdAt") as Timestamp|undefined;
 if(!created)throw new HttpsError("failed-precondition","Customer profile missing");
 const data=billing.data();
 const planId:PlanId=data?.planId==="self"||data?.planId==="pro"?data.planId:"managed";
 const plan=await getConfiguredPlan(planId);
 const now=Date.now();
 const active=data?.status==="active"&&data.periodEnd?.toMillis?.()>now;
 const trial=(data?.status===undefined||data?.status==="trial")&&created.toMillis()+7*86400000>now;
 if(!plan.enabled||!(active||trial))throw new HttpsError("permission-denied","Active trial or subscription required");
 const websites=db.collection(`customers/${uid}/websites`);
 const siteRef=websites.doc();
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(customerRef);
  const count=Number(fresh.get("websiteCount")||0);
  // Legacy accounts may lack a counter; do not silently bypass limits.
  if(!Number.isSafeInteger(count)||count<0)throw new HttpsError("failed-precondition","Invalid website count");
  if(fresh.get("websiteCount")===undefined){
   const existing=await tx.get(websites.limit(plan.websites+1));
   if(existing.size>=plan.websites)throw new HttpsError("resource-exhausted","Website limit reached");
   if(existing.docs.some(d=>d.get("url")===url))throw new HttpsError("already-exists","Website already registered");
   tx.update(customerRef,{websiteCount:existing.size+1});
  }else{
   if(count>=plan.websites)throw new HttpsError("resource-exhausted","Website limit reached");
   tx.update(customerRef,{websiteCount:FieldValue.increment(1)});
  }
  tx.create(siteRef,{url,status:"pending",createdAt:FieldValue.serverTimestamp()});
 });
 return {websiteId:siteRef.id,url};
});
