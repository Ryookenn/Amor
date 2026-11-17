/* Bibliothèque, destinations, regroupements de séjours et organisation d'album. */
(() => {
 const S=AmorV5,V=AmorV6,M=AmorV7,{E,B,D,run,fail}=V,$=s=>document.querySelector(s);
 let data=null,urls=new Map(),libraryRows=[],libraryIndex=0,photoZoom=null;
 const library=D('Notre photothèque'),journeys=D('Nos voyages'),journeyEditor=D('Les étapes du voyage',true),album=D('Organiser cet album',true);
 const shortcuts=$('.v5-shortcuts');shortcuts.prepend(B('Photothèque',()=>openLibrary()),B('Nos voyages',openJourneys));
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 async function getData(){data=await S.snapshot(true);return data;}
 async function sign(media){const paths=[...new Set(media.flatMap(m=>[m.thumb_path||m.display_path||m.storage_path,m.display_path||m.storage_path]))];
  const map=new Map();for(let i=0;i<paths.length;i+=100){const batch=paths.slice(i,i+100);const {data,error}=await supabaseClient.storage.from('memories').createSignedUrls(batch,3600);if(error)throw error;batch.forEach((p,j)=>map.set(p,data[j]?.signedUrl));}return map;}
 function mediaContext(m){const stay=data.stays.find(s=>String(s.id)===String(m.stay_id));return {stay,city:data.cities.find(c=>String(c.id)===String(stay?.city_id))};}
 let libraryState={query:'',city:'',year:'',fav:false},libraryTicket=0,photoTicket=0,moreObserver=null,libraryAccount=null,loadedCount=0,loadMore=null;
 async function openLibrary(){
  const account=S.uid,request=++libraryTicket;moreObserver?.disconnect();const oldTop=library.d.scrollTop;
  if(libraryAccount!==account){libraryState={query:'',city:'',year:'',fav:false};urls=new Map();loadedCount=0;}libraryAccount=account;
  const previousCount=loadedCount;
  library.c.innerHTML='<p>Vos photos, à portée de main.</p><div class="v6-filters"><label>Rechercher<input id="v6-library-query" type="search" placeholder="Ville ou légende"></label><label>Ville<select id="v6-library-city"><option value="">Toutes</option></select></label><label>Année<select id="v6-library-year"><option value="">Toutes, y compris sans date</option></select></label><label><input id="v6-library-favorites" type="checkbox">Mes favoris seulement</label></div><div id="v7-library-chips" class="v7-chips" aria-label="Filtres actifs"></div><p id="v6-library-count" role="status"></p><div class="v6-photo-grid" id="v6-library-grid"></div><div id="v7-library-more"></div>';
  if(!library.d.open)library.d.showModal();
  try{await getData();if(request!==libraryTicket||account!==S.uid)return;const photos=data.stay_media.filter(m=>m.media_type==='photo'&&S.live(data,'stay_media',m));
   data.cities.filter(c=>S.live(data,'cities',c)).forEach(c=>{const o=E('option',c.name);o.value=c.id;$('#v6-library-city').append(o);});
   const years=[...new Set(photos.map(m=>mediaContext(m).stay?.date_start?.slice(0,4)).filter(Boolean))].sort().reverse();years.forEach(y=>{const o=E('option',y);o.value=y;$('#v6-library-year').append(o);});
   function applyState(){$('#v6-library-query').value=libraryState.query;$('#v6-library-city').value=libraryState.city;$('#v6-library-year').value=libraryState.year;$('#v6-library-favorites').checked=libraryState.fav;}
   let renderToken=0;
   async function render(restore=false){const token=++renderToken;moreObserver?.disconnect();
    libraryState={query:$('#v6-library-query').value,city:$('#v6-library-city').value,year:$('#v6-library-year').value,fav:$('#v6-library-favorites').checked};
    const {city,year,fav}=libraryState,query=normalize(libraryState.query);libraryRows=photos.filter(m=>{const c=mediaContext(m);return (!city||String(c.city?.id)===city)&&(!year||c.stay?.date_start?.startsWith(year))&&(!query||normalize([c.city?.name,m.caption,m.original_name].join(' ')).includes(query))&&(!fav||data.my_favorites.some(f=>f.kind==='media'&&String(f.target_id)===String(m.id)));});
    $('#v6-library-count').textContent=`${libraryRows.length} photo(s)`;const grid=$('#v6-library-grid'),chips=$('#v7-library-chips'),more=$('#v7-library-more');grid.replaceChildren();chips.replaceChildren();more.replaceChildren();loadedCount=0;
    [['query',libraryState.query],['city',data.cities.find(c=>c.id===city)?.name],['year',year],['fav',fav?'Favoris':null]].filter(x=>x[1]).forEach(([key,label])=>chips.append(M.button(label+' · Retirer',()=>{libraryState[key]=key==='fav'?false:'';applyState();render();},'close')));
    if(chips.children.length)chips.append(M.button('Tout réinitialiser',()=>{libraryState={query:'',city:'',year:'',fav:false};applyState();render();},'undo'));
    let busy=false;const button=M.button('Charger les photos suivantes',()=>load(), 'plus');more.append(button);
    async function load(){if(busy||token!==renderToken||request!==libraryTicket||account!==S.uid)return;busy=true;button.disabled=true;button.textContent='Chargement…';const start=loadedCount,batch=libraryRows.slice(start,start+24);
     try{const links=await sign(batch);if(token!==renderToken||request!==libraryTicket||account!==S.uid)return;links.forEach((v,k)=>urls.set(k,v));
      batch.forEach((m,i)=>{const c=mediaContext(m),index=start+i,card=B('',()=>openLibraryPhoto(index),'v6-photo-card');card.append(M.image(urls.get(m.thumb_path||m.display_path||m.storage_path),m.caption||m.original_name||'Notre photo'),E('strong',c.city?.name||''),E('span',m.caption||(c.stay?.date_start?formaterDate(c.stay.date_start):'Sans date imposée')));grid.append(card);});
      loadedCount+=batch.length;button.hidden=loadedCount>=libraryRows.length;button.textContent='Charger les photos suivantes';
     }catch(error){button.textContent='Réessayer le chargement';fail(more,error);}finally{busy=false;button.disabled=false;}
    }loadMore=load;await load();
    if(restore){while(loadedCount<Math.min(previousCount,libraryRows.length)&&token===renderToken){const before=loadedCount;await load();if(loadedCount===before)break;}library.d.scrollTop=oldTop;}
    if('IntersectionObserver'in window){moreObserver=new IntersectionObserver(items=>{if(items.some(x=>x.isIntersecting)&&!button.hidden)load();},{root:library.d,rootMargin:'400px'});moreObserver.observe(more);}
    if(!libraryRows.length)grid.append(E('p','Aucune photo avec ces filtres.'));
   }
   applyState();library.c.querySelectorAll('input,select').forEach(n=>n.addEventListener('input',()=>render()));await render(true);
  }catch(error){if(request===libraryTicket&&account===S.uid)fail(library.c,error,openLibrary);}
 }
 library.d.addEventListener('close',()=>moreObserver?.disconnect());
 new MutationObserver(()=>{const more=$('#v7-library-more');if(library.d.open&&more)moreObserver?.observe(more);}).observe(library.d,{attributes:true,attributeFilter:['open']});
 const photoView=D('Notre photo');
 async function openLibraryPhoto(index){const m=libraryRows[index];if(!m)return;const ticket=++photoTicket,account=S.uid;libraryIndex=index;const c=mediaContext(m);
  if(!urls.has(m.display_path||m.storage_path)){try{const links=await sign([m]);if(ticket!==photoTicket||account!==S.uid)return;links.forEach((v,k)=>urls.set(k,v));}catch(error){fail(library.c,error);return;}}
  photoZoom?.destroy();photoView.c.replaceChildren();const img=E('img',null,'v6-full-photo');img.src=urls.get(m.display_path||m.storage_path);img.alt=m.caption||m.original_name||'Notre photo';
  const stage=E('div',null,'v6-library-zoom');stage.append(img);photoView.c.append(stage,E('p',m.caption||''),E('small',c.city?.name||''));photoZoom=V.attachZoom(stage,img);
  const row=E('div',null,'v6-action-row'),prev=B('←',()=>openLibraryPhoto(libraryIndex-1)),next=B('→',()=>openLibraryPhoto(libraryIndex+1));prev.disabled=index===0;next.disabled=index===libraryRows.length-1;
  prev.setAttribute('aria-label','Photo précédente');next.setAttribute('aria-label','Photo suivante');
  row.append(prev,B('Ouvrir le souvenir',async()=>{photoView.d.close();const dest=destinations.find(d=>d.id===c.city?.id);if(dest)await M.visit(library.d,()=>ouvrirFiche(dest,c.stay.id),'la photothèque');}),next);photoView.c.append(row);
  M.photoControls?.(photoView.d,stage);if(!photoView.d.open){photoView.d.showModal();requestAnimationFrame(()=>M.photoTransition(stage));}
 }
 // La liste complète les destinations sur la même vue que la carte.
 const controls=E('div',null,'v6-map-switch'),list=E('div',null,'v6-destinations');list.hidden=true;
 const mapButton=B('Carte',()=>{list.hidden=true;$('#map').hidden=false;mapButton.setAttribute('aria-pressed','true');listButton.setAttribute('aria-pressed','false');map.invalidateSize();});
 const listButton=B('Liste',()=>{list.hidden=false;$('#map').hidden=true;listButton.setAttribute('aria-pressed','true');mapButton.setAttribute('aria-pressed','false');renderDestinations();});mapButton.setAttribute('aria-pressed','true');listButton.setAttribute('aria-pressed','false');controls.append(mapButton,listButton);$('#map').before(controls,list);
 let countryFilter='',cityQuery='';
 async function renderDestinations(){list.replaceChildren();const query=E('input');query.type='search';query.placeholder='Rechercher une destination';query.value=cityQuery;query.setAttribute('aria-label','Rechercher une destination');const countries=E('select');countries.setAttribute('aria-label','Filtrer par pays');countries.append(E('option','Tous les pays'));countries.options[0].value='';
  [...new Map(destinations.map(d=>[d.countryCode,d.countryName])).entries()].forEach(([code,name])=>{const o=E('option',name);o.value=code;countries.append(o);});countries.value=countryFilter;
  const grid=E('div',null,'v6-city-grid');list.append(query,countries,grid);
  const chips=E('div',null,'v7-chips');grid.before(chips);
  function cards(){cityQuery=query.value;countryFilter=countries.value;grid.replaceChildren();chips.replaceChildren();if(cityQuery)chips.append(M.button(cityQuery+' · Retirer',()=>{query.value='';cards();},'close'));if(countryFilter)chips.append(M.button(countries.selectedOptions[0].textContent+' · Retirer',()=>{countries.value='';cards();},'close'));if(chips.children.length)chips.append(M.button('Tout réinitialiser',()=>{query.value='';countries.value='';cards();},'undo'));
   destinations.filter(d=>(!countryFilter||d.countryCode===countryFilter)&&normalize(d.ville).includes(normalize(cityQuery))).forEach(d=>{const card=B('',()=>M.visit(null,()=>ouvrirFiche(d),'la liste'),'v6-city-card');if(d.urlPhotoPrincipale)card.append(M.image(d.urlPhotoPrincipale,'','4/3'));card.append(E('strong',d.ville),E('small',d.experienceType==='home'?'Notre chez-nous':d.countryName),E('span',d.experienceType==='home'?'Page permanente':`${d.nombreSejours} séjour(s)`));grid.append(card);});if(!grid.children.length)grid.append(E('p','Aucune destination avec ces filtres.'));}
  query.oninput=cards;countries.onchange=cards;cards();
 }
 document.addEventListener('amor:data-ready',()=>{if(!list.hidden)renderDestinations();});

 async function openJourneys(){journeys.c.replaceChildren(E('p','Chargement…'));if(!journeys.d.open)journeys.d.showModal();try{
  await getData();journeys.c.replaceChildren(E('p','Regroupez des séjours existants sans dupliquer les villes ni créer de nouvelle visite. Paris et Lyon restent des pages permanentes.'),B('Regrouper un voyage',()=>editJourney()));
  const trips=(data.journeys||[]).filter(j=>!j.deleted_at);if(!trips.length)journeys.c.append(E('p','Aucun regroupement pour le moment.'));
  trips.forEach(j=>{const card=E('article',null,'v6-note');card.append(E('h3',j.title));
   const steps=(data.journey_stays||[]).filter(s=>s.journey_id===j.id).sort((a,b)=>a.sort_order-b.sort_order);
   steps.forEach((step,i)=>{const stay=data.stays.find(s=>String(s.id)===String(step.stay_id)),city=data.cities.find(c=>c.id===stay?.city_id);if(stay&&S.live(data,'stays',stay))card.append(B(`${i+1}. ${city?.name} · ${stay.date_start?formaterDate(stay.date_start):'Date libre'}`,()=>{journeys.d.close();ouvrirFiche(destinations.find(d=>d.id===city.id),stay.id);},'v6-step'));});
   card.append(B('Modifier les étapes',()=>editJourney(j),'v6-quiet'));journeys.c.append(card);});
 }catch(error){fail(journeys.c,error,openJourneys);}}
 function editJourney(existing){
  let chosen=(data.journey_stays||[]).filter(s=>s.journey_id===existing?.id).sort((a,b)=>a.sort_order-b.sort_order).map(s=>String(s.stay_id));
  journeyEditor.c.innerHTML='<form id="v6-journey-form"><label>Nom du voyage<input name="title" required maxlength="120" placeholder="Notre escapade en Provence"></label><div id="v6-journey-choices"></div><h3>Ordre des étapes</h3><div id="v6-journey-order"></div><button class="v6-button" type="submit">Enregistrer ce regroupement</button></form>';
  const f=$('#v6-journey-form');f.elements.title.value=existing?.title||'';
  const stayLabel=id=>{const stay=data.stays.find(s=>String(s.id)===id),city=data.cities.find(c=>c.id===stay?.city_id);return `${city?.name||'Séjour'} · ${stay?.date_start?formaterDate(stay.date_start):'Date libre'}`;};
  function order(){const target=$('#v6-journey-order');target.replaceChildren();chosen.forEach((id,index)=>{const row=E('div',null,'v6-order-row');row.append(E('span',stayLabel(id)));const up=B('↑',()=>{[chosen[index-1],chosen[index]]=[chosen[index],chosen[index-1]];journeyEditor.d.dataset.changed='true';order();}),down=B('↓',()=>{[chosen[index],chosen[index+1]]=[chosen[index+1],chosen[index]];journeyEditor.d.dataset.changed='true';order();});up.disabled=index===0;down.disabled=index===chosen.length-1;up.setAttribute('aria-label','Monter cette étape');down.setAttribute('aria-label','Descendre cette étape');row.append(up,down);target.append(row);});}
  data.stays.filter(s=>S.live(data,'stays',s)&&data.cities.find(c=>c.id===s.city_id)?.experience_type!=='home').forEach(s=>{const other=(data.journey_stays||[]).find(link=>String(link.stay_id)===String(s.id)&&link.journey_id!==existing?.id);const label=E('label',null,'v6-check');const check=E('input');check.type='checkbox';check.value=s.id;check.checked=chosen.includes(String(s.id));check.disabled=Boolean(other);check.onchange=()=>{chosen=check.checked?[...chosen,String(s.id)]:chosen.filter(id=>id!==String(s.id));order();};label.append(check,E('span',stayLabel(String(s.id))+(other?' — déjà dans un autre voyage':'')));$('#v6-journey-choices').append(label);});order();
  f.onsubmit=e=>{e.preventDefault();run(f.querySelector('[type=submit]'),async()=>{if(!chosen.length)throw Error('Choisissez au moins une étape.');const {error}=await supabaseClient.rpc('amor_save_journey',{p_id:existing?.id||null,p_title:f.elements.title.value.trim(),p_stays:chosen.map(Number),p_revision:existing?.revision||null});if(error)throw error;S.invalidate();journeyEditor.d.close();await openJourneys();},f);};journeyEditor.d.showModal();
 }

 // Sélection multiple, déplacement de blocs et annulation avant sauvegarde.
 let albumRows=[],albumHome=false;
 M.moveSelected=(rows,selected,position)=>{const picked=rows.filter(m=>selected.has(String(m.id))),rest=rows.filter(m=>!selected.has(String(m.id)));rest.splice(Math.min(rest.length,Math.max(0,position-1)),0,...picked);return rest;};
 function openAlbum(home){albumHome=home;const source=home?homeMediasActifs:mediasPhotosActifs;albumRows=source.map(m=>({...m,caption:m.caption||'',in_mosaic:m.in_mosaic!==false}));
  const selected=new Set(),history=[],clone=()=>albumRows.map(m=>({...m}));
  album.c.replaceChildren(E('p','Sélectionnez plusieurs photos pour les déplacer ensemble. Rien n’est appliqué avant l’enregistrement.'));
  const toolbar=E('div',null,'v7-batch-tools'),target=E('div',null,'v6-album-editor'),count=E('p');count.setAttribute('role','status');
  const undo=M.button('Annuler la dernière modification',()=>{const previous=history.pop();if(previous){albumRows=previous;draw();M.announce('Dernière modification d’album annulée.');}},'undo');undo.disabled=true;
  function remember(){history.push(clone());if(history.length>30)history.shift();album.d.dataset.changed='true';undo.disabled=false;}
  const all=M.button('Tout sélectionner',()=>{albumRows.forEach(m=>selected.add(String(m.id)));draw();},'check'),none=M.button('Désélectionner',()=>{selected.clear();draw();},'close');
  const position=E('input');position.type='number';position.min='1';position.value='1';position.inputMode='numeric';position.setAttribute('aria-label','Position de départ du groupe de photos');
  const move=M.button('Déplacer le groupe',()=>{const n=Number(position.value);if(!selected.size)return;if(!Number.isInteger(n)||n<1||n>albumRows.length-selected.size+1){M.announce('Choisissez une position valide pour le groupe.');position.reportValidity();return;}remember();albumRows=M.moveSelected(albumRows,selected,n);draw();},'up');
  const show=M.button('Dans la mosaïque',()=>setMosaic(true),'image'),hide=M.button('Hors de la mosaïque',()=>setMosaic(false),'image');
  function setMosaic(value){if(!selected.size)return;remember();albumRows.forEach(m=>{if(selected.has(String(m.id)))m.in_mosaic=value;});draw();}
  toolbar.append(all,none,count,position,move,show,hide,undo);album.c.append(toolbar,target);
  function draw(){const top=album.d.scrollTop;target.replaceChildren();count.textContent=`${selected.size} photo(s) sélectionnée(s)`;position.max=String(Math.max(1,albumRows.length-selected.size+1));[move,show,hide].forEach(b=>b.disabled=!selected.size);none.disabled=!selected.size;undo.disabled=!history.length;
   albumRows.forEach((m,index)=>{const card=E('article',null,'v6-album-row v7-album-row');const pick=E('label',null,'v7-photo-select'),checkbox=E('input');checkbox.type='checkbox';checkbox.checked=selected.has(String(m.id));checkbox.onchange=()=>{if(checkbox.checked)selected.add(String(m.id));else selected.delete(String(m.id));draw();};pick.append(checkbox,E('span',`Photo ${index+1}`));
    const img=M.image(m.thumbUrl||m.url,m.caption||m.original_name||'Notre photo'),text=E('textarea');text.value=m.caption;text.maxLength=600;text.rows=2;text.placeholder='Une légende, si vous en avez envie';text.setAttribute('aria-label',`Légende photo ${index+1}`);let editing=false;text.onfocus=()=>editing=false;text.oninput=()=>{if(!editing){remember();editing=true;}m.caption=text.value;};
    const label=E('label',null,'v6-check'),check=E('input');check.type='checkbox';check.checked=m.in_mosaic;check.onchange=()=>{remember();m.in_mosaic=check.checked;};label.append(check,E('span','Dans la mosaïque'));
    const up=M.button('Monter',()=>{remember();[albumRows[index-1],albumRows[index]]=[albumRows[index],albumRows[index-1]];draw();},'up'),down=M.button('Descendre',()=>{remember();[albumRows[index],albumRows[index+1]]=[albumRows[index+1],albumRows[index]];draw();},'down');up.disabled=index===0;down.disabled=index===albumRows.length-1;up.setAttribute('aria-label',`Monter la photo ${index+1}`);down.setAttribute('aria-label',`Descendre la photo ${index+1}`);
    card.classList.toggle('v7-selected',selected.has(String(m.id)));card.append(pick,img,text,label,up,down);target.append(card);
   });album.d.scrollTop=top;
  }draw();
  const save=B('Enregistrer l’album',()=>run(save,async()=>{const {error}=await supabaseClient.rpc('amor_save_album',{p_rows:albumRows.map((m,i)=>({id:String(m.id),revision:m.revision,caption:m.caption,sort_order:i,in_mosaic:m.in_mosaic}))});if(error)throw error;history.length=0;S.invalidate();album.d.close();if(albumHome)await chargerPhotosHome(homeActif);else await chargerPhotos(souvenirsActifs);},album.c));album.c.append(save);album.d.showModal();
 }
 const albumStay=M.button('Organiser l’album',()=>openAlbum(false),'image'),albumHomeButton=M.button('Organiser l’album',()=>openAlbum(true),'image');
 M.secondary($('#souvenir-dialog'),[albumStay],'Options du souvenir');M.secondary($('#home-dialog'),[albumHomeButton],'Options de notre chez-nous');
 $('#galerie-photos').after(B('Voir tout l’album',()=>{if(photosAffichees.length)ouvrirVisionneuse(0);},'v6-album-all'));
 $('#home-galerie').after(B('Voir tout l’album',()=>{if(photosAffichees.length)ouvrirVisionneuse(0);},'v6-album-all'));
 V.openLibrary=openLibrary;V.openJourneys=openJourneys;
 new MutationObserver(()=>{if($('#auth-screen').hidden)return;libraryTicket++;photoTicket++;moreObserver?.disconnect();photoZoom?.destroy();data=null;urls.clear();libraryRows=[];albumRows=[];libraryState={query:'',city:'',year:'',fav:false};libraryAccount=null;library.c.replaceChildren();photoView.c.replaceChildren();album.c.replaceChildren();}).observe($('#auth-screen'),{attributes:true,attributeFilter:['hidden']});
})();
