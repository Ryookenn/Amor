/* AMOR V5 — espace personnel, histoire partagée, envies et sauvegardes. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s),S=AmorV5;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const b=(text,fn,cls='v5-button')=>{const n=node('button',text,cls);n.type='button';n.onclick=fn;return n;};
 function modal(title){const d=node('dialog',null,'v5-dialog'),h=node('header'),c=node('div',null,'v5-content');const heading=node('h2',title);heading.id='v5-'+crypto.randomUUID();d.setAttribute('aria-labelledby',heading.id);h.append(heading,b('Fermer',()=>d.close(),'v5-quiet'));d.append(h,c);document.body.append(d);return {d,c};}
 function failure(parent,error,retry){const box=node('div',null,'v5-error');box.setAttribute('role','alert');box.append(node('p',error?.code==='40001'?'Ce contenu a changé sur un autre appareil. Rechargez-le avant de réessayer.':error?.message||String(error)));if(retry)box.append(b('Réessayer',()=>{box.remove();retry();}));parent.append(box);amorConflict(error);}
 async function run(button,fn,parent){if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');try{await fn();}catch(e){failure(parent,e);}finally{button.disabled=false;button.removeAttribute('aria-busy');}}
 let cache=null,cacheTime=0,accountTicket=0;
 function invalidate(){cache=null;cacheTime=0;}
 async function snapshot(force=false){if(!S.uid)throw Error('Connectez-vous pour retrouver votre histoire.');if(!force&&cache&&Date.now()-cacheTime<15000)return cache;
  const ticket=accountTicket;const {data,error}=await supabaseClient.rpc('amor_backup');if(error)throw error;
  if(ticket!==accountTicket)throw Error('La session a changé.');cache=data;cacheTime=Date.now();return data;}
 async function refresh(){invalidate();await chargerDestinationsDepuisSupabase();await chargerPremieresFois();document.dispatchEvent(new CustomEvent('amor:refresh-covers'));}
 ['amor:saved','amor:moment-saved','amor:home-saved','amor:badge','amor:trashed'].forEach(event=>document.addEventListener(event,invalidate));
 function live(data,table,row){
  if(!row||row.deleted_at)return false;
  if(table==='cities')return true;
  if(row.city_id && !data.cities.some(c=>String(c.id)===String(row.city_id)&&!c.deleted_at))return false;
  if(row.stay_id){const stay=data.stays.find(s=>String(s.id)===String(row.stay_id));return live(data,'stays',stay);}
  return true;
 }
 function catalogue(data){
  const list=[];const city=id=>data.cities.find(c=>String(c.id)===String(id));
  data.cities.filter(c=>live(data,'cities',c)).forEach(c=>list.push({kind:'city',id:String(c.id),title:c.name,description:c.experience_type==='home'?'Notre chez-nous':c.country_name||'',city:c,date:null}));
  data.stays.filter(s=>live(data,'stays',s)&&city(s.city_id)?.experience_type!=='home').forEach(s=>list.push({kind:'stay',id:String(s.id),title:city(s.city_id).name,description:s.shared_quote||'',city:city(s.city_id),stay:s,date:s.date_start}));
  data.home_items.filter(s=>live(data,'home_items',s)).forEach(s=>list.push({kind:'home_item',id:String(s.id),title:s.title,description:s.content||'',city:city(s.city_id),date:s.happened_on}));
  data.memory_fragments.filter(s=>live(data,'memory_fragments',s)).forEach(s=>list.push({kind:'fragment',id:String(s.id),title:s.title,description:s.content||'',city:city(s.city_id),stay:data.stays.find(t=>String(t.id)===String(s.stay_id)),date:s.happened_on}));
  data.first_times.filter(s=>s.stay_id&&live(data,'first_times',s)).forEach(s=>{const stay=data.stays.find(t=>String(t.id)===String(s.stay_id));list.push({kind:'badge',id:String(s.id),title:s.title,description:s.description||'Une première fois vécue ensemble.',city:city(stay.city_id),stay,date:s.unlocked_on});});
  data.stay_media.filter(m=>live(data,'stay_media',m)).forEach(m=>{const stay=data.stays.find(s=>String(s.id)===String(m.stay_id));list.push({kind:'media',id:String(m.id),title:m.original_name||(m.media_type==='audio'?'Notre vocal':'Notre photo'),description:city(stay.city_id)?.name||'',city:city(stay.city_id),stay,media:m,date:stay.date_start});});
  return list;
 }
 async function openMoment(item){
  const dest=destinations.find(d=>String(d.id)===String(item.city?.id));if(!dest)throw Error('Ce moment est peut-être dans la corbeille.');
  await ouvrirFiche(dest,item.stay?.id||null);
  if(item.kind==='media'){
   if(item.media.media_type==='photo'){
    const media=dest.experienceType==='home'?homeMediasActifs:mediasPhotosActifs;
    const index=media.findIndex(m=>String(m.id)===item.id);if(index>=0)ouvrirVisionneuse(index);
   }else $('#capsule-audio')?.scrollIntoView({block:'center'});
  }else if(item.kind==='home_item')document.querySelector(`[data-item-id="${item.id}"]`)?.scrollIntoView({block:'center'});
  else if(item.kind==='fragment')document.querySelector(`[data-fragment-id="${item.id}"]`)?.scrollIntoView({block:'center'});
 }
 const hub=node('section',null,'v5-hub');hub.append(node('p','À nous de choisir','map-label'),node('h2','Notre espace à deux'));
 const shortcuts=node('div',null,'v5-shortcuts');hub.append(shortcuts);$('.hero').after(hub);
 const panels=[];
 const favorites=modal('Mes moments préférés'),wishes=modal('Un jour, peut-être'),exports=modal('Sauvegarder notre histoire'),trash=modal('Corbeille'),book=modal('Notre carnet');
 panels.push(favorites,wishes,exports,trash,book);
 shortcuts.append(b('Mes favoris',openFavorites),b('Nos envies',openWishes),b('Notre carnet',openBook),b('Sauvegardes',openExports),b('Corbeille',openTrash));

 // Profil personnel, sans changer le formulaire de mot de passe existant.
 const profileForm=node('form',null,'v5-profile');
 profileForm.innerHTML='<h3>Mon espace</h3><label>Mon prénom<input id="v5-name" maxlength="60" required autocomplete="given-name"></label><label>Ma photo<input id="v5-avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><img class="v5-avatar-preview" alt="Ma photo" hidden><label class="v5-toggle"><input id="v5-originals" type="checkbox" checked>Conserver les originaux des prochaines photos</label><p>Décocher conserve uniquement la copie optimisée des nouveaux ajouts. Les anciens originaux ne sont jamais supprimés.</p><label class="v5-toggle"><input id="v5-rediscover" type="checkbox" checked>Afficher « À redécouvrir à deux » sur mon accueil</label><button type="submit" class="v5-button">Enregistrer mon profil</button><p id="v5-profile-status" role="status"></p>';
 $('#compte-form').before(profileForm);
 let profileAvatar=null,profileTicket=0;
 async function fillProfile(){
  const uid=S.uid,ticket=++profileTicket;if(!uid)return;
  const {data,error}=await supabaseClient.from('member_profiles').select('*').eq('user_id',uid).maybeSingle();if(error)throw error;
  if(uid!==S.uid||ticket!==profileTicket)return;
  let display=data?.display_name;
  if(!display){const {data:members}=await supabaseClient.rpc('amor_directory');display=members?.find(m=>m.user_id===S.uid)?.display_name||'Nous';}
  if(uid!==S.uid||ticket!==profileTicket)return;
  S.profile=data;S.keepOriginals=data?.preferences?.keep_originals!==false;
  $('#v5-name').value=display;$('#v5-originals').checked=S.keepOriginals;$('#v5-rediscover').checked=data?.preferences?.rediscover!==false;
  $('.hero-label').textContent=`${display}, notre histoire continue.`;
  profileAvatar=data?.avatar_path||null;const image=profileForm.querySelector('img');image.hidden=!profileAvatar;
  if(profileAvatar){const {data:link}=await supabaseClient.storage.from('memories').createSignedUrl(profileAvatar,3600);if(link&&uid===S.uid&&ticket===profileTicket)image.src=link.signedUrl;}
  rediscovery.hidden=data?.preferences?.rediscover===false;
 }
 profileForm.addEventListener('submit',event=>{event.preventDefault();const submit=profileForm.querySelector('[type=submit]');run(submit,async()=>{
  if(!$('#v5-originals').checked && S.keepOriginals && !confirm('Pour les prochaines photos, conserver uniquement la version optimisée ? Les originaux resteront sur votre appareil, mais ne seront pas envoyés dans AMOR.'))return;
  let path=profileAvatar;const file=$('#v5-avatar').files[0];
  if(file){if(file.size>10*1024*1024)throw Error('Photo de profil : 10 Mo maximum.');const blob=await amorResize(file,320,.86);path=`profiles/${S.uid}/${crypto.randomUUID()}.webp`;const {error}=await supabaseClient.storage.from('memories').upload(path,blob,{contentType:blob.type,upsert:false});if(error)throw error;}
  const value={user_id:S.uid,display_name:$('#v5-name').value.trim(),avatar_path:path,preferences:{keep_originals:$('#v5-originals').checked,rediscover:$('#v5-rediscover').checked}};
  const req=S.profile?supabaseClient.from('member_profiles').update({...value,revision:S.profile.revision}).eq('user_id',S.uid):supabaseClient.from('member_profiles').insert(value);
  const {error}=await req.select().single();if(error)throw error;$('#v5-avatar').value='';await fillProfile();invalidate();$('#v5-profile-status').textContent='Profil enregistré.';
 },profileForm);});
 $('#ouvrir-compte').addEventListener('click',()=>{if(S.uid)fillProfile().catch(e=>failure(profileForm,e));});

 // Favoris et échanges : cibles stables (identifiants), pas d'URL signée enregistrée.
 let myFavorites=new Set();
 const key=t=>`${t.kind}:${t.id}`;
 async function refreshFavorites(){const {data,error}=await supabaseClient.from('personal_favorites').select('kind,target_id');if(error)throw error;myFavorites=new Set(data.map(f=>`${f.kind}:${f.target_id}`));}
 function actions(parent,target){
  parent.querySelector(':scope > .v5-actions')?.remove();const line=node('div',null,'v5-actions');
  const star=b(myFavorites.has(key(target))?'♥ Dans mes favoris':'♡ Garder pour moi',()=>run(star,async()=>{
   const selected=myFavorites.has(key(target));const request=selected?supabaseClient.from('personal_favorites').delete().eq('user_id',S.uid).eq('kind',target.kind).eq('target_id',String(target.id)):
    supabaseClient.from('personal_favorites').insert({user_id:S.uid,kind:target.kind,target_id:String(target.id)});
   const {error}=await request;if(error)throw error;await refreshFavorites();invalidate();actions(parent,target);
  },line),'v5-quiet');
  line.append(star,b('Un mot à deux',()=>openReactions(target),'v5-quiet'));parent.append(line);
 }
 function installActions(){
  if(!S.uid)return;
  if(destinationActive&&souvenirsActifs?.id)actions($('#souvenir-view .souvenir-introduction'),{kind:'stay',id:souvenirsActifs.id});
  if(homeActif)actions($('#home-dialog .home-introduction-carte'),{kind:'city',id:homeActif.id});
  document.querySelectorAll('[data-item-id]').forEach(card=>actions(card,{kind:'home_item',id:card.dataset.itemId}));
  document.querySelectorAll('[data-fragment-id]').forEach(card=>actions(card,{kind:'fragment',id:card.dataset.fragmentId}));
  if($('#visionneuse').open){const photo=photosAffichees[indexPhotoActive];const media=[...mediasPhotosActifs,...homeMediasActifs].find(m=>m.url===photo?.url);if(media)actions($('#visionneuse .visionneuse-contenu'),{kind:'media',id:media.id});}
 }
 [$('#vue-dates'),$('#home-items'),$('#visionneuse-legende')].forEach(n=>new MutationObserver(installActions).observe(n,{childList:true}));
 new MutationObserver(installActions).observe($('#souvenir-dialog'),{attributes:true,attributeFilter:['open']});
 new MutationObserver(installActions).observe($('#home-dialog'),{attributes:true,attributeFilter:['open']});
 const noteList=$('.mom-notes-list');if(noteList)new MutationObserver(installActions).observe(noteList,{childList:true});
 document.addEventListener('amor:photos-ready',installActions);
 async function openFavorites(){favorites.c.replaceChildren(node('p','Chargement…'));favorites.d.showModal();try{
  const data=await snapshot(true),catalog=catalogue(data);await refreshFavorites();favorites.c.replaceChildren();
  const items=catalog.filter(item=>myFavorites.has(key(item)));if(!items.length)favorites.c.append(node('p','Vos favoris sont personnels. Gardez une photo, un séjour ou une anecdote depuis sa fiche.'));
  items.forEach(item=>{const card=b('',async()=>{favorites.d.close();await openMoment(item);},'v5-card');card.append(node('small',item.city?.name||''),node('strong',item.title),node('span',item.description));favorites.c.append(card);});
 }catch(error){failure(favorites.c,error,openFavorites);}}
 const reactions=modal('Un mot à deux');panels.push(reactions);
 async function openReactions(target){
  reactions.c.replaceChildren(node('p','Chargement des petits mots…'));if(!reactions.d.open)reactions.d.showModal();
  try{
   const [{data,error},{data:directory}]=await Promise.all([supabaseClient.from('moment_reactions').select('*').eq('kind',target.kind).eq('target_id',String(target.id)).order('created_at'),supabaseClient.rpc('amor_directory')]);
   if(error)throw error;reactions.c.replaceChildren();
   if(!data.length)reactions.c.append(node('p','Un sourire ou quelques mots, sans obligation de répondre.'));
   for(const r of data){const card=node('article',null,'v5-note');const person=directory?.find(p=>p.user_id===r.user_id);card.append(node('small',person?.display_name||'Nous'),node('p',[r.emoji,r.message].filter(Boolean).join(' ')));
    if(person?.avatar_path){const img=node('img',null,'v5-small-avatar');const {data:link}=await supabaseClient.storage.from('memories').createSignedUrl(person.avatar_path,3600);if(link){img.src=link.signedUrl;img.alt='';card.prepend(img);}}
    if(r.user_id===S.uid)card.append(b('Retirer mon mot',async()=>{if(!confirm('Retirer ce mot ?'))return;const {error}=await supabaseClient.from('moment_reactions').delete().eq('id',r.id);if(error)failure(card,error);else{invalidate();openReactions(target);}},'v5-quiet'));reactions.c.append(card);
   }
   const f=node('form');f.innerHTML='<label>Une réaction<select name="emoji"><option value="">Sans réaction</option><option value="♥">♥</option><option value="☺">☺</option><option value="✦">✦</option></select></label><label>Quelques mots<textarea name="message" maxlength="600" rows="3" placeholder="J’avais oublié ce moment…"></textarea></label><button class="v5-button" type="submit">Partager ce petit mot</button>';
   f.onsubmit=event=>{event.preventDefault();const button=f.querySelector('button');run(button,async()=>{
    const emoji=f.elements.emoji.value||null,message=f.elements.message.value.trim();if(!emoji&&!message)throw Error('Choisissez une réaction ou écrivez quelques mots.');
    const {error}=await supabaseClient.from('moment_reactions').insert({user_id:S.uid,kind:target.kind,target_id:String(target.id),emoji,message});if(error)throw error;invalidate();await openReactions(target);
   },f);};reactions.c.append(f);
  }catch(error){failure(reactions.c,error,()=>openReactions(target));}
 }

 // Redécouverte facultative : pas de notification, d'objectif ou de compteur.
 const rediscovery=node('section',null,'v5-rediscovery');rediscovery.append(node('p','À redécouvrir à deux','map-label'));hub.after(rediscovery);
 let lastRediscovery=null;
 async function rediscover(){
  if(!S.uid||S.profile?.preferences?.rediscover===false)return;
  try{const data=await snapshot(),items=catalogue(data).filter(i=>i.kind!=='city');
   rediscovery.replaceChildren(node('p','À redécouvrir à deux','map-label'));
   if(!items.length){rediscovery.append(node('p','Vos moments reviendront ici, au fil de votre histoire.'));return;}
   const candidates=items.filter(i=>key(i)!==lastRediscovery),item=(candidates.length?candidates:items)[Math.floor(Math.random()*(candidates.length||items.length))];lastRediscovery=key(item);
   rediscovery.append(node('h3',item.city?.name||item.title),node('p',item.kind==='media'?(item.media.media_type==='audio'?'Un son, une voix, un moment à retrouver.':'Une image de notre histoire.'):item.description||item.title));
   if(item.media?.media_type==='photo'){const {data:link}=await supabaseClient.storage.from('memories').createSignedUrl(item.media.display_path||item.media.storage_path,3600);if(link){const image=node('img');image.src=link.signedUrl;image.alt=item.title;rediscovery.prepend(image);}}
   const row=node('div',null,'v5-actions');row.append(b('Retrouver ce moment',()=>openMoment(item)),b('Un autre',rediscover,'v5-quiet'));rediscovery.append(row);
  }catch(error){rediscovery.replaceChildren(node('p','À redécouvrir à deux','map-label'));failure(rediscovery,error,rediscover);}
 }

 // Envies : édition libre puis conversion atomique, uniquement sur demande.
 async function openWishes(){wishes.c.replaceChildren(node('p','Chargement…'));if(!wishes.d.open)wishes.d.showModal();try{
  const {data,error}=await supabaseClient.from('shared_wishes').select('*').is('deleted_at',null).order('created_at',{ascending:false});if(error)throw error;wishes.c.replaceChildren(node('p','Des propositions sans échéance, à garder tant qu’elles vous font envie.'));
  wishes.c.append(b('Garder une nouvelle envie',()=>editWish()));
  data.forEach(w=>{const card=node('article',null,'v5-note');card.append(node('h3',w.title),node('p',w.description),node('small',w.destination?.ville?[w.destination.ville,w.destination.countryName].filter(Boolean).join(' · '):'Pas de destination imposée'));
   card.append(b('Modifier',()=>editWish(w),'v5-quiet'));
   if(w.converted_stay_id)card.append(b('Revoir ce voyage',async()=>{wishes.d.close();const dest=destinations.find(d=>d.id===w.destination?.id);if(dest)await ouvrirFiche(dest,w.converted_stay_id);else alert('Le voyage est peut-être dans la corbeille.');}));
   else card.append(b('On l’a vécu : créer le souvenir',()=>convertWish(w)));
   card.append(b('Mettre à la corbeille',async()=>{if(!confirm(`Mettre « ${w.title} » à la corbeille ?`))return;const {error}=await amorTrashQuery('shared_wishes').eq('id',w.id);if(error)failure(card,error);else{invalidate();openWishes();}},'v5-quiet'));wishes.c.append(card);});
 }catch(error){failure(wishes.c,error,openWishes);}}
 const wishEditor=modal('Une envie, pour un jour');panels.push(wishEditor);
 function editWish(existing=null){
  let destination=existing?.destination||null;
  wishEditor.c.innerHTML='<form id="v5-wish-form"><label>Notre idée<input name="title" maxlength="120" required placeholder="Un week-end à Lisbonne…"></label><label>Ce qui nous tente<textarea name="description" maxlength="2000" rows="4"></textarea></label><label>Une destination, facultative<input name="geo" type="search" placeholder="Ville et pays"></label><button type="button" class="v5-quiet" id="v5-wish-search">Chercher une ville</button><p id="v5-wish-place"></p><div id="v5-wish-results"></div><button type="submit" class="v5-button">Garder cette envie</button></form>';
  const f=$('#v5-wish-form');f.elements.title.value=existing?.title||'';f.elements.description.value=existing?.description||'';
  const place=()=>$('#v5-wish-place').textContent=destination?`${destination.ville} · ${destination.countryName}`:'Pas de destination choisie.';place();
  f.append(b('Retirer la destination',()=>{destination=null;place();},'v5-quiet'));
  $('#v5-wish-search').onclick=()=>run($('#v5-wish-search'),async()=>{
   if(f.elements.geo.value.trim().length<2)throw Error('Précisez une ville ou un pays.');
   const results=await amorGeocode(f.elements.geo.value.trim()),list=$('#v5-wish-results');list.replaceChildren();
   if(!results.length)list.append(node('p','Aucun résultat. Précisez le pays.'));
   results.forEach(c=>list.append(b([c.ville,c.countryName].filter(Boolean).join(' · '),()=>{destination=c;place();list.replaceChildren();},'v5-card')));
  },f);
  f.onsubmit=event=>{event.preventDefault();run(f.querySelector('[type=submit]'),async()=>{
   const value={title:f.elements.title.value.trim(),description:f.elements.description.value.trim(),destination};
   const req=existing?supabaseClient.from('shared_wishes').update({...value,revision:existing.revision}).eq('id',existing.id):supabaseClient.from('shared_wishes').insert(value);
   const {error}=await req.select().single();if(error)throw error;invalidate();wishEditor.d.close();openWishes();
  },f);};wishEditor.d.showModal();
 }
 const convert=modal('Transformer cette envie en souvenir');panels.push(convert);
 function convertWish(w){
  convert.c.replaceChildren(node('p',w.destination?`Créer un séjour à ${w.destination.ville}. L’envie restera accessible et liée au voyage.`:'Choisissez d’abord une destination en modifiant cette envie.'));
  if(!w.destination){convert.c.append(b('Choisir une destination',()=>{convert.d.close();editWish(w);}));convert.d.showModal();return;}
  const f=node('form');f.innerHTML='<label>Premier jour, facultatif<input name="start" type="date"></label><label>Dernier jour, facultatif<input name="end" type="date"></label><button type="submit" class="v5-button">Créer notre souvenir</button>';
  f.onsubmit=event=>{event.preventDefault();run(f.querySelector('button'),async()=>{
   const {data,error}=await supabaseClient.rpc('amor_convert_wish',{p_id:w.id,p_start:f.elements.start.value||null,p_end:f.elements.end.value||null});if(error)throw error;
   await refresh();convert.d.close();wishes.d.close();const dest=destinations.find(d=>d.id===w.destination.id);if(dest)await ouvrirFiche(dest,data);
  },f);};convert.c.append(f);convert.d.showModal();
 }

 // Corbeille sans effacement automatique : restauration explicite, médias conservés.
 async function openTrash(){trash.c.replaceChildren(node('p','Chargement…'));if(!trash.d.open)trash.d.showModal();try{
  const {data,error}=await supabaseClient.rpc('amor_trash_list');if(error)throw error;
  trash.c.replaceChildren(node('p','Les fichiers restent conservés. Restaurez d’abord la ville, puis les séjours si leurs éléments sont encore masqués. Aucune purge automatique n’est effectuée.'));
  if(!data.length)trash.c.append(node('p','La corbeille est vide.'));
  data.sort((a,b)=>b.deleted_at.localeCompare(a.deleted_at)).forEach(r=>{const card=node('article',null,'v5-note');card.append(node('strong',r.label),node('small',`${r.table} · ${new Date(r.deleted_at).toLocaleDateString('fr-FR')}`));
   const restore=b('Restaurer',()=>run(restore,async()=>{const {error}=await supabaseClient.rpc('amor_restore',{p_table:r.table,p_id:r.id});if(error)throw error;await refresh();openTrash();},card));card.append(restore);trash.c.append(card);});
 }catch(error){failure(trash.c,error,openTrash);}}

 // Exports chiffrés ? Non : fichiers privés, à conserver dans un lieu sécurisé.
 async function openExports(){exports.c.replaceChildren(node('h3','Une copie que vous gardez'),node('p','Ces fichiers contiennent vos souvenirs privés et ne sont pas chiffrés. Gardez-les dans un emplacement sécurisé. Aucun envoi vers un service tiers.'));
  const scope=node('select');scope.innerHTML='<option value="">Toute notre histoire, y compris la corbeille</option>';
  destinations.forEach(d=>{const o=node('option',d.ville);o.value='city:'+d.id;scope.append(o);
   if(d.experienceType!=='home')d.sejoursResume.forEach((s,i)=>{const entry=node('option',`↳ ${d.ville} · séjour ${i+1}`);entry.value='stay:'+s.id;scope.append(entry);});});
  const label=node('label','Limiter les médias à une ville ou à un séjour');label.append(scope);exports.c.append(label);
  const inScope=s=>!scope.value||(scope.value.startsWith('stay:')?String(s.id)===scope.value.slice(5):String(s.city_id)===scope.value.slice(5));
  const json=b('Exporter les textes et métadonnées (JSON)',()=>run(json,async()=>{const data=await snapshot(true);amorDownload(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'AMOR-sauvegarde.json');},exports.c));
  const media=b('Télécharger les médias et la sauvegarde (ZIP)',()=>run(media,async()=>{
   const data=await snapshot(true);const entries=[{name:'AMOR-sauvegarde.json',blob:new Blob([JSON.stringify(data,null,2)],{type:'application/json'})}];
   const stays=new Set(data.stays.filter(inScope).map(s=>String(s.id)));
   const files=data.stay_media.filter(m=>stays.has(String(m.stay_id)));const done=new Set();let total=0;
   for(const m of files)for(const [kind,path]of [['source',m.storage_path],['ecran',m.display_path],['miniature',m.thumb_path]]){
    if(!path||done.has(path))continue;done.add(path);const {data:blob,error}=await supabaseClient.storage.from('memories').download(path);if(error)throw Error(`Média indisponible : ${m.original_name||m.id}. Réessayez sans supprimer l’original.`);
    total+=blob.size;if(total>300*1024*1024)throw Error('Plus de 300 Mo : choisissez une seule ville pour ce téléchargement.');
    const name=path.split('/').pop().replace(/[^a-zA-Z0-9._-]/g,'_');entries.push({name:`medias/${m.stay_id}/${m.id}-${kind}-${name}`,blob});
   }
   amorDownload(await amorZip(entries),'AMOR-medias-et-sauvegarde.zip');
  },exports.c));exports.c.append(json,media,node('p','Les originaux ne sont inclus que s’ils ont été conservés à l’ajout. Les avatars sont référencés dans le JSON ; le ZIP ci-dessus rassemble les photos et vocaux des souvenirs.'));
  const status=node('p');status.setAttribute('role','status');
  const optimize=b('Accélérer les anciens albums',()=>run(optimize,async()=>{
   const data=await snapshot(true);const ids=new Set(data.stays.filter(inScope).map(s=>String(s.id)));
   const files=data.stay_media.filter(m=>ids.has(String(m.stay_id))&&live(data,'stay_media',m));
   if(!confirm('Créer des copies légères pour ces photos ? Les sources seront conservées et cette opération consommera un peu de stockage supplémentaire.'))return;
   const count=await amorOptimizeExisting(files,n=>status.textContent=`${n} photo(s) optimisée(s)… Gardez cette fenêtre ouverte.`);
   status.textContent=`Terminé : ${count} photo(s) optimisée(s). Les originaux sont inchangés.`;invalidate();await chargerDestinationsDepuisSupabase();
  },exports.c));exports.c.append(node('h3','Entretien des photos'),node('p','Pour les albums importés avant la V5 : générer les miniatures et copies écran, sans supprimer les sources.'),optimize,status);
  exports.d.showModal();
 }

 // Carnet fidèle : sélection de vos vrais contenus, impression PDF du navigateur.
 let printURL=null;
 async function openBook(){book.c.replaceChildren(node('p','Préparation des moments…'));if(!book.d.open)book.d.showModal();try{
  const data=await snapshot(true),items=catalogue(data).filter(i=>i.kind!=='city');book.c.replaceChildren(node('p','Choisissez une année ou composez une sélection libre. Le carnet utilise vos textes, sans récit inventé.'));
  const title=node('input');title.value='Notre histoire, toi et moi';title.maxLength=120;const titleLabel=node('label','Titre du carnet');titleLabel.append(title);book.c.append(titleLabel);
  const year=node('select');year.append(node('option','Toutes les années'));year.options[0].value='';
  [...new Set(items.map(i=>i.date?.slice(0,4)).filter(Boolean))].sort().reverse().forEach(y=>{const o=node('option',y);o.value=y;year.append(o);});
  const dates=node('label','Une année, si vous voulez');dates.append(year);book.c.append(dates);const list=node('div',null,'v5-book-selection');book.c.append(list);
  function render(){list.replaceChildren();items.filter(i=>!year.value||i.date?.startsWith(year.value)).forEach((item,index)=>{const l=node('label',null,'v5-toggle');const c=node('input');c.type='checkbox';c.checked=index<20;c.dataset.key=key(item);l.append(c,node('span',`${item.city?.name||''} · ${item.title}`));list.append(l);});}year.onchange=render;render();
  const generate=b('Composer le carnet',()=>run(generate,async()=>{
   const keys=new Set([...list.querySelectorAll('input:checked')].map(c=>c.dataset.key));const selected=items.filter(i=>keys.has(key(i)));
   if(!selected.length)throw Error('Choisissez au moins un moment.');if(selected.length>60)throw Error('Composez des carnets de 60 moments maximum pour garder une impression légère.');
   const pages=[];let total=0;
   for(const i of selected){let picture='';
    let m=i.media?.media_type==='photo'?i.media:data.stay_media.find(m=>m.media_type==='photo'&&live(data,'stay_media',m)&&String(m.stay_id)===String(i.stay?.id));
    if(m){const {data:blob,error}=await supabaseClient.storage.from('memories').download(m.display_path||m.storage_path);if(error)throw Error('Une photo est indisponible. Réessayez ou retirez ce moment de la sélection.');total+=blob.size;if(total>80*1024*1024)throw Error('Carnet trop volumineux : réduisez la sélection.');
     const dataURL=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});picture=`<img src="${amorEscape(dataURL)}" alt="">`;}
    let words=i.description||'';
    if(i.kind==='stay')words=[i.stay.shared_quote,i.stay.amine_place&&`Amine — lieu préféré : ${i.stay.amine_place}`,i.stay.maena_place&&`Maéna — lieu préféré : ${i.stay.maena_place}`,i.stay.amine_quote,i.stay.maena_quote,i.stay.music&&`Notre musique : ${i.stay.music}`].filter(Boolean).join('\n\n');
    pages.push(`<article><p class="meta">${amorEscape(i.city?.name||'')} ${i.date?'· '+amorEscape(formaterDate(i.date)):''}</p><h2>${amorEscape(i.title)}</h2>${picture}<p class="words">${amorEscape(words)}</p>${i.media?.media_type==='audio'?'<p>Une capsule audio fait partie de ce moment. Retrouvez-la dans AMOR.</p>':''}</article>`);
   }
   const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><title>${amorEscape(title.value)}</title><style>body{margin:0;background:#fffaf7;color:#291b1f;font:16px/1.7 Georgia,serif}header,article{max-width:700px;margin:auto;padding:55px 35px}h1{font-size:48px;color:#7f263e}h2{font-size:32px;font-weight:400}.meta{font:12px Arial;color:#7f263e;letter-spacing:2px}img{width:100%;max-height:500px;object-fit:contain}.words{white-space:pre-wrap}article{break-before:page}button{padding:16px;background:#7f263e;color:white;border:0;border-radius:12px}@media print{button{display:none}@page{size:A4;margin:15mm}header,article{padding:15px;max-width:none}}</style><header><p>AMOR · Amine & Maéna</p><h1>${amorEscape(title.value)}</h1><p>Des moments choisis dans notre histoire.</p><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></header>${pages.join('')}</html>`;
   if(printURL)URL.revokeObjectURL(printURL);printURL=URL.createObjectURL(new Blob([html],{type:'text/html'}));
   const result=node('div',null,'v5-book-result');result.append(node('p','Le carnet est prêt. Ouvrez-le puis choisissez Imprimer / Enregistrer en PDF. Sur iPhone, utilisez aussi Partager depuis l’aperçu d’impression.'));
   const a=node('a','Ouvrir le carnet imprimable','v5-button');a.href=printURL;a.target='_blank';a.rel='noopener';result.append(a,b('Télécharger le carnet autonome',()=>amorDownload(new Blob([html],{type:'text/html'}),'AMOR-carnet.html'),'v5-quiet'));book.c.append(result);
  },book.c));book.c.append(generate);
 }catch(error){failure(book.c,error,openBook);}}

 // Les conflits ne déclenchent jamais d'écrasement ou de rechargement automatique.
 const conflict=modal('Deux versions de ce moment');panels.push(conflict);
 document.addEventListener('amor:conflict',()=>{
  conflict.c.replaceChildren(node('p','Ce contenu a changé depuis son ouverture. Votre saisie reste disponible. Fermez ce message pour la copier ou conserver votre brouillon, puis rechargez la fiche avant de réessayer.'));
  conflict.c.append(b('Garder ma saisie et revenir',()=>conflict.d.close()),b('Recharger l’application',()=>{
   if(confirm('Recharger maintenant ? Copiez les textes importants. Les photos et vocaux non envoyés devront être sélectionnés de nouveau.'))location.reload();
  },'v5-quiet'));if(!conflict.d.open)conflict.d.showModal();invalidate();
 });
 document.addEventListener('amor:data-ready',()=>{const count=new Set(destinations.map(d=>d.countryCode).filter(Boolean)).size;
  let label=$('#v5-country-count');if(!label){label=node('p',null,'v5-country-count');label.id='v5-country-count';$('.dashboard-geographie').append(label);}label.textContent=`${count} pays partagé${count>1?'s':''} · Régions et départements : France uniquement`;
 });
 const heading=$('.hero h1');if(heading.firstChild)heading.firstChild.textContent='Le monde, ';
 document.querySelectorAll('.hero-label').forEach(n=>n.textContent='Notre histoire, ici et ailleurs');
 $('#recherche-ville').placeholder='Exemple : Kyoto, Japon';
 document.querySelector('#ajout-ville-form .fiche-secondaire').textContent='Recherche mondiale sur demande. Précisez le pays pour distinguer les villes homonymes.';
 let firstFit=true;
 document.addEventListener('amor:data-ready',()=>{if(firstFit&&destinations.length){map.fitBounds(destinations.map(d=>[d.latitude,d.longitude]),{padding:[30,30],maxZoom:7});firstFit=false;}});
 async function identity(){
  const ticket=++accountTicket;const {data}=await supabaseClient.auth.getSession();if(ticket!==accountTicket)return;S.uid=data.session?.user?.id||null;
  if(!S.uid)return;try{await fillProfile();if(ticket!==accountTicket)return;await refreshFavorites();if(ticket!==accountTicket)return;installActions();await rediscover();}catch(error){if(ticket===accountTicket)failure(hub,error,identity);}
 }
 new MutationObserver(()=>{
  if($('#auth-screen').hidden)identity();else{accountTicket++;S.uid=null;S.profile=null;S.keepOriginals=true;invalidate();myFavorites.clear();
   panels.forEach(p=>{p.d.close();p.c.replaceChildren();});reactions.d.close();profileForm.reset();rediscovery.replaceChildren();if(printURL){URL.revokeObjectURL(printURL);printURL=null;}}
 }).observe($('#auth-screen'),{attributes:true,attributeFilter:['hidden']});
 if($('#auth-screen').hidden)identity();
 document.addEventListener('amor:trashed',()=>{invalidate();});
})();
