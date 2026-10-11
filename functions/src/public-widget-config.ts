import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,Timestamp} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {resolveInstallation} from "./widget-installation.js";
import {allowedBrowserOrigin,validInstallationId} from "./widget-security.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
/** Public widget settings expose no billing records or private tenant data. */
export const publicWidgetConfig=onRequest({region:"asia-south1",maxInstances:3,concurrency:10,invoker:"public"},async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="GET"){res.status(405).end();return;}
 const installationId=req.query.installationId;
 if(!validInstallationId(installationId)){res.status(400).end();return;}
 try{
  const {uid,site}=await resolveInstallation(installationId);
  const origin=req.get("origin");
  if(!allowedBrowserOrigin(origin,site.get("url"))||site.get("widgetPublished")!==true){res.status(403).end();return;}
  res.set("Access-Control-Allow-Origin",origin!);res.set("Vary","Origin");
  const [billing,customer]=await Promise.all([db.doc("privateBilling/"+uid).get(),db.doc("customers/"+uid).get()]);
  const end=billing.get("periodEnd") as Timestamp|undefined;
  const active=billing.get("status")==="active"&&end instanceof Timestamp&&end.toMillis()>Date.now();
  const brandingRemoved=active&&billing.get("brandingEnabled")===true;
  const settings=customer.get("settings")||{};
  const color=typeof settings.color==="string"&&/^#[0-9a-fA-F]{6}$/.test(settings.color)?settings.color:"#6d5efc";
  const botName=typeof settings.botName==="string"?settings.botName.slice(0,80):"Website assistant";
  res.status(200).json({brandingRemoved,color,botName});
 }catch{res.status(403).end();}
});
