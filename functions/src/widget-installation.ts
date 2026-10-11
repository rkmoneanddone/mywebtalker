import {randomBytes} from "node:crypto";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
if(!getApps().length)initializeApp();
const db=getFirestore(),region="asia-south1";
const validId=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
function requireUid(auth:{uid:string;token:{email_verified?:boolean}}|undefined){
 if(!auth?.uid||auth.token.email_verified!==true)throw new HttpsError("unauthenticated","Verified login required");
 return auth.uid;
}
/** Only verified website owners may mint a new public installation identifier. */
export const createWidgetInstallation=onCall({region},async request=>{
 const uid=requireUid(request.auth);
 const websiteId=request.data?.websiteId;
 if(!validId(websiteId))throw new HttpsError("invalid-argument","Invalid website ID");
 const ref=db.doc(`customers/${uid}/websites/${websiteId}`);
 const site=await ref.get();
 if(!site.exists||site.get("status")!=="verified")throw new HttpsError("failed-precondition","Verify website ownership first");
 const installationId="w_"+randomBytes(20).toString("hex");
 // This identifier is public. It is NOT authentication or an abuse-prevention credential.
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(ref);
  if(fresh.get("status")!=="verified")throw new HttpsError("failed-precondition","Website not verified");
  const previous=fresh.get("widgetInstallationId");
  if(typeof previous==="string"&&/^w_[a-f0-9]{40}$/.test(previous))tx.update(db.doc(`widgetInstallations/${previous}`),{enabled:false,revokedAt:FieldValue.serverTimestamp()});
  tx.set(db.doc(`widgetInstallations/${installationId}`),{uid,websiteId,createdAt:FieldValue.serverTimestamp(),enabled:true});
  tx.update(ref,{widgetInstallationId:installationId,widgetPublished:false});
 });
 return {installationId};
});
/** Resolve public installation ID to the verified owner; never trust a caller-supplied tenant. */
export async function resolveInstallation(installationId:unknown){
 if(!validId(installationId))throw new HttpsError("invalid-argument","Invalid installation ID");
 const installation=await db.doc(`widgetInstallations/${installationId}`).get();
 if(!installation.exists||installation.get("enabled")!==true)throw new HttpsError("not-found","Installation not found");
 const uid=installation.get("uid"),websiteId=installation.get("websiteId");
 if(typeof uid!=="string"||!validId(websiteId))throw new HttpsError("not-found","Installation not found");
 const site=await db.doc(`customers/${uid}/websites/${websiteId}`).get();
 if(!site.exists||site.get("status")!=="verified"||site.get("widgetInstallationId")!==installationId)throw new HttpsError("not-found","Installation revoked");
 return {uid,websiteId,site};
}

/** Owner-only publication switch. Default remains private until explicitly enabled. */
export const setWidgetPublication=onCall({region},async request=>{
 const uid=requireUid(request.auth);
 const websiteId=request.data?.websiteId;
 const published=request.data?.published;
 if(!validId(websiteId)||typeof published!=="boolean")throw new HttpsError("invalid-argument","Invalid publication request");
 const ref=db.doc(`customers/${uid}/websites/${websiteId}`);
 await db.runTransaction(async tx=>{
  const site=await tx.get(ref);
  if(!site.exists||site.get("status")!=="verified"||typeof site.get("widgetInstallationId")!=="string")
   throw new HttpsError("failed-precondition","Verify the website and create a widget installation first");
  tx.update(ref,{widgetPublished:published,widgetPublicationUpdatedAt:FieldValue.serverTimestamp()});
 });
 return {published};
});
