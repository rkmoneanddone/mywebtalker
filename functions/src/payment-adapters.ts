import {createHmac,timingSafeEqual} from "node:crypto";
import {defineSecret} from "firebase-functions/params";
import {getFirestore,FieldValue,Timestamp} from "firebase-admin/firestore";
import {getPaymentSettings} from "./payment-config.js";
import {getConfiguredPlan} from "./plan-config.js";
import type {PlanId,Currency} from "./entitlements.js";
export const razorpayKeySecret=defineSecret("RAZORPAY_KEY_SECRET");
export const razorpayWebhookSecret=defineSecret("RAZORPAY_WEBHOOK_SECRET");
export const dodoApiKey=defineSecret("DODO_API_KEY");
export const dodoWebhookSecret=defineSecret("DODO_WEBHOOK_SECRET");
const db=getFirestore();
const ids=["self","managed","pro"];
type Provider="razorpay"|"dodo";
type CheckoutRequest={uid:string;email:string;planId:PlanId;currency:Currency};
function configuredProduct(data:Record<string,unknown>,provider:Provider,planId:string,currency:Currency):string{
 const gateways=data.gateways as Record<string,any>|undefined;
 const entry=gateways?.[provider];
 const id=entry?.products?.[currency]?.[planId];
 if(typeof id!=="string"||!id.trim())throw Error("Gateway product mapping missing");
 return id;
}
async function requestJson(url:string,options:RequestInit):Promise<any>{
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 const body=await response.text();
 let json:any;try{json=JSON.parse(body)}catch{throw Error("Gateway returned non-JSON response")}
 if(!response.ok)throw Error("Gateway request failed: "+response.status+" "+String(json?.message||json?.error?.description||""));
 return json;
}
export async function initiateCheckout(input:CheckoutRequest):Promise<{url:string;provider:Provider}>{
 const settings=await getPaymentSettings();
 if(!settings.enabled||!settings.provider)throw Error("No payment gateway enabled");
 const plan=await getConfiguredPlan(input.planId);
 if(!plan.enabled)throw Error("Selected plan disabled");
 const data=(await db.doc("privateConfig/payments").get()).data()||{};
 const productId=configuredProduct(data,settings.provider,input.planId,input.currency);
 const amount=input.currency==="INR"?plan.inrMinor:plan.usdMinor;
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error("Invalid plan amount");
 const intent=db.collection("paymentIntents").doc();
 await intent.set({uid:input.uid,email:input.email,planId:input.planId,currency:input.currency,amountMinor:amount,provider:settings.provider,status:"pending",createdAt:FieldValue.serverTimestamp()});
 try{
  if(settings.provider==="razorpay"){
   const entry=(data.gateways as any)?.razorpay;
   const keyId=entry?.keyId;
   const secret=razorpayKeySecret.value();
   if(!keyId||!secret)throw Error("Razorpay credentials missing");
   const json=await requestJson("https://api.razorpay.com/v1/subscriptions",{
    method:"POST",headers:{"Authorization":"Basic "+Buffer.from(keyId+":"+secret).toString("base64"),"Content-Type":"application/json"},
    body:JSON.stringify({plan_id:productId,total_count:120,quantity:1,customer_notify:1,notes:{intentId:intent.id,uid:input.uid,planId:input.planId,currency:input.currency}})
   });
   if(typeof json.short_url!=="string"||!json.id)throw Error("Razorpay did not return a subscription checkout URL");
   await intent.update({providerSubscriptionId:json.id});
   return {url:json.short_url,provider:"razorpay"};
  }
  const key=dodoApiKey.value();if(!key)throw Error("Dodo credentials missing");
  const endpoint=settings.mode==="live"?"https://live.dodopayments.com":"https://test.dodopayments.com";
  const json=await requestJson(endpoint+"/checkouts",{
   method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({product_cart:[{product_id:productId,quantity:1}],customer:{email:input.email},metadata:{intentId:intent.id,uid:input.uid,planId:input.planId,currency:input.currency}})
  });
  if(typeof json.checkout_url!=="string")throw Error("Dodo did not return checkout URL");
  await intent.update({providerCheckoutId:json.session_id||null});
  return {url:json.checkout_url,provider:"dodo"};
 }catch(error){await intent.update({status:"failed",failure:String(error)});throw error}
}
function safeEqualHex(a:string,b:string):boolean{
 if(!/^[a-f0-9]{64}$/i.test(a))return false;
 return timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}
