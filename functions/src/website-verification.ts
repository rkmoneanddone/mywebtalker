import {randomBytes} from "node:crypto";
import {resolveTxt} from "node:dns/promises";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
if(!getApps().length)initializeApp();
const db=getFirestore();
const region="asia-south1";

/** Require verified Firebase authentication for ownership changes. */
function uidOf(request:{auth?:{uid:string;token:{email_verified?:boolean}}}):string{
 if(!request.auth?.uid||request.auth.token.email_verified!==true)throw new HttpsError("unauthenticated","Verified login required");
 return request.auth.uid;
}
/** Only permit a single Firestore ID segment. */
function websiteIdOf(value:unknown):string{
 if(typeof value!=="string"||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw new HttpsError("invalid-argument","Invalid website ID");
 return value;
}
/** Extract an exact public HTTPS hostname from a previously registered website. */
export function verificationHost(raw:string):string{
 const u=new URL(raw);
 if(u.protocol!=="https:"||u.username||u.password||u.port||u.pathname!=="/"||u.search||u.hash)throw Error("Invalid website URL");
 const host=u.hostname.toLowerCase().replace(/\.$/,"");
 if(host.length>253||!host.includes(".")||host==="localhost"||host.endsWith(".local")||host.endsWith(".localhost")||!host.split(".").every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||/^[0-9.]+$/.test(host))throw Error("A public DNS hostname is required");
 return host;
}
/** Generate a server-owned, unpredictable challenge; never accept a browser-selected proof. */
export const beginWebsiteVerification=onCall({region},async request=>{
 const uid=uidOf(request),id=websiteIdOf(request.data?.websiteId);
 const ref=db.doc(`customers/${uid}/websites/${id}`);
 const snap=await ref.get();
 if(!snap.exists)throw new HttpsError("not-found","Website not registered");
 if(snap.get("status")==="verified")return {verified:true};
 let host:string;
 try{host=verificationHost(String(snap.get("url")||""));}
 catch{throw new HttpsError("failed-precondition","Website URL is invalid");}
 const token="mwt-"+randomBytes(24).toString("hex");
 await ref.update({verificationToken:token,verificationIssuedAt:FieldValue.serverTimestamp()});
 return {verified:false,hostname:host,recordName:`_mywebtalker.${host}`,recordValue:token};
});
/** Verify DNS TXT ownership without fetching untrusted customer URLs (avoids SSRF). */
export const confirmWebsiteVerification=onCall({region,timeoutSeconds:20},async request=>{
 const uid=uidOf(request),id=websiteIdOf(request.data?.websiteId);
 const ref=db.doc(`customers/${uid}/websites/${id}`);
 const snap=await ref.get();
 if(!snap.exists)throw new HttpsError("not-found","Website not registered");
 if(snap.get("status")==="verified")return {verified:true};
 const token=snap.get("verificationToken");
 const issued=snap.get("verificationIssuedAt") as Timestamp|undefined;
 if(typeof token!=="string"||!issued||Date.now()-issued.toMillis()>86400000)throw new HttpsError("failed-precondition","Start verification again; challenge expired");
 let host:string;
 try{host=verificationHost(String(snap.get("url")||""));}
 catch{throw new HttpsError("failed-precondition","Website URL is invalid");}
 let records:string[][];
 try{records=await resolveTxt(`_mywebtalker.${host}`);}
 catch{throw new HttpsError("failed-precondition","DNS TXT record not found; allow time for propagation");}
 if(!records.some(parts=>parts.join("")===token))throw new HttpsError("permission-denied","DNS TXT value does not match the challenge");
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(ref);
  if(fresh.get("verificationToken")!==token||fresh.get("status")==="verified")throw new HttpsError("aborted","Verification changed; reload and retry");
  tx.update(ref,{status:"verified",verifiedAt:FieldValue.serverTimestamp(),verificationToken:FieldValue.delete(),verificationIssuedAt:FieldValue.delete()});
 });
 return {verified:true};
});
