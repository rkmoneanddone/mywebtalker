import {getFirestore,FieldValue} from "firebase-admin/firestore";
const db=getFirestore();
// Conservative request budget, including the system prompt, context, question and output.
// This is a hard ceiling on *estimated* tokens; exact provider usage is tracked separately.
export const MAX_CONTEXT_CHARS=9000;
export const MAX_QUESTION_CHARS=500;
const DAILY_TOKEN_BUDGET=40000;
const MONTHLY_TOKEN_BUDGET=600000;
const RESERVED_TOKENS=3500;
export async function reserveAiBudget(uid:string):Promise<void>{
 const now=new Date();
 const day=now.toISOString().slice(0,10);
 const month=day.slice(0,7);
 const daily=db.doc(`aiBudgets/${uid}/days/${day}`);
 const monthly=db.doc(`aiBudgets/${uid}/months/${month}`);
 await db.runTransaction(async tx=>{
  const [d,m]=await Promise.all([tx.get(daily),tx.get(monthly)]);
  if(Number(d.get("reservedTokens")||0)+RESERVED_TOKENS>DAILY_TOKEN_BUDGET||
     Number(m.get("reservedTokens")||0)+RESERVED_TOKENS>MONTHLY_TOKEN_BUDGET)
   throw Error("ai-budget-exhausted");
  tx.set(daily,{reservedTokens:FieldValue.increment(RESERVED_TOKENS)},{merge:true});
  tx.set(monthly,{reservedTokens:FieldValue.increment(RESERVED_TOKENS)},{merge:true});
 });
}
// Reservations intentionally are not refunded: ambiguous provider failures may still incur costs.
// Provider usage is recorded separately for auditing; it cannot weaken the hard reservation ceiling.
export async function recordAiUsage(uid:string,usage:unknown):Promise<void>{
 if(!usage||typeof usage!=="object")return;
 const u=usage as {prompt_tokens?:number;completion_tokens?:number};
 const input=u.prompt_tokens,output=u.completion_tokens;
 if(!Number.isSafeInteger(input)||!Number.isSafeInteger(output)||(input as number)<0||(output as number)<0)return;
 const month=new Date().toISOString().slice(0,7);
 await db.doc(`aiBudgets/${uid}/months/${month}`).set({
  inputTokens:FieldValue.increment(input as number),outputTokens:FieldValue.increment(output as number),
  successfulRequests:FieldValue.increment(1)
 },{merge:true});
}
