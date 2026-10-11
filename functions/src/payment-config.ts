import {getFirestore} from "firebase-admin/firestore";
export type PaymentProvider="razorpay"|"dodo";
export type PaymentSettings={enabled:boolean;provider:PaymentProvider|null;mode:"test"|"live"};
/** Exactly one gateway may be enabled. Both disabled means checkout unavailable. */
export async function getPaymentSettings():Promise<PaymentSettings>{
 const data=(await getFirestore().doc("privateConfig/payments").get()).data();
 const gateways=data?.gateways as Record<string,unknown>|undefined;
 const enabled=(["razorpay","dodo"] as const).filter(name=>{
  const value=gateways?.[name] as {enabled?:unknown}|undefined;
  return value?.enabled===true;
 });
 if(enabled.length>1)throw Error("Invalid payment configuration: only one gateway may be enabled");
 if(enabled.length===0)return {enabled:false,provider:null,mode:"test"};
 const provider:PaymentProvider=enabled[0]!;
 const settings=gateways?.[provider] as {mode?:unknown}|undefined;
 return {enabled:true,provider,mode:settings?.mode==="live"?"live":"test"};
}
