import {getFirestore} from "firebase-admin/firestore";
export type PaymentProvider="razorpay"|"dodo";
export type PaymentSettings={enabled:boolean;provider:PaymentProvider|null;mode:"test"|"live"};
/** Only server-side checkout adapters may act on this configuration. */
export async function getPaymentSettings():Promise<PaymentSettings>{
 const data=(await getFirestore().doc("privateConfig/payments").get()).data();
 const provider=data?.provider==="razorpay"||data?.provider==="dodo"?data.provider:null;
 const mode=data?.mode==="live"?"live":"test";
 // Fail closed if provider or explicit enablement is absent.
 return {enabled:data?.enabled===true&&provider!==null,provider,mode};
}
