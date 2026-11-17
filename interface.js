/* V6 : navigation, confort tactile et synchronisation non intrusive. */
(() => {
 const S=AmorV5,$=s=>document.querySelector(s);
 const E=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const B=(text,fn,cls='v6-button')=>{const n=E('button',text,cls);n.type='button';n.onclick=fn;return n;};
 function D(title,protect=false){const d=E('dialog',null,'v6-dialog'),h=E('header'),c=E('div',null,'v6-content'),heading=E('h2',title);heading.id='v6-'+crypto.randomUUID();d.setAttribute('aria-labelledby',heading.id);
  const mayClose=()=>!protect||d.dataset.changed!=='true'||confirm('Fermer sans enregistrer ces modifications ?');
  h.append(heading,B('Fermer',()=>{if(mayClose())d.close();},'v6-quiet'));d.append(h,c);document.body.append(d);
  if(protect){d.addEventListener('input',()=>d.dataset.changed='true');d.addEventListener('change',()=>d.dataset.changed='true');d.addEventListener('cancel',event=>{if(!mayClose())event.preventDefault();});d.addEventListener('close',()=>{delete d.dataset.changed;});}
  return {d,c};}
 function fail(parent,error,retry){const n=E('div',null,'v6-error');n.setAttribute('role','alert');n.append(E('p',error?.message||String(error)));if(retry)n.append(B('Réessayer',()=>{n.remove();retry();}));parent.append(n);amorConflict(error);}
 async function run(button,fn,parent){if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');try{return await fn();}catch(error){fail(parent,error);}finally{button.disabled=false;button.removeAttribute('aria-busy');}}
 window.AmorV6={E,B,D,fail,run,dirty:false,uploading:false,theme:'system'};
 const V=AmorV6;
 // Réglages sortis de l'accueil ; les boutons conservent leurs gestionnaires.
 const settings=D('Réglages');const tools=$('.v5-shortcuts');
 const maintenance=E('div',null,'v6-settings-tools');[...tools.children].filter(n=>['Sauvegardes','Corbeille'].includes(n.textContent)).forEach(n=>maintenance.append(n));
 settings.c.append(E('h3','Application et entretien'),maintenance);
 $('.v5-hub > .map-label').textContent='Accès rapides';$('.v5-hub h2').textContent='Retrouver nos moments';
 const gear=B('Réglages',()=>settings.d.showModal(),'v6-settings-trigger');$('.header-actions').prepend(gear);
 const theme=E('select');theme.setAttribute('aria-label','Thème de l’application');
 [['system','Automatique — selon le téléphone'],['light','Clair'],['dark','Sombre']].forEach(([value,label])=>{const o=E('option',label);o.value=value;theme.append(o);});
 settings.c.append(E('h3','Apparence'),theme,E('p','Le bordeaux AMOR est conservé dans les deux thèmes.'));
 const mediaTheme=matchMedia('(prefers-color-scheme: dark)');
 function setTheme(value){V.theme=value;document.documentElement.dataset.theme=value==='system'?(mediaTheme.matches?'dark':'light'):value;theme.value=value;
  $('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='dark'?'#171419':'#FFFAF7';
  try{localStorage.setItem('amor:theme',value);}catch{} }
 let stored='system';try{stored=localStorage.getItem('amor:theme')||'system';}catch{}setTheme(['system','light','dark'].includes(stored)?stored:'system');
 theme.onchange=()=>setTheme(theme.value);mediaTheme.addEventListener('change',()=>{if(V.theme==='system')setTheme('system');});
 settings.c.append(E('p','AMOR · version 7.0','v6-version'));
 settings.c.append(E('h3','Session'),$('#deconnexion'));
 V.settings=settings;

 // Sélecteur direct des séjours : flèches existantes conservées.
 const stayPicker=D('Choisir un séjour');const indicator=$('.indicateur-sejour');
 const pick=B('',async()=>{
  stayPicker.c.replaceChildren(E('p','Séjours de cette destination, dans le même ordre que les flèches.'));
  sejoursActifs.forEach((stay,index)=>{
   const text=`Séjour ${index+1} · ${stay.dateDebut?formaterDate(stay.dateDebut):'Dates à compléter'}`;
   const item=B(text,()=>{if(index===indexSejourActif){stayPicker.d.close();return;}
    if(modeEdition&&formulaireModifie&&!confirm('Changer de séjour ? Le brouillon texte reste sur cet appareil ; les fichiers non envoyés sont à sélectionner de nouveau.'))return;
    readingTop=0;stayPicker.d.close();afficherModeConsultation();afficherSejour(index);
   },'v6-stay-choice');
   item.setAttribute('aria-current',index===indexSejourActif?'true':'false');stayPicker.c.append(item);
  });stayPicker.d.showModal();
 },'v6-stay-picker');indicator.before(pick);pick.append(indicator);
 pick.setAttribute('aria-label','Choisir directement un séjour');
 // Miniatures des séjours, chargées uniquement à l'ouverture du sélecteur.
 pick.addEventListener('click',async()=>{const city=destinationActive?.id;if(!city)return;try{
  const data=await S.snapshot(),media=data.stay_media.filter(m=>m.media_type==='photo'&&S.live(data,'stay_media',m));
  for(const [index,stay]of sejoursActifs.entries()){
   const m=media.find(m=>String(m.stay_id)===String(stay.id));if(!m)continue;
   const {data:link}=await supabaseClient.storage.from('memories').createSignedUrl(m.thumb_path||m.display_path||m.storage_path,3600);
   if(!stayPicker.d.open||destinationActive?.id!==city)break;
   if(link){const img=E('img');img.src=link.signedUrl;img.alt='';stayPicker.c.querySelectorAll('.v6-stay-choice')[index]?.prepend(img);}
  }
 }catch{} });

 // Onglets Amine/Maéna : aucun champ n'est désactivé ou déplacé hors du formulaire.
 function duo(container){
  const cards=[...container.children].filter(n=>n.classList.contains('reponse-personne'));if(cards.length!==2)return;
  const tabs=E('div',null,'v6-duo-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Réponses personnelles');
  let active=0;
  function choose(i){active=i;cards.forEach((card,n)=>{card.classList.toggle('v6-person-off',n!==i);});
   [...tabs.children].forEach((b,n)=>{b.setAttribute('aria-selected',String(n===i));b.tabIndex=n===i?0:-1;});}
  cards.forEach((card,i)=>{const id='v6-person-'+crypto.randomUUID();card.id ||= id;
   const button=B(card.querySelector('h4').textContent.trim(),()=>choose(i));button.setAttribute('role','tab');button.id=id+'-tab';button.setAttribute('aria-controls',card.id);
   card.setAttribute('aria-labelledby',button.id);tabs.append(button);});
  tabs.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();choose(active===0?1:0);tabs.children[active].focus();}});
  container.before(tabs);choose(0);
  let x=null;container.addEventListener('touchstart',e=>{x=e.touches.length===1&&!e.target.closest('input,textarea,select,button')?e.touches[0]:null;},{passive:true});
  container.addEventListener('touchend',e=>{if(!x||!e.changedTouches.length)return;const t=e.changedTouches[0],dx=t.clientX-x.clientX,dy=t.clientY-x.clientY;x=null;if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*2)choose(dx<0?1:0);},{passive:true});
 }
 document.querySelectorAll('#souvenir-view .reponses-duo,#edition-personnes .reponses-duo').forEach(duo);
 // Les champs requis cachés par un onglet sont montrés si la validation les vise.
 $('#souvenir-form').addEventListener('invalid',event=>{const card=event.target.closest('.reponse-personne');if(card?.classList.contains('v6-person-off'))card.parentElement.previousElementSibling.querySelector(`[aria-controls="${card.id}"]`)?.click();},true);

 // Clavier : conserver le champ dans la partie réellement visible de la fenêtre.
 const viewport=window.visualViewport;let focusTimer=null;
 function keyboard(){const height=viewport?.height||innerHeight;document.documentElement.style.setProperty('--v6-visible-height',height+'px');
  document.body.classList.toggle('v6-keyboard',innerHeight-height>140);
  clearTimeout(focusTimer);focusTimer=setTimeout(()=>{const input=document.activeElement;if(!input?.matches('input,textarea,select'))return;
   const r=input.getBoundingClientRect(),bottom=height+(viewport?.offsetTop||0);if(r.bottom>bottom-95||r.top<80)input.scrollIntoView({block:'center',behavior:'smooth'});
  },150);
 }
 viewport?.addEventListener('resize',keyboard);document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,150));
 let readingTop=0;
 $('#modifier-fiche').addEventListener('click',()=>{readingTop=$('#souvenir-dialog').scrollTop;},true);
 const consultation=afficherModeConsultation;afficherModeConsultation=function(){consultation();requestAnimationFrame(()=>{if($('#souvenir-dialog').open)$('#souvenir-dialog').scrollTop=readingTop;});};
 const open=ouvrirFiche;ouvrirFiche=async function(...args){readingTop=0;return open(...args);};

 // Synchronisation par horloge : aucun remplacement pendant une saisie ou un upload.
 let dirtyForms=new Set(),version=null,channel=null,poll=null,debounce=null,refreshing=false,pendingRemote=false;
 document.addEventListener('input',e=>{const f=e.target.closest('form');if(f)dirtyForms.add(f);V.dirty=dirtyForms.size>0;});
 ['amor:saved','amor:home-saved','amor:moment-saved'].forEach(name=>document.addEventListener(name,()=>{dirtyForms.clear();V.dirty=false;}));
 const banner=E('div',null,'v6-sync-banner');banner.hidden=true;banner.setAttribute('role','status');
 function showRemote(){banner.replaceChildren(E('span','Du nouveau dans AMOR. Votre saisie n’a pas été remplacée.'),B('Actualiser après ma saisie',()=>{
  if(isBusy()&&!confirm('Actualiser les données ? Conservez votre saisie ou son brouillon avant de poursuivre.'))return;
  if(V.uploading){alert('Attendez la fin de l’envoi ou annulez-le.');return;}dirtyForms.clear();V.dirty=false;afficherModeConsultation();remoteRefresh(true);
 },'v6-quiet'));banner.hidden=false;(document.activeElement?.closest('dialog')||($('#souvenir-dialog').open?$('#souvenir-dialog'):$('#home-dialog').open?$('#home-dialog'):document.body)).append(banner);}
 function isBusy(){return V.uploading||(modeEdition&&formulaireModifie)||[...dirtyForms].some(f=>f.isConnected&&!f.hidden&&f.getClientRects().length)||document.querySelector('.visionneuse[open],.mom-dialog[open] form,.v5-dialog[open] form,.v6-dialog[open]');}
 async function remoteRefresh(force=false){if(!S.uid)return;if(refreshing){pendingRemote=true;return;}if(!force&&isBusy()){showRemote();return;}
  refreshing=true;try{const id=destinationActive?.id,stay=souvenirsActifs?.id,home=homeActif?.id,reading=$('#souvenir-dialog').scrollTop,homeReading=$('#home-dialog').scrollTop;
   S.invalidate();await chargerDestinationsDepuisSupabase();await chargerPremieresFois();
   if($('#souvenir-dialog').open&&id){const d=destinations.find(d=>d.id===id);if(d)await ouvrirFiche(d,stay);else $('#souvenir-dialog').close();}
   if($('#home-dialog').open&&home){const d=destinations.find(d=>d.id===home);if(d)await ouvrirFicheHome(d);else $('#home-dialog').close();}
   requestAnimationFrame(()=>{$('#souvenir-dialog').scrollTop=reading;$('#home-dialog').scrollTop=homeReading;});
   banner.hidden=true;document.dispatchEvent(new CustomEvent('amor:remote-update'));
  }catch{showRemote();}finally{refreshing=false;if(pendingRemote){pendingRemote=false;clearTimeout(debounce);debounce=setTimeout(()=>remoteRefresh(),900);}}
 }
 async function checkVersion(){if(!S.uid||document.hidden)return;const {data,error}=await supabaseClient.rpc('amor_sync_version');if(error||data==null)return;
  if(version!==null&&BigInt(data)>BigInt(version)){version=data;V.refreshResponses?.();clearTimeout(debounce);debounce=setTimeout(()=>remoteRefresh(),900);}else if(version===null)version=data;
 }
 V.refreshRemote=remoteRefresh;
 document.addEventListener('close',()=>{setTimeout(()=>{if(!banner.hidden&&!isBusy())remoteRefresh();},100);},true);
 function startSync(){if(channel)supabaseClient.removeChannel(channel);clearInterval(poll);version=null;
  channel=supabaseClient.channel('amor-v6-'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'amor_sync_clock'},()=>checkVersion()).subscribe();
  poll=setInterval(checkVersion,45000);checkVersion();
 }
 document.addEventListener('amor:identity-ready',startSync);window.addEventListener('focus',checkVersion);document.addEventListener('visibilitychange',checkVersion);
 new MutationObserver(()=>{if($('#auth-screen').hidden)return;clearInterval(poll);clearTimeout(debounce);if(channel){supabaseClient.removeChannel(channel);channel=null;}dirtyForms.clear();V.dirty=false;banner.hidden=true;}).observe($('#auth-screen'),{attributes:true,attributeFilter:['hidden']});
 if(S.uid)startSync();

 // Mise à jour explicite : le service worker attend, jamais de rechargement forcé.
 const update=E('div',null,'v6-update');update.hidden=true;document.body.append(update);let accepted=false;
 if('serviceWorker'in navigator){navigator.serviceWorker.ready.then(reg=>{
  function offer(){if(!reg.waiting)return;update.replaceChildren(E('span','Une nouvelle version d’AMOR est prête.'),B('Mettre à jour',()=>{
   if(V.uploading){alert('Terminez ou annulez l’envoi avant la mise à jour.');return;}
   if(isBusy()&&!confirm('Mettre à jour maintenant ? Gardez les brouillons et resélectionnez ensuite les fichiers non envoyés.'))return;
   accepted=true;reg.waiting?.postMessage({type:'ACTIVATE_UPDATE'});
  }));update.hidden=false;}
  offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',offer);});
  settings.c.append(B('Vérifier les mises à jour',async()=>{await reg.update();offer();},'v6-quiet'));
 });navigator.serviceWorker.addEventListener('controllerchange',()=>{if(accepted)location.reload();});}
})();
