import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
if(!getApps().length)initializeApp();
const db=getFirestore();
/** All values are integer micro-USD (one million units per USD).
 * Pessimistic reservation for at most 9k context chars + question, system text
 * and 400 output tokens. Price intentionally exceeds current gpt-4.1-mini rates;
 * update if model, context or pricing changes. Not an OpenAI billing guarantee.
 */
export const COST_PER_REQUEST_MICRO_USD=20000; // $0.02 reserved per request
export const CUSTOMER_DAILY_MICRO_USD=200000; // $0.20
export const CUSTOMER_MONTHLY_MICRO_USD=3000000; // $3
export const PLATFORM_DAILY_MICRO_USD=10000000; // $10
export const PLATFORM_MONTHLY_MICRO_USD=100000000; // $100
export type BudgetScope="customerDay"|"customerMonth"|"platformDay"|"platformMonth";
export function budgetAllowed(current:number,limit:number,cost=COST_PER_REQUEST_MICRO_USD):boolean{
 return Number.isSafeInteger(current)&&current>=0&&Number.isSafeInteger(limit)&&limit>0&&current+cost<=limit;
}
export async function reserveAiBudget(uid:string):Promise<void>{
 const day=new Date().toISOString().slice(0,10),month=day.slice(0,7);
 const refs=[
  db.doc(`aiBudgets/${uid}/days/${day}`),
  db.doc(`aiBudgets/${uid}/months/${month}`),
  db.doc(`aiPlatformBudgets/global/days/${day}`),
  db.doc(`aiPlatformBudgets/global/months/${month}`)
 ];
 const limits=[CUSTOMER_DAILY_MICRO_USD,CUSTOMER_MONTHLY_MICRO_USD,PLATFORM_DAILY_MICRO_USD,PLATFORM_MONTHLY_MICRO_USD];
 await db.runTransaction(async tx=>{
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  for(let i=0;i<refs.length;i++){
   if(!budgetAllowed(Number(snaps[i]!.get("reservedMicroUsd")||0),limits[i]!))throw Error("ai-budget-exhausted");
  }
  for(const ref of refs)tx.set(ref,{reservedMicroUsd:FieldValue.increment(COST_PER_REQUEST_MICRO_USD),updatedAt:FieldValue.serverTimestamp()},{merge:true});
 });
}
/** Provider-reported usage is accounting, not permission to release uncertain reservations. */
export async function recordAiUsage(uid:string,usage:unknown):Promise<void>{
 if(!usage||typeof usage!=="object")return;
 const u=usage as {prompt_tokens?:number;completion_tokens?:number};
 const input=u.prompt_tokens,output=u.completion_tokens;
 if(!Number.isSafeInteger(input)||!Number.isSafeInteger(output)||(input as number)<0||(output as number)<0)return;
 const month=new Date().toISOString().slice(0,7);
 await db.doc(`aiBudgets/${uid}/months/${month}`).set({
  inputTokens:FieldValue.increment(input as number),
  outputTokens:FieldValue.increment(output as number),
  successfulRequests:FieldValue.increment(1)
 },{merge:true});
}
