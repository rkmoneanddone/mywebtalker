import {randomBytes} from "node:crypto";
import {resolveTxt,lookup} from "node:dns/promises";
import {request as httpsRequest} from "node:https";
import {isIP} from "node:net";
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
/** Fetch only the exact challenge file from a public IP, pinning DNS resolution to prevent rebinding. */
async function verifyHtmlFile(host:string,token:string):Promise<boolean>{
 const addresses=await lookup(host,{all:true,verbatim:true});
 if(!addresses.length||addresses.some(({address})=>{
  if(isIP(address)===4){const [a=0,b=0,c=0,d=0]=address.split(".").map(Number);return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&b>=18&&b<=19;}
  const a=address.toLowerCase();return a==="::1"||a==="::"||a.startsWith("fc")||a.startsWith("fd")||a.startsWith("fe8")||a.startsWith("fe9")||a.startsWith("fea")||a.startsWith("feb")||a.startsWith("::ffff:");
 }))throw Error("Non-public address");
 const address=addresses[0]!;
 return await new Promise<boolean>((resolve,reject)=>{
  const req=httpsRequest({hostname:host,port:443,path:"/.well-known/mywebtalker-verification.txt",method:"GET",timeout:7000,headers:{accept:"text/plain"},lookup:(_hostname,_options,callback)=>callback(null,address.address,address.family)},res=>{
   if(res.statusCode!==200){res.resume();resolve(false);return;}
   let body="";res.setEncoding("utf8");
   res.on("data",(part:string)=>{body+=part;if(body.length>512)req.destroy(Error("Challenge too large"));});
   res.on("end",()=>resolve(body.trim()===token));
   res.on("error",reject);
  });
  req.on("timeout",()=>req.destroy(Error("Verification timed out")));
  req.on("error",reject);req.end();
 });
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
 return {verified:false,hostname:host,recordName:`_mywebtalker.${host}`,recordValue:token,htmlPath:"/.well-known/mywebtalker-verification.txt"};
});
/** Verify DNS TXT ownership without fetching untrusted customer URLs (avoids SSRF). */
export const confirmWebsiteVerification=onCall({region,timeoutSeconds:20},async request=>{
 const uid=uidOf(request),id=websiteIdOf(request.data?.websiteId);
 const method=request.data?.method==="html"?"html":"dns";
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
 if(method==="html"){
  let matched=false;
  try{matched=await verifyHtmlFile(host,token);}catch{throw new HttpsError("failed-precondition","Could not read the HTTPS verification file");}
  if(!matched)throw new HttpsError("permission-denied","HTML verification file does not match the challenge");
 }else{
  let records:string[][];
  try{records=await resolveTxt(`_mywebtalker.${host}`);}
  catch{throw new HttpsError("failed-precondition","DNS TXT record not found; allow time for propagation");}
  if(!records.some(parts=>parts.join("")===token))throw new HttpsError("permission-denied","DNS TXT value does not match the challenge");
 }
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(ref);
  if(fresh.get("verificationToken")!==token||fresh.get("status")==="verified")throw new HttpsError("aborted","Verification changed; reload and retry");
  tx.update(ref,{status:"verified",verifiedAt:FieldValue.serverTimestamp(),verificationToken:FieldValue.delete(),verificationIssuedAt:FieldValue.delete()});
 });
 return {verified:true};
});
