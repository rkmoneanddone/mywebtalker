import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {request as httpsRequest} from "node:https";
import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
import {chunkText,searchTerms} from "./knowledge.js";
import {verificationHost} from "./website-verification.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
function publicAddress(address:string):boolean{
 if(isIP(address)!==4)return false; // IPv4 only: fail closed on IPv6
 const [a,b,c]=address.split(".").map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&b>=18&&b<=19);
}
async function fetchHomepage(host:string):Promise<string>{
 const addresses=await lookup(host,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error("Website DNS does not resolve exclusively to public IPv4 addresses");
 const address=addresses[0]!;
 return new Promise((resolve,reject)=>{
  let total=0,body="";
  const req=httpsRequest({hostname:host,port:443,path:"/",method:"GET",timeout:7000,headers:{Accept:"text/html","User-Agent":"MyWebTalkerBot/1.0"},lookup:(_h,_opts,cb)=>cb(null,address.address,4)},res=>{
   if(res.statusCode!==200||!String(res.headers["content-type"]||"").toLowerCase().includes("text/html")){res.resume();reject(Error("Website did not return HTML"));return;}
   res.setEncoding("utf8");
   res.on("data",(part:string)=>{total+=Buffer.byteLength(part);if(total>128*1024){req.destroy(Error("Website page too large"));return;}body+=part;});
   res.on("end",()=>resolve(body));
   res.on("error",reject);
  });
  req.on("timeout",()=>req.destroy(Error("Website fetch timed out")));
  req.on("error",reject);req.end();
 });
}
function textFromHtml(html:string):string{
 return html.replace(/<!--[\s\S]*?-->/g," ").replace(/<(script|style|svg|noscript|template|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim().slice(0,30000);
}
/** Manual, single-page crawl. No redirects, subpages, external links or file storage. */
export const crawlWebsiteHomepage=onCall({region:"asia-south1",timeoutSeconds:25,maxInstances:2},async request=>{
 const uid=request.auth?.uid;
 if(!uid||request.auth?.token.email_verified!==true)throw new HttpsError("unauthenticated","Verified login required");
 const id=request.data?.websiteId;
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new HttpsError("invalid-argument","Invalid website");
 const siteRef=db.doc(`customers/${uid}/websites/${id}`);
 const site=await siteRef.get();
 if(!site.exists||site.get("status")!=="verified")throw new HttpsError("permission-denied","Verified website required");
 const customer=await db.doc(`customers/${uid}`).get();
 const created=customer.get("createdAt");
 if(!created||typeof created.toMillis!=="function"||Date.now()>created.toMillis()+7*86400000)throw new HttpsError("permission-denied","Active trial required for crawling");
 let host:string;
 try{host=verificationHost(String(site.get("url")||""));}
 catch{throw new HttpsError("invalid-argument","Invalid website URL");}
 const day=new Date().toISOString().slice(0,10);
 const limit=db.doc(`crawlLimits/${uid}/days/${day}`);
 await db.runTransaction(async tx=>{
  const s=await tx.get(limit);
  if(Number(s.get("count")||0)>=3)throw new HttpsError("resource-exhausted","Daily crawl limit reached");
  tx.set(limit,{count:FieldValue.increment(1)},{merge:true});
 });
 let content:string;
 try{content=textFromHtml(await fetchHomepage(host));}
 catch{throw new HttpsError("unavailable","Could not safely fetch homepage");}
 if(content.length<30)throw new HttpsError("failed-precondition","No usable homepage text found");
 const chunks=chunkText(content);
 const sourceId="homepage";
 const index=db.collection(`customers/${uid}/websites/${id}/knowledgeIndex`);
 const old=await index.where("sourceId","==",sourceId).limit(100).get();
 const batch=db.batch();
 old.docs.forEach(d=>batch.delete(d.ref));
 chunks.forEach((text,i)=>batch.set(index.doc(`homepage_${String(i).padStart(5,"0")}`),{sourceId,text,terms:searchTerms(text)}));
 await batch.commit();
 return {pages:1,characters:content.length,passages:chunks.length};
});
