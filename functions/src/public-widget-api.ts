import {createHash} from "node:crypto";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {resolveInstallation} from "./widget-installation.js";
import {allowedBrowserOrigin,minuteBucket,validInstallationId,validVisitorQuestion} from "./widget-security.js";
import {DEFAULT_PLANS,evaluateAccess} from "./entitlements.js";
import type {BillingState,PlanId} from "./entitlements.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
const responseHeaders={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
/** Gate public widget requests without making paid model calls or returning private passages. */
export const publicWidgetChat=onRequest({region:"asia-south1",timeoutSeconds:15,maxInstances:3,invoker:"public"},async(req,res)=>{
 res.set(responseHeaders);
 if(req.method==="OPTIONS"){res.status(403).json({error:"Widget preflight is not enabled"});return;}\n if(req.method!=="POST"){res.set("Allow","POST");res.status(405).json({error:"Method not allowed"});return;}
 if(!req.is("application/json")){res.status(415).json({error:"JSON required"});return;}
 const {installationId,question}=req.body||{};
 if(!validInstallationId(installationId)||!validVisitorQuestion(question)){res.status(400).json({error:"Invalid request"});return;}
 try{
  const {uid,site}=await resolveInstallation(installationId);
  // CORS is a browser restriction, not a substitute for rate limiting or tenant isolation.
  const origin=req.get("origin");
  if(!allowedBrowserOrigin(origin,site.get("url"))){res.status(403).json({error:"Unapproved website origin"});return;}
  res.set("Access-Control-Allow-Origin",origin!);
  res.set("Vary","Origin");
  // Public access remains OFF until the owner explicitly publishes the verified website.
  if(site.get("widgetPublished")!==true){res.status(403).json({error:"Widget is not published"});return;}
  const customer=await db.doc(`customers/${uid}`).get();
  const created=customer.get("createdAt") as Timestamp|undefined;
  if(!created){res.status(403).json({error:"Subscription unavailable"});return;}
  const subscription=(await db.doc(`privateBilling/${uid}`).get()).data();
  const planId:PlanId=subscription?.planId==="self"||subscription?.planId==="pro"?subscription.planId:"managed";
  const billing:BillingState={status:subscription?.status==="active"?"active":subscription?.status==="trial"?"trial":"expired",planId,trialEndMs:created.toMillis()+7*86400000,periodEndMs:subscription?.periodEnd?.toMillis?.(),brandingEnabled:false};
  const period=new Date().toISOString().slice(0,7);
  const usageRef=db.doc(`usage/${uid}/months/${period}`);
  const ip=String(req.ip||"unknown");
  const ipHash=createHash("sha256").update(ip).digest("hex");
  const bucket=minuteBucket(Date.now());
  const limitRef=db.doc(`widgetRateLimits/${installationId}/windows/${bucket}_${ipHash}`);
  await db.runTransaction(async tx=>{
   const [usage,rate]=await Promise.all([tx.get(usageRef),tx.get(limitRef)]);
   const decision=evaluateAccess(billing,DEFAULT_PLANS[planId],Date.now(),Number(usage.get("responses")||0));
   if(!decision.allowed)throw Error("quota");
   if(Number(rate.get("count")||0)>=5)throw Error("rate");
   tx.set(limitRef,{count:FieldValue.increment(1),expiresAt:Timestamp.fromMillis(Date.now()+3600000)},{merge:true});
   // Do not charge a response unit for this placeholder; no AI answer is generated.
  });
  res.status(200).json({answer:"This website assistant is not accepting AI questions yet. Please contact the website directly.",ready:false});
 }catch(error){
  if(error instanceof Error&&error.message==="rate"){res.status(429).json({error:"Too many requests; retry shortly"});return;}
  if(error instanceof Error&&error.message==="quota"){res.status(403).json({error:"Subscription inactive or quota exhausted"});return;}
  // Avoid exposing Firestore paths, tenant identifiers or internal errors.
  res.status(403).json({error:"Widget unavailable"});
 }
});
