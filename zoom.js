/* Pincement, panoramique et double toucher indépendants du changement de photo. */
(() => {
 const V=AmorV6;
 function attach(stage,image){
  let scale=1,x=0,y=0,pinch=null,pan=null,tap=null,lastTap=null;
  const reset=document.createElement('button');reset.type='button';reset.className='v6-zoom-reset';reset.textContent='Revenir à la photo entière';reset.hidden=true;stage.append(reset);stage.classList.add('v6-zoom-stage');
  const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  function bounds(){const ratio=(image.naturalWidth||stage.clientWidth)/(image.naturalHeight||stage.clientHeight),fw=Math.min(stage.clientWidth,stage.clientHeight*ratio),fh=fw/ratio;
   x=Math.max(-Math.max(0,(fw*scale-stage.clientWidth)/2),Math.min(Math.max(0,(fw*scale-stage.clientWidth)/2),x));
   y=Math.max(-Math.max(0,(fh*scale-stage.clientHeight)/2),Math.min(Math.max(0,(fh*scale-stage.clientHeight)/2),y));
  }
  function draw(animate=false){bounds();image.style.transition=animate?'transform 180ms ease':'none';image.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;reset.hidden=scale<=1.01;stage.dataset.zoomed=String(scale>1.01);}
  function clear(){scale=1;x=y=0;pinch=pan=tap=lastTap=null;draw(true);}
  reset.onclick=clear;
  const start=e=>{if(e.target===reset||stage.classList.contains('mom-carousel')&&window.amorCarousel?.busy())return;
   if(e.touches.length===2){tap=null;window.amorCarousel?.reset();const r=stage.getBoundingClientRect();pinch={distance:distance(e.touches),scale,x,y,mx:(e.touches[0].clientX+e.touches[1].clientX)/2-r.left-r.width/2,my:(e.touches[0].clientY+e.touches[1].clientY)/2-r.top-r.height/2};pan=null;e.preventDefault();e.stopImmediatePropagation();}
   else if(e.touches.length===1){const t=e.touches[0];tap={x:t.clientX,y:t.clientY,time:Date.now()};if(scale>1.01){window.amorCarousel?.reset();pan={sx:t.clientX,sy:t.clientY,x,y};e.preventDefault();e.stopImmediatePropagation();}}
  };
  const move=e=>{if(e.touches.length===2&&pinch){e.preventDefault();e.stopImmediatePropagation();const next=Math.max(1,Math.min(4,pinch.scale*distance(e.touches)/Math.max(1,pinch.distance))),factor=next/pinch.scale;scale=next;x=pinch.x*factor-pinch.mx*(factor-1);y=pinch.y*factor-pinch.my*(factor-1);draw();}
   else if(e.touches.length===1&&scale>1.01){e.preventDefault();e.stopImmediatePropagation();if(!pan){pan={sx:e.touches[0].clientX,sy:e.touches[0].clientY,x,y};}x=pan.x+e.touches[0].clientX-pan.sx;y=pan.y+e.touches[0].clientY-pan.sy;draw();}
  };
  const end=e=>{const wasZooming=Boolean(pinch||pan);if(wasZooming){e.preventDefault();e.stopImmediatePropagation();pinch=pan=null;if(scale<1.03)clear();}
   if(tap&&e.changedTouches.length===1&&e.touches.length===0){const t=e.changedTouches[0],short=Math.hypot(t.clientX-tap.x,t.clientY-tap.y)<12&&Date.now()-tap.time<300;
    if(short&&lastTap&&Date.now()-lastTap.time<330&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<30){e.preventDefault();e.stopImmediatePropagation();window.amorCarousel?.reset();if(scale>1.01)clear();else{const r=stage.getBoundingClientRect();scale=2.5;x=-(t.clientX-r.left-r.width/2)*(scale-1);y=-(t.clientY-r.top-r.height/2)*(scale-1);draw(true);}lastTap=null;}else if(short)lastTap={x:t.clientX,y:t.clientY,time:Date.now()};tap=null;
   }
  };
  stage.addEventListener('touchstart',start,{capture:true,passive:false});stage.addEventListener('touchmove',move,{capture:true,passive:false});stage.addEventListener('touchend',end,{capture:true,passive:false});
  const cancel=()=>{pinch=pan=tap=null;draw();};stage.addEventListener('touchcancel',cancel,{capture:true,passive:true});
  const observer=new MutationObserver(clear);observer.observe(image,{attributes:true,attributeFilter:['src']});const resize=new ResizeObserver(()=>draw());resize.observe(stage);
  return {reset:clear,destroy(){observer.disconnect();resize.disconnect();stage.removeEventListener('touchstart',start,true);stage.removeEventListener('touchmove',move,true);stage.removeEventListener('touchend',end,true);stage.removeEventListener('touchcancel',cancel,true);reset.remove();}};
 }
 V.attachZoom=attach;
 const main=attach(document.querySelector('.mom-carousel'),document.querySelector('#visionneuse-image'));
 window.amorResetZoom=main.reset;document.querySelector('#visionneuse').addEventListener('close',main.reset);
})();
