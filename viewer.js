/* V7 — filmstrip, lecture sans commandes et transition depuis la miniature. */
(() => {
 const M=AmorV7,{E}=AmorV6,viewer=document.querySelector('#visionneuse'),stage=document.querySelector('.mom-carousel');
 let origin=null,cleanupTap=null;
 document.addEventListener('click',event=>{const image=event.target.closest('button,.photo-souvenir,.home-photo')?.querySelector('img');if(image){const r=image.getBoundingClientRect();if(r.width&&r.height)origin={r,time:Date.now()};}},true);
 M.photoControls=(dialog,surface)=>{
  surface._v7Cleanup?.();let start=null,timer=null,last=0;
  const toggle=()=>{const clean=dialog.classList.toggle('v7-clean-photo');button.setAttribute('aria-pressed',String(clean));button.textContent=clean?'Afficher les commandes':'Masquer les commandes';};
  let button=dialog.querySelector('.v7-toggle-controls');if(!button){button=M.button('Masquer les commandes',toggle,'image');button.classList.add('v7-toggle-controls');dialog.append(button);}else button.onclick=toggle;
  dialog.classList.remove('v7-clean-photo');button.setAttribute('aria-pressed','false');button.textContent='Masquer les commandes';
  const down=e=>{clearTimeout(timer);start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now()}:null;};
  const up=e=>{if(!start||e.changedTouches.length!==1||e.touches.length)return;const t=e.changedTouches[0],time=Date.now();if(Math.hypot(t.clientX-start.x,t.clientY-start.y)<10&&time-start.time<250){if(time-last>350)timer=setTimeout(toggle,350);last=time;}start=null;};
  const cancel=()=>{start=null;clearTimeout(timer);};surface.addEventListener('touchstart',down,{passive:true});surface.addEventListener('touchend',up,{passive:true});surface.addEventListener('touchcancel',cancel,{passive:true});
  const click=e=>{if(e.target.closest('button')||e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents||e.detail===0)return;if(Date.now()-last>600)toggle();};surface.addEventListener('click',click);
  const closed=()=>{cancel();dialog.classList.remove('v7-clean-photo');};dialog.addEventListener('close',closed,{once:true});
  surface._v7Cleanup=()=>{cancel();surface.removeEventListener('touchstart',down);surface.removeEventListener('touchend',up);surface.removeEventListener('touchcancel',cancel);surface.removeEventListener('click',click);dialog.removeEventListener('close',closed);};
 };
 const strip=E('nav',null,'v7-filmstrip');strip.setAttribute('aria-label','Choisir une photo de l’album');document.querySelector('#visionneuse-legende').after(strip);
 const count=E('p',null,'v7-photo-count');count.setAttribute('role','status');strip.before(count);
 function filmstrip(){strip.replaceChildren();const start=Math.max(0,indexPhotoActive-6),end=Math.min(photosAffichees.length,indexPhotoActive+7);
  for(let index=start;index<end;index++){const photo=photosAffichees[index],b=M.button('',()=>{window.amorResetZoom?.();window.amorCarousel.goTo(index);});b.setAttribute('aria-label',`Photo ${index+1} sur ${photosAffichees.length} : ${photo.texteAlternatif||'Notre photo'}`);b.setAttribute('aria-current',index===indexPhotoActive?'true':'false');const img=E('img');img.src=photo.thumbUrl||photo.url;img.alt='';img.loading='lazy';b.append(img);strip.append(b);}
  count.textContent=`${indexPhotoActive+1} / ${photosAffichees.length}`;requestAnimationFrame(()=>{const b=strip.querySelector('[aria-current=true]');if(b)strip.scrollLeft=Math.max(0,b.offsetLeft-strip.offsetLeft-(strip.clientWidth-b.offsetWidth)/2);});
 }
 const update=actualiserVisionneuse;actualiserVisionneuse=function(){update();if(viewer.open)filmstrip();};
 M.photoTransition=surface=>{if(!M.reduced()&&surface.animate&&origin&&Date.now()-origin.time<1500){const to=surface.getBoundingClientRect(),from=origin.r,dx=from.left+from.width/2-to.left-to.width/2,dy=from.top+from.height/2-to.top-to.height/2;
   surface.animate([{transform:`translate(${dx}px,${dy}px) scale(${Math.min(1,from.width/Math.max(1,to.width))})`,opacity:.6},{transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.75,.25,1)'});origin=null;}};
 new MutationObserver(()=>{if(!viewer.open){strip.replaceChildren();origin=null;cleanupTap?.();return;}filmstrip();M.photoControls(viewer,stage);cleanupTap=stage._v7Cleanup;M.photoTransition(stage);
 }).observe(viewer,{attributes:true,attributeFilter:['open']});
})();