export function verifyGatewayWebhook(provider:Provider,raw:Buffer,headers:Record<string,string|undefined>):any{
 if(provider==="razorpay"){
  const expected=createHmac("sha256",razorpayWebhookSecret.value()).update(raw).digest("hex");
  if(!safeEqualHex(headers["x-razorpay-signature"]||"",expected))throw Error("Invalid Razorpay signature");
 }else{
  const id=headers["webhook-id"],timestamp=headers["webhook-timestamp"],signature=headers["webhook-signature"];
  if(!id||!timestamp||!signature||Math.abs(Date.now()/1000-Number(timestamp))>300)throw Error("Invalid Dodo webhook headers");
  const secret=dodoWebhookSecret.value();
  const key=Buffer.from(secret.replace(/^whsec_/,""),"base64");
  const expected=createHmac("sha256",key).update(id+"."+timestamp+"."+raw.toString("utf8")).digest("base64");
  if(!signature.split(" ").some(s=>s==="v1,"+expected))throw Error("Invalid Dodo signature");
 }
 return JSON.parse(raw.toString("utf8"));
}
export async function processGatewayEvent(provider:Provider,payload:any):Promise<void>{
 const eventId=String(provider==="razorpay"?payload?.event+":"+(payload?.payload?.subscription?.entity?.id||payload?.payload?.payment?.entity?.id||"")+":"+(payload?.created_at||""):payload?.event_id||payload?.id||"");
 if(eventId.length<8||eventId.length>300)throw Error("Missing event identity");
 const eventType=String(provider==="razorpay"?payload?.event:payload?.type);
 const sub=provider==="razorpay"?payload?.payload?.subscription?.entity:payload?.data;
 const subscriptionId=String(sub?.subscription_id||sub?.id||"");
 if(!subscriptionId) return;
 const matches=await db.collection("paymentIntents").where("provider","==",provider).where("providerSubscriptionId","==",subscriptionId).limit(1).get();
 if(matches.empty)return;
 const intent=matches.docs[0],value=intent.data();
 if(!ids.includes(value.planId))return;
 const paid=provider==="razorpay"?["subscription.activated","subscription.charged"].includes(eventType):["subscription.active","subscription.renewed"].includes(eventType);
 const ended=provider==="razorpay"?["subscription.halted","subscription.cancelled","subscription.expired"].includes(eventType):["subscription.failed","subscription.cancelled","subscription.expired"].includes(eventType);
 if(!paid&&!ended)return;
 const untilSeconds=Number(sub?.current_end||0);
 const until=untilSeconds>0?untilSeconds*1000:Date.parse(String(sub?.next_billing_date||""));
 if(paid&&(!Number.isFinite(until)||until<=Date.now()))throw Error("Cannot activate subscription without verified future billing period");
 const eventRef=db.doc("paymentEvents/"+createHmac("sha256","mywebtalker-event").update(eventId).digest("hex"));
 await db.runTransaction(async tx=>{
  const existing=await tx.get(eventRef);if(existing.exists)return;
  const billingRef=db.doc("privateBilling/"+value.uid);
  const current=await tx.get(billingRef);
  if(paid)tx.set(billingRef,{status:"active",planId:value.planId,provider,providerSubscriptionId:subscriptionId,periodEnd:Timestamp.fromMillis(until),brandingEnabled:current.get("brandingEnabled")===true},{merge:true});
  else if(current.get("providerSubscriptionId")===subscriptionId)tx.set(billingRef,{status:eventType.includes("cancel")?"cancelled":"past_due"},{merge:true});
  tx.create(eventRef,{provider,eventType,createdAt:FieldValue.serverTimestamp(),intentId:intent.id});
 });
}
