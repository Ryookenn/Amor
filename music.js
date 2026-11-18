/* V9 — lecteurs officiels chargés au toucher, aucune copie audio ni connexion musicale requise dans AMOR. */
(() => {
 'use strict';
 const {E}=AmorV6,M=AmorV7,$=s=>document.querySelector(s),input=$('#fiche-musique-lien');
 function parse(value){
  if(!String(value||'').trim())return null;
  let u;try{u=new URL(String(value).trim());}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2048)return null;
  if(u.hostname==='open.spotify.com'){
   const m=u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/);if(!m)return null;
   return {provider:'Spotify',url:'https://open.spotify.com/track/'+m[1],embed:'https://open.spotify.com/embed/track/'+m[1],height:152};
  }
  if(u.hostname==='music.apple.com'){
   const m=u.pathname.match(/^\/([a-z]{2})\/(song|album)\/([^/]+)\/(\d+)\/?$/);if(!m)return null;
   const track=m[2]==='song'?m[4]:u.searchParams.get('i');if(!track||!/^\d+$/.test(track))return null;
   const url=new URL(u.origin+u.pathname);if(m[2]==='album')url.searchParams.set('i',track);
   return {provider:'Apple Music',url:url.href,embed:url.href.replace('https://music.apple.com/','https://embed.music.apple.com/'),height:175};
  }
  return null;
 }
 const player=E('div',null,'v9-music');$('#vue-musique').closest('.musique-souvenir').after(player);
 let key=null;
 function stop(){player.querySelectorAll('iframe').forEach(n=>n.remove());key=null;}
 function render(){const current=souvenirsActifs||{},raw=current.musiqueLien||'',track=parse(raw),next=String(current.id||'')+'|'+raw;
  if(key===next)return;stop();key=next;player.replaceChildren();player.hidden=!raw;if(!raw)return;
  if(!track){player.append(E('p','Le lien musical n’est pas reconnu. Vous pouvez le remplacer dans la fiche.'));return;}
  const note=E('p','Lecteur '+track.provider+' · extrait ou lecture selon disponibilité','v9-muted'),slot=E('div',null,'v9-player-slot');
  const activate=M.button('Écouter avec '+track.provider,()=>{
   if(slot.querySelector('iframe'))return;
   const iframe=E('iframe');iframe.title='Écouter '+(current.musique||'notre musique')+' sur '+track.provider;iframe.src=track.embed;iframe.height=String(track.height);iframe.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.loading='lazy';slot.replaceChildren(iframe);activate.hidden=true;requestAnimationFrame(fitPlayer);
   note.textContent='Touchez Play dans le lecteur. Si la lecture est indisponible, ouvrez le morceau sur '+track.provider+'.';
  },'music',false);
  const external=E('a','Ouvrir dans '+track.provider,'v6-quiet');external.href=track.url;external.target='_blank';external.rel='noopener noreferrer';
  player.append(note,activate,slot,external,E('small','Le lecteur contacte '+track.provider+' uniquement après votre toucher. Aucun lancement automatique.'));
 }
 function fitPlayer(){const slot=player.querySelector('.v9-player-slot');if(!slot?.querySelector('iframe'))return;slot.style.width='';slot.style.marginLeft='';slot.style.marginRight='';if(slot.clientWidth>=280)return;const owner=$('#souvenir-dialog'),width=Math.max(0,Math.min(660,owner.clientWidth-16)),left=owner.getBoundingClientRect().left+(owner.clientWidth-width)/2;slot.style.width=width+'px';slot.style.marginLeft='0px';slot.style.marginRight='0px';slot.style.marginLeft=(left-slot.getBoundingClientRect().left)+'px';}
 new ResizeObserver(fitPlayer).observe(player);
 function validate(){const valid=!input.value.trim()||parse(input.value);input.setCustomValidity(valid?'':'Collez le lien HTTPS d’un morceau Apple Music ou Spotify. Pour un lien court, ouvrez-le puis copiez l’adresse complète du morceau.');}
 input.addEventListener('input',validate);$('#souvenir-form').addEventListener('submit',validate,true);
 new MutationObserver(()=>{if($('#souvenir-dialog').open&&!modeEdition)render();else{stop();player.replaceChildren();}}).observe($('#souvenir-dialog'),{attributes:true,attributeFilter:['open','class']});
 new MutationObserver(render).observe($('#vue-musique'),{childList:true});
 document.addEventListener('amor:record-ready',render);document.addEventListener('amor:editing',()=>{stop();player.replaceChildren();validate();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();player.replaceChildren();}else if($('#souvenir-dialog').open&&!modeEdition)render();});
 window.AmorMusic={parse,stop};
})();
