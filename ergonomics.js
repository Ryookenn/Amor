/* AMOR V7 — utilitaires de navigation et de saisie, sans nouvelle table. */
(() => {
 'use strict';
 const V=AmorV6,S=AmorV5,{E,B,D}=V,$=s=>document.querySelector(s);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const M=window.AmorV7={reduced};
 const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();M.normal=normal;
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(`amor:v7:${S.uid}:${key}`))??fallback;}catch{return fallback;}};
 const write=(key,value)=>{if(S.uid)try{localStorage.setItem(`amor:v7:${S.uid}:${key}`,JSON.stringify(value));}catch{}};M.read=read;M.write=write;
 const live=E('p',null,'v7-sr');live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);
 M.announce=text=>{live.textContent=text;};
 const iconPaths={music:'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',back:'m14 5-7 7 7 7M7 12h14',close:'m6 6 12 12M18 6 6 18',more:'M5 12h.01M12 12h.01M19 12h.01',up:'m6 14 6-6 6 6',down:'m6 10 6 6 6-6',undo:'M9 5 3 10l6 5M3 10h10a7 7 0 0 1 0 14',check:'m5 12 4 4L19 6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',image:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M7 7h.01',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',book:'M3 3h7l2 2 2-2h7v18h-7l-2 2-2-2H3ZM12 5v18',plus:'M12 4v16M4 12h16',moon:'M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11'};
 M.icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('v7-icon');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',iconPaths[name]||iconPaths.more);svg.append(p);return svg;};
 M.button=(text,fn,icon,quiet=true)=>{const b=B(text,fn,quiet?'v6-quiet':'v6-button');if(icon)b.prepend(M.icon(icon));return b;};
 let actionOrigin=null;document.addEventListener('click',event=>{const target=event.target.closest('button,.home-carte,.mom-record,.v6-city-card');if(target){const r=target.getBoundingClientRect();actionOrigin={x:r.left+r.width/2,y:r.top+r.height/2,time:Date.now()};}},true);
 function openMotion(dialog,from){if(reduced()||!dialog.animate)return;const r=dialog.getBoundingClientRect(),fresh=from&&Date.now()-from.time<1800,dx=fresh?(from.x-r.left-r.width/2)*.12:0,dy=fresh?(from.y-r.top-r.height/2)*.12:12;dialog.animate([{opacity:.65,transform:`translate(${dx}px,${dy}px) scale(.96)`},{opacity:1,transform:'none'}],{duration:200,easing:'cubic-bezier(.2,.75,.25,1)'});}

 // Retour vers la source sans reconstruire ses filtres ou sa liste.
 const returns=new Map();let generation=0;const readPositions=new Map();
 M.releaseReturn=target=>{const r=returns.get(target);if(r){target.removeEventListener('close',r.closed);r.button.remove();returns.delete(target);}};
 M.visit=async(source,action,label='la liste')=>{
  const account=S.uid,top=source?.scrollTop||0,y=scrollY,focus=document.activeElement,token=++generation;
  if(source?.open)source.close();
  try{await action();}catch(error){if(source?.isConnected&&account===S.uid&&!source.open)source.showModal();throw error;}
  if(account!==S.uid||token!==generation)return;
  const target=[...document.querySelectorAll('dialog[open]')].at(-1);if(!target||target===source)return;
  const old=returns.get(target);old?.button.remove();if(old)target.removeEventListener('close',old.closed);
  const back=M.button('Retour à '+label,()=>{
   const close=target.querySelector('#fermer-fiche,#fermer-home,header button,.mom-header button');if(close)close.click();else target.close();
  },'back');back.classList.add('v7-context-back');target.prepend(back);
  const closed=()=>{returns.delete(target);back.remove();setTimeout(()=>{
   if(account!==S.uid||!$('#auth-screen').hidden)return;
   if(source?.isConnected&&!source.open)source.showModal();
   if(source)source.scrollTop=top;else window.scrollTo({top:y,behavior:'instant'});
   if(focus?.isConnected&&!focus.closest('[hidden]'))try{focus.focus({preventScroll:true});}catch{}
  },0);};returns.set(target,{button:back,closed});target.addEventListener('close',closed,{once:true});
 };
 function readingKey(){const home=$('#home-dialog').open;return home?'home:'+homeActif?.id:'stay:'+destinationActive?.id+':'+souvenirsActifs?.id;}
 ['#souvenir-dialog','#home-dialog'].forEach(id=>$(id).addEventListener('scroll',()=>{if(!modeEdition)readPositions.set(readingKey(),$(id).scrollTop);},{passive:true}));
 const originalOpen=ouvrirFiche;ouvrirFiche=async function(...args){const from=actionOrigin;await originalOpen(...args);const d=args[0]?.experienceType==='home'?$('#home-dialog'):$('#souvenir-dialog');
  if(!d.open)return;const key=readingKey(),top=readPositions.get(key)||0;requestAnimationFrame(()=>{d.scrollTop=top;});
  if(args[0]?.experienceType!=='home')openMotion(d,from);
 };
 const originalHome=ouvrirFicheHome;ouvrirFicheHome=async function(dest,...args){const from=actionOrigin;await originalHome(dest,...args);const d=$('#home-dialog');if(!d.open)return;requestAnimationFrame(()=>{d.scrollTop=readPositions.get('home:'+dest.id)||0;});openMotion(d,from);};

 // Panneaux secondaires : les éléments originaux et leurs gestionnaires sont conservés.
 const sheets=new Map();
 M.secondary=(owner,buttons,title='Options')=>{
  if(!buttons.length)return;let sheet=sheets.get(owner);
  if(!sheet){sheet=D(title);sheet.d.classList.add('v7-sheet');const trigger=M.button(title,()=>sheet.d.showModal(),'more');trigger.classList.add('v7-options-trigger');
   const anchor=owner.querySelector('.fiche-header-actions,.home-header-actions')||owner.querySelector('header')||owner;anchor.append(trigger);sheets.set(owner,sheet);
   owner.addEventListener('close',()=>{if(sheet.d.open)sheet.d.close();});
  }
  buttons.forEach(b=>{if(!b||sheet.c.contains(b))return;sheet.c.append(b);b.addEventListener('click',()=>sheet.d.close());});return sheet;
 };

 // Images : boîte stable, fond prévisible et erreur lisible (aucun service externe).
 const imageColors=new Map();
 M.image=(url,alt='',ratio='1')=>{const account=S.uid,box=E('span',null,'v7-image-box'),img=E('img'),key=String(url||'').split('?')[0];box.style.aspectRatio=ratio;if(imageColors.has(key))box.style.backgroundColor=imageColors.get(key);img.alt=alt;img.decoding='async';img.loading='lazy';box.append(img);
  img.addEventListener('load',()=>{box.classList.add('v7-image-ready');if(imageColors.has(key)||!url)return;
   // Lecture CORS facultative d'une miniature déjà chargée : repli neutre si refusée.
   const probe=new Image();probe.crossOrigin='anonymous';probe.onload=()=>{if(account!==S.uid)return;try{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(probe,0,0,1,1);const [r,g,b]=ctx.getImageData(0,0,1,1).data,color=`rgb(${r},${g},${b})`;if(imageColors.size>=256)imageColors.delete(imageColors.keys().next().value);imageColors.set(key,color);box.style.backgroundColor=color;}catch{}};probe.src=url;
  },{once:true});img.addEventListener('error',()=>{box.classList.add('v7-image-failed');const text=E('span','Image indisponible');box.append(text);},{once:true});if(url)img.src=url;return box;};

 // Historique local avant enregistrement, jamais de mot de passe ni de fichier.
 const histories=new WeakMap();let replaying=false;
 function controls(form){return [...form.querySelectorAll('input,textarea,select')].filter(n=>!['password','file','hidden','submit','button'].includes(n.type)&&!n.closest('.v7-no-history')).map(n=>{n.id||='v7-field-'+crypto.randomUUID();return n;});}
 const snapshot=form=>controls(form).map(n=>({id:n.id,value:n.type==='checkbox'||n.type==='radio'?n.checked:n.value}));
 function history(form){let h=histories.get(form);if(!h){const initial=snapshot(form);h={initial,last:initial,stack:[],field:null,time:0};histories.set(form,h);}return h;}
 function syncUndo(form){const h=history(form);form.querySelectorAll('.v7-undo').forEach(b=>b.disabled=!h.stack.length);}
 M.resetHistory=form=>{if(form){histories.delete(form);syncUndo(form);form.querySelectorAll('input,textarea,select').forEach(clearError);}};
 M.record=form=>{const h=history(form);h.stack.push(h.last);if(h.stack.length>30)h.stack.shift();h.last=snapshot(form);h.field=null;syncUndo(form);};
 M.undo=form=>{const h=history(form),old=h.stack.pop();if(!old)return;replaying=true;try{for(const f of old){const n=document.getElementById(f.id);if(!n||!form.contains(n))continue;if(n.type==='checkbox'||n.type==='radio')n.checked=f.value;else n.value=f.value;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));}h.last=snapshot(form);h.field=null;}finally{replaying=false;}syncUndo(form);M.announce('Dernière modification annulée, avant enregistrement.');};
 function installHistory(form){if(form.dataset.v7History||form.matches('.v7-no-history')||form.querySelector('input[type=password]'))return;form.dataset.v7History='true';history(form);
  const b=M.button('Annuler la dernière modification',()=>M.undo(form),'undo');b.classList.add('v7-undo');b.disabled=true;
  (form.querySelector('.edition-introduction')||form).append(b);
  form.addEventListener('focusin',()=>{const h=history(form);if(!h.stack.length)h.last=snapshot(form);});
  form.addEventListener('input',e=>{if(replaying||!controls(form).includes(e.target))return;const h=history(form),now=Date.now(),next=snapshot(form);if(JSON.stringify(h.last)===JSON.stringify(next))return;
   if(h.field!==e.target.id||now-h.time>800){h.stack.push(h.last);if(h.stack.length>30)h.stack.shift();}h.field=e.target.id;h.time=now;h.last=next;syncUndo(form);
  });form.addEventListener('reset',()=>setTimeout(()=>M.resetHistory(form),0));
 }
 M.installHistory=installHistory;
 const edit=afficherModeEdition;afficherModeEdition=function(){edit();$('#souvenir-fin').min=$('#souvenir-debut').value;M.resetHistory($('#souvenir-form'));document.dispatchEvent(new CustomEvent('amor:editing'));};
 document.addEventListener('amor:saved',()=>M.resetHistory($('#souvenir-form')));

 // Note tactile, demi-points et saisie précise conservée.
 function rating(input){const row=E('div',null,'v7-rating'),minus=M.button('−',()=>set(-.5)),plus=M.button('+',()=>set(.5)),clear=M.button('Effacer',()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));});
  minus.setAttribute('aria-label','Diminuer la note de 0,5');plus.setAttribute('aria-label','Augmenter la note de 0,5');input.before(row);row.append(minus,input,plus,clear);input.inputMode='decimal';input.setAttribute('aria-label',input.id==='amine-note'?'Note d’Amine sur dix':'Note de Maéna sur dix');
  const ticks=E('div',null,'v7-rating-ticks');ticks.setAttribute('role','group');ticks.setAttribute('aria-label','Choisir une note sur dix');for(let n=0;n<=10;n++){const b=B(String(n),()=>{input.value=String(n);input.dispatchEvent(new Event('input',{bubbles:true}));},'v7-rating-tick');b.setAttribute('aria-label',`${n} sur dix`);ticks.append(b);}row.after(ticks);
  function set(delta){const value=input.value===''?0:Number(input.value);input.value=String(Math.min(10,Math.max(0,Math.round((value+delta)*2)/2)));input.dispatchEvent(new Event('input',{bubbles:true}));}
  function sync(){[...ticks.children].forEach((b,n)=>b.setAttribute('aria-pressed',String(input.value!==''&&Number(input.value)===n)));}
  input.addEventListener('input',sync);document.addEventListener('amor:editing',sync);sync();
 }

 // Choix de période : validation avant de toucher les champs du souvenir.
 const dates=D('Les dates du séjour',true);dates.d.classList.add('v7-sheet');dates.c.innerHTML='<form id="v7-dates-form" class="v7-no-history"><label>Premier jour<input id="v7-date-start" type="date"></label><label>Dernier jour<input id="v7-date-end" type="date"></label><p id="v7-date-preview" role="status"></p><button type="submit" class="v6-button">Utiliser cette période</button></form>';
 const dateStart=$('#souvenir-debut'),dateEnd=$('#souvenir-fin');
 const chooseDates=M.button('Choisir la période',()=>{const f=$('#v7-dates-form');f.reset();$('#v7-date-start').value=dateStart.value;$('#v7-date-end').value=dateEnd.value;period();dates.d.showModal();},'plus');$('#edition-dates').append(chooseDates);
 function period(){const a=$('#v7-date-start'),b=$('#v7-date-end'),invalid=a.value&&b.value&&b.value<a.value;b.min=a.value;b.setCustomValidity(invalid?'La fin doit suivre le premier jour.':'');$('#v7-date-preview').textContent=invalid?'Vérifiez le dernier jour avant de confirmer.':a.value&&b.value?`${formaterDate(a.value)} → ${formaterDate(b.value)}`:'Les dates restent facultatives.';}
 $('#v7-date-start').oninput=()=>{if(!$('#v7-date-end').value)$('#v7-date-end').value=$('#v7-date-start').value;period();};$('#v7-date-end').oninput=period;
 $('#v7-dates-form').onsubmit=e=>{e.preventDefault();period();if(!e.target.reportValidity())return;const f=$('#souvenir-form'),h=history(f);h.stack.push(snapshot(f));replaying=true;try{dateStart.value=$('#v7-date-start').value;dateEnd.value=$('#v7-date-end').value;[dateStart,dateEnd].forEach(n=>n.dispatchEvent(new Event('input',{bubbles:true})));}finally{replaying=false;}h.last=snapshot(f);h.field=null;syncUndo(f);dates.d.close();};
 dateStart.addEventListener('input',()=>{dateEnd.min=dateStart.value;});

 // État stable et erreurs locales associées par aria-describedby.
 const state=E('p','Aucune modification en cours','v7-save-state');state.setAttribute('role','status');state.setAttribute('aria-live','polite');$('#souvenir-dialog .navigation-sejours').after(state);
 function saveState(text,phase){state.textContent=text;state.dataset.phase=phase;}
 $('#souvenir-form').addEventListener('input',()=>{const f=$('#souvenir-form'),changed=JSON.stringify(snapshot(f))!==JSON.stringify(history(f).initial)||fichiersPhotosSelectionnes?.length>0||Boolean(fichierAudioSelectionne);saveState(changed?'Modifications non enregistrées':'Aucune modification en cours',changed?'dirty':'idle');});
 $('#souvenir-form').addEventListener('submit',()=>{setTimeout(()=>{if($('#souvenir-form [type=submit]').disabled)saveState('Enregistrement…','saving');},0);},true);
 document.addEventListener('amor:saved',()=>saveState('Enregistré dans AMOR','saved'));document.addEventListener('amor:editing',()=>saveState('Prêt à modifier','idle'));
 const consultation=afficherModeConsultation;afficherModeConsultation=function(){consultation();saveState('Aucune modification en cours','idle');M.resetHistory($('#souvenir-form'));};
 new MutationObserver(()=>{const text=$('#souvenir-message').textContent;if(/échoué|impossible/i.test(text))saveState('Enregistrement incomplet — votre saisie reste visible','error');else if(/Enregistrement|Envoi|Déblocage/.test(text))saveState('Enregistrement…','saving');}).observe($('#souvenir-message'),{childList:true});
 const errorNodes=new WeakMap();
 function clearError(n){const err=errorNodes.get(n);if(!err)return;n.removeAttribute('aria-invalid');const ids=(n.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==err.id);if(ids.length)n.setAttribute('aria-describedby',ids.join(' '));else n.removeAttribute('aria-describedby');err.remove();errorNodes.delete(n);}
 function inlineError(n){if(!n.matches('input,textarea,select'))return;clearError(n);const p=E('p',n.validationMessage||'Vérifiez cette information.','v7-field-error');p.id='v7-error-'+crypto.randomUUID();p.setAttribute('role','alert');n.setAttribute('aria-invalid','true');n.setAttribute('aria-describedby',[(n.getAttribute('aria-describedby')||''),p.id].filter(Boolean).join(' '));(n.closest('.v7-rating')||n).after(p);errorNodes.set(n,p);}
 document.addEventListener('invalid',e=>inlineError(e.target),true);document.addEventListener('input',e=>{if(e.target.validity?.valid)clearError(e.target);});
 document.addEventListener('reset',e=>{const form=e.target;setTimeout(()=>form.querySelectorAll('input,textarea,select').forEach(clearError),0);},true);

 // Trois accès rapides, sans historique de lieux sur l'accueil.
 const pinned=E('div',null,'v7-pinned');$('.v5-shortcuts').before(pinned);
 const all=E('details',null,'v7-all-access');all.append(E('summary','Tous les accès'));$('.v5-shortcuts').before(all);all.append($('.v5-shortcuts'));const quick=$('.mom-home-tools');if(quick)all.append(quick);
 const options=[['library','Photothèque','image',()=>V.openLibrary()],['journeys','Nos voyages','map',()=>V.openJourneys()],['favorites','Mes favoris','heart',()=>S.openFavorites()],['wishes','Nos envies','plus',()=>S.openWishes()],['book','Notre carnet','book',()=>S.openBook()],['search','Rechercher','search',()=>[...document.querySelectorAll('.mom-home-tools button')].find(b=>b.textContent==='Rechercher')?.click()],['quick','Ajouter un moment','plus',()=>$('.mom-home-tools button')?.click()]];
 function renderPinned(){pinned.replaceChildren();const prefs=read('shortcuts',['library','favorites','search']);prefs.slice(0,3).forEach(id=>{const opt=options.find(x=>x[0]===id);if(opt)pinned.append(M.button(opt[1],opt[3],opt[2]));});}
 const customize=D('Mes trois raccourcis',true);V.settings.c.append(M.button('Personnaliser mes raccourcis',()=>{customize.c.replaceChildren(E('p','Choisissez exactement trois accès pour l’accueil.'));let selected=read('shortcuts',['library','favorites','search']);
  options.forEach(([id,label])=>{const row=E('label',null,'v6-check'),n=E('input');n.type='checkbox';n.checked=selected.includes(id);n.onchange=()=>{selected=n.checked?[...selected,id]:selected.filter(x=>x!==id);};row.append(n,E('span',label));customize.c.append(row);});
  customize.c.append(M.button('Enregistrer mes trois accès',()=>{if(selected.length!==3){M.announce('Choisissez exactement trois raccourcis.');let p=customize.c.querySelector('.v7-field-error');if(!p){p=E('p',null,'v7-field-error');p.setAttribute('role','alert');customize.c.append(p);}p.textContent='Choisissez exactement trois raccourcis.';return;}write('shortcuts',selected);renderPinned();customize.d.close();},'check',false));customize.d.showModal();},'more'));
 document.addEventListener('amor:identity-ready',renderPinned);

 // Repère de focus, noms de fenêtres et contrôles symboliques uniformes.
 function accessibility(root){root.querySelectorAll('dialog').forEach(d=>{if(!d.getAttribute('aria-labelledby')&&!d.getAttribute('aria-label')){const h=d.querySelector('h1,h2,h3');if(h){h.id||='v7-heading-'+crypto.randomUUID();d.setAttribute('aria-labelledby',h.id);}}});
  root.querySelectorAll('button').forEach(b=>{if(b.dataset.v7Icon||b.querySelector('svg,img'))return;const text=b.textContent.trim();const name={Fermer:'close','←':'back','→':'back','↑':'up','↓':'down','•••':'more','✕':'close','×':'close'}[text];if(!name)return;
   b.dataset.v7Icon='true';if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',text==='Fermer'?'Fermer la fenêtre':text==='↑'?'Monter':text==='↓'?'Descendre':text==='←'?'Précédent':text==='→'?'Suivant':'Plus d’options');b.replaceChildren(M.icon(name));if(text==='→')b.firstChild.style.rotate='180deg';});
  root.querySelectorAll('form').forEach(installHistory);
 }
 const changes=new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1){if(node.tagName==='FORM')installHistory(node);accessibility(node);}});
 document.addEventListener('DOMContentLoaded',()=>{
  $('#modifier-fiche').setAttribute('aria-label','Modifier ce souvenir');
  const homeEdit=$('#modifier-home'),homeActions=$('#home-dialog .home-header-actions');if(homeEdit&&homeActions){homeEdit.classList.add('v8-home-edit');homeEdit.setAttribute('aria-label','Modifier notre page');homeEdit.replaceChildren($('#modifier-fiche svg').cloneNode(true),E('span','Modifier'));homeActions.prepend(homeEdit);}
  ['amine-note','maena-note'].forEach(id=>rating($('#'+id)));accessibility(document);changes.observe(document.body,{childList:true,subtree:true});renderPinned();
  const more=$('.mom-more');if(more){const sheet=M.secondary($('#souvenir-dialog'),[...more.querySelectorAll('.mom-more-menu>button')],'Options du souvenir');more.remove();sheet?.d.classList.add('v7-danger-sheet');}
  const covers=[...document.querySelectorAll('.mom-cover-trigger')];for(const b of covers){const owner=b.closest('dialog');if(owner)M.secondary(owner,[b],owner.id==='home-dialog'?'Options de notre chez-nous':'Options du souvenir');}
 });
 new MutationObserver(()=>{if($('#auth-screen').hidden)return;generation++;for(const [d,r]of returns){d.removeEventListener('close',r.closed);r.button.remove();}returns.clear();readPositions.clear();imageColors.clear();pinned.replaceChildren();live.textContent='';}).observe($('#auth-screen'),{attributes:true,attributeFilter:['hidden']});
 M.highlight=node=>{if(!node)return;node.scrollIntoView({block:'center',behavior:reduced()?'instant':'smooth'});node.classList.add('v7-search-hit');node.tabIndex=-1;node.focus({preventScroll:true});setTimeout(()=>node.classList.remove('v7-search-hit'),2300);};
})();
