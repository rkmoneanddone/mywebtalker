/** Pure validation functions for public widget requests; no client field selects a tenant. */
export function validInstallationId(value:unknown):value is string{
 return typeof value==="string"&&/^w_[a-f0-9]{40}$/.test(value);
}
export function validVisitorQuestion(value:unknown):value is string{
 return typeof value==="string"&&value.trim().length>=2&&value.length<=500;
}
export function allowedBrowserOrigin(origin:unknown,registeredUrl:string):boolean{
 if(typeof origin!=="string")return false;
 try{
  const incoming=new URL(origin),registered=new URL(registeredUrl);
  return incoming.protocol==="https:"&&incoming.origin===registered.origin&&incoming.pathname==="/"&&incoming.search===""&&incoming.hash==="";
 }catch{return false;}
}
/** Rate windows are aligned to UTC minutes, keeping counters bounded and predictable. */
export function minuteBucket(now:number):string{
 return new Date(Math.floor(now/60000)*60000).toISOString().slice(0,16).replace(/[-:T]/g,"");
}
