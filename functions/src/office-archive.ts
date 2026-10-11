/** Inspect ZIP central-directory metadata before passing Office files to parsers.
 * This is a resource guard, not a substitute for runtime memory/time limits. */
export function validateOfficeArchive(bytes:Buffer):void{
 const maxEntries=150,maxExpanded=2*1024*1024,maxRatio=100;
 const start=Math.max(0,bytes.length-22-65535);
 let end=-1;
 for(let i=bytes.length-22;i>=start;i--){
  if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 }
 if(end<0)throw Error("Invalid Office ZIP archive");
 const count=bytes.readUInt16LE(end+10);
 const directorySize=bytes.readUInt32LE(end+12);
 const offset=bytes.readUInt32LE(end+16);
 if(count===0||count>maxEntries||count===65535||offset+directorySize>end)
  throw Error("Office archive exceeds safe entry limits");
 let cursor=offset,total=0;
 for(let n=0;n<count;n++){
  if(cursor+46>offset+directorySize||bytes.readUInt32LE(cursor)!==0x02014b50)throw Error("Invalid Office ZIP directory");
  const flags=bytes.readUInt16LE(cursor+8),compressed=bytes.readUInt32LE(cursor+20),expanded=bytes.readUInt32LE(cursor+24);
  const nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32);
  if(flags&1||compressed===0xffffffff||expanded===0xffffffff||expanded>maxExpanded||expanded>Math.max(1,compressed)*maxRatio)
   throw Error("Office archive is encrypted or expands beyond safe limits");
  total+=expanded;
  if(total>maxExpanded)throw Error("Office archive expands beyond 2 MB");
  cursor+=46+nameLength+extraLength+commentLength;
 }
 if(cursor!==offset+directorySize)throw Error("Invalid Office ZIP directory size");
}
