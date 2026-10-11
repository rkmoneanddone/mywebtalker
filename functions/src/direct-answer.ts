/** Return a verbatim answer only for an explicitly authored Q/A pair.
 * No keyword-only or similarity-based answers: those can misrepresent policies.
 */
export function normalizeFaqQuestion(value:string):string{
 return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
}
export function findDirectFaqAnswer(question:string,passages:readonly {id:string;text:string}[]):{answer:string;sourceId:string}|null{
 const target=normalizeFaqQuestion(question);
 if(target.length<4)return null;
 const matches:{answer:string;sourceId:string}[]=[];
 for(const passage of passages){
  // Explicit Q: ... newline A: ...; one-line answers only, avoiding ambiguous boundaries.
  const lines=passage.text.split(/\r?\n/);
  for(let i=0;i+1<lines.length;i++){
   const q=lines[i]!.match(/^\s*(?:Q:|Question:)\s*(.+?)\s*$/i);
   const a=lines[i+1]!.match(/^\s*(?:A:|Answer:)\s*(.+?)\s*$/i);
   if(!q||!a||normalizeFaqQuestion(q[1]!)!==target)continue;
   const answer=a[1]!.trim();
   if(answer.length<2||answer.length>1500)continue;
   matches.push({answer,sourceId:passage.id});
  }
 }
 if(!matches.length)return null;
 // Conflicting answers are never returned automatically.
 if(matches.some(m=>m.answer!==matches[0]!.answer))return null;
 return matches[0]!;
}
