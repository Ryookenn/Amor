/* AMOR V3 — présentation et navigation. Aucune nouvelle donnée distante. */
(() => {
    'use strict';
    const $ = selector => document.querySelector(selector);
    const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paths = {
        home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
        map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
        badge: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8M10 9l1.5 1.5L14 8"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
        camera: '<path d="M8 5 9.5 3h5L16 5h4a1 1 0 0 1 1 1v13H3V6a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12" r="4"/>',
        audio: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
        edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        plus: '<path d="M12 4v16M4 12h16"/>',
        left: '<path d="m14 5-7 7 7 7M7 12h14"/>',
        right: '<path d="m10 5 7 7-7 7M3 12h14"/>',
        trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18"/>',
        music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>'
    };
    function icon(name) {
        return `<svg class="amor-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.heart}</svg>`;
    }

    // Chaque commande garde son élément et son gestionnaire d'origine.
    const controls = {
        'fermer-fiche': ['close', 'Fermer la fiche'],
        'fermer-home': ['close', 'Fermer la fiche'],
        'fermer-visionneuse': ['close', 'Fermer la photo'],
        'fermer-premieres-fois': ['close', 'Fermer les premières fois'],
        'fermer-ajout-ville': ['close', 'Fermer'],
        'supprimer-ville': ['trash', 'Supprimer cette ville'],
        'sejour-precedent': ['left', 'Séjour précédent'],
        'sejour-suivant': ['right', 'Séjour suivant'],
        'photo-precedente': ['left', 'Photo précédente'],
        'photo-suivante': ['right', 'Photo suivante']
    };
    for (const [id, [name, label]] of Object.entries(controls)) {
        const element = document.getElementById(id);
        if (!element) continue;
        element.innerHTML = icon(name);
        element.setAttribute('aria-label', label);
        element.title = label;
        element.classList.add('amor-icon-button');
    }
    [['.ajouter-photos-icone', 'camera'], ['.ajouter-audio-icone', 'audio'],
        ['.musique-icone', 'music'], ['.capsule-audio-icone', 'audio'],
        ['.premieres-fois-resume-icone', 'badge']].forEach(([selector, name]) => {
        document.querySelectorAll(selector).forEach(el => { el.innerHTML = icon(name); });
    });
    const modifier = $('#modifier-fiche');
    modifier.innerHTML = `${icon('edit')}<span>Modifier</span>`;

    const main = $('main');
    const dashboard = $('.tableau-bord');
    main.insertBefore(dashboard, $('.premieres-fois-resume'));
    $('.hero-description').textContent = 'Nos escapades, nos habitudes, et tout ce qui fait nous.';

    const firstPage=$('#premieres-fois-dialog');main.append(firstPage);
    $('#fermer-premieres-fois').hidden=true;
    const nav = document.createElement('nav');
    nav.className = 'amor-tabbar';
    nav.setAttribute('aria-label', 'Navigation principale');
    nav.innerHTML = [['accueil', 'heart', 'Accueil'], ['carte', 'map', 'Carte'],
        ['premieres', 'badge', 'Premières fois'], ['homes', 'home', 'Chez nous']]
        .map(([route, name, label]) => `<button type="button" data-route="${route}">${icon(name)}<span>${label}</span></button>`).join('');
    document.body.append(nav);
    document.body.dataset.amorRoute = 'accueil';
    let activeRoute = 'accueil';
    const scrollPositions=new Map();
    function route(name) {
        if(!['accueil','carte','premieres','homes'].includes(name))return;
        scrollPositions.set(activeRoute,scrollY);
        const changed=activeRoute!==name;
        activeRoute = name;
        document.body.dataset.amorRoute = name;
        firstPage.hidden=name!=='premieres';
        nav.querySelectorAll('button').forEach(button => {
            button.setAttribute('aria-current', button.dataset.route === name ? 'page' : 'false');
        });
        if(changed)window.scrollTo({top:scrollPositions.get(name)||0,behavior:'instant'});
        requestAnimationFrame(() => { if (typeof map !== 'undefined') map.invalidateSize(); });
        if(name==='premieres'&&changed)chargerPremieresFois().catch(()=>{document.dispatchEvent(new CustomEvent('amor:first-times-error'));});
        document.dispatchEvent(new CustomEvent('amor:route-change',{detail:{route:name}}));
    }
    window.amorNavigate=route;
    route('accueil');
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-route]');
        if (button) route(button.dataset.route);
    });
    $('.logo').addEventListener('click', event => { event.preventDefault(); route('accueil'); });
    const auth = $('#auth-screen');
    const syncAuth = () => {document.body.classList.toggle('amor-connected', auth.hidden);if(!auth.hidden){fermerFormulairePremiereFois();$('#liste-premieres-fois-a-vivre').replaceChildren();$('#liste-premieres-fois-realisees').replaceChildren();route('accueil');scrollPositions.clear();}};
    new MutationObserver(syncAuth).observe(auth, { attributes: true, attributeFilter: ['hidden'] });
    syncAuth();

    // Photo principale du séjour courant : pas une photo d'un autre séjour.
    function makeCover(dialog, source, title, subtitle) {
        const cover = document.createElement('div');
        cover.className = 'amor-cover';
        cover.hidden = true;
        cover.innerHTML = '<img alt=""><div class="amor-cover-shade"></div><div class="amor-cover-caption"><p></p><h3></h3></div>';
        dialog.querySelector(':scope > header, :scope > .fiche-header').after(cover);
        const image = cover.querySelector('img');
        function update() {
            const first = source.querySelector('img');
            const preference = window.amorCoverSource?.(dialog.id);
            const url = preference?.url || first?.getAttribute('src');
            image.style.objectPosition = `${preference?.x ?? 50}% ${preference?.y ?? 50}%`;
            cover.hidden = !url;
            if (url && image.getAttribute('src') !== url) image.src = url;
            cover.querySelector('h3').textContent = title.textContent;
            cover.querySelector('p').textContent = subtitle.textContent;
            dialog.dataset.city = title.textContent.trim().toLowerCase();
        }
        image.addEventListener('error', () => { cover.classList.add('amor-cover-error'); });
        image.addEventListener('load', () => { cover.classList.remove('amor-cover-error'); });
        new MutationObserver(update).observe(source, { childList: true, subtree: true });
        new MutationObserver(update).observe(title, { childList: true, subtree: true });
        new MutationObserver(update).observe(subtitle, { childList: true, subtree: true });
        update();
        document.addEventListener('amor:refresh-covers', update);
    }
    makeCover($('#souvenir-dialog'), $('#galerie-photos'), $('#fiche-ville'), $('#vue-dates'));
    makeCover($('#home-dialog'), $('#home-galerie'), $('#home-ville'), $('#home-tagline'));

    // Une mosaïque compacte ; la cinquième image ouvre toute la visionneuse.
    const gallery = $('#galerie-photos');
    function mosaic() {
        const pictures = [...gallery.querySelectorAll('.photo-souvenir')];
        gallery.classList.toggle('amor-mosaic', pictures.length > 1);
        const chosen=pictures.filter(p=>p.dataset.mosaic!=='false');
        pictures.forEach((picture) => {
            const i=chosen.indexOf(picture);
            picture.classList.toggle('amor-photo-extra', i < 0 || i > 4);
            picture.removeAttribute('data-more');
            if (i === 4 && pictures.length > 5) {
                picture.dataset.more = `+${pictures.length - 5}`;
                picture.setAttribute('aria-label', `Voir les ${pictures.length} photos du séjour`);
            }
        });
    }
    new MutationObserver(mosaic).observe(gallery, { childList: true });
    mosaic();

    // États vides illustrés par des SVG locaux, sans ressource distante.
    [['#photos-vides', 'camera', 'Notre album commence ici', 'Les images que l’on choisira de garder ensemble.'],
        ['#audio-vide', 'audio', 'Un jour, une voix', 'Quelques mots ou un son pour retrouver ce moment.'],
        ['#home-galerie-vide', 'camera', 'Notre quotidien en images', 'Une photo quand l’envie nous prend.'],
        ['#home-items-vide', 'heart', 'Les petits riens qui restent', 'Une anecdote ou une habitude, sans rien à remplir par obligation.']]
        .forEach(([selector, name, title, description]) => {
            const el = $(selector);
            if (el) {
                el.classList.add('amor-empty');
                el.innerHTML = `${icon(name)}<strong>${title}</strong><span>${description}</span>`;
            }
        });

    // Notification accessible : placée dans le dialogue actif (top layer).
    let toastTimer;
    let lastBadge = 0;
    function announce(message, badge = false) {
        document.querySelectorAll('.amor-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = `amor-toast${badge ? ' amor-toast-badge' : ''}`;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = icon(badge ? 'badge' : 'check');
        const text = document.createElement('span');
        text.textContent = message;
        toast.append(text);
        const dialogs = [...document.querySelectorAll('dialog[open]')];
        (dialogs.at(-1) || document.body).append(toast);
        if (navigator.vibrate) navigator.vibrate(badge ? [25, 40, 25] : 15);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.remove(), 3600);
    }
    document.addEventListener('amor:saved', () => {
        const withBadge = Date.now() - lastBadge < 60000;
        announce(withBadge ? 'Souvenir enregistré. Une nouvelle première fois à deux !' : 'Votre souvenir est enregistré.', withBadge);
        lastBadge = 0;
    });
    document.addEventListener('amor:badge', () => {
        lastBadge = Date.now();
        announce('Une nouvelle première fois dans notre histoire.', true);
    });
    document.addEventListener('amor:moment-saved', () => announce('Ce petit moment est enregistré.'));
    document.addEventListener('amor:home-saved', () => announce('Votre page est enregistrée.'));

    // Champs souples, sans modifier leur valeur ou les règles de saisie.
    function grow(textarea) {
        if (textarea.offsetParent === null) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(320, Math.max(108, textarea.scrollHeight))}px`;
    }
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.addEventListener('input', () => grow(textarea));
        textarea.addEventListener('focus', () => grow(textarea));
    });

    // Réglages tactiles : top de la navigation calculé selon le vrai header.
    const header = $('#souvenir-dialog .fiche-header');
    new ResizeObserver(() => {
        $('#souvenir-dialog').style.setProperty('--fiche-header-height', `${header.getBoundingClientRect().height}px`);
    }).observe(header);
    const edition = $('#souvenir-form');
    new MutationObserver(() => {
        if (!edition.hidden) {
            edition.querySelectorAll('textarea').forEach(grow);
            edition.querySelector('.edition-nav').scrollLeft = 0;
        }
    }).observe(edition, { attributes: true, attributeFilter: ['hidden'] });

    // Le carrousel tactile continu est géré par moments.js en V4.
})();
