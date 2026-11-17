/* Réagir à une réponse, et voir immédiatement qui a laissé un mot. */
(() => {
 const V=AmorV6,S=AmorV5,$=s=>document.querySelector(s),{E,B,D,run,fail}=V;
 const fields=[
  ['amine_place','vue-amine-lieu','Le lieu préféré d’Amine'],['amine_meal','vue-amine-repas','Le repas préféré d’Amine'],
  ['amine_quote','vue-amine-phrase','La phrase d’Amine'],['amine_rating','vue-amine-note','La note d’Amine'],
  ['maena_place','vue-maena-lieu','Le lieu préféré de Maéna'],['maena_meal','vue-maena-repas','Le repas préféré de Maéna'],
  ['maena_quote','vue-maena-phrase','La phrase de Maéna'],['maena_rating','vue-maena-note','La note de Maéna'],
  ['shared_quote','vue-phrase-commune','Notre phrase commune'],['music','vue-musique','Notre musique']
 ];
 let reactions=[],directory=[],avatars=new Map(),ticket=0,active=null;
 const composer=D('Un mot sur cette réponse',true);
 const hosts=new Map();
 for(const [field,id,label]of fields){const value=$('#'+id),host=E('div',null,'v6-response-reactions');host.setAttribute('aria-label','Réactions : '+label);
  if(value.tagName==='DD')value.parentElement.append(host);else value.after(host);hosts.set(field,host);
 }
 function render(){
  for(const [field,id,label]of fields){const host=hosts.get(field),value=$('#'+id);host.replaceChildren();
   const valid=souvenirsActifs?.id&&value.textContent.trim()&&!value.classList.contains('valeur-manquante');host.hidden=!valid;if(!valid)continue;
   const list=reactions.filter(r=>r.field_key===field);
   for(const reaction of list){const person=directory.find(p=>p.user_id===reaction.user_id),name=person?.display_name||'Nous';
    const bubble=B('',()=>open(field,label,reaction),'v6-reaction-bubble');bubble.title=`${name} : ${reaction.message||reaction.emoji}`;
    bubble.setAttribute('aria-label',`${name} a laissé ${reaction.message?'un mot':'une réaction'} sur ${label}. Afficher.`);
    const portrait=E('span',null,'v6-reaction-face');const url=avatars.get(reaction.user_id);
    if(url){const img=E('img');img.src=url;img.alt='';img.onerror=()=>{portrait.textContent=(Array.from(name.trim())[0]||'?').toUpperCase();};portrait.append(img);}else portrait.textContent=(Array.from(name.trim())[0]||'?').toUpperCase();
    bubble.append(portrait,E('span',reaction.emoji||'•••','v6-reaction-mark'));host.append(bubble);
   }
   const mine=list.find(r=>r.user_id===S.uid);
   host.append(B(mine?'Modifier mon mot':'Réagir',()=>open(field,label,mine),'v6-react-add'));
  }
 }
 async function refresh(){const id=souvenirsActifs?.id;if(!id||!S.uid){reactions=[];render();return;}
  const current=++ticket;
  try{const [r,d]=await Promise.all([supabaseClient.from('response_reactions').select('*').eq('stay_id',id).order('created_at'),supabaseClient.rpc('amor_directory')]);
   if(current!==ticket||String(souvenirsActifs.id)!==String(id))return;if(r.error)throw r.error;if(d.error)throw d.error;
   const nextAvatars=new Map();
   await Promise.all(d.data.filter(p=>p.avatar_path).map(async p=>{const {data}=await supabaseClient.storage.from('memories').createSignedUrl(p.avatar_path,3600);if(data)nextAvatars.set(p.user_id,data.signedUrl);}));
   if(current===ticket&&String(souvenirsActifs.id)===String(id)){reactions=r.data;directory=d.data;avatars=nextAvatars;render();
    const {data:old}=await supabaseClient.from('moment_reactions').select('id').eq('kind','stay').eq('target_id',String(id)).limit(1);
    if(current===ticket)legacy.hidden=!old?.length;
   }
  }catch(error){if(current!==ticket)return;render();const host=hosts.values().next().value;
   if(host){host.hidden=false;fail(host,Error('Réactions indisponibles. Vos réponses sont conservées.'),refresh);}
  }
 }
 function open(field,label,selected){
  const value=$('#'+fields.find(f=>f[0]===field)[1]).textContent.trim(),stay=souvenirsActifs.id;
  active={stay,field,label,value};composer.c.replaceChildren(E('p',label,'v6-eyebrow'),E('blockquote',value));
  const list=reactions.filter(r=>r.field_key===field);
  list.forEach(r=>{const person=directory.find(p=>p.user_id===r.user_id);const card=E('article',null,'v6-note');
   card.append(E('strong',person?.display_name||'Nous'),E('p',[r.emoji,r.message].filter(Boolean).join(' ')));
   if(r.quoted_value!==value)card.append(E('small','Cette réponse a changé depuis ce mot.'));
   if(selected?.id===r.id)card.classList.add('v6-highlight');composer.c.append(card);
  });
  const mine=list.find(r=>r.user_id===S.uid),form=E('form');
  form.innerHTML='<label>Ma réaction<select name="emoji"><option value="">Sans emoji</option><option value="♥">♥</option><option value="☺">☺</option><option value="✦">✦</option></select></label><label>Mon mot<textarea name="message" maxlength="600" rows="3" placeholder="Cette note mérite une explication…"></textarea></label><button class="v6-button" type="submit">Enregistrer mon mot</button>';
  form.elements.emoji.value=mine?.emoji||'';form.elements.message.value=mine?.message||'';
  form.onsubmit=event=>{event.preventDefault();run(form.querySelector('button'),async()=>{
   const message=form.elements.message.value.trim(),emoji=form.elements.emoji.value||null;if(!message&&!emoji)throw Error('Écrivez un mot ou choisissez une réaction.');
   const row={stay_id:stay,field_key:field,user_id:S.uid,emoji,message,quoted_value:Array.from(value).slice(0,4000).join('')};
   const q=mine?supabaseClient.from('response_reactions').update({...row,revision:mine.revision}).eq('id',mine.id):supabaseClient.from('response_reactions').insert(row);
   const {error}=await q.select().single();if(error)throw error;S.invalidate();composer.d.close();await refresh();
   document.dispatchEvent(new CustomEvent('amor:response-saved'));
  },form);};composer.c.append(form);
  if(mine)composer.c.append(B('Retirer mon mot',async()=>{if(!confirm('Retirer votre mot sur cette réponse ?'))return;
   const {error}=await supabaseClient.from('response_reactions').delete().eq('id',mine.id);if(error)fail(composer.c,error);else{S.invalidate();composer.d.close();refresh();}
  },'v6-quiet'));
  if(!composer.d.open)composer.d.showModal();
 }
 let debounce;function schedule(){clearTimeout(debounce);debounce=setTimeout(refresh,100);}
 for(const [,id]of fields)new MutationObserver(schedule).observe($('#'+id),{childList:true});
 new MutationObserver(()=>{if($('#souvenir-dialog').open)schedule();else{++ticket;reactions=[];render();}}).observe($('#souvenir-dialog'),{attributes:true,attributeFilter:['open']});
 document.addEventListener('amor:remote-update',schedule);document.addEventListener('amor:identity-ready',schedule);
 const legacy=B('Anciens mots globaux du séjour',()=>{if(souvenirsActifs.id)S.openReactions({kind:'stay',id:souvenirsActifs.id});},'v6-legacy');
 $('#souvenir-view').append(legacy);
 // Afficher le lien d'archive uniquement s'il existe réellement d'anciens mots.
 legacy.hidden=true;new MutationObserver(async()=>{if(!$('#souvenir-dialog').open)return;
  const stay=souvenirsActifs.id;if(!stay)return;const {data}=await supabaseClient.from('moment_reactions').select('id').eq('kind','stay').eq('target_id',String(stay)).limit(1);
  if(String(souvenirsActifs.id)===String(stay))legacy.hidden=!data?.length;
 }).observe($('#vue-dates'),{childList:true});
 V.refreshResponses=refresh;
})();
