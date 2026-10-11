import {searchTerms} from "./knowledge.js";
export type Passage={id:string;text:string};
/** Quote a single complete, relevant sentence from uploaded knowledge.
 * This is extractive retrieval, not a claim to understand every paraphrase.
 * Ambiguous or multi-part questions fall back to the AI route.
 */
export function extractPassageAnswer(question:string,passages:readonly Passage[]):{answer:string;sourceId:string}|null{
 const q=question.trim();
 if(q.length<8||q.length>500||/[\n\r]/.test(q)||/\b(compare|versus|vs|recommend|best|why|explain|summarize|difference|should|if|unless|except|after|before)\b/i.test(q))return null;
 const terms=searchTerms(q,20).filter(t=>t.length>=3);
 if(terms.length<2)return null;
 const candidates:{answer:string;sourceId:string;score:number}[]=[];
 for(const p of passages){
  // Sentence boundaries; retain source wording without synthesizing claims.
  const sentences=p.text.replace(/\r/g,"").split(/(?<=[.!?])\s+|\n+/);
  for(const raw of sentences){
   const sentence=raw.trim();
   if(sentence.length<25||sentence.length>400)continue;
   const lower=sentence.toLowerCase();
   const matched=terms.filter(t=>new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^\\p{L}\\p{N}]|$)`,"u").test(lower));
   if(matched.length!==terms.length)continue;
   candidates.push({answer:sentence,sourceId:p.id,score:matched.length});
  }
 }
 // Only one distinct complete statement can be safely quoted.
 const distinct=[...new Map(candidates.map(c=>[c.answer.toLowerCase(),c])).values()];
 if(distinct.length!==1)return null;
 return {answer:distinct[0]!.answer,sourceId:distinct[0]!.sourceId};
}
