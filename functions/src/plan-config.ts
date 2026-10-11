import {getFirestore} from "firebase-admin/firestore";
import {initializeApp,getApps} from "firebase-admin/app";
import {DEFAULT_PLANS} from "./entitlements.js";
import type {Plan,PlanId} from "./entitlements.js";
if(!getApps().length)initializeApp();
const db=getFirestore();
export const planIds:PlanId[]=["self","managed","pro"];
export function parsePlan(value:unknown,id:PlanId):Plan{
 const fallback=DEFAULT_PLANS[id];
 if(!value||typeof value!=="object")return fallback;
 const p=value as Partial<Plan>;
 if(p.id!==id||typeof p.name!=="string"||!p.name.trim()||p.name.length>80||typeof p.enabled!=="boolean"||typeof p.managed!=="boolean"||!Number.isSafeInteger(p.inrMinor)||Number(p.inrMinor)<0||!Number.isSafeInteger(p.usdMinor)||Number(p.usdMinor)<0||!Number.isSafeInteger(p.responsesPerMonth)||Number(p.responsesPerMonth)<1||!Number.isSafeInteger(p.websites)||Number(p.websites)<1||!Number.isSafeInteger(p.knowledgePages)||Number(p.knowledgePages)<1)return fallback;
 return {...fallback,...p};
}
export async function getConfiguredPlan(id:PlanId):Promise<Plan>{
 const snap=await db.doc(`publicConfig/plans/entries/${id}`).get();
 return parsePlan(snap.data(),id);
}
export async function getBrandingConfig():Promise<{inrMinor:number;usdMinor:number;enabled:boolean;frequency:"one_time"}>{
 const snap=await db.doc("publicConfig/branding").get();
 const value=snap.data();
 return {inrMinor:Number.isSafeInteger(value?.inrMinor)&&value!.inrMinor>=0?value!.inrMinor:99900,usdMinor:Number.isSafeInteger(value?.usdMinor)&&value!.usdMinor>=0?value!.usdMinor:900,enabled:value?.enabled===true,frequency:"one_time"};
}
