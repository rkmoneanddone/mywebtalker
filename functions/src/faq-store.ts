import {getFirestore} from "firebase-admin/firestore";
import {extractFaqEntries,faqKey,normalizeFaqQuestion} from "./direct-answer.js";
/** An exact, tenant-scoped indexed lookup; multiple different answers fail closed. */
export async function lookupFaq(uid:string,websiteId:string,question:string):Promise<{answer:string;sourceId:string}|null>{
 if(normalizeFaqQuestion(question).length<4)return null;
 const db=getFirestore();
 const snap=await db.collection(`customers/${uid}/websites/${websiteId}/faqIndex`).where("key","==",faqKey(question)).limit(31).get();
 if(snap.empty||snap.size>=31)return null;
 const entries=snap.docs.map(d=>({answer:String(d.get("answer")||""),sourceId:String(d.get("sourceId")||"")}));
 if(entries.some(e=>!e.sourceId||e.answer.length<2||e.answer.length>1500||e.answer!==entries[0]!.answer))return null;
 return entries[0]!;
}
export function faqRecords(text:string):{key:string;answer:string}[]{
 const seen=new Set<string>();
 return extractFaqEntries(text).flatMap(f=>{
  const key=faqKey(f.question),unique=key+"|"+f.answer;
  if(seen.has(unique))return [];
  seen.add(unique);
  return [{key,answer:f.answer}];
 }).slice(0,100);
}
