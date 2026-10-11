import {createHash} from "node:crypto";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {resolveInstallation} from "./widget-installation.js";
import {allowedBrowserOrigin,validInstallationId,minuteBucket} from "./widget-security.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
export const captureVisitorLead=onRequest({region:"asia-south1",maxInstances:3,concurrency:10,invoker:"public"},async(req,res)=>{
 res.set({"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
 if(req.method==="OPTIONS"){
  try{
   const id=req.query.installationId;
   if(!validInstallationId(id))throw Error("Invalid installation");
   const result=await resolveInstallation(id);
   const origin=req.get("origin");
   if(!allowedBrowserOrigin(origin,result.site.get("url"))||result.site.get("widgetPublished")!==true)throw Error("Invalid origin");
   res.set("Access-Control-Allow-Origin",origin!);
   res.set("Vary","Origin");
   res.set("Access-Control-Allow-Methods","POST");
   res.set("Access-Control-Allow-Headers","Content-Type");
   res.status(204).end();
  }catch{res.status(403).end();}
  return;
 }
 if(req.method!=="POST"){res.status(405).json({error:"POST required"});return;}
 if(!req.is("application/json")||Number(req.get("content-length")||0)>2048){res.status(400).json({error:"Invalid request"});return;}
 const p=req.body;
 if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).some(k=>!["installationId","name","email","mobile"].includes(k))||!validInstallationId(p.installationId)){res.status(400).json({error:"Invalid request"});return;}
 const name=typeof p.name==="string"?p.name.trim():"";
 const email=typeof p.email==="string"?p.email.trim().toLowerCase():"";
 const mobile=typeof p.mobile==="string"?p.mobile.trim():"";
 if(name.length<2||name.length>100||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||!/^\+?[1-9]\d{7,14}$/.test(mobile)){res.status(400).json({error:"Enter a valid name, email and mobile number"});return;}
 try{
  const {uid,websiteId,site}=await resolveInstallation(p.installationId);
  const origin=req.get("origin");
  if(!allowedBrowserOrigin(origin,site.get("url"))||site.get("widgetPublished")!==true){res.status(403).json({error:"Widget unavailable"});return;}
  res.set("Access-Control-Allow-Origin",origin!);
  res.set("Vary","Origin");
  const hash=createHash("sha256").update(String(req.ip||"unknown")).digest("hex");
  const limit=db.doc("leadRateLimits/"+p.installationId+"/windows/"+minuteBucket(Date.now())+"_"+hash);
  await db.runTransaction(async tx=>{
   const snapshot=await tx.get(limit);
   if(Number(snapshot.get("count")||0)>=3)throw Error("rate");
   tx.set(limit,{count:FieldValue.increment(1),expiresAt:Timestamp.fromMillis(Date.now()+3600000)},{merge:true});
  });
  await db.collection("customers/"+uid+"/websites/"+websiteId+"/leads").add({name,email,mobile,createdAt:FieldValue.serverTimestamp(),source:"widget"});
  res.status(200).json({saved:true});
 }catch(error){res.status(error instanceof Error&&error.message==="rate"?429:403).json({error:"Lead capture unavailable"});}
});
