import {createHash} from "node:crypto";
/** Strict deterministic FAQ indexing; do not guess from keyword similarity. */
export function normalizeFaqQuestion(value:string):string{
 return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
}
export function faqKey(question:string):string{
 return createHash("sha256").update(normalizeFaqQuestion(question)).digest("hex");
}
export type FaqEntry={question:string;answer:string};
export function extractFaqEntries(text:string):FaqEntry[]{
 const entries:FaqEntry[]=[];
 const lines=text.split(/\r?\n/);
 for(let i=0;i+1<lines.length;i++){
  const q=lines[i]!.match(/^\s*(?:Q:|Question:)\s*(.+?)\s*$/i);
  const a=lines[i+1]!.match(/^\s*(?:A:|Answer:)\s*(.+?)\s*$/i);
  if(!q||!a)continue;
  const question=q[1]!.trim(),answer=a[1]!.trim();
  if(normalizeFaqQuestion(question).length<4||question.length>500||answer.length<2||answer.length>1500)continue;
  entries.push({question,answer});
 }
 return entries;
}
export function findDirectFaqAnswer(question:string,passages:readonly {id:string;text:string}[]):{answer:string;sourceId:string}|null{
 const target=normalizeFaqQuestion(question);
 if(target.length<4)return null;
 const matches:{answer:string;sourceId:string}[]=[];
 for(const passage of passages){
  for(const faq of extractFaqEntries(passage.text)){
   if(normalizeFaqQuestion(faq.question)===target)matches.push({answer:faq.answer,sourceId:passage.id});
  }
 }
 if(!matches.length||matches.some(m=>m.answer!==matches[0]!.answer))return null;
 return matches[0]!;
}
