import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
if(!getApps().length)initializeApp();
const db=getFirestore(),region="asia-south1";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
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
 const token=randomBytes(32).toString("hex");
 // Store only the hash; rotating the installation invalidates the previous secret.
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(ref);
  if(fresh.get("status")!=="verified")throw new HttpsError("failed-precondition","Website not verified");
  tx.set(db.doc(`widgetInstallations/${installationId}`),{uid,websiteId,tokenHash:digest(token),createdAt:FieldValue.serverTimestamp(),enabled:true});
  tx.update(ref,{widgetInstallationId:installationId});
 });
 return {installationId,installationToken:token};
});
/** Check installation credentials using a server-owned mapping, never a browser-supplied tenant ID. */
export async function authenticateInstallation(installationId:unknown,token:unknown){
 if(!validId(installationId)||typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))throw new HttpsError("permission-denied","Invalid installation credentials");
 const installation=await db.doc(`widgetInstallations/${installationId}`).get();
 if(!installation.exists||installation.get("enabled")!==true)throw new HttpsError("permission-denied","Installation disabled");
 const expected=installation.get("tokenHash");
 const actual=digest(token);
 if(typeof expected!=="string"||expected.length!==64||!timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(actual,"hex")))throw new HttpsError("permission-denied","Invalid installation credentials");
 const uid=installation.get("uid"),websiteId=installation.get("websiteId");
 if(typeof uid!=="string"||!validId(websiteId))throw new HttpsError("permission-denied","Invalid installation");
 const site=await db.doc(`customers/${uid}/websites/${websiteId}`).get();
 if(!site.exists||site.get("status")!=="verified"||site.get("widgetInstallationId")!==installationId)throw new HttpsError("permission-denied","Installation revoked");
 return {uid,websiteId,site};
}
