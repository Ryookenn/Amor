/* Envois suivis et réimportation conservatrice, sans restauration destructive. */
(() => {
 const V=AmorV6,S=AmorV5,{E,B,D,run,fail}=V,$=s=>document.querySelector(s);
 const panel=E('section',null,'v6-upload-panel');panel.hidden=true;panel.setAttribute('aria-label','Envoi des photos');
 const status=E('p'),progress=E('progress'),cancel=B('Annuler l’envoi',()=>{cancelled=true;xhr?.abort();},'v6-quiet');progress.max=100;panel.append(status,progress,cancel);
 let xhr=null,cancelled=false,working=false;
 const jobs=new Map();
 async function digest(file){const bytes=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 async function upload(path,blob,onProgress){
  const {data,error}=await supabaseClient.auth.getSession();if(error||!data.session)throw Error('Reconnectez-vous avant l’envoi.');
  if(cancelled)throw Error('Envoi annulé.');return new Promise((resolve,reject)=>{
  const request=new XMLHttpRequest();xhr=request;request.open('POST',SUPABASE_URL+'/storage/v1/object/memories/'+path.split('/').map(encodeURIComponent).join('/'));
  request.timeout=90000;
  request.setRequestHeader('Authorization','Bearer '+data.session.access_token);request.setRequestHeader('apikey',SUPABASE_PUBLISHABLE_KEY);request.setRequestHeader('Content-Type',blob.type||'application/octet-stream');request.setRequestHeader('x-upsert','false');request.setRequestHeader('cache-control','3600');
  request.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total);};
  request.onload=async()=>{xhr=null;try{if(request.status>=200&&request.status<300)resolve();else if(request.status===409){
   const {data,error}=await supabaseClient.storage.from('memories').download(path);if(data&&!error&&data.size===blob.size)resolve();else reject(Error('Un fichier existe déjà à ce chemin. Réessayez ou nettoyez cet envoi partiel.'));
  }else reject(Error('Envoi impossible ('+request.status+'). Réessayez après vérification de la connexion.'));}catch(error){reject(error);}};
  request.ontimeout=()=>{xhr=null;reject(Error('L’envoi a expiré. Vous pouvez le reprendre.'));};
  request.onerror=()=>{xhr=null;reject(Error('Connexion interrompue. Les photos terminées ne seront pas renvoyées.'));};request.onabort=()=>{xhr=null;reject(Error('Envoi annulé. Les photos déjà enregistrées restent dans l’album.'));};request.send(blob);
 });}
 const extension=blob=>blob.type==='image/webp'?'webp':blob.type==='image/png'?'png':'jpg';
 envoyerPhotos=async function(files,stay,destination){
  if(working)throw Error('Un envoi est déjà en cours.');working=true;V.uploading=true;cancelled=false;cancel.disabled=false;
  const host=$('#home-dialog').open?$('#home-dialog'):$('#souvenir-dialog');host.append(panel);panel.hidden=false;
  try{
   const ids=destination.experienceType==='home'?idsSejoursHome(destination):[stay.id];
   const {data:last,error:lastError}=await supabaseClient.from('stay_media').select('sort_order').in('stay_id',ids.length?ids:[stay.id]).order('sort_order',{ascending:false}).limit(1);if(lastError)throw lastError;
   let position=(last?.[0]?.sort_order??-1)+1;
   for(let index=0;index<files.length;index++){
    if(cancelled)throw Error('Envoi annulé.');const file=files[index];status.textContent=`Photo ${index+1}/${files.length} : préparation de ${file.name}…`;progress.value=0;
    const key=String(stay.id)+':'+await digest(file),uid=S.uid;
    let job=jobs.get(key);
    if(job&&job.uid!==uid){jobs.delete(key);job=null;}
    const {data:existing,error}=await supabaseClient.from('stay_media').select('id').eq('upload_key',key).maybeSingle();if(error)throw error;
    if(existing){status.textContent=`Photo ${index+1}/${files.length} déjà enregistrée.`;progress.value=100;continue;}
    if(!job){
     let thumb=null,display=null;try{thumb=await amorResize(file,480,.78);if(file.type!=='image/gif')display=await amorResize(file,2000,.88);}catch(error){
      if(/\.hei[cf]$/i.test(file.name)||/hei[cf]/i.test(file.type))throw Error('Ce navigateur ne peut pas décoder cette photo HEIC. Exportez-la en JPEG depuis Photos ou utilisez Safari compatible. Aucun fichier n’a été envoyé.');
     }
     const keep=S.keepOriginals||!display,main=keep?file:display,stem=`${destination.id}/${stay.id}/${crypto.randomUUID()}`;
     const path=stem+'-'+(keep?nettoyerNomFichier(file.name):'photo.'+extension(main)),thumbPath=thumb?stem+'-thumb.'+extension(thumb):null,displayPath=display?(keep?stem+'-screen.'+extension(display):path):null;
     const parts=[{path,blob:main,done:false}];if(thumb)parts.push({path:thumbPath,blob:thumb,done:false});if(display&&keep)parts.push({path:displayPath,blob:display,done:false});
     job={uid,file,city:destination.id,parts,row:{stay_id:stay.id,media_type:'photo',storage_path:path,thumb_path:thumbPath,display_path:displayPath,original_name:file.name,original_kept:keep,upload_key:key,sort_order:position++}};jobs.set(key,job);
    }
    const total=job.parts.reduce((n,p)=>n+p.blob.size,0);
    for(const part of job.parts){if(part.done)continue;if(cancelled)throw Error('Envoi annulé.');
     const sent=job.parts.filter(p=>p.done).reduce((n,p)=>n+p.blob.size,0);status.textContent=`Photo ${index+1}/${files.length} : ${file.name}`;
     await upload(part.path,part.blob,ratio=>{progress.value=Math.round((sent+ratio*part.blob.size)/Math.max(1,total)*100);});part.done=true;
    }
    const {error:insertError}=await supabaseClient.from('stay_media').insert(job.row);if(insertError){
     if(insertError.code!=='23505')throw insertError;
     const {data:confirmed}=await supabaseClient.from('stay_media').select('id').eq('upload_key',key).maybeSingle();if(!confirmed)throw insertError;
    }
    progress.value=100;jobs.delete(key);
   }
   status.textContent='Toutes les photos sont enregistrées.';cancel.disabled=true;setTimeout(()=>{if(!working)panel.hidden=true;},1800);
  }catch(error){status.textContent=error.message+($('#home-dialog').open?' Resélectionnez les mêmes photos pour reprendre les restantes.':' Réenregistrez la fiche pour reprendre uniquement les photos restantes.');throw error;}
  finally{working=false;V.uploading=false;cancel.disabled=true;document.dispatchEvent(new CustomEvent('amor:transfer-state'));}
 };
 window.addEventListener('beforeunload',event=>{if(working){event.preventDefault();event.returnValue='';}});
 envoyerAudio=async function(file,stay,destination){
  if(working)throw Error('Un envoi est déjà en cours.');working=true;V.uploading=true;cancelled=false;cancel.disabled=false;$('#souvenir-dialog').append(panel);panel.hidden=false;progress.value=0;
  try{const key=String(stay.id)+':audio:'+await digest(file);const {data:existing,error}=await supabaseClient.from('stay_media').select('id').eq('upload_key',key).maybeSingle();if(error)throw error;
   if(!existing){let job=jobs.get(key);if(!job){const path=`${destination.id}/${stay.id}/audio/${crypto.randomUUID()}-${nettoyerNomFichier(file.name)}`;job={uid:S.uid,file,city:destination.id,parts:[{path,blob:file,done:false}],row:{stay_id:stay.id,media_type:'audio',storage_path:path,original_name:file.name,upload_key:key}};jobs.set(key,job);}
    status.textContent='Envoi du vocal : '+file.name;const part=job.parts[0];if(!part.done){await upload(part.path,part.blob,ratio=>progress.value=Math.round(ratio*100));part.done=true;}
    const {error}=await supabaseClient.from('stay_media').insert(job.row);if(error){const {data:confirmed}=await supabaseClient.from('stay_media').select('id').eq('upload_key',key).maybeSingle();if(!confirmed)throw error;}jobs.delete(key);
   }status.textContent='Vocal enregistré.';progress.value=100;setTimeout(()=>{if(!working)panel.hidden=true;},1800);
  }catch(error){status.textContent=error.message+' Réenregistrez la fiche pour reprendre le vocal.';throw error;}
  finally{working=false;V.uploading=false;cancel.disabled=true;document.dispatchEvent(new CustomEvent('amor:transfer-state'));}
 };
 new MutationObserver(()=>{if($('#auth-screen').hidden)return;cancelled=true;xhr?.abort();jobs.clear();panel.hidden=true;}).observe($('#auth-screen'),{attributes:true,attributeFilter:['hidden']});
 const cleanup=B('Nettoyer mes envois partiels',()=>run(cleanup,async()=>{
  if(working)throw Error('Arrêtez d’abord l’envoi.');if(!confirm('Supprimer les copies partielles non rattachées à un souvenir ? Les photos déjà enregistrées sont protégées.'))return;
  for(const job of jobs.values()){const {error}=await amorSafeRemove(job.parts.filter(p=>p.done).map(p=>p.path));if(error)throw error;}jobs.clear();panel.hidden=true;
 },V.settings.c),'v6-quiet');V.settings.c.append(cleanup);

 // Lecteur ZIP borné : archives AMOR produites en mode non compressé par V5/V6/V8/V9.
 async function readZip(file){if(file.size>320*1024*1024)throw Error('Archive de 320 Mo maximum ; importez par séjour.');const buffer=await file.arrayBuffer(),view=new DataView(buffer),bytes=new Uint8Array(buffer),entries=new Map();let at=0;
  while(at+4<=bytes.length&&view.getUint32(at,true)===0x04034b50){
   if(at+30>bytes.length)throw Error('Archive tronquée.');const flags=view.getUint16(at+6,true),method=view.getUint16(at+8,true),crc=view.getUint32(at+14,true),size=view.getUint32(at+18,true),nameSize=view.getUint16(at+26,true),extra=view.getUint16(at+28,true);
   if(method!==0||(flags&8))throw Error('Utilisez un ZIP AMOR V5/V6/V8/V9 non recompressé.');const name=new TextDecoder().decode(bytes.subarray(at+30,at+30+nameSize));const start=at+30+nameSize+extra,end=start+size;if(end>bytes.length)throw Error('Archive tronquée.');
   if(name.split('/').includes('..')||name.startsWith('/')||name.includes(String.fromCharCode(92))||entries.has(name))throw Error('Chemin d’archive invalide.');const payload=bytes.subarray(start,end);if(amorCrc(payload)!==crc)throw Error('Un fichier est corrompu dans le ZIP.');entries.set(name,new Blob([payload]));at=end;
  }if(!entries.size)throw Error('Archive AMOR vide ou non reconnue.');return entries;
 }
 const restore=D('Réimporter une sauvegarde');
 V.settings.c.append(B('Réimporter une sauvegarde',()=>openRestore()));
 function openRestore(){restore.c.innerHTML='<p>Import conservateur : ajout des lignes manquantes seulement. Les lignes existantes ne seront ni écrasées ni supprimées. Les favoris et profils privés ne sont pas importés.</p><label>Sauvegarde JSON ou ZIP AMOR<input id="v6-import-file" type="file" accept=".json,.zip,application/json,application/zip"></label><div id="v6-import-report"></div>';
  const preview=B('Analyser sans modifier',()=>run(preview,async()=>{
   const file=$('#v6-import-file').files[0];if(!file)throw Error('Choisissez une sauvegarde.');let entries=null,json;
   if(/\.zip$/i.test(file.name)){entries=await readZip(file);const meta=entries.get('AMOR-sauvegarde.json');if(!meta)throw Error('JSON de sauvegarde absent du ZIP.');json=JSON.parse(await meta.text());}
   else{if(file.size>12*1024*1024)throw Error('JSON de 12 Mo maximum.');json=JSON.parse(await file.text());}
   if(![5,6,8,9].includes(json.schema_version))throw Error('Sauvegarde V5, V6, V8 ou V9 attendue.');
   const {data:report,error}=await supabaseClient.rpc('amor_import',{p_data:json,p_apply:false});if(error)throw error;
   const parent=$('#v6-import-report');parent.replaceChildren(E('h3','Aperçu'),E('p',`${report.missing} ligne(s) manquante(s), ${report.existing_unchanged} ligne(s) existante(s) conservée(s).`));
   for(const [table,count]of Object.entries(report.tables))parent.append(E('p',`${table} : ${count} ajout(s) possible(s)`));
   parent.append(E('p',entries?'Les médias du ZIP seront remis à leur chemin d’origine, sans remplacer un fichier existant.':'Sans ZIP, les médias doivent déjà exister dans le stockage du projet. Sinon l’import s’arrêtera avant de créer les lignes.'));
   const apply=B('Confirmer l’ajout des éléments manquants',()=>run(apply,async()=>{
    if(!confirm('Ajouter les éléments manquants dans ce projet AMOR ? Aucun contenu existant ne sera remplacé.'))return;
    const paths=new Map();for(const m of json.stay_media||[])for(const [kind,path]of [['source',m.storage_path],['ecran',m.display_path],['miniature',m.thumb_path]]){
     if(!path)continue;if(path.split('/').includes('..')||path.startsWith('/')||path.includes('\\'))throw Error('Chemin de média invalide.');
     const name=path.split('/').pop().replace(/[^a-zA-Z0-9._-]/g,'_'),entry=`medias/${m.stay_id}/${m.id}-${kind}-${name}`;paths.set(path,entries?.get(entry)||paths.get(path));
    }
    for(const w of json.shared_wishes||[])for(const a of w.inspirations||[]){if(a.kind!=='image'||!a.path)continue;const path=a.path;if(path.split('/').includes('..')||path.startsWith('/')||path.includes('\\'))throw Error('Chemin d’inspiration invalide.');const name=path.split('/').pop().replace(/[^a-zA-Z0-9._-]/g,'_');paths.set(path,entries?.get(`envies/${w.id}/${a.id}-${name}`)||paths.get(path));}
    for(const [path,blob]of paths){
     const {data:present,error:downloadError}=await supabaseClient.storage.from('memories').download(path);if(present&&!downloadError)continue;
     if(!blob)throw Error('Fichier source manquant : '+path+'. Fournissez le ZIP contenant les médias.');
     const ext=path.split('.').pop().toLowerCase(),mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg'}[ext]||'application/octet-stream';
     const {error}=await supabaseClient.storage.from('memories').upload(path,blob,{upsert:false,contentType:mime});if(error&&String(error.statusCode)!=='409')throw error;
    }
    const {data,error}=await supabaseClient.rpc('amor_import',{p_data:json,p_apply:true});if(error)throw error;
    S.invalidate();await S.refresh();parent.replaceChildren(E('p',`Import terminé. ${data.missing} élément(s) ajouté(s). Les éléments existants sont inchangés.`));
   },parent));parent.append(apply);
  },restore.c));restore.c.append(preview);restore.d.showModal();
 }
 V.readZip=readZip;
 V.pendingTransfers=()=>[...jobs].filter(([,j])=>j.uid===S.uid&&j.file).map(([key,j])=>({key,name:j.row.original_name,city:j.city,stay:j.row.stay_id}));
 V.resumeTransfer=async key=>{const job=jobs.get(key);if(!job||job.uid!==S.uid)throw Error('Cet envoi n’est plus disponible. Resélectionnez le fichier.');const dest=destinations.find(d=>d.id===job.city);if(!dest)throw Error('La destination n’est plus disponible.');if(job.row.media_type==='photo')await envoyerPhotos([job.file],{id:job.row.stay_id},dest);else await envoyerAudio(job.file,{id:job.row.stay_id},dest);S.invalidate();if(dest.experienceType==='home'&&homeActif?.id===dest.id)await chargerPhotosHome(homeActif);else if(String(souvenirsActifs?.id)===String(job.row.stay_id)){await chargerPhotos(souvenirsActifs);await chargerAudio(souvenirsActifs);}};
})();
