/* Bibliothèque, destinations, regroupements de séjours et organisation d'album. */
(() => {
 const S=AmorV5,V=AmorV6,{E,B,D,run,fail}=V,$=s=>document.querySelector(s);
 let data=null,urls=new Map(),libraryRows=[],libraryIndex=0,photoZoom=null;
 const library=D('Notre photothèque'),journeys=D('Nos voyages'),journeyEditor=D('Les étapes du voyage',true),album=D('Organiser cet album',true);
 const shortcuts=$('.v5-shortcuts');shortcuts.prepend(B('Photothèque',()=>openLibrary()),B('Nos voyages',openJourneys));
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 async function getData(){data=await S.snapshot(true);return data;}
 async function sign(media){const paths=[...new Set(media.flatMap(m=>[m.thumb_path||m.display_path||m.storage_path,m.display_path||m.storage_path]))];
  const map=new Map();for(let i=0;i<paths.length;i+=100){const batch=paths.slice(i,i+100);const {data,error}=await supabaseClient.storage.from('memories').createSignedUrls(batch,3600);if(error)throw error;batch.forEach((p,j)=>map.set(p,data[j]?.signedUrl));}return map;}
 function mediaContext(m){const stay=data.stays.find(s=>String(s.id)===String(m.stay_id));return {stay,city:data.cities.find(c=>String(c.id)===String(stay?.city_id))};}
 async function openLibrary(){
  library.c.innerHTML='<p>Vos images, sans devoir ouvrir chaque fiche.</p><div class="v6-filters"><label>Rechercher<input id="v6-library-query" type="search" placeholder="Ville ou légende"></label><label>Ville<select id="v6-library-city"><option value="">Toutes</option></select></label><label>Année<select id="v6-library-year"><option value="">Toutes, y compris sans date</option></select></label><label><input id="v6-library-favorites" type="checkbox">Mes favoris seulement</label></div><p id="v6-library-count" role="status"></p><div class="v6-photo-grid" id="v6-library-grid"></div>';
  if(!library.d.open)library.d.showModal();
  try{await getData();const photos=data.stay_media.filter(m=>m.media_type==='photo'&&S.live(data,'stay_media',m));urls=await sign(photos);
   data.cities.filter(c=>S.live(data,'cities',c)).forEach(c=>{const o=E('option',c.name);o.value=c.id;$('#v6-library-city').append(o);});
   const years=[...new Set(photos.map(m=>mediaContext(m).stay?.date_start?.slice(0,4)).filter(Boolean))].sort().reverse();years.forEach(y=>{const o=E('option',y);o.value=y;$('#v6-library-year').append(o);});
   function render(){const query=normalize($('#v6-library-query').value),city=$('#v6-library-city').value,year=$('#v6-library-year').value,fav=$('#v6-library-favorites').checked;
    libraryRows=photos.filter(m=>{const c=mediaContext(m);return (!city||String(c.city?.id)===city)&&(!year||c.stay?.date_start?.startsWith(year))&&(!query||normalize([c.city?.name,m.caption,m.original_name].join(' ')).includes(query))&&(!fav||data.my_favorites.some(f=>f.kind==='media'&&String(f.target_id)===String(m.id)));});
    $('#v6-library-count').textContent=`${libraryRows.length} photo(s)`;const grid=$('#v6-library-grid');grid.replaceChildren();
    libraryRows.forEach((m,index)=>{const c=mediaContext(m),card=B('',()=>openLibraryPhoto(index),'v6-photo-card'),img=E('img');img.src=urls.get(m.thumb_path||m.display_path||m.storage_path)||'';img.alt=m.caption||m.original_name||'Notre photo';img.loading='lazy';card.append(img,E('strong',c.city?.name||''),E('span',m.caption||c.stay?.date_start&&formaterDate(c.stay.date_start)||'Sans date imposée'));grid.append(card);});
   }
   library.c.querySelectorAll('input,select').forEach(n=>n.addEventListener('input',render));render();
  }catch(error){fail(library.c,error,openLibrary);}
 }
 const photoView=D('Notre photo');
 function openLibraryPhoto(index){libraryIndex=index;const m=libraryRows[index];if(!m)return;const c=mediaContext(m);
  photoZoom?.destroy();photoView.c.replaceChildren();const img=E('img',null,'v6-full-photo');img.src=urls.get(m.display_path||m.storage_path);img.alt=m.caption||m.original_name||'Notre photo';
  const stage=E('div',null,'v6-library-zoom');stage.append(img);photoView.c.append(stage,E('p',m.caption||''),E('small',c.city?.name||''));photoZoom=V.attachZoom(stage,img);
  const row=E('div',null,'v6-action-row'),prev=B('←',()=>openLibraryPhoto(libraryIndex-1)),next=B('→',()=>openLibraryPhoto(libraryIndex+1));prev.disabled=index===0;next.disabled=index===libraryRows.length-1;
  row.append(prev,B('Ouvrir le souvenir',async()=>{photoView.d.close();library.d.close();const dest=destinations.find(d=>d.id===c.city?.id);if(dest){await ouvrirFiche(dest,c.stay.id);}}),next);photoView.c.append(row);if(!photoView.d.open)photoView.d.showModal();
 }
 // La liste complète les destinations sur la même vue que la carte.
 const controls=E('div',null,'v6-map-switch'),list=E('div',null,'v6-destinations');list.hidden=true;
 const mapButton=B('Carte',()=>{list.hidden=true;$('#map').hidden=false;mapButton.setAttribute('aria-pressed','true');listButton.setAttribute('aria-pressed','false');map.invalidateSize();});
 const listButton=B('Liste',()=>{list.hidden=false;$('#map').hidden=true;listButton.setAttribute('aria-pressed','true');mapButton.setAttribute('aria-pressed','false');renderDestinations();});mapButton.setAttribute('aria-pressed','true');listButton.setAttribute('aria-pressed','false');controls.append(mapButton,listButton);$('#map').before(controls,list);
 let countryFilter='',cityQuery='';
 async function renderDestinations(){list.replaceChildren();const query=E('input');query.type='search';query.placeholder='Rechercher une destination';query.value=cityQuery;query.setAttribute('aria-label','Rechercher une destination');const countries=E('select');countries.setAttribute('aria-label','Filtrer par pays');countries.append(E('option','Tous les pays'));countries.options[0].value='';
  [...new Map(destinations.map(d=>[d.countryCode,d.countryName])).entries()].forEach(([code,name])=>{const o=E('option',name);o.value=code;countries.append(o);});countries.value=countryFilter;
  const grid=E('div',null,'v6-city-grid');list.append(query,countries,grid);
  function cards(){cityQuery=query.value;countryFilter=countries.value;grid.replaceChildren();destinations.filter(d=>(!countryFilter||d.countryCode===countryFilter)&&normalize(d.ville).includes(normalize(cityQuery))).forEach(d=>{const card=B('',()=>ouvrirFiche(d),'v6-city-card');if(d.urlPhotoPrincipale){const img=E('img');img.src=d.urlPhotoPrincipale;img.alt='';img.loading='lazy';card.append(img);}card.append(E('strong',d.ville),E('small',d.experienceType==='home'?'Notre chez-nous':d.countryName),E('span',d.experienceType==='home'?'Page permanente':`${d.nombreSejours} séjour(s)`));grid.append(card);});}
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

 // Organisation par boutons tactiles : légendes et mosaïque persistantes.
 let albumRows=[],albumHome=false;
 function openAlbum(home){albumHome=home;const source=home?homeMediasActifs:mediasPhotosActifs;albumRows=source.map(m=>({...m,caption:m.caption||'',in_mosaic:m.in_mosaic!==false}));
  album.c.replaceChildren(E('p','Les flèches changent l’ordre. Masquer une image de la mosaïque ne la supprime pas de l’album.'));
  const target=E('div',null,'v6-album-editor');album.c.append(target);
  function draw(){target.replaceChildren();albumRows.forEach((m,index)=>{
   const card=E('article',null,'v6-album-row'),img=E('img');img.src=m.thumbUrl||m.url;img.alt=m.caption||m.original_name||'';const text=E('textarea');text.value=m.caption;text.maxLength=600;text.rows=2;text.placeholder='Une légende, si vous en avez envie';text.setAttribute('aria-label',`Légende photo ${index+1}`);text.oninput=()=>m.caption=text.value;
   const label=E('label',null,'v6-check'),check=E('input');check.type='checkbox';check.checked=m.in_mosaic;check.onchange=()=>m.in_mosaic=check.checked;label.append(check,E('span','Dans la mosaïque'));
   const up=B('↑',()=>{[albumRows[index-1],albumRows[index]]=[albumRows[index],albumRows[index-1]];album.d.dataset.changed='true';draw();}),down=B('↓',()=>{[albumRows[index],albumRows[index+1]]=[albumRows[index+1],albumRows[index]];album.d.dataset.changed='true';draw();});up.disabled=index===0;down.disabled=index===albumRows.length-1;up.setAttribute('aria-label','Monter cette photo');down.setAttribute('aria-label','Descendre cette photo');
   card.append(img,text,label,up,down);target.append(card);
  });}draw();
  const save=B('Enregistrer l’album',()=>run(save,async()=>{const {error}=await supabaseClient.rpc('amor_save_album',{p_rows:albumRows.map((m,i)=>({id:String(m.id),revision:m.revision,caption:m.caption,sort_order:i,in_mosaic:m.in_mosaic}))});if(error)throw error;S.invalidate();album.d.close();if(albumHome)await chargerPhotosHome(homeActif);else await chargerPhotos(souvenirsActifs);},album.c));album.c.append(save);album.d.showModal();
 }
 $('#galerie-photos').before(B('Organiser l’album',()=>openAlbum(false),'v6-quiet'));$('#home-galerie').before(B('Organiser l’album',()=>openAlbum(true),'v6-quiet'));
 $('#galerie-photos').after(B('Voir tout l’album',()=>{if(photosAffichees.length)ouvrirVisionneuse(0);},'v6-album-all'));
 $('#home-galerie').after(B('Voir tout l’album',()=>{if(photosAffichees.length)ouvrirVisionneuse(0);},'v6-album-all'));
 V.openLibrary=openLibrary;V.openJourneys=openJourneys;
})();
