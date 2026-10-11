import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {initializeApp,getApps} from "firebase-admin/app";
import {onCall,HttpsError} from "firebase-functions/v2/https";
import {extractKnowledge,rankPassages,searchTerms,MAX_KNOWLEDGE_BYTES} from "./knowledge.js";
import {DEFAULT_PLANS,evaluateAccess} from "./entitlements.js";
import type {BillingState,PlanId} from "./entitlements.js";

if(!getApps().length)initializeApp();
const db=getFirestore();
const region="asia-south1";
const MAX_DOCUMENTS=30;
const MAX_UPLOADS_PER_DAY=10;
const MAX_DAILY_BYTES=1024*1024;

/** Require a verified signed-in customer for every private knowledge operation. */
function customerId(request:{auth?:{uid:string;token:{email_verified?:boolean}}}):string{
 if(!request.auth?.uid||request.auth.token.email_verified!==true)throw new HttpsError("unauthenticated","Verified login required");
 return request.auth.uid;
}
/** Validate Firestore document identifiers to prevent path injection. */
function safeId(value:unknown):string{
 if(typeof value!=="string"||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw new HttpsError("invalid-argument","Invalid website or document ID");
 return value;
}
/** Check trial/paid access using server-owned timestamps and subscription records. */
async function requireKnowledgeAccess(uid:string):Promise<void>{
 const account=await db.doc(`customers/${uid}`).get();
 const created=account.get("createdAt") as Timestamp|undefined;
 if(!created)throw new HttpsError("failed-precondition","Customer profile is missing");
 const subscription=(await db.doc(`privateBilling/${uid}`).get()).data();
 const planId:PlanId=subscription?.planId==="self"||subscription?.planId==="pro"?subscription.planId:"managed";
 const billing:BillingState={
  status:subscription?.status==="active"?"active":subscription?.status==="expired"?"expired":subscription?.status==="past_due"?"past_due":subscription?.status==="cancelled"?"cancelled":"trial",
  planId,trialEndMs:created.toMillis()+7*86400000,
  periodEndMs:subscription?.periodEnd?.toMillis?.(),
  brandingEnabled:subscription?.brandingEnabled===true
 };
 const access=evaluateAccess(billing,DEFAULT_PLANS[planId],Date.now(),0);
 if(!access.allowed)throw new HttpsError("permission-denied","Trial or subscription is not active");
}
/** Accept a small document upload, extract all content and atomically publish its indexed passages. */
export const uploadKnowledge=onCall({region,memory:"1GiB",timeoutSeconds:120,maxInstances:5},async request=>{
 const uid=customerId(request);
 await requireKnowledgeAccess(uid);
 const websiteId=safeId(request.data?.websiteId);
 const filename=request.data?.filename;
 const base64=request.data?.base64;
 if(typeof filename!=="string"||typeof base64!=="string"||base64.length>Math.ceil(MAX_KNOWLEDGE_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new HttpsError("invalid-argument","Invalid upload");
 const website=await db.doc(`customers/${uid}/websites/${websiteId}`).get();
 if(!website.exists)throw new HttpsError("not-found","Website not registered");
 const collectionRef=db.collection(`customers/${uid}/websites/${websiteId}/knowledge`);
 const existing=await collectionRef.limit(MAX_DOCUMENTS).get();
 if(existing.size>=MAX_DOCUMENTS)throw new HttpsError("resource-exhausted","Document limit reached");
 let extracted;
 try{extracted=await extractKnowledge(filename,Buffer.from(base64,"base64"));}
 catch(error){throw new HttpsError("invalid-argument",error instanceof Error?error.message:"Invalid document");}
 if(extracted.chunks.length>450)throw new HttpsError("resource-exhausted","Too many chunks for one document");
 // Reserve daily upload allowance atomically before writing indexed text. No original file is persisted.
 const day=new Date().toISOString().slice(0,10);
 const uploadLimit=db.doc(`uploadLimits/${uid}/days/${day}`);
 const uploadedBytes=Buffer.byteLength(base64,"base64");
 await db.runTransaction(async tx=>{
  const snap=await tx.get(uploadLimit);
  if(Number(snap.get("count")||0)>=MAX_UPLOADS_PER_DAY||Number(snap.get("bytes")||0)+uploadedBytes>MAX_DAILY_BYTES)
   throw new HttpsError("resource-exhausted","Daily upload allowance reached");
  tx.set(uploadLimit,{count:FieldValue.increment(1),bytes:FieldValue.increment(uploadedBytes),updatedAt:FieldValue.serverTimestamp()},{merge:true});
 });
 const docRef=collectionRef.doc();
 // Firestore batches are capped at 500 writes; this upload is capped at 450 chunks.
 const batch=db.batch();
 batch.create(docRef,{filename:extracted.filename,type:extracted.type,characters:extracted.characters,chunkCount:extracted.chunks.length,createdAt:FieldValue.serverTimestamp()});
 extracted.chunks.forEach((text,index)=>{const chunkId=String(index).padStart(5,"0");batch.create(docRef.collection("chunks").doc(chunkId),{text,index});batch.create(db.doc(`customers/${uid}/websites/${websiteId}/knowledgeIndex/${docRef.id}_${chunkId}`),{sourceId:docRef.id,text,terms:searchTerms(text)});});
 try{await batch.commit();}catch(error){await uploadLimit.update({count:FieldValue.increment(-1),bytes:FieldValue.increment(-uploadedBytes)}).catch(()=>undefined);throw error;}
 return {id:docRef.id,filename:extracted.filename,characters:extracted.characters,chunks:extracted.chunks.length};
});
/** List a bounded catalogue of documents belonging to a registered website. */
export const listKnowledge=onCall({region},async request=>{
 const uid=customerId(request);
 const websiteId=safeId(request.data?.websiteId);
 const website=await db.doc(`customers/${uid}/websites/${websiteId}`).get();
 if(!website.exists)throw new HttpsError("not-found","Website not registered");
 const snap=await db.collection(`customers/${uid}/websites/${websiteId}/knowledge`).limit(MAX_DOCUMENTS).get();
 return {documents:snap.docs.map(doc=>({id:doc.id,...doc.data()}))};
});
/** Delete an uploaded document and its chunks in a bounded batch. */
export const deleteKnowledge=onCall({region},async request=>{
 const uid=customerId(request);
 const websiteId=safeId(request.data?.websiteId);
 const documentId=safeId(request.data?.documentId);
 const website=await db.doc(`customers/${uid}/websites/${websiteId}`).get();
 if(!website.exists)throw new HttpsError("not-found","Website not registered");
 const ref=db.doc(`customers/${uid}/websites/${websiteId}/knowledge/${documentId}`);
 const snap=await ref.get();
 if(!snap.exists)throw new HttpsError("not-found","Document not found");
 const chunks=await ref.collection("chunks").limit(451).get();
 if(chunks.size>450)throw new HttpsError("failed-precondition","Document requires administrative cleanup");
 const batch=db.batch();
 chunks.docs.forEach(d=>{batch.delete(d.ref);batch.delete(db.doc(`customers/${uid}/websites/${websiteId}/knowledgeIndex/${documentId}_${d.id}`));});
 batch.delete(ref);
 await batch.commit();
 return {ok:true};
});
/** Retrieve ranked knowledge excerpts privately; never expose arbitrary tenant data to visitors. */
export const searchKnowledge=onCall({region},async request=>{
 const uid=customerId(request);
 await requireKnowledgeAccess(uid);
 const websiteId=safeId(request.data?.websiteId);
 const question=request.data?.question;
 if(typeof question!=="string"||question.length<2||question.length>500)throw new HttpsError("invalid-argument","Question must be 2–500 characters");
 const website=await db.doc(`customers/${uid}/websites/${websiteId}`).get();
 if(!website.exists)throw new HttpsError("not-found","Website not registered");
 const terms=searchTerms(question,10);
 if(!terms.length)return {passages:[]};
 const matches=await db.collection(`customers/${uid}/websites/${websiteId}/knowledgeIndex`).where("terms","array-contains-any",terms).limit(25).get();
 return {passages:rankPassages(question,matches.docs.map(d=>({id:d.id,text:String(d.get("text")||"")})))};
});
