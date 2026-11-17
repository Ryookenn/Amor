/* Optimisation non destructive par défaut ; anciens médias toujours compatibles. */
(() => {
    const storage=()=>supabaseClient.storage.from('memories');
    const ext=blob=>blob.type==='image/webp'?'webp':blob.type==='image/png'?'png':'jpg';
    envoyerPhotos=async function(files,stay,destination){
        const uploaded=[],created=[];
        try{
            for(const file of files){
                let thumb=null,display=null;
                try{thumb=await amorResize(file,480,.78);if(file.type!=='image/gif')display=await amorResize(file,2000,.88);}catch{ /* Original conservé si le navigateur ne sait pas convertir. */ }
                const keep=AmorV5.keepOriginals || !display;
                const main=keep?file:display;
                const stem=`${destination.id}/${stay.id}/${crypto.randomUUID()}`;
                const path=`${stem}-${keep?nettoyerNomFichier(file.name):'photo.'+ext(main)}`;
                let thumbPath=null,displayPath=null;
                async function upload(p,blob){const {error}=await storage().upload(p,blob,{cacheControl:'3600',upsert:false,contentType:blob.type});if(error)throw error;uploaded.push(p);}
                await upload(path,main);
                if(thumb){thumbPath=`${stem}-thumb.${ext(thumb)}`;await upload(thumbPath,thumb);}
                if(display&&keep){displayPath=`${stem}-screen.${ext(display)}`;await upload(displayPath,display);}
                else if(display)displayPath=path;
                const {data,error}=await supabaseClient.from('stay_media').insert({stay_id:stay.id,media_type:'photo',storage_path:path,
                    thumb_path:thumbPath,display_path:displayPath,original_kept:keep,original_name:file.name}).select('id').single();
                if(error)throw error;created.push(String(data.id));
            }
        }catch(error){
            if(created.length)await amorTrashQuery('stay_media').in('id',created);
            await amorSafeRemove(uploaded);throw error;
        }
    };
    async function signed(media){
        const paths=[...new Set(media.flatMap(m=>[m.storage_path,m.thumb_path,m.display_path].filter(Boolean)))];
        if(!paths.length)return new Map();
        const {data,error}=await storage().createSignedUrls(paths,3600);if(error)throw error;
        return new Map(paths.map((p,i)=>[p,data[i]?.signedUrl]));
    }
    function hydrate(media,links){return media.map(m=>({...m,url:links.get(m.display_path)||links.get(m.storage_path),
        originalUrl:links.get(m.storage_path),thumbUrl:links.get(m.thumb_path)||links.get(m.display_path)||links.get(m.storage_path)})).filter(m=>m.url);}
    window.amorOptimizeExisting=async function(media,progress=()=>{}){
        let done=0;
        for(const m of media){
            if(m.media_type!=='photo'||(m.thumb_path&&(m.display_path||m.original_name?.toLowerCase().endsWith('.gif')))||m.deleted_at)continue;
            const {data:file,error}=await storage().download(m.storage_path);if(error)throw error;
            const thumb=await amorResize(file,480,.78),display=(file.type==='image/gif'||m.original_name?.toLowerCase().endsWith('.gif'))?null:await amorResize(file,2000,.88);
            const prefix=`optimized/${m.stay_id}/${crypto.randomUUID()}`;
            const values={thumb_path:m.thumb_path||`${prefix}-thumb.${ext(thumb)}`,display_path:m.display_path||(display?`${prefix}-screen.${ext(display)}`:null)};
            const uploaded=[];
            try{
                for(const [path,blob,needed]of [[values.thumb_path,thumb,!m.thumb_path],[values.display_path,display,!m.display_path&&display]]){
                    if(!needed)continue;const {error}=await storage().upload(path,blob,{upsert:false,contentType:blob.type,cacheControl:'3600'});if(error)throw error;uploaded.push(path);
                }
                const {error}=await supabaseClient.from('stay_media').update(values).eq('id',m.id).select('id').single();if(error)throw error;
                progress(++done);
            }catch(error){await amorSafeRemove(uploaded);throw error;}
        }return done;
    };
    let stayRequest=0,homeRequest=0;
    chargerPhotos=async function(stay){
        const ticket=++stayRequest;
        galeriePhotos.replaceChildren();mediasPhotosActifs=[];photosAffichees=[];photosVides.hidden=false;photosExistantesEdition.replaceChildren();
        if(!stay.id)return;
        try{
            const {data,error}=await supabaseClient.from('stay_media').select('id,stay_id,storage_path,thumb_path,display_path,original_name,original_kept,caption,sort_order,in_mosaic,revision,upload_key').eq('stay_id',stay.id).eq('media_type','photo').order('sort_order').order('created_at');
            if(error)throw error;
            const links=await signed(data);
            if(ticket!==stayRequest||String(souvenirsActifs.id)!==String(stay.id))return;
            mediasPhotosActifs=hydrate(data,links);
            photosAffichees=mediasPhotosActifs.map(m=>({url:m.url,thumbUrl:m.thumbUrl,texteAlternatif:m.caption||m.original_name||'Notre photo'}));
            mediasPhotosActifs.forEach((m,i)=>{
                const photo=creerElementPhoto(m.thumbUrl,m.original_name||`Photo ${i+1}`,()=>ouvrirVisionneuse(i));
                photo.dataset.mediaId=m.id;galeriePhotos.append(photo);
                photo.dataset.mosaic=String(m.in_mosaic!==false);
            });
            photosVides.hidden=mediasPhotosActifs.length>0;afficherPhotosEdition();
            document.dispatchEvent(new CustomEvent('amor:photos-ready'));
        }catch(error){document.dispatchEvent(new CustomEvent('amor:media-error',{detail:{audio:false,stayId:stay.id}}));}
    };
    chargerPhotosHome=async function(destination){
        const ticket=++homeRequest;
        homeGalerie.replaceChildren();homeMediasActifs=[];photosAffichees=[];homeGalerieVide.hidden=false;
        const ids=idsSejoursHome(destination);if(!ids.length)return;
        const {data,error}=await supabaseClient.from('stay_media').select('id,stay_id,storage_path,thumb_path,display_path,original_name,original_kept,created_at,caption,sort_order,in_mosaic,revision,upload_key').in('stay_id',ids).eq('media_type','photo').order('sort_order').order('created_at');
        if(error)throw error;
        const links=await signed(data);if(ticket!==homeRequest||homeActif?.id!==destination.id)return;
        homeMediasActifs=hydrate(data,links);
        photosAffichees=homeMediasActifs.map(m=>({url:m.url,thumbUrl:m.thumbUrl,texteAlternatif:m.caption||m.original_name||'Notre photo'}));
        homeMediasActifs.forEach((m,i)=>{
            const card=document.createElement('div');card.className='home-photo';card.dataset.mediaId=m.id;
            card.classList.toggle('v6-hidden-mosaic',m.in_mosaic===false);
            const open=document.createElement('button');open.type='button';open.className='home-photo-ouvrir';open.setAttribute('aria-label','Agrandir cette photo');
            const image=document.createElement('img');image.src=m.thumbUrl;image.alt=m.original_name||'';image.loading='lazy';open.append(image);open.onclick=()=>ouvrirVisionneuse(i);
            const remove=document.createElement('button');remove.type='button';remove.className='home-photo-supprimer';remove.textContent='×';remove.setAttribute('aria-label','Mettre cette photo à la corbeille');remove.onclick=()=>supprimerPhotoHome(m,remove);
            card.append(open,remove);homeGalerie.append(card);
        });
        homeGalerieVide.hidden=homeMediasActifs.length>0;
        document.dispatchEvent(new CustomEvent('amor:photos-ready'));
    };
})();
