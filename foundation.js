/* Fonctions partagées, sans requête automatique avant l'initialisation. */
window.AmorV5={uid:null,profile:null,keepOriginals:true};
function amorConflict(error){
 if(error?.code==='40001'||String(error?.message).includes('AMOR_CONFLICT')){
  document.dispatchEvent(new CustomEvent('amor:conflict'));return true;
 }return false;
}
function amorTrashQuery(table){
 let ids=[],task=null;
 const query={eq(column,id){if(column!=='id')throw Error('Filtre de corbeille non pris en charge');ids=[String(id)];return query;},
  in(column,list){if(column!=='id')throw Error('Filtre de corbeille non pris en charge');ids=list.map(String);return query;},
  then(resolve,reject){task??=supabaseClient.rpc('amor_trash',{p_table:table,p_ids:ids}).then(result=>{
   if(!result.error)document.dispatchEvent(new CustomEvent('amor:trashed'));return result;
  });return task.then(resolve,reject);}};
 return query;
}
async function amorSafeRemove(paths){
 const {data,error}=await supabaseClient.rpc('amor_protected_paths',{p_paths:paths});
 if(error)return {error};
 const unreferenced=paths.filter(p=>!data.includes(p));
 if(!unreferenced.length)return {data:[],error:null};
 return supabaseClient.storage.from('memories').remove(unreferenced);
}
function amorEscape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function amorDownload(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const amorGeoCache=new Map();let amorGeoLast=0,amorGeoQueue=Promise.resolve();
function amorGeoFetch(url){
 const job=async()=>{
  if(amorGeoCache.has(url))return new Response(JSON.stringify(amorGeoCache.get(url)),{status:200,headers:{'Content-Type':'application/json'}});
  const delay=Math.max(0,1100-(Date.now()-amorGeoLast));if(delay)await new Promise(r=>setTimeout(r,delay));
  amorGeoLast=Date.now();const response=await fetch(url);if(response.ok)amorGeoCache.set(url,await response.clone().json());return response;
 };
 const next=amorGeoQueue.then(job,job);amorGeoQueue=next.catch(()=>{});return next;
}
async function amorGeocode(query){
 const params=new URLSearchParams({q:query,format:'jsonv2',addressdetails:'1',limit:'5',featureType:'settlement','accept-language':'fr'});
 const response=await amorGeoFetch('https://nominatim.openstreetmap.org/search?'+params);if(!response.ok)throw Error('Recherche géographique indisponible');
 return (await response.json()).map(convertirResultatGeographique);
}
async function amorCoverLinks(covers){
 const paths=covers.map(c=>c.storage_path);
 const {data,error}=await supabaseClient.from('stay_media').select('storage_path,display_path').in('storage_path',paths);
 if(error)return {data:null,error};
 const map=new Map(data.map(m=>[m.storage_path,m.display_path||m.storage_path]));
 return supabaseClient.storage.from('memories').createSignedUrls(paths.map(p=>map.get(p)||p),3600);
}
// Archive ZIP standard non compressée ; aucune dépendance externe ou serveur.
const amorCrcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function amorCrc(bytes){let crc=0xffffffff;for(const b of bytes)crc=amorCrcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
async function amorZip(entries){
 if(entries.length>60000)throw Error('Trop de fichiers pour une archive. Sélectionnez un séjour.');
 const parts=[],central=[];let offset=0,count=0,total=0;
 const header=(len)=>{const b=new Uint8Array(len);return [b,new DataView(b.buffer)];};
 for(const entry of entries){
  const bytes=new Uint8Array(await entry.blob.arrayBuffer());total+=bytes.length;
  if(total>300*1024*1024)throw Error('Archive trop volumineuse pour ce navigateur. Exportez un séjour à la fois.');
  const name=new TextEncoder().encode(entry.name),crc=amorCrc(bytes);
  let [h,v]=header(30);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);
  v.setUint16(12,33,true);
  v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);
  parts.push(h,name,bytes);
  let [c,d]=header(46);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);
  d.setUint16(14,33,true);
  d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);
  central.push(c,name);offset+=30+name.length+bytes.length;count++;
 }
 const length=central.reduce((n,b)=>n+b.length,0);let [end,e]=header(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,count,true);e.setUint16(10,count,true);e.setUint32(12,length,true);e.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
async function amorResize(file,max,quality=.84){
 let image,source;
 try{
  if(window.createImageBitmap)image=await createImageBitmap(file,{imageOrientation:'from-image'});
  else{source=URL.createObjectURL(file);image=new Image();image.src=source;await image.decode();}
  const ratio=Math.min(1,max/image.width,max/image.height),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Conversion indisponible')),'image/webp',quality));
 }finally{image?.close?.();if(source)URL.revokeObjectURL(source);}
}
