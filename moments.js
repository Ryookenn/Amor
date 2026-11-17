/* AMOR V4 — couvertures, accès rapide, recherche, fil, brouillons et carrousel. */
(() => {
    'use strict';
    const $ = s => document.querySelector(s);
    const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, {detail}));
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    function el(tag, text, cls) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (cls) node.className = cls;
        return node;
    }
    function button(text, action, cls = 'mom-button') {
        const b = el('button', text, cls); b.type = 'button';
        b.addEventListener('click', action); return b;
    }
    function dialog(title) {
        const d = el('dialog', null, 'mom-dialog');
        const header = el('header', null, 'mom-header');
        const h = el('h2', title); h.id = `mom-title-${document.querySelectorAll('.mom-dialog').length}`;
        d.setAttribute('aria-labelledby', h.id);
        header.append(h, button('Fermer', () => d.close(), 'mom-close'));
        const content = el('div', null, 'mom-content');
        d.append(header, content); document.body.append(d);
        return {d, content};
    }
    function errorBox(parent, message, retry) {
        const box = el('div', null, 'mom-error'); box.setAttribute('role','alert');
        box.append(el('p', message));
        if (retry) box.append(button('Réessayer', () => { box.remove(); retry(); }));
        parent.append(box); return box;
    }

    // Les commandes destructives sont sorties de l'en-tête et de la navigation.
    const more = el('details', null, 'mom-more');
    const summary = el('summary', '•••'); summary.setAttribute('aria-label','Plus d’options');
    const menu = el('div', null, 'mom-more-menu');
    menu.append(el('p','Actions sur cette destination'), $('#supprimer-sejour'), $('#supprimer-ville'));
    more.append(summary, menu);
    $('#souvenir-dialog .fiche-header-actions').prepend(more);
    menu.querySelectorAll('button').forEach(b => {
        b.classList.remove('amor-icon-button');
        b.textContent = b.id === 'supprimer-ville' ? 'Supprimer la ville…' : 'Supprimer ce séjour…';
        b.addEventListener('click', () => { more.open = false; });
    });
    $('#souvenir-dialog').addEventListener('close', () => { more.open = false; });

    // Modification ciblée, à partir du même formulaire : toutes les valeurs restent remplies.
    const view = $('#souvenir-view');
    const targets = ['edition-dates','edition-personnes','edition-ensemble','edition-ensemble','edition-premieres-fois','edition-photos','edition-audio'];
    [...view.children].filter(n => n.tagName === 'SECTION').forEach((section, i) => {
        const b = button('Modifier cette rubrique', () => {
            afficherModeEdition(); focusSection(targets[i]);
        }, 'mom-inline-edit');
        section.append(b);
    });
    const form = $('#souvenir-form');
    const all = button('Afficher toutes les rubriques', () => focusSection(null), 'mom-inline-edit');
    form.querySelector('.edition-introduction').append(all);
    function focusSection(id) {
        form.classList.toggle('mom-focused', Boolean(id));
        form.querySelectorAll('.edition-section').forEach(section => {
            section.classList.toggle('mom-section-off', Boolean(id) && section.id !== id &&
                !(id === 'edition-ensemble' && section.classList.contains('edition-musique')));
        });
        all.hidden = !id;
        if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({block:'start', behavior:reduced()?'instant':'smooth'}));
    }
    $('#modifier-fiche').addEventListener('click', () => focusSection(null));
    form.querySelector('.edition-nav').addEventListener('click', event => {
        const b = event.target.closest('[data-edition-cible]');
        if (b && form.classList.contains('mom-focused')) focusSection(b.dataset.editionCible);
    }, true);

    // Identité et brouillons : jamais de mot de passe ni de fichier dans localStorage.
    let userId = null, activeDraftKey = null;
    const draftStatus = el('p', 'Les modifications ne sont pas encore enregistrées.', 'mom-draft-status');
    draftStatus.setAttribute('role','status');
    form.querySelector('.edition-introduction').append(draftStatus);
    const draftPrompt = el('div', null, 'mom-draft-prompt'); draftPrompt.hidden = true;
    form.querySelector('.edition-introduction').after(draftPrompt);
    const draftPrefix = 'amor-draft-v4:';
    function draftKey() {
        return userId && destinationActive ? `${draftPrefix}${userId}:${destinationActive.id}:${souvenirsActifs?.id ?? 'new'}` : null;
    }
    const fields = () => [...form.querySelectorAll('input[id], textarea[id], select[id]')].filter(n => !['file','checkbox','radio','hidden'].includes(n.type));
    function saveDraft() {
        if (!modeEdition) return;
        formulaireModifie=true;
        if (!activeDraftKey) return;
        const values = Object.fromEntries(fields().map(n => [n.id, n.value]));
        const badges = [...form.querySelectorAll('.premiere-fois-checkbox:checked')].map(n => ({
            id:n.value, date:n.closest('.premiere-fois-option')?.querySelector('.premiere-fois-date')?.value || ''
        }));
        try {
            localStorage.setItem(activeDraftKey, JSON.stringify({time:Date.now(), values, badges}));
            draftStatus.textContent = 'Brouillon conservé sur cet appareil · pas encore enregistré dans AMOR.';
        } catch { draftStatus.textContent = 'Modifications non enregistrées · brouillon local indisponible.'; }
    }
    function offerDraft() {
        activeDraftKey = draftKey(); draftPrompt.replaceChildren(); draftPrompt.hidden = true;
        draftStatus.textContent = 'Les modifications ne sont pas encore enregistrées.';
        if (!activeDraftKey) return;
        try {
            const raw = localStorage.getItem(activeDraftKey);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved.time || Date.now() - saved.time > 7*86400000) { localStorage.removeItem(activeDraftKey); return; }
            draftPrompt.hidden = false;
            draftPrompt.append(el('p','Un brouillon récent existe pour ce souvenir. Photos et vocaux sont à sélectionner de nouveau.'));
            draftPrompt.append(button('Reprendre', () => {
                fields().forEach(n => { if (Object.hasOwn(saved.values || {}, n.id)) n.value = saved.values[n.id]; });
                form.querySelectorAll('.premiere-fois-checkbox').forEach(n => {
                    const found = saved.badges?.find(b => String(b.id) === n.value);
                    n.checked = Boolean(found); n.dispatchEvent(new Event('change', {bubbles:true}));
                    const date = n.closest('.premiere-fois-option')?.querySelector('.premiere-fois-date');
                    if (found && date) date.value = found.date;
                });
                formulaireModifie = true; actualiserRepereEdition();
                saveDraft();
                draftPrompt.hidden = true; draftStatus.textContent = 'Brouillon repris · pensez à enregistrer.';
            }), button('Supprimer ce brouillon', () => {
                localStorage.removeItem(activeDraftKey); draftPrompt.hidden = true;
            }, 'mom-quiet'));
        } catch { /* Un stockage bloqué ne doit jamais empêcher la saisie. */ }
    }
    form.addEventListener('input', saveDraft);
    form.addEventListener('change', saveDraft);
    window.addEventListener('pagehide',()=>{if(modeEdition&&formulaireModifie)saveDraft();});
    new MutationObserver(() => { if (!form.hidden) { offerDraft(); if (userId === null) identity(); } }).observe(form,{attributes:true,attributeFilter:['hidden']});
    document.addEventListener('amor:saved', () => {
        if (activeDraftKey) { try { localStorage.removeItem(activeDraftKey); } catch {} }
        activeDraftKey = null; draftStatus.textContent = 'Enregistré dans AMOR.'; indexDirty = true;
    });
    async function identity() {
        const {data} = await supabaseClient.auth.getSession();
        userId = data.session?.user?.id ?? null;
        if(userId){
            try{Object.keys(localStorage).filter(k=>k.startsWith(`${draftPrefix}${userId}:`)).forEach(k=>{
                try{const saved=JSON.parse(localStorage.getItem(k));if(!saved?.time||Date.now()-saved.time>7*86400000)localStorage.removeItem(k);}
                catch{localStorage.removeItem(k);}
            });}catch{}
        }
        if (!form.hidden) offerDraft();
    }
    identity().catch(()=>{});
    new MutationObserver(() => {
        if ($('#auth-screen').hidden) { identity().catch(()=>{}); return; }
        if (userId) {
            try { Object.keys(localStorage).filter(k=>k.startsWith(`${draftPrefix}${userId}:`)).forEach(k=>localStorage.removeItem(k)); } catch {}
        }
        userId = null; activeDraftKey = null; records = []; indexDirty = true;
        preferences.clear(); document.querySelectorAll('.mom-search-results').forEach(n=>n.replaceChildren());
        finder.d.close(); quick.d.close(); coverEditor.d.close();
        fragmentEditor.d.close();
        document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    }).observe($('#auth-screen'), {attributes:true,attributeFilter:['hidden']});

    // Recherche et fil commun : pagination pour ne pas s'arrêter à 1 000 lignes.
    let records = [], indexDirty = true, loadTask = null;
    const finder = dialog('Notre histoire');
    finder.content.innerHTML = '<label class="mom-field">Rechercher dans AMOR<input id="mom-search" type="search" placeholder="Une ville, une phrase, une anecdote…" autocomplete="off"></label><div class="mom-filters"><button type="button" data-filter="all">Tout</button><button type="button" data-filter="voyage">Voyages</button><button type="button" data-filter="fragment">Fragments</button><button type="button" data-filter="badge">Premières fois</button></div><p class="mom-search-meta" role="status"></p><div class="mom-search-results"></div>';
    const resultList = finder.content.querySelector('.mom-search-results');
    let filter = 'all', searchMode = false;
    const normal = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    async function rows(table, columns) {
        const list=[];
        for(let start=0;;start+=500){
            const {data,error}=await supabaseClient.from(table).select(columns).order('id').range(start,start+499);
            if(error) throw error;
            list.push(...data); if(data.length<500) return list;
        }
    }
    async function buildIndex() {
        if (!indexDirty) return;
        if (loadTask) return loadTask;
        const account = userId;
        loadTask=(async()=>{
            const [stays,fragments,badges,cities,travelFragments] = await Promise.all([
                rows('stays','id,city_id,date_start,date_end,created_at,shared_quote,music,amine_place,amine_meal,amine_quote,maena_place,maena_meal,maena_quote'),
                rows('home_items','id,city_id,title,content,item_type,happened_on,created_at'),
                rows('first_times','id,title,description,stay_id,unlocked_on,created_at'),
                rows('cities','id,name,experience_type'),
                rows('memory_fragments','id,city_id,stay_id,title,content,happened_on,created_at')
            ]);
            if (account !== userId || !$('#auth-screen').hidden) return;
            const cityMap=new Map(cities.map(c=>[String(c.id),c]));
            const stayMap=new Map(stays.map(s=>[String(s.id),s]));
            const mapped=[];
            stays.forEach(s=>{
                const city=cityMap.get(String(s.city_id)); if(!city) return;
                if(city.experience_type === 'home') {
                    // Les anciens textes restent retrouvables, sans créer de visites.
                    if(![s.shared_quote,s.music,s.amine_place,s.amine_meal,s.amine_quote,s.maena_place,s.maena_meal,s.maena_quote].some(Boolean)) return;
                }
                const home=city.experience_type==='home';
                mapped.push({type:home?'fragment':'voyage',title:home?`Notre page à ${city.name}`:`Séjour à ${city.name}`,city:city.name,cityId:s.city_id,stayId:s.id,
                    date:home?null:s.date_start,caption:s.shared_quote || s.music || 'Un moment de notre histoire.',
                    search:Object.values(s).filter(v=>typeof v==='string').join(' ')});
            });
            fragments.forEach(f=>{
                const city=cityMap.get(String(f.city_id)); if(!city) return;
                mapped.push({type:'fragment',title:f.title,city:city.name,cityId:f.city_id,date:f.happened_on,
                    caption:f.content || (f.item_type==='habit'?'Notre habitude':'Notre anecdote'),search:f.content});
            });
            travelFragments.forEach(f=>{
                const city=cityMap.get(String(f.city_id)); if(!city)return;
                mapped.push({type:'fragment',title:f.title,city:city.name,cityId:f.city_id,stayId:f.stay_id,date:f.happened_on,
                    caption:f.content||'Notre anecdote',search:f.content,fragmentId:f.id});
            });
            badges.forEach(b=>{
                const stay=stayMap.get(String(b.stay_id)); const city=cityMap.get(String(stay?.city_id));
                mapped.push({type:'badge',title:b.title,city:city?.name || 'Une envie à deux',cityId:city?.id,stayId:stay?.id,
                    date:b.unlocked_on,caption:b.stay_id?'Une première fois vécue ensemble.':'Une proposition, quand l’envie nous prend.',search:b.description,
                    pending:!b.stay_id});
            });
            cities.forEach(c=>mapped.push({type:'ville',title:c.name,city:c.name,cityId:c.id,date:null,caption:c.experience_type==='home'?'Notre chez-nous':'Sur notre carte',search:''}));
            records=mapped; indexDirty=false;
        })().finally(()=>{loadTask=null;});
        return loadTask;
    }
    async function openRecord(record) {
        const target=destinations.find(d=>String(d.id)===String(record.cityId));
        if(target){
            finder.d.close(); await ouvrirFiche(target,record.stayId || null);
            if(record.type==='fragment'){
                if(target.experienceType==='home'){
                    const card=[...document.querySelectorAll('.home-item')].find(c=>c.querySelector('h4')?.textContent===record.title);
                    card?.scrollIntoView({block:'center',behavior:reduced()?'instant':'smooth'});
                }else if(record.fragmentId){
                    await loadStayFragments();
                    document.querySelector(`[data-fragment-id="${record.fragmentId}"]`)?.scrollIntoView({block:'center',behavior:reduced()?'instant':'smooth'});
                }
            }
        } else { finder.d.close(); $('#ouvrir-premieres-fois').click(); }
    }
    function renderRecords() {
        const query=normal($('#mom-search').value).trim();
        const items=records.filter(r=>(filter==='all'||r.type===filter) && (searchMode || (r.type!=='ville' && !r.pending)) &&
            (!query || query.split(/\s+/).every(word=>normal([r.title,r.city,r.caption,r.search].join(' ')).includes(word))));
        items.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
        resultList.replaceChildren();
        finder.content.querySelector('.mom-search-meta').textContent=`${items.length} résultat${items.length>1?'s':''}${!searchMode?' · Les fragments sans date sont réunis en fin de fil.':''}`;
        finder.content.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
        if(!items.length) resultList.append(el('p','Rien pour le moment. Essayez un autre mot ou un autre filtre.','mom-empty'));
        items.forEach(r=>{
            const card=button('',()=>openRecord(r),'mom-record');
            card.append(el('small',`${r.type==='badge'?'Première fois':r.type==='voyage'?'Voyage':r.type==='ville'?'Ville':'Fragment'} · ${r.city}`),el('strong',r.title),
                el('span',r.caption),el('time',r.date?formaterDate(r.date):r.pending?'À vivre, si l’envie nous prend':'Sans date imposée'));
            resultList.append(card);
        });
    }
    async function openFinder(search) {
        searchMode=search; $('#mom-search').value=''; filter='all';
        if(!finder.d.open) finder.d.showModal();
        finder.content.querySelector('h2');
        resultList.replaceChildren(el('div','Chargement de notre histoire…','mom-skeleton'));
        try { await buildIndex(); if(finder.d.open){renderRecords(); if(search) $('#mom-search').focus();} }
        catch { resultList.replaceChildren(); errorBox(resultList,'Notre histoire ne peut pas être chargée. Vos données sont conservées.',()=>openFinder(search)); }
    }
    $('#mom-search').addEventListener('input',renderRecords);
    finder.content.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderRecords();}));
    const tools=el('div',null,'mom-home-tools');
    tools.append(button('Ajouter un moment',()=>openQuick()),button('Notre fil',()=>openFinder(false)),button('Rechercher',()=>openFinder(true)));
    $('.hero').append(tools);

    // Une commande rapide réutilise les formulaires existants et leurs protections.
    const quick=dialog('Garder un moment');
    quick.content.innerHTML='<label class="mom-field">Qu’a-t-on envie de garder ?<select id="mom-quick-kind"><option value="photo">Une photo</option><option value="fragment">Une anecdote</option><option value="badge">Une première fois</option></select></label><label class="mom-field">Où ?<select id="mom-quick-city"></select></label><label class="mom-field" id="mom-quick-stay-label">Quel séjour ?<select id="mom-quick-stay"></select></label><p id="mom-quick-info" role="status"></p>';
    const go=button('Continuer',async()=>{
        const dest=destinations.find(d=>String(d.id)===$('#mom-quick-city').value);
        if(!dest) return;
        const kind=$('#mom-quick-kind').value,home=dest.experienceType==='home';
        go.disabled=true;
        try {
            quick.d.close(); await ouvrirFiche(dest,$('#mom-quick-stay').value || null);
            if(home && !$('#home-dialog').open) throw new Error('not-open');
            if(!home && !$('#souvenir-dialog').open) throw new Error('not-open');
            if(home){
                if(kind==='photo') $('#home-ajout-photos').scrollIntoView({block:'center'});
                if(kind==='fragment') $('#ajouter-home-item').click();
                if(kind==='badge') $('#ajouter-home-badge').click();
            } else {
                if(kind==='fragment') openFragment();
                else {afficherModeEdition(); focusSection(kind==='photo'?'edition-photos':'edition-premieres-fois');}
            }
            // La sélection de fichier reste un clic explicite sur le bouton visible.
        } catch { if(!quick.d.open) quick.d.showModal(); errorBox(quick.content,'Impossible d’ouvrir cette fiche. Réessayez.',()=>go.click()); }
        finally {go.disabled=false;}
    });
    quick.content.append(go);
    function fillQuickCities() {
        const select=$('#mom-quick-city'); select.replaceChildren();
        destinations.forEach(d=>{
            const option=el('option',d.ville); option.value=d.id; select.append(option);
        });
        fillQuickStays();
    }
    function fillQuickStays() {
        const dest=destinations.find(d=>String(d.id)===$('#mom-quick-city').value);
        const home=dest?.experienceType==='home';
        $('#mom-quick-stay-label').hidden=Boolean(home);
        const select=$('#mom-quick-stay'); select.replaceChildren();
        (dest?.sejoursResume || []).forEach((s,i)=>{const o=el('option',`Séjour ${i+1}${s.date?` · ${formaterDate(String(s.date).slice(0,10))}`:''}`);o.value=s.id;select.append(o);});
        $('#mom-quick-info').textContent=home?'Une page permanente, sans nouvelle visite à créer.':$('#mom-quick-kind').value==='photo'?'Choisissez le séjour, puis vos photos. Elles seront envoyées à l’enregistrement.':$('#mom-quick-kind').value==='fragment'?'Un petit fragment, rattaché à ce séjour. La date reste facultative.':'Ouvrez le séjour pour sélectionner les expériences vécues pour la première fois.';
        go.disabled=!dest;
    }
    function openQuick(){fillQuickCities();quick.d.showModal();}
    $('#mom-quick-kind').addEventListener('change',fillQuickCities);
    $('#mom-quick-city').addEventListener('change',fillQuickStays);

    // Anecdotes de voyage : elles complètent le séjour, sans toucher aux réponses.
    const notesSection=el('section',null,'fiche-rubrique mom-stay-fragments');
    notesSection.append(el('h3','Nos petits fragments'),el('p','Une anecdote, quand l’envie nous prend.','fiche-secondaire'));
    const notesList=el('div',null,'mom-notes-list');
    notesSection.append(notesList,button('Ajouter une anecdote',()=>openFragment(),'mom-inline-edit'));view.append(notesSection);
    const fragmentEditor=dialog('Un petit fragment');
    fragmentEditor.content.innerHTML='<form id="mom-fragment-form"><label class="mom-field">Le titre<input id="mom-fragment-title" maxlength="100" required placeholder="Le fou rire dans le train…"></label><label class="mom-field">Ce que l’on garde<textarea id="mom-fragment-content" maxlength="1200" rows="5" placeholder="Quelques mots pour retrouver ce moment…"></textarea></label><label class="mom-field">Une date, si vous en avez envie<input id="mom-fragment-date" type="date"></label><p id="mom-fragment-message" role="status"></p><button class="mom-button" type="submit">Enregistrer ce fragment</button></form>';
    const fragmentForm=$('#mom-fragment-form');
    let fragmentContext=null,fragmentChanged=false,fragmentRequest=0;
    let fragmentDraftKey=null;
    async function loadStayFragments(){
        const ticket=++fragmentRequest;
        const stay=souvenirsActifs?.id;
        if(!stay){notesList.replaceChildren(el('p','Aucune anecdote pour le moment.','mom-empty'));return;}
        notesList.replaceChildren(el('div','Chargement des fragments…','mom-skeleton'));
        const {data,error}=await supabaseClient.from('memory_fragments').select('*').eq('stay_id',stay).order('created_at',{ascending:false});
        if(ticket!==fragmentRequest || String(souvenirsActifs?.id)!==String(stay))return;
        notesList.replaceChildren();
        if(error){errorBox(notesList,'Les anecdotes sont indisponibles. Vérifiez la connexion et la migration V4.',loadStayFragments);return;}
        if(!data.length)notesList.append(el('p','Le prochain petit moment trouvera sa place ici.','mom-empty'));
        data.forEach(item=>{
            const card=el('article',null,'mom-note');card.dataset.fragmentId=item.id;
            card.append(el('h4',item.title),el('p',item.content));
            if(item.happened_on)card.append(el('small',formaterDate(item.happened_on)));
            const actions=el('div',null,'mom-note-actions');
            actions.append(button('Modifier',()=>openFragment(item),'mom-quiet'));
            const options=el('details',null,'mom-note-more');options.append(el('summary','Plus'));
            options.append(button('Supprimer ce fragment…',async()=>{
                if(!confirm(`Mettre « ${item.title} » à la corbeille ?`))return;
                const {error}=await amorTrashQuery("memory_fragments").eq('id',item.id);
                if(error){errorBox(card,'Le fragment n’a pas été supprimé. Réessayez.');return;}
                indexDirty=true;await loadStayFragments();
            },'mom-quiet'));
            actions.append(options);card.append(actions);notesList.append(card);
        });
    }
    function openFragment(item=null){
        if(!destinationActive)return;
        fragmentContext={dest:destinationActive,stay:souvenirsActifs?.id??null,item};fragmentChanged=false;
        fragmentForm.reset();$('#mom-fragment-message').textContent='';
        $('#mom-fragment-title').value=item?.title||'';$('#mom-fragment-content').value=item?.content||'';$('#mom-fragment-date').value=item?.happened_on||'';
        fragmentDraftKey=userId?`${draftPrefix}${userId}:fragment:${destinationActive.id}:${souvenirsActifs?.id??'new'}:${item?.id??'new'}`:null;
        fragmentEditor.content.querySelector('.mom-draft-prompt')?.remove();
        try{
            const draft=JSON.parse(localStorage.getItem(fragmentDraftKey)||'null');
            if(draft && Date.now()-draft.time<7*86400000){
                const prompt=el('div',null,'mom-draft-prompt');prompt.append(el('p','Un brouillon de ce fragment est disponible.'));
                prompt.append(button('Reprendre',()=>{['title','content','date'].forEach(k=>$('#mom-fragment-'+k).value=draft[k]||'');fragmentChanged=true;prompt.remove();}),
                    button('Supprimer le brouillon',()=>{localStorage.removeItem(fragmentDraftKey);prompt.remove();},'mom-quiet'));
                fragmentForm.before(prompt);
            }
        }catch{}
        fragmentEditor.d.showModal();$('#mom-fragment-title').focus();
    }
    fragmentForm.addEventListener('input',()=>{
        fragmentChanged=true;
        if(fragmentDraftKey){try{localStorage.setItem(fragmentDraftKey,JSON.stringify({time:Date.now(),title:$('#mom-fragment-title').value,content:$('#mom-fragment-content').value,date:$('#mom-fragment-date').value}));}catch{}}
    });
    function protectFragment(event){
        if(fragmentChanged && !confirm('Fermer ce fragment ? Le brouillon reste sur cet appareil.')){event.preventDefault();event.stopImmediatePropagation();}
    }
    fragmentEditor.d.addEventListener('cancel',protectFragment);
    fragmentEditor.d.querySelector('.mom-close').addEventListener('click',protectFragment,true);
    fragmentForm.addEventListener('submit',async event=>{
        event.preventDefault();if(!fragmentForm.reportValidity()||!fragmentContext)return;
        const b=fragmentForm.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;
        b.setAttribute('aria-busy','true');
        const c=fragmentContext;
        try{
            if(!c.stay){
                const stay=await enregistrerSejour(souvenirsActifs,c.dest);
                souvenirsActifs=stay;sejoursActifs[indexSejourActif]=stay;c.stay=stay.id;creationSejour=false;
                afficherSouvenirs(stay);actualiserNavigationSejours();
            }
            const value={city_id:c.dest.id,stay_id:c.stay,title:$('#mom-fragment-title').value.trim(),content:$('#mom-fragment-content').value.trim(),happened_on:$('#mom-fragment-date').value||null};
            if(!value.title){$('#mom-fragment-message').textContent='Ajoutez un titre au fragment.';return;}
            const req=c.item?supabaseClient.from('memory_fragments').update({...value,revision:c.item.revision}).eq('id',c.item.id):supabaseClient.from('memory_fragments').insert(value);
            const {error}=await req.select().single();if(error){amorConflict(error);throw error;}
            if(fragmentDraftKey){try{localStorage.removeItem(fragmentDraftKey);}catch{}}
            fragmentChanged=false;fragmentEditor.d.close();indexDirty=true;await loadStayFragments();
            emit('amor:moment-saved');
            await chargerDestinationsDepuisSupabase();
        }catch{$('#mom-fragment-message').textContent='Le fragment n’a pas pu être enregistré. Vérifiez la connexion et le script SQL V4, puis réessayez.';}
        finally{b.disabled=false;b.removeAttribute('aria-busy');}
    });
    new MutationObserver(()=>{if($('#souvenir-dialog').open)loadStayFragments().catch(()=>{});}).observe($('#vue-dates'),{childList:true});
    new MutationObserver(()=>{if($('#souvenir-dialog').open)loadStayFragments().catch(()=>{});}).observe($('#souvenir-dialog'),{attributes:true,attributeFilter:['open']});

    // Même principe de brouillon privé pour les deux formulaires des chez-nous.
    [['home-profil-form','profile'],['home-item-form','item']].forEach(([id,type])=>{
        const f=$('#'+id);let key=null;
        const inputs=()=>[...f.querySelectorAll('input[id],textarea[id],select[id]')].filter(n=>n.type!=='hidden');
        const banner=el('div',null,'mom-draft-prompt');banner.hidden=true;f.prepend(banner);
        new MutationObserver(()=>{
            if(f.hidden||!homeActif||!userId)return;
            key=`${draftPrefix}${userId}:home:${homeActif.id}:${type}:${type==='item'?($('#home-item-id').value||'new'):'profile'}`;
            banner.hidden=true;banner.replaceChildren();
            try{
                const saved=JSON.parse(localStorage.getItem(key)||'null');
                if(!saved||Date.now()-saved.time>7*86400000)return;
                banner.hidden=false;banner.append(el('p','Un brouillon existe sur cet appareil.'));
                banner.append(button('Reprendre',()=>{inputs().forEach(n=>{if(Object.hasOwn(saved.values,n.id))n.value=saved.values[n.id];});banner.hidden=true;}),
                    button('Supprimer le brouillon',()=>{localStorage.removeItem(key);banner.hidden=true;},'mom-quiet'));
            }catch{}
        }).observe(f,{attributes:true,attributeFilter:['hidden']});
        f.addEventListener('input',()=>{
            if(!key)return;
            try{localStorage.setItem(key,JSON.stringify({time:Date.now(),values:Object.fromEntries(inputs().map(n=>[n.id,n.value]))}));}catch{}
        });
        document.addEventListener('amor:home-saved',event=>{
            if(event.detail.type!==type)return;
            if(key){try{localStorage.removeItem(key);}catch{}}
            banner.hidden=true;indexDirty=true;
        });
    });

    // Couvertures synchronisées : chemins privés, jamais d'URL signée stockée.
    const preferences=new Map();
    const coverEditor=dialog('Choisir notre couverture');
    coverEditor.content.innerHTML='<p>Choisissez une image de cet album et ajustez son cadrage.</p><div class="mom-cover-options"></div><div class="mom-crop-preview"><img alt="Aperçu du cadrage"></div><label class="mom-field">Cadrage horizontal<input id="mom-crop-x" type="range" min="0" max="100" value="50"></label><label class="mom-field">Cadrage vertical<input id="mom-crop-y" type="range" min="0" max="100" value="50"></label><p id="mom-cover-message" role="status"></p>';
    let coverContext=null, selectedPhoto=null;
    function context(isHome) {
        const dest=isHome?homeActif:destinationActive;
        if(!dest) return null;
        const stay=isHome?null:souvenirsActifs?.id;
        if(!isHome&&!stay) return null;
        const media=isHome?homeMediasActifs.map((m,i)=>({...m,url:photosAffichees[i]?.url})):mediasPhotosActifs;
        return {key:isHome?`home:${dest.id}`:`stay:${stay}`,dest,stay,media,isHome};
    }
    window.amorCoverSource=dialogId=>{
        const c=context(dialogId==='home-dialog'); if(!c) return null;
        const p=preferences.get(c.key); if(!p) return null;
        const photo=c.media.find(m=>m.storage_path===p.storage_path);
        return photo?.url?{url:photo.url,x:p.position_x,y:p.position_y}:null;
    };
    async function loadCover(isHome) {
        const c=context(isHome); if(!c) return;
        const account=userId;
        const {data,error}=await supabaseClient.from('memory_covers').select('*').eq('scope_key',c.key).maybeSingle();
        if(error || account!==userId || !$('#auth-screen').hidden) return;
        if(data) preferences.set(c.key,data); else preferences.delete(c.key);
        emit('amor:refresh-covers');
    }
    function cropPreview(){
        const img=coverEditor.content.querySelector('.mom-crop-preview img');
        if(selectedPhoto) img.src=selectedPhoto.url;
        img.style.objectPosition=`${$('#mom-crop-x').value}% ${$('#mom-crop-y').value}%`;
    }
    function chooseCover(isHome){
        coverContext=context(isHome); const c=coverContext;
        if(!c || !c.media.length){ window.alert('Ajoutez d’abord une photo à cet album.'); return; }
        const existing=preferences.get(c.key);
        selectedPhoto=c.media.find(m=>m.storage_path===existing?.storage_path)||c.media[0];
        $('#mom-crop-x').value=existing?.position_x??50; $('#mom-crop-y').value=existing?.position_y??50;
        $('#mom-cover-message').textContent='';
        const options=coverEditor.content.querySelector('.mom-cover-options');options.replaceChildren();
        c.media.filter(m=>m.url).forEach((m,i)=>{
            const b=button('',()=>{
                selectedPhoto=m;
                options.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b))); cropPreview();
            });
            b.setAttribute('aria-label',`Choisir la photo ${i+1}`);b.setAttribute('aria-pressed',String(m===selectedPhoto));
            const image=el('img');image.src=m.url;image.alt='';b.append(image);options.append(b);
        });
        cropPreview(); coverEditor.d.showModal();
    }
    $('#mom-crop-x').addEventListener('input',cropPreview);$('#mom-crop-y').addEventListener('input',cropPreview);
    const saveCover=button('Enregistrer la couverture',async()=>{
        if(!selectedPhoto||!coverContext) return;
        saveCover.disabled=true;
        saveCover.setAttribute('aria-busy','true');
        const c=coverContext;
        try {
            const value={scope_key:c.key,city_id:c.dest.id,stay_id:c.stay,storage_path:selectedPhoto.storage_path,
                position_x:Number($('#mom-crop-x').value),position_y:Number($('#mom-crop-y').value)};
            const existing=preferences.get(c.key);
            const req=existing?supabaseClient.from('memory_covers').update({...value,revision:existing.revision}).eq('scope_key',c.key):supabaseClient.from('memory_covers').insert(value);
            const {data:saved,error}=await req.select().single();
            if(error){amorConflict(error);throw error;}
            preferences.set(c.key,saved);emit('amor:refresh-covers');coverEditor.d.close();
            refreshCardCovers().catch(()=>{});
        } catch { $('#mom-cover-message').textContent='Couverture non enregistrée. Vérifiez la connexion et que le script SQL V4 a été exécuté, puis réessayez.'; }
        finally {saveCover.disabled=false;saveCover.removeAttribute('aria-busy');}
    });
    coverEditor.content.append(saveCover,button('Revenir à la couverture automatique',async()=>{
        if(!coverContext) return;
        const {error}=await supabaseClient.from('memory_covers').delete().eq('scope_key',coverContext.key);
        if(error){$('#mom-cover-message').textContent='Impossible de rétablir la couverture automatique. Réessayez.';return;}
        preferences.delete(coverContext.key);emit('amor:refresh-covers');coverEditor.d.close();
        await chargerDestinationsDepuisSupabase();
    },'mom-quiet'));
    [false,true].forEach(home=>{
        const d=$(home?'#home-dialog':'#souvenir-dialog');
        const b=button('Choisir la couverture',()=>chooseCover(home),'mom-cover-trigger');
        d.querySelector('.amor-cover').after(b);
        new MutationObserver(()=>{if(d.open) loadCover(home).catch(()=>{});}).observe(d,{attributes:true,attributeFilter:['open']});
        new MutationObserver(()=>{if(d.open) loadCover(home).catch(()=>{});}).observe($(home?'#home-galerie':'#galerie-photos'),{childList:true});
    });

    // Réservations de place, état de chargement et reprise sans modifier les médias.
    document.addEventListener('amor:media-error',event=>{
        if(String(event.detail.stayId)!==String(souvenirsActifs?.id)) return;
        const target=$(event.detail.audio?'#audio-vide':'#photos-vides');
        target.hidden=false;target.replaceChildren();
        errorBox(target,'Le chargement a échoué. Aucun fichier n’a été supprimé.',()=>{
            if(event.detail.audio) chargerAudio(souvenirsActifs); else chargerPhotos(souvenirsActifs);
        });
    });
    document.addEventListener('error',event=>{
        const image=event.target;
        if(image.tagName!=='IMG'||!image.closest('dialog')||image.parentElement.querySelector('.mom-image-retry'))return;
        const src=image.getAttribute('src');if(!src)return;
        const retry=button('Image indisponible · Réessayer',()=>{
            retry.remove(); image.src=src;
        },'mom-image-retry');
        image.after(retry);
    },true);
    document.addEventListener('load',event=>{
        if(event.target.tagName==='IMG')event.target.parentElement?.querySelector('.mom-image-retry')?.remove();
    },true);
    document.addEventListener('amor:badge',()=>{indexDirty=true;});
    ['home-item-form','home-badge-form'].forEach(id=>$('#'+id).addEventListener('submit',()=>{indexDirty=true;}));
    new MutationObserver(()=>{indexDirty=true;}).observe($('#home-items'),{childList:true});

    async function refreshCardCovers(){
        if(!$('#auth-screen').hidden) return;
        const account=userId;
        const {data,error}=await supabaseClient.from('memory_covers').select('*');
        if(error || account!==userId) return;
        if(!data.length) return;
        const {data:links,error:linkError}=await amorCoverLinks(data);
        if(linkError || account!==userId || !$('#auth-screen').hidden) return;
        data.forEach((p,i)=>{
            const url=links[i]?.signedUrl;if(!url)return;
            preferences.set(p.scope_key,p);
            const dest=destinations.find(d=>String(d.id)===String(p.city_id));
            if(!dest)return;
            if(!p.stay_id || String(dest.dernierSejourId)===String(p.stay_id)) dest.urlPhotoPrincipale=url;
            if(!p.stay_id){
                const card=[...document.querySelectorAll('.home-carte')].find(c=>c.querySelector('h3')?.textContent===dest.ville);
                if(card){let img=card.querySelector(':scope > img');if(!img){img=el('img');img.alt=`Notre chez-nous à ${dest.ville}`;card.prepend(img);}
                    img.src=url;img.style.objectPosition=`${p.position_x}% ${p.position_y}%`;card.classList.add('avec-photo');}
            }
            if(typeof destinationDernierSouvenir!=='undefined' && destinationDernierSouvenir &&
                ((p.stay_id && String(destinationDernierSouvenir.dernierSejourId)===String(p.stay_id)) ||
                (!p.stay_id && String(destinationDernierSouvenir.id)===String(p.city_id)))){
                const img=$('#dashboard-dernier-photo');img.src=url;img.hidden=false;img.style.objectPosition=`${p.position_x}% ${p.position_y}%`;
                $('#dashboard-dernier-souvenir').classList.add('avec-photo');
            }
        });
        emit('amor:refresh-covers');
    }
    document.addEventListener('amor:data-ready',()=>{indexDirty=true;refreshCardCovers().catch(()=>{});});
    new MutationObserver(()=>{refreshCardCovers().catch(()=>{});}).observe($('#homes-liste'),{childList:true});
    document.addEventListener('amor:data-error',()=>{
        const parent=$('.hero'); parent.querySelector('.mom-error')?.remove();
        errorBox(parent,'La carte et les villes ne peuvent pas être chargées pour le moment.',()=>chargerDestinationsDepuisSupabase());
    });
    document.addEventListener('amor:data-ready',()=>$('.hero > .mom-error')?.remove());
    document.addEventListener('amor:first-times-error',()=>{
        const parent=$('#premieres-fois-dialog');parent.querySelector('.mom-first-error')?.remove();
        const box=errorBox(parent,'Les premières fois sont indisponibles. Réessayez quand la connexion revient.',async()=>{
            try{await chargerPremieresFois();}catch{emit('amor:first-times-error');}
        });box.classList.add('mom-first-error');
    });

    // Chargements visibles, sans faux état « aucun média » en cas de panne.
    function mediaLoader(old, audio){
        let version=0;
        const target=$(audio?'#audio-vide':'#photos-vides');
        const initial=target.innerHTML;
        const skeleton=el('div',audio?'Chargement du vocal…':'Chargement des photos…','mom-skeleton');skeleton.hidden=true;
        target.before(skeleton);
        return async function(souvenir){
            const ticket=++version;
            let failed=false;
            const failure=e=>{if(e.detail.audio===audio && String(e.detail.stayId)===String(souvenir.id))failed=true;};
            document.addEventListener('amor:media-error',failure);
            target.innerHTML=initial;target.setAttribute('aria-busy','true');
            const promise=old(souvenir);target.hidden=true;skeleton.hidden=false;
            try{await promise;}
            catch{failed=true;emit('amor:media-error',{audio,stayId:souvenir.id});}
            finally{
                document.removeEventListener('amor:media-error',failure);
                if(ticket===version){
                    skeleton.hidden=true;target.removeAttribute('aria-busy');
                    if(String(souvenir.id)===String(souvenirsActifs?.id))target.hidden=failed?false:audio?Boolean(mediaAudioActif):mediasPhotosActifs.length>0;
                }
            }
        };
    }
    chargerPhotos=mediaLoader(chargerPhotos,false);
    chargerAudio=mediaLoader(chargerAudio,true);

    const opening=dialog('Ouverture du souvenir');let openingCount=0;
    opening.content.append(el('div','Un instant, on retrouve vos moments…','mom-skeleton'));
    opening.d.querySelector('.mom-close').hidden=true;
    opening.d.addEventListener('cancel',event=>event.preventDefault());
    const recovery=dialog('Réessayer l’ouverture');
    function openLoader(old, home){
        return async function wrapped(dest,...args){
            openingCount++;if(!opening.d.open)opening.d.showModal();
            const expected=$(home||dest.experienceType==='home'?'#home-dialog':'#souvenir-dialog');
            try{await old(dest,...args);}
            catch(error){console.warn('Ouverture temporairement indisponible.',error);}
            finally{
                openingCount--;
                if(!$('#auth-screen').hidden){expected.close();opening.d.close();return;}
                if(openingCount===0){
                    opening.d.close();
                    if(!expected.open){
                        recovery.content.replaceChildren();
                        errorBox(recovery.content,'Cette fiche n’a pas pu être ouverte. Vos données ne sont pas perdues.',()=>{recovery.d.close();wrapped(dest,...args);});
                        recovery.d.showModal();
                    }
                }
            }
        };
    }
    ouvrirFiche=openLoader(ouvrirFiche,false);ouvrirFicheHome=openLoader(ouvrirFicheHome,true);

    // Carrousel tactile : trois panneaux suivent le doigt, puis se calent.
    const viewer=$('#visionneuse'), original=$('#visionneuse-image');
    const stage=el('div',null,'mom-carousel');const track=el('div',null,'mom-carousel-track');
    const prevPane=el('div',null,'mom-slide'),currentPane=el('div',null,'mom-slide'),nextPane=el('div',null,'mom-slide');
    original.before(stage);currentPane.append(original);track.append(prevPane,currentPane,nextPane);stage.append(track);
    let gesture=null, animating=false, frame=0, fallbackTimer=null, activeEnd=null;
    function offset(x,animate=false){track.style.transition=animate&&!reduced()?'transform 260ms cubic-bezier(.2,.75,.25,1)':'none';track.style.transform=`translate3d(${-stage.clientWidth+x}px,0,0)`;}
    function neighbours(){
        [prevPane,nextPane].forEach((pane,i)=>{
            pane.replaceChildren(); const p=photosAffichees[indexPhotoActive+(i===0?-1:1)];
            if(p){const img=el('img');img.src=p.url;img.alt='';img.draggable=false;pane.append(img);}
        });
        original.draggable=false;offset(0);
    }
    function slide(direction){
        window.amorResetZoom?.();
        const next=indexPhotoActive+direction;
        if(animating||next<0||next>=photosAffichees.length){offset(0,true);return;}
        animating=true;offset(-direction*stage.clientWidth,true);
        const finish=()=>{
            if(!animating)return;
            animating=false;clearTimeout(fallbackTimer);track.removeEventListener('transitionend',end);activeEnd=null;
            if(viewer.open){indexPhotoActive=next;actualiserVisionneuse();neighbours();}
        };
        const end=event=>{if(event.target===track&&event.propertyName==='transform')finish();};
        activeEnd=end;
        track.addEventListener('transitionend',end);fallbackTimer=setTimeout(finish,reduced()?0:300);
    }
    const originalUpdate=actualiserVisionneuse;
    actualiserVisionneuse=function(){originalUpdate();requestAnimationFrame(()=>{if(!animating)neighbours();});};
    ['photo-precedente','photo-suivante'].forEach((id,i)=>$('#'+id).addEventListener('click',event=>{
        event.preventDefault();event.stopImmediatePropagation();slide(i===0?-1:1);
    },true));
    document.addEventListener('keydown',event=>{
        if(viewer.open&&['ArrowLeft','ArrowRight'].includes(event.key)){
            event.preventDefault();event.stopImmediatePropagation();slide(event.key==='ArrowLeft'?-1:1);
        }
    },true);
    stage.addEventListener('touchstart',event=>{
        if(animating){gesture=null;return;}
        if(event.touches.length!==1){gesture=null;offset(0);return;}
        const t=event.touches[0];gesture={x:t.clientX,y:t.clientY,dx:0,time:performance.now(),axis:null};
    },{passive:true});
    stage.addEventListener('touchmove',event=>{
        if(!gesture)return;
        if(event.touches.length!==1){gesture=null;offset(0);return;}
        const t=event.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
        if(!gesture.axis&&Math.max(Math.abs(dx),Math.abs(dy))>8)gesture.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
        if(gesture.axis!=='x')return;
        event.preventDefault();
        gesture.dx=dx;
        const edge=(dx>0&&indexPhotoActive===0)||(dx<0&&indexPhotoActive===photosAffichees.length-1);
        cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>offset(edge?dx*.25:dx));
    },{passive:false});
    stage.addEventListener('touchend',()=>{
        cancelAnimationFrame(frame);
        if(!gesture)return;
        const {dx,time,axis}=gesture;gesture=null;
        const speed=Math.abs(dx)/Math.max(1,performance.now()-time);
        if(axis==='x'&&(Math.abs(dx)>stage.clientWidth*.2||(Math.abs(dx)>28&&speed>.45)))slide(dx<0?1:-1);
        else offset(0,true);
    },{passive:true});
    stage.addEventListener('touchcancel',()=>{cancelAnimationFrame(frame);gesture=null;offset(0,true);},{passive:true});
    viewer.addEventListener('close',()=>{gesture=null;animating=false;clearTimeout(fallbackTimer);cancelAnimationFrame(frame);
        if(activeEnd){track.removeEventListener('transitionend',activeEnd);activeEnd=null;}offset(0);});
    new ResizeObserver(()=>{if(!gesture&&!animating)offset(0);}).observe(stage);
    window.amorCarousel={busy:()=>animating,reset(){gesture=null;cancelAnimationFrame(frame);if(!animating)offset(0);}};
})();
