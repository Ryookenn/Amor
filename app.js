// =========================
// CRÉATION DE LA CARTE
// =========================

// Les deux premiers nombres représentent
// la latitude et la longitude du centre de la France.
// Le nombre 6 correspond au niveau de zoom.
const map = L.map("map").setView(
    [46.603354, 1.888334],
    6
);


// =========================
// FOND DE CARTE
// =========================

L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,

        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
).addTo(map);

// =========================
// DONNÉES DES DESTINATIONS
// =========================

let destinations = [];


// =========================
// APPARENCE DES MARQUEURS
// =========================

const destinationIcon = L.divIcon({
    className: "destination-marker",

    html: `
        <div class="marker-circle">
            <span>♥</span>
        </div>
    `,

    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -24]
});

// =========================
// GROUPE DES MARQUEURS
// =========================

const marqueursDestinations =
    L.layerGroup().addTo(map);


// =========================
// CHARGEMENT DEPUIS SUPABASE
// =========================

async function chargerDestinationsDepuisSupabase() {

    const headerCityCounter =
        document.querySelector(
            "#header-city-counter"
        );


    if (headerCityCounter) {

        headerCityCounter.textContent =
            "Chargement des villes…";

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("cities")
        .select(`
            id,
            name,
            latitude,
            longitude,
            region,
            department,
            stays (
                id,
                date_start,
                created_at,
                shared_quote,
                amine_rating,
                maena_rating,
                stay_media (
                    storage_path,
                    media_type,
                    created_at
                )
            )
        `)
        .order("name", {
            ascending: true
        });


    if (error) {

        console.error(
            "Erreur Supabase :",
            error
        );


        if (headerCityCounter) {

            headerCityCounter.textContent =
                "Villes indisponibles";

        }


        window.alert(
            "Impossible de charger les villes depuis Supabase."
        );

        return;

    }


    destinations = data.map(
        function(villeSupabase) {

            const sejours =
                [...(villeSupabase.stays ?? [])];


            sejours.sort(
                function(sejourA, sejourB) {

                    const dateA =
                        sejourA.date_start ||
                        sejourA.created_at;

                    const dateB =
                        sejourB.date_start ||
                        sejourB.created_at;


                    return (
                        new Date(dateB).getTime() -
                        new Date(dateA).getTime()
                    );

                }
            );


            const dernierSejour =
                sejours[0] ?? null;


            const photos =
                dernierSejour
                    ? (
                        dernierSejour.stay_media ?? []
                    )
                        .filter(
                            function(media) {

                                return (
                                    media.media_type ===
                                    "photo"
                                );

                            }
                        )
                        .sort(
                            function(mediaA, mediaB) {

                                return (
                                    new Date(
                                        mediaA.created_at
                                    ).getTime() -
                                    new Date(
                                        mediaB.created_at
                                    ).getTime()
                                );

                            }
                        )
                    : [];


            return {

                id:
                    villeSupabase.id,

                ville:
                    villeSupabase.name,

                latitude:
                    villeSupabase.latitude,

                longitude:
                    villeSupabase.longitude,

                region:
                    villeSupabase.region,

                departement:
                    villeSupabase.department,

                nombreSejours:
                    sejours.length,

                apercuPhrase:
                    dernierSejour?.shared_quote ??
                    "",

                apercuNoteAmine:
                    dernierSejour?.amine_rating ??
                    null,

                apercuNoteMaena:
                    dernierSejour?.maena_rating ??
                    null,

                cheminPhotoPrincipale:
                    photos[0]?.storage_path ??
                    null,

                urlPhotoPrincipale:
                    null

            };

        }
    );


    const destinationsAvecPhoto =
        destinations.filter(
            function(destination) {

                return Boolean(
                    destination.cheminPhotoPrincipale
                );

            }
        );


    if (destinationsAvecPhoto.length > 0) {

        const chemins =
            destinationsAvecPhoto.map(
                function(destination) {

                    return (
                        destination
                            .cheminPhotoPrincipale
                    );

                }
            );


        const {
            data: liens,
            error: erreurLiens
        } = await supabaseClient
            .storage
            .from("memories")
            .createSignedUrls(
                chemins,
                3600
            );


        if (erreurLiens) {

            console.warn(
                "Certaines photos d’aperçu sont indisponibles :",
                erreurLiens
            );

        } else {

            destinationsAvecPhoto.forEach(
                function(destination, index) {

                    destination.urlPhotoPrincipale =
                        liens[index]?.signedUrl ??
                        null;

                }
            );

        }

    }


    afficherDestinations();
    actualiserStatistiques();

}


// =========================
// AFFICHAGE DES MARQUEURS
// =========================

function echapperHtml(valeur) {

    return String(valeur ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function formaterNoteApercu(note) {

    if (
        note === null ||
        note === undefined ||
        note === ""
    ) {
        return "—";
    }

    return `${Number(note)} / 10`;

}


function creerContenuSurvol(destination) {

    const texteSejours =
        destination.nombreSejours === 1
            ? "1 séjour"
            : `${destination.nombreSejours} séjours`;


    const photo =
        destination.urlPhotoPrincipale
            ? `
                <img
                    class="apercu-ville-photo"
                    src="${echapperHtml(
                        destination.urlPhotoPrincipale
                    )}"
                    alt="">
            `
            : `
                <div class="apercu-ville-photo-vide">
                    <span>♥</span>
                    <small>Photo à ajouter</small>
                </div>
            `;


    const phrase =
        destination.apercuPhrase
            ? `« ${echapperHtml(
                destination.apercuPhrase
            )} »`
            : "Phrase du séjour à compléter";


    return `
        <article class="apercu-ville">

            <div class="apercu-ville-visuel">
                ${photo}
            </div>

            <div class="apercu-ville-contenu">

                <div class="apercu-ville-entete">

                    <div>

                        <p class="apercu-ville-region">
                            ${echapperHtml(
                                destination.region
                            )}
                        </p>

                        <h3>
                            ${echapperHtml(
                                destination.ville
                            )}
                        </h3>

                    </div>

                    <span class="apercu-ville-sejours">
                        ${texteSejours}
                    </span>

                </div>


                <p class="apercu-ville-phrase">
                    ${phrase}
                </p>


                <div class="apercu-ville-notes">

                    <span>
                        <small>Amine</small>
                        <strong>
                            ${formaterNoteApercu(
                                destination.apercuNoteAmine
                            )}
                        </strong>
                    </span>

                    <span>
                        <small>Maéna</small>
                        <strong>
                            ${formaterNoteApercu(
                                destination.apercuNoteMaena
                            )}
                        </strong>
                    </span>

                </div>

            </div>

        </article>
    `;

}

// =========================
// APERÇU FLOTTANT DES VILLES
// =========================

const apercuVilleFlottant =
    document.createElement("div");

apercuVilleFlottant.className =
    "apercu-ville-flottant";

apercuVilleFlottant.hidden = true;

document.body.appendChild(
    apercuVilleFlottant
);


function positionnerApercuVille(marker) {

    const elementMarqueur =
        marker.getElement();


    if (!elementMarqueur) {
        return;
    }


    const positionMarqueur =
        elementMarqueur
            .getBoundingClientRect();


    const centreMarqueur =
        positionMarqueur.left +
        positionMarqueur.width / 2;


    // Rend temporairement la carte mesurable.

    apercuVilleFlottant.style.visibility =
        "hidden";

    apercuVilleFlottant.hidden = false;


    const largeurApercu =
        apercuVilleFlottant.offsetWidth;

    const hauteurApercu =
        apercuVilleFlottant.offsetHeight;


    const margePage = 12;
    const espaceMarqueur = 20;


    let positionGauche =
        centreMarqueur -
        largeurApercu / 2;


    positionGauche =
        Math.max(
            margePage,
            Math.min(
                positionGauche,
                window.innerWidth -
                    largeurApercu -
                    margePage
            )
        );


    let positionHaute =
        positionMarqueur.top -
        hauteurApercu -
        espaceMarqueur;


    // S’il n’y a pas assez de place au-dessus,
    // l’aperçu passe sous le marqueur.

    if (positionHaute < margePage) {

        positionHaute =
            positionMarqueur.bottom +
            espaceMarqueur;

    }


    positionHaute =
        Math.min(
            positionHaute,
            window.innerHeight -
                hauteurApercu -
                margePage
        );


    apercuVilleFlottant.style.left =
        `${positionGauche}px`;

    apercuVilleFlottant.style.top =
        `${positionHaute}px`;

    apercuVilleFlottant.style.visibility =
        "visible";

}


function afficherApercuVille(
    destination,
    marker
) {

    apercuVilleFlottant.innerHTML =
        creerContenuSurvol(
            destination
        );

    positionnerApercuVille(
        marker
    );

}


function masquerApercuVille() {

    apercuVilleFlottant.hidden = true;
    apercuVilleFlottant.innerHTML = "";

}

function afficherDestinations() {

    marqueursDestinations.clearLayers();


    destinations.forEach(
        function(destination) {

            const marker = L.marker(
                [
                    destination.latitude,
                    destination.longitude
                ],
                {
                    icon: destinationIcon,
                    title: destination.ville,
                    alt: destination.ville
                }
            );


            marker.addTo(
                marqueursDestinations
            );

            marker.on(
                "mouseover",
                function() {

                    afficherApercuVille(
                        destination,
                        marker
                    );

                }
            );


            marker.on(
                "mouseout",
                function() {

                    masquerApercuVille();

                }
            );

            marker.on(
                "click",
                function() {

                    masquerApercuVille();

                    ouvrirFiche(
                        destination
                    );

                }
            );

        }
    );

}


// =========================
// STATISTIQUES
// =========================

function actualiserStatistiques() {

    const nombreVilles =
        destinations.length;


    const nombreRegions =
               new Set(
            destinations.map(
                function(destination) {

                    return destination.region;

                }
            )
        ).size;


    const nombreDepartements =
        new Set(
            destinations.map(
                function(destination) {

                    return destination.departement;

                }
            )
        ).size;


    const headerCityCounter =
        document.querySelector(
            "#header-city-counter"
        );

    const mapCounter =
        document.querySelector(
            "#map-counter"
        );

    const headerProgressValue =
        document.querySelector(
            "#header-progress-value"
        );


    if (headerCityCounter) {

        headerCityCounter.textContent =
            `${nombreVilles} villes visitées`;

    }


    if (mapCounter) {

        mapCounter.textContent =
            `${nombreVilles} lieux débloqués`;

    }


    const objectifVilles = 20;

    const pourcentageProgression =
        Math.min(
            (
                nombreVilles /
                objectifVilles
            ) * 100,
            100
        );


    if (headerProgressValue) {

        headerProgressValue.style.width =
            `${pourcentageProgression}%`;

    }


    const statVilles =
        document.querySelector(
            "#stat-villes"
        );

    const statDepartements =
        document.querySelector(
            "#stat-departements"
        );

    const statRegions =
        document.querySelector(
            "#stat-regions"
        );


    if (statVilles) {

        statVilles.textContent =
            nombreVilles;

    }


    if (statDepartements) {

        statDepartements.textContent =
            nombreDepartements;

    }


    if (statRegions) {

        statRegions.textContent =
            nombreRegions;

    }

}

async function actualiserCarteSouvenirs() {

    masquerApercuVille();

    await chargerDestinationsDepuisSupabase();

}


// =========================
// FICHE DES SOUVENIRS
// =========================

const souvenirDialog =
    document.querySelector("#souvenir-dialog");

const souvenirView =
    document.querySelector("#souvenir-view");

const souvenirForm =
    document.querySelector("#souvenir-form");

const boutonModifier =
    document.querySelector("#modifier-fiche");

const boutonSupprimerVille =
    document.querySelector("#supprimer-ville");

const boutonFermerFiche =
    document.querySelector("#fermer-fiche");

const boutonAnnulerModification =
    document.querySelector("#annuler-modification");

const souvenirMessage =
    document.querySelector("#souvenir-message");

const boutonSejourPrecedent =
    document.querySelector("#sejour-precedent");

const boutonSejourSuivant =
    document.querySelector("#sejour-suivant");

const boutonAjouterSejour =
    document.querySelector("#ajouter-sejour");

const boutonSupprimerSejour =
    document.querySelector("#supprimer-sejour");

const numeroSejour =
    document.querySelector("#numero-sejour");

const nombreSejours =
    document.querySelector("#nombre-sejours");

const galeriePhotos =
    document.querySelector("#galerie-photos");

const photosVides =
    document.querySelector("#photos-vides");

const ajoutPhotos =
    document.querySelector("#ajout-photos");

const apercuPhotos =
    document.querySelector("#apercu-photos");

const photosExistantesEdition =
    document.querySelector(
        "#photos-existantes-edition"
    );

const visionneuse =
    document.querySelector("#visionneuse");

const visionneuseImage =
    document.querySelector("#visionneuse-image");

const visionneuseLegende =
    document.querySelector("#visionneuse-legende");

const boutonFermerVisionneuse =
    document.querySelector("#fermer-visionneuse");

const boutonPhotoPrecedente =
    document.querySelector("#photo-precedente");

const boutonPhotoSuivante =
    document.querySelector("#photo-suivante");

const capsuleAudio =
    document.querySelector("#capsule-audio");

const nomCapsuleAudio =
    document.querySelector("#nom-capsule-audio");

const lecteurCapsuleAudio =
    document.querySelector("#lecteur-capsule-audio");

const audioVide =
    document.querySelector("#audio-vide");

const audioExistantEdition =
    document.querySelector("#audio-existant-edition");

const zoneAjoutAudio =
    document.querySelector("#zone-ajout-audio");

const ajoutAudio =
    document.querySelector("#ajout-audio");

const apercuAudio =
    document.querySelector("#apercu-audio");

const nomApercuAudio =
    document.querySelector("#nom-apercu-audio");

const lecteurApercuAudio =
    document.querySelector("#lecteur-apercu-audio");


let fichierAudioSelectionne = null;
let urlApercuAudio = null;
let mediaAudioActif = null;


let photosAffichees = [];
let indexPhotoActive = 0;
let elementAvantVisionneuse = null;


let fichiersPhotosSelectionnes = [];
let urlsApercuPhotos = [];
let mediasPhotosActifs = [];

let destinationActive = null;

let sejoursActifs = [];
let indexSejourActif = 0;
let souvenirsActifs = {};

let modeEdition = false;
let formulaireModifie = false;
let creationSejour = false;

// =========================
// SÉJOURS ET SUPABASE
// =========================

function cleSouvenirsLocale(destination) {

    return `amor:souvenirs:v2:${destination.id}`;

}


function ancienneCleSouvenirsLocale(destination) {

    return `amor:souvenirs:v1:${destination.ville}`;

}


// Lit les anciens souvenirs présents dans le navigateur.

function chargerSejoursLocaux(destination) {

    let sauvegarde = localStorage.getItem(
        cleSouvenirsLocale(destination)
    );


    if (sauvegarde === null) {

        sauvegarde = localStorage.getItem(
            ancienneCleSouvenirsLocale(destination)
        );

    }


    if (sauvegarde === null) {
        return [];
    }


    const donnees = JSON.parse(sauvegarde);


    if (
        !donnees ||
        typeof donnees !== "object" ||
        Array.isArray(donnees)
    ) {
        return [];
    }


    if (Array.isArray(donnees.sejours)) {

        return donnees.sejours;

    }


    return [donnees];

}


// Vérifie qu’un séjour contient réellement un souvenir.

function sejourContientDesDonnees(souvenirs) {

    const amine =
        souvenirs.amine ?? {};

    const maena =
        souvenirs.maena ?? {};


    return Boolean(
        souvenirs.dateDebut ||
        souvenirs.dateFin ||
        amine.lieu ||
        amine.repas ||
        amine.phrase ||
        amine.note !== null &&
        amine.note !== undefined &&
        amine.note !== "" ||
        maena.lieu ||
        maena.repas ||
        maena.phrase ||
        maena.note !== null &&
        maena.note !== undefined &&
        maena.note !== "" ||
        souvenirs.phraseCommune ||
        souvenirs.musique
    );

}


// Transforme un souvenir AMOR en ligne Supabase.

function souvenirsVersLigneSupabase(
    souvenirs,
    destination
) {

    const amine =
        souvenirs.amine ?? {};

    const maena =
        souvenirs.maena ?? {};


    return {

        city_id:
            destination.id,

        date_start:
            souvenirs.dateDebut || null,

        date_end:
            souvenirs.dateFin || null,

        amine_place:
            amine.lieu || null,

        amine_meal:
            amine.repas || null,

        amine_quote:
            amine.phrase || null,

        amine_rating:
            amine.note ?? null,

        maena_place:
            maena.lieu || null,

        maena_meal:
            maena.repas || null,

        maena_quote:
            maena.phrase || null,

        maena_rating:
            maena.note ?? null,

        shared_quote:
            souvenirs.phraseCommune || null,

        music:
            souvenirs.musique || null

    };

}


// Transforme une ligne Supabase pour la fiche AMOR.

function ligneSupabaseVersSouvenirs(ligne) {

    return {

        id:
            ligne.id,

        dateDebut:
            ligne.date_start ?? "",

        dateFin:
            ligne.date_end ?? "",

        amine: {

            lieu:
                ligne.amine_place ?? "",

            repas:
                ligne.amine_meal ?? "",

            phrase:
                ligne.amine_quote ?? "",

            note:
                ligne.amine_rating === null
                    ? null
                    : Number(ligne.amine_rating)

        },

        maena: {

            lieu:
                ligne.maena_place ?? "",

            repas:
                ligne.maena_meal ?? "",

            phrase:
                ligne.maena_quote ?? "",

            note:
                ligne.maena_rating === null
                    ? null
                    : Number(ligne.maena_rating)

        },

        phraseCommune:
            ligne.shared_quote ?? "",

        musique:
            ligne.music ?? ""

    };

}


// Charge les séjours en ligne et transfère les anciens
// souvenirs locaux si la ville est encore vide.

async function chargerSejours(destination) {

    const {
        data,
        error
    } = await supabaseClient
        .from("stays")
        .select("*")
        .eq("city_id", destination.id)
        .order("date_start", {
            ascending: true,
            nullsFirst: false
        })
        .order("id", {
            ascending: true
        });


    if (error) {
        throw error;
    }


    if (data.length > 0) {

        return data.map(
            ligneSupabaseVersSouvenirs
        );

    }


    const sejoursLocaux =
        chargerSejoursLocaux(destination)
            .filter(sejourContientDesDonnees);


    if (sejoursLocaux.length === 0) {

        // Fiche vide provisoire, non enregistrée.

        return [{}];

    }


    const lignesAInserer =
        sejoursLocaux.map(
            function(souvenirs) {

                return souvenirsVersLigneSupabase(
                    souvenirs,
                    destination
                );

            }
        );


    const {
        data: lignesImportees,
        error: erreurImportation
    } = await supabaseClient
        .from("stays")
        .insert(lignesAInserer)
        .select();


    if (erreurImportation) {
        throw erreurImportation;
    }


    return lignesImportees.map(
        ligneSupabaseVersSouvenirs
    );

}


// Crée ou met à jour un séjour dans Supabase.

async function enregistrerSejour(
    souvenirs,
    destination
) {

    const ligne =
        souvenirsVersLigneSupabase(
            souvenirs,
            destination
        );


    if (souvenirs.id) {

        const {
            data,
            error
        } = await supabaseClient
            .from("stays")
            .update(ligne)
            .eq("id", souvenirs.id)
            .select()
            .single();


        if (error) {
            throw error;
        }


        return ligneSupabaseVersSouvenirs(
            data
        );

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("stays")
        .insert(ligne)
        .select()
        .single();


    if (error) {
        throw error;
    }


    return ligneSupabaseVersSouvenirs(
        data
    );

}

// =========================
// OUTILS GÉNÉRAUX
// =========================

function remplirChamp(id, valeur) {

    document.getElementById(id).value =
        valeur ?? "";

}


function lireChamp(id) {

    return document
        .getElementById(id)
        .value
        .trim();

}


function lireNote(id) {

    const valeur = lireChamp(id);

    return valeur === ""
        ? null
        : Number(valeur);

}


function texteOuManquant(valeur) {

    if (
        valeur === null ||
        valeur === undefined ||
        valeur === ""
    ) {
        return "À compléter";
    }

    return String(valeur);

}


function remplirReponse(id, valeur) {

    const element =
        document.getElementById(id);

    const valeurManquante =
        valeur === null ||
        valeur === undefined ||
        valeur === "";

    element.textContent =
        valeurManquante
            ? "À compléter"
            : valeur;

    element.classList.toggle(
        "valeur-manquante",
        valeurManquante
    );

}


function afficherNote(note) {

    if (
        note === null ||
        note === undefined ||
        note === ""
    ) {
        return "";
    }

    return `${note} / 10`;

}


// =========================
// GESTION DES DATES
// =========================

function formaterDate(date) {

    return new Date(
        `${date}T00:00:00Z`
    ).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    });

}


function calculerRepere(date) {

    const reference =
        Date.UTC(2026, 3, 19);

    const jour = new Date(
        `${date}T00:00:00Z`
    ).getTime();

    const nombreJours = Math.round(
        (jour - reference) / 86400000
    );

    return nombreJours >= 0
        ? `J+${nombreJours}`
        : `J${nombreJours}`;

}


function actualiserRepereEdition() {

    const debut =
        lireChamp("souvenir-debut");

    const fin =
        lireChamp("souvenir-fin");

    const champFin =
        document.getElementById("souvenir-fin");

    const repere =
        document.getElementById("fiche-repere");


    champFin.setCustomValidity("");


    if (fin && !debut) {

        champFin.setCustomValidity(
            "Renseigne aussi le premier jour du séjour."
        );

        repere.textContent =
            "Premier jour à renseigner.";

        return;

    }


    if (debut && fin && fin < debut) {

        champFin.setCustomValidity(
            "Le dernier jour ne peut pas précéder le premier."
        );

        repere.textContent =
            "Vérifie l’ordre des dates.";

        return;

    }


    if (!debut) {

        repere.textContent =
            "Notre repère : le 19 avril 2026 · J+0";

        return;

    }


    repere.textContent =
        fin && fin !== debut
            ? `${calculerRepere(debut)} → ${calculerRepere(fin)} depuis notre premier échange`
            : `${calculerRepere(debut)} depuis notre premier échange`;

}


// =========================
// AFFICHAGE DES RÉPONSES
// =========================

function afficherSouvenirs(souvenirs) {

    const amine =
        souvenirs.amine ?? {};

    const maena =
        souvenirs.maena ?? {};


    // Dates

    const debut =
        souvenirs.dateDebut;

    const fin =
        souvenirs.dateFin;


    if (debut) {

        document
            .getElementById("vue-dates")
            .textContent =
                fin && fin !== debut
                    ? `Du ${formaterDate(debut)} au ${formaterDate(fin)}`
                    : formaterDate(debut);

        document
            .getElementById("vue-repere")
            .textContent =
                fin && fin !== debut
                    ? `${calculerRepere(debut)} → ${calculerRepere(fin)} depuis notre premier échange`
                    : `${calculerRepere(debut)} depuis notre premier échange`;

    } else {

        document
            .getElementById("vue-dates")
            .textContent =
                "Dates à compléter";

        document
            .getElementById("vue-repere")
            .textContent =
                "Notre repère : le 19 avril 2026 · J+0";

    }


    // Amine

    remplirReponse(
        "vue-amine-lieu",
        amine.lieu
    );

    remplirReponse(
        "vue-amine-repas",
        amine.repas
    );

    remplirReponse(
        "vue-amine-phrase",
        amine.phrase
    );

    remplirReponse(
        "vue-amine-note",
        afficherNote(amine.note)
    );


    // Maéna

    remplirReponse(
        "vue-maena-lieu",
        maena.lieu
    );

    remplirReponse(
        "vue-maena-repas",
        maena.repas
    );

    remplirReponse(
        "vue-maena-phrase",
        maena.phrase
    );

    remplirReponse(
        "vue-maena-note",
        afficherNote(maena.note)
    );


    // Éléments communs

    remplirReponse(
        "vue-phrase-commune",
        souvenirs.phraseCommune
    );

    remplirReponse(
        "vue-musique",
        souvenirs.musique
    );

}


// =========================
// REMPLISSAGE DU FORMULAIRE
// =========================

function remplirFormulaire(souvenirs) {

    const amine =
        souvenirs.amine ?? {};

    const maena =
        souvenirs.maena ?? {};


    remplirChamp(
        "souvenir-debut",
        souvenirs.dateDebut
    );

    remplirChamp(
        "souvenir-fin",
        souvenirs.dateFin
    );


    remplirChamp(
        "amine-lieu",
        amine.lieu
    );

    remplirChamp(
        "amine-repas",
        amine.repas
    );

    remplirChamp(
        "amine-phrase",
        amine.phrase
    );

    remplirChamp(
        "amine-note",
        amine.note
    );


    remplirChamp(
        "maena-lieu",
        maena.lieu
    );

    remplirChamp(
        "maena-repas",
        maena.repas
    );

    remplirChamp(
        "maena-phrase",
        maena.phrase
    );

    remplirChamp(
        "maena-note",
        maena.note
    );


    remplirChamp(
        "fiche-phrase-commune",
        souvenirs.phraseCommune
    );

    remplirChamp(
        "fiche-musique",
        souvenirs.musique
    );


    actualiserRepereEdition();

}

// =========================
// GESTION DES PHOTOS
// =========================

function viderSelectionPhotos() {

    urlsApercuPhotos.forEach(
        function(url) {

            URL.revokeObjectURL(url);

        }
    );

    urlsApercuPhotos = [];
    fichiersPhotosSelectionnes = [];

    ajoutPhotos.value = "";
    apercuPhotos.innerHTML = "";

}


function creerElementPhoto(
    url,
    texteAlternatif,
    action = null
) {

    const cadre =
        document.createElement(
            action ? "button" : "div"
        );

    cadre.className =
        "photo-souvenir";


    if (action) {

        cadre.type = "button";

        cadre.classList.add(
            "photo-cliquable"
        );

        cadre.setAttribute(
            "aria-label",
            `Agrandir ${texteAlternatif}`
        );

        cadre.addEventListener(
            "click",
            action
        );

    }


    const image =
        document.createElement("img");

    image.src = url;
    image.alt = texteAlternatif;
    image.loading = "lazy";


    cadre.appendChild(image);

    return cadre;

}


function afficherApercuPhotos() {

    apercuPhotos.innerHTML = "";

    urlsApercuPhotos.forEach(
        function(url, index) {

            const fichier =
                fichiersPhotosSelectionnes[index];

            const photo =
                creerElementPhoto(
                    url,
                    fichier.name
                );

            apercuPhotos.appendChild(
                photo
            );

        }
    );

}


ajoutPhotos.addEventListener(
    "change",
    function() {

        // Les fichiers sont récupérés avant
        // la réinitialisation des anciens aperçus.

        const fichiers =
            Array.from(
                ajoutPhotos.files
            );


        // Supprime seulement les anciennes URL d’aperçu.

        urlsApercuPhotos.forEach(
            function(url) {

                URL.revokeObjectURL(url);

            }
        );

        urlsApercuPhotos = [];
        fichiersPhotosSelectionnes = [];
        apercuPhotos.innerHTML = "";


        const fichiersValides =
            fichiers.filter(
                function(fichier) {

                    return (
                        fichier.type.startsWith(
                            "image/"
                        ) &&
                        fichier.size <=
                            10 * 1024 * 1024
                    );

                }
            );


        if (
            fichiersValides.length !==
            fichiers.length
        ) {

            window.alert(
                "Certaines images ont été ignorées. " +
                "Chaque fichier doit être une image de 10 Mo maximum."
            );

        }


        fichiersPhotosSelectionnes =
            fichiersValides;

        urlsApercuPhotos =
            fichiersValides.map(
                function(fichier) {

                    return URL.createObjectURL(
                        fichier
                    );

                }
            );


        afficherApercuPhotos();

    }
);


function nettoyerNomFichier(nom) {

    return nom
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
        )
        .toLowerCase();

}


async function envoyerPhotos(
    fichiers,
    sejour,
    destination
) {

    const cheminsEnvoyes = [];
    const mediasCrees = [];


    try {

        for (const fichier of fichiers) {

            const nomNettoye =
                nettoyerNomFichier(
                    fichier.name
                );

            const chemin =
                `${destination.id}/${sejour.id}/` +
                `${crypto.randomUUID()}-${nomNettoye}`;


            const {
                error: erreurEnvoi
            } = await supabaseClient
                .storage
                .from("memories")
                .upload(
                    chemin,
                    fichier,
                    {
                        cacheControl: "3600",
                        upsert: false
                    }
                );


            if (erreurEnvoi) {
                throw erreurEnvoi;
            }


            cheminsEnvoyes.push(
                chemin
            );


            const {
                data: mediaCree,
                error: erreurMedia
            } = await supabaseClient
                .from("stay_media")
                .insert({
                    stay_id:
                        sejour.id,

                    media_type:
                        "photo",

                    storage_path:
                        chemin,

                    original_name:
                        fichier.name
                })
                .select("id")
                .single();


            if (erreurMedia) {
                throw erreurMedia;
            }


            mediasCrees.push(
                mediaCree.id
            );

        }

    } catch (erreur) {

        if (mediasCrees.length > 0) {

            await supabaseClient
                .from("stay_media")
                .delete()
                .in("id", mediasCrees);

        }


        if (cheminsEnvoyes.length > 0) {

            await supabaseClient
                .storage
                .from("memories")
                .remove(
                    cheminsEnvoyes
                );

        }


        throw erreur;

    }

}

function actualiserVisionneuse() {

    const photo =
        photosAffichees[indexPhotoActive];


    if (!photo) {
        return;
    }


    visionneuseImage.src =
        photo.url;

    visionneuseImage.alt =
        photo.texteAlternatif;

    visionneuseLegende.textContent =
        photo.texteAlternatif;


    boutonPhotoPrecedente.disabled =
        indexPhotoActive === 0;

    boutonPhotoSuivante.disabled =
        indexPhotoActive ===
        photosAffichees.length - 1;

}


function ouvrirVisionneuse(index) {

    elementAvantVisionneuse =
        document.activeElement;

    indexPhotoActive = index;

    actualiserVisionneuse();

    visionneuse.showModal();

    document.body.classList.add(
        "visionneuse-ouverte"
    );

    boutonFermerVisionneuse.focus();

}


function fermerVisionneuse() {

    if (!visionneuse.open) {
        return;
    }

    visionneuse.close();

    visionneuseImage.src = "";

    document.body.classList.remove(
        "visionneuse-ouverte"
    );


    if (elementAvantVisionneuse) {

        elementAvantVisionneuse.focus();

    }

}


boutonFermerVisionneuse.addEventListener(
    "click",
    fermerVisionneuse
);

visionneuse.addEventListener(
    "cancel",
    function(event) {

        event.preventDefault();

        fermerVisionneuse();

    }
);

boutonPhotoPrecedente.addEventListener(
    "click",
    function() {

        if (indexPhotoActive > 0) {

            indexPhotoActive -= 1;
            actualiserVisionneuse();

        }

    }
);


boutonPhotoSuivante.addEventListener(
    "click",
    function() {

        if (
            indexPhotoActive <
            photosAffichees.length - 1
        ) {

            indexPhotoActive += 1;
            actualiserVisionneuse();

        }

    }
);


visionneuse.addEventListener(
    "click",
    function(event) {

        if (event.target === visionneuse) {
            fermerVisionneuse();
        }

    }
);


document.addEventListener(
    "keydown",
    function(event) {

        if (!visionneuse.open) {
            return;
        }


        if (event.key === "Escape") {

            fermerVisionneuse();

        } else if (
            event.key === "ArrowLeft" &&
            indexPhotoActive > 0
        ) {

            indexPhotoActive -= 1;
            actualiserVisionneuse();

        } else if (
            event.key === "ArrowRight" &&
            indexPhotoActive <
            photosAffichees.length - 1
        ) {

            indexPhotoActive += 1;
            actualiserVisionneuse();

        }

    }
);

function afficherPhotosEdition() {

    photosExistantesEdition.innerHTML = "";


    if (mediasPhotosActifs.length === 0) {

        const message =
            document.createElement("p");

        message.className =
            "photos-edition-vides";

        message.textContent =
            "Aucune photo déjà enregistrée.";

        photosExistantesEdition.appendChild(
            message
        );

        return;

    }


    mediasPhotosActifs.forEach(
        function(media) {

            const cadre =
                document.createElement("div");

            cadre.className =
                "photo-souvenir photo-en-edition";


            const image =
                document.createElement("img");

            image.src =
                media.url;

            image.alt =
                media.original_name ||
                "Photo du séjour";


            const bouton =
                document.createElement("button");

            bouton.type = "button";

            bouton.className =
                "supprimer-photo";

            bouton.textContent = "×";

            bouton.setAttribute(
                "aria-label",
                `Supprimer ${image.alt}`
            );


            bouton.addEventListener(
                "click",
                function() {

                    supprimerPhoto(
                        media,
                        bouton
                    );

                }
            );


            cadre.appendChild(image);
            cadre.appendChild(bouton);

            photosExistantesEdition.appendChild(
                cadre
            );

        }
    );

}


async function supprimerPhoto(
    media,
    bouton
) {

    const confirmation =
        window.confirm(
            "Supprimer définitivement cette photo du séjour ?"
        );


    if (!confirmation) {
        return;
    }


    bouton.disabled = true;


    try {

        const {
            error: erreurLigne
        } = await supabaseClient
            .from("stay_media")
            .delete()
            .eq("id", media.id);


        if (erreurLigne) {
            throw erreurLigne;
        }


        const {
            error: erreurFichier
        } = await supabaseClient
            .storage
            .from("memories")
            .remove([
                media.storage_path
            ]);


        if (erreurFichier) {

            console.warn(
                "Le fichier n’a pas été nettoyé :",
                erreurFichier
            );

        }


        await chargerPhotos(
            souvenirsActifs
        );

        afficherPhotosEdition();

        await actualiserCarteSouvenirs();

    } catch (erreur) {

        console.error(
            "Suppression de la photo impossible :",
            erreur
        );

        bouton.disabled = false;

        window.alert(
            "La photo n’a pas pu être supprimée."
        );

    }

}

async function chargerPhotos(souvenirs) {

    galeriePhotos.innerHTML = "";
    photosAffichees = [];
    photosVides.hidden = false;
    mediasPhotosActifs = [];
    photosExistantesEdition.innerHTML = "";


    if (!souvenirs.id) {
        return;
    }


    const sejourIdDemande =
        souvenirs.id;


    const {
        data: medias,
        error: erreurMedias
    } = await supabaseClient
        .from("stay_media")
        .select(`
            id,
            storage_path,
            original_name
        `)
        .eq("stay_id", sejourIdDemande)
        .eq("media_type", "photo")
        .order("created_at", {
            ascending: true
        });


    if (erreurMedias) {

        console.error(
            "Chargement des photos impossible :",
            erreurMedias
        );

        return;

    }


    if (medias.length === 0) {
        return;
    }


    const chemins =
        medias.map(
            function(media) {

                return media.storage_path;

            }
        );


    const {
        data: liens,
        error: erreurLiens
    } = await supabaseClient
        .storage
        .from("memories")
        .createSignedUrls(
            chemins,
            3600
        );


    if (erreurLiens) {

        console.error(
            "Création des liens impossible :",
            erreurLiens
        );

        return;

    }


    // Empêche un ancien chargement de remplacer
    // les photos d’un autre séjour.

    if (
        !souvenirsActifs ||
        souvenirsActifs.id !== sejourIdDemande
    ) {
        return;
    }


    galeriePhotos.innerHTML = "";


    medias.forEach(
        function(media, index) {

            const lien =
                liens[index];


            if (!lien?.signedUrl) {
                return;
            }


            const texteAlternatif =
                media.original_name ||
                `Photo ${index + 1} du séjour`;


            const indexDansGalerie =
                photosAffichees.length;


            photosAffichees.push({

                url:
                    lien.signedUrl,

                texteAlternatif:
                    texteAlternatif

            });

            mediasPhotosActifs.push({

                id:
                    media.id,

                storage_path:
                    media.storage_path,

                original_name:
                    media.original_name,

                url:
                    lien.signedUrl

            });

            const photo =
                creerElementPhoto(
                    lien.signedUrl,
                    texteAlternatif,
                    function() {

                        ouvrirVisionneuse(
                            indexDansGalerie
                        );

                    }
                );


            galeriePhotos.appendChild(
                photo
            );

        }
    );

    afficherPhotosEdition();

    photosVides.hidden =
        galeriePhotos.children.length > 0;

}

// =========================
// GESTION DU VOCAL
// =========================

function viderSelectionAudio() {

    if (urlApercuAudio) {

        URL.revokeObjectURL(
            urlApercuAudio
        );

    }


    fichierAudioSelectionne = null;
    urlApercuAudio = null;

    ajoutAudio.value = "";

    lecteurApercuAudio.pause();
    lecteurApercuAudio.removeAttribute(
        "src"
    );
    lecteurApercuAudio.load();

    nomApercuAudio.textContent = "";
    apercuAudio.hidden = true;

}


ajoutAudio.addEventListener(
    "change",
    function() {

        const fichier =
            ajoutAudio.files[0] ?? null;


        viderSelectionAudio();


        if (!fichier) {
            return;
        }


        const fichierValide =
            fichier.type.startsWith(
                "audio/"
            ) &&
            fichier.size <=
                20 * 1024 * 1024;


        if (!fichierValide) {

            window.alert(
                "Le fichier doit être un audio de 20 Mo maximum."
            );

            return;

        }


        fichierAudioSelectionne =
            fichier;

        urlApercuAudio =
            URL.createObjectURL(
                fichier
            );

        nomApercuAudio.textContent =
            fichier.name;

        lecteurApercuAudio.src =
            urlApercuAudio;

        apercuAudio.hidden = false;

    }
);


async function envoyerAudio(
    fichier,
    sejour,
    destination
) {

    const nomNettoye =
        nettoyerNomFichier(
            fichier.name
        );

    const chemin =
        `${destination.id}/${sejour.id}/audio/` +
        `${crypto.randomUUID()}-${nomNettoye}`;


    const {
        error: erreurEnvoi
    } = await supabaseClient
        .storage
        .from("memories")
        .upload(
            chemin,
            fichier,
            {
                cacheControl: "3600",
                upsert: false
            }
        );


    if (erreurEnvoi) {
        throw erreurEnvoi;
    }


    const {
        error: erreurMedia
    } = await supabaseClient
        .from("stay_media")
        .insert({
            stay_id:
                sejour.id,

            media_type:
                "audio",

            storage_path:
                chemin,

            original_name:
                fichier.name
        });


    if (erreurMedia) {

        await supabaseClient
            .storage
            .from("memories")
            .remove([chemin]);

        throw erreurMedia;

    }

}


function afficherAudioEdition() {

    audioExistantEdition.innerHTML = "";

    zoneAjoutAudio.hidden =
        Boolean(mediaAudioActif);


    if (!mediaAudioActif) {
        return;
    }


    const nom =
        document.createElement("p");

    nom.className =
        "nom-apercu-audio";

    nom.textContent =
        mediaAudioActif.original_name ||
        "Capsule audio";


    const lecteur =
        document.createElement("audio");

    lecteur.controls = true;
    lecteur.preload = "metadata";
    lecteur.src =
        mediaAudioActif.url;


    const bouton =
        document.createElement("button");

    bouton.type = "button";

    bouton.className =
        "supprimer-audio";

    bouton.textContent =
        "Supprimer le vocal";


    bouton.addEventListener(
        "click",
        function() {

            supprimerAudio(
                mediaAudioActif,
                bouton
            );

        }
    );


    audioExistantEdition.appendChild(nom);
    audioExistantEdition.appendChild(lecteur);
    audioExistantEdition.appendChild(bouton);

}


async function chargerAudio(souvenirs) {

    mediaAudioActif = null;

    capsuleAudio.hidden = true;
    audioVide.hidden = false;

    lecteurCapsuleAudio.pause();
    lecteurCapsuleAudio.removeAttribute(
        "src"
    );
    lecteurCapsuleAudio.load();

    audioExistantEdition.innerHTML = "";
    zoneAjoutAudio.hidden = false;


    if (!souvenirs.id) {
        return;
    }


    const sejourIdDemande =
        souvenirs.id;


    const {
        data,
        error
    } = await supabaseClient
        .from("stay_media")
        .select(`
            id,
            storage_path,
            original_name
        `)
        .eq("stay_id", sejourIdDemande)
        .eq("media_type", "audio")
        .order("created_at", {
            ascending: true
        })
        .limit(1);


    if (error) {

        console.error(
            "Chargement du vocal impossible :",
            error
        );

        return;

    }


    if (data.length === 0) {
        return;
    }


    const media =
        data[0];


    const {
        data: lien,
        error: erreurLien
    } = await supabaseClient
        .storage
        .from("memories")
        .createSignedUrl(
            media.storage_path,
            3600
        );


    if (erreurLien) {

        console.error(
            "Ouverture du vocal impossible :",
            erreurLien
        );

        return;

    }


    if (
        !souvenirsActifs ||
        souvenirsActifs.id !==
            sejourIdDemande
    ) {
        return;
    }


    mediaAudioActif = {

        id:
            media.id,

        storage_path:
            media.storage_path,

        original_name:
            media.original_name,

        url:
            lien.signedUrl

    };


    nomCapsuleAudio.textContent =
        media.original_name ||
        "Capsule audio";

    lecteurCapsuleAudio.src =
        lien.signedUrl;

    capsuleAudio.hidden = false;
    audioVide.hidden = true;

    afficherAudioEdition();

}


async function supprimerAudio(
    media,
    bouton
) {

    const confirmation =
        window.confirm(
            "Supprimer définitivement ce vocal du séjour ?"
        );


    if (!confirmation) {
        return;
    }


    bouton.disabled = true;


    try {

        const {
            error: erreurLigne
        } = await supabaseClient
            .from("stay_media")
            .delete()
            .eq("id", media.id);


        if (erreurLigne) {
            throw erreurLigne;
        }


        const {
            error: erreurFichier
        } = await supabaseClient
            .storage
            .from("memories")
            .remove([
                media.storage_path
            ]);


        if (erreurFichier) {

            console.warn(
                "Nettoyage du fichier audio impossible :",
                erreurFichier
            );

        }


        await chargerAudio(
            souvenirsActifs
        );

    } catch (erreur) {

        console.error(
            "Suppression du vocal impossible :",
            erreur
        );

        bouton.disabled = false;

        window.alert(
            "Le vocal n’a pas pu être supprimé."
        );

    }

}

// =========================
// NAVIGATION DES SÉJOURS
// =========================

function actualiserNavigationSejours() {

    const total =
        sejoursActifs.length;

    numeroSejour.textContent =
        `Séjour ${indexSejourActif + 1}`;

    nombreSejours.textContent =
        `sur ${total}`;

    boutonSejourPrecedent.disabled =
        modeEdition ||
        indexSejourActif === 0;

    boutonSejourSuivant.disabled =
        modeEdition ||
        indexSejourActif === total - 1;

    boutonAjouterSejour.disabled =
        modeEdition;

    boutonSupprimerSejour.disabled =
        modeEdition ||
        total <= 1;

}


function afficherSejour(index) {

    if (
        index < 0 ||
        index >= sejoursActifs.length
    ) {
        return;
    }

    indexSejourActif = index;

    souvenirsActifs =
        sejoursActifs[indexSejourActif];

    afficherSouvenirs(
        souvenirsActifs
    );

    chargerPhotos(
        souvenirsActifs
    );

    chargerAudio(
        souvenirsActifs
    );

    actualiserNavigationSejours();

    souvenirDialog.scrollTop = 0;

}

// =========================
// CHANGEMENT DE MODE
// =========================

function afficherModeConsultation() {

    modeEdition = false;
    formulaireModifie = false;

    souvenirView.hidden = false;
    souvenirForm.hidden = true;

    boutonModifier.hidden = false;

    souvenirMessage.textContent = "";

    actualiserNavigationSejours();
    souvenirDialog.scrollTop = 0;

}


function afficherModeEdition() {

    modeEdition = true;
    formulaireModifie = false;

    remplirFormulaire(souvenirsActifs);
    viderSelectionPhotos();
    afficherPhotosEdition();
    viderSelectionAudio();
    afficherAudioEdition();

    souvenirView.hidden = true;
    souvenirForm.hidden = false;

    boutonModifier.hidden = true;

    souvenirMessage.textContent = "";

    actualiserNavigationSejours();
    souvenirDialog.scrollTop = 0;

}


// =========================
// OUVERTURE DE LA FICHE
// =========================

async function ouvrirFiche(destination) {

    destinationActive =
        destination;


    document
        .getElementById("fiche-ville")
        .textContent =
            destination.ville;

    document
        .getElementById("fiche-region")
        .textContent =
            destination.region;


    try {

        sejoursActifs =
            await chargerSejours(
                destination
            );

        indexSejourActif = 0;

        souvenirsActifs =
            sejoursActifs[indexSejourActif];

    } catch (erreur) {

        console.error(
            "Chargement des séjours impossible :",
            erreur
        );

        destinationActive = null;

        window.alert(
            "Impossible de charger les souvenirs de cette ville."
        );

        return;

    }


    afficherSouvenirs(
        souvenirsActifs
    );

    await chargerPhotos(
        souvenirsActifs
    );

    await chargerAudio(
        souvenirsActifs
    );

    afficherModeConsultation();


    souvenirDialog.showModal();
    souvenirDialog.scrollTop = 0;

    document.body.classList.add(
        "fiche-ouverte"
    );

}

// =========================
// SUPPRESSION D’UNE VILLE
// =========================

boutonSupprimerVille.addEventListener(
    "click",
    async function() {

        if (
            !destinationActive ||
            modeEdition
        ) {
            return;
        }


        const villeASupprimer =
            destinationActive;

        const confirmation =
            window.confirm(
                `Supprimer définitivement ${villeASupprimer.ville}, ` +
                "tous ses séjours, ses photos et ses vocaux ?"
            );


        if (!confirmation) {
            return;
        }


        boutonSupprimerVille.disabled =
            true;

        boutonSupprimerVille.textContent =
            "Suppression…";


        try {

            // Recherche tous les séjours de la ville.

            const {
                data: sejours,
                error: erreurSejours
            } = await supabaseClient
                .from("stays")
                .select("id")
                .eq(
                    "city_id",
                    villeASupprimer.id
                );


            if (erreurSejours) {
                throw erreurSejours;
            }


            const identifiantsSejours =
                sejours.map(
                    function(sejour) {

                        return sejour.id;

                    }
                );


            let cheminsMedias = [];


            // Recherche les fichiers liés à ces séjours.

            if (identifiantsSejours.length > 0) {

                const {
                    data: medias,
                    error: erreurMedias
                } = await supabaseClient
                    .from("stay_media")
                    .select("storage_path")
                    .in(
                        "stay_id",
                        identifiantsSejours
                    );


                if (erreurMedias) {
                    throw erreurMedias;
                }


                cheminsMedias =
                    medias.map(
                        function(media) {

                            return media.storage_path;

                        }
                    );

            }


            // La suppression de la ville supprime
            // automatiquement ses séjours et leurs lignes médias.

            const {
                error: erreurVille
            } = await supabaseClient
                .from("cities")
                .delete()
                .eq(
                    "id",
                    villeASupprimer.id
                );


            if (erreurVille) {
                throw erreurVille;
            }


            // Nettoyage des véritables fichiers.

            if (cheminsMedias.length > 0) {

                const {
                    error: erreurFichiers
                } = await supabaseClient
                    .storage
                    .from("memories")
                    .remove(
                        cheminsMedias
                    );


                if (erreurFichiers) {

                    console.warn(
                        "Certains fichiers n’ont pas été nettoyés :",
                        erreurFichiers
                    );

                }

            }


            // Nettoyage des anciennes données locales éventuelles.

            localStorage.removeItem(
                cleSouvenirsLocale(
                    villeASupprimer
                )
            );

            localStorage.removeItem(
                ancienneCleSouvenirsLocale(
                    villeASupprimer
                )
            );


            souvenirDialog.close();


            await chargerDestinationsDepuisSupabase();


            map.setView(
                [46.603354, 1.888334],
                6
            );

        } catch (erreur) {

            console.error(
                "Suppression de la ville impossible :",
                erreur
            );

            window.alert(
                "La ville n’a pas pu être supprimée."
            );

        } finally {

            boutonSupprimerVille.disabled =
                false;

            boutonSupprimerVille.textContent =
                "Supprimer la ville";

        }

    }
);

// =========================
// BOUTON MODIFIER
// =========================

boutonModifier.addEventListener(
    "click",
    function() {

        afficherModeEdition();

    }
);


// =========================
// MODIFICATION DES CHAMPS
// =========================

souvenirForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        if (!destinationActive) {
            return;
        }


        actualiserRepereEdition();


        if (!souvenirForm.reportValidity()) {
            return;
        }


        const nouveauxSouvenirs = {

            id:
                souvenirsActifs.id ?? null,

            dateDebut:
                lireChamp("souvenir-debut"),

            dateFin:
                lireChamp("souvenir-fin"),

            amine: {

                lieu:
                    lireChamp("amine-lieu"),

                repas:
                    lireChamp("amine-repas"),

                phrase:
                    lireChamp("amine-phrase"),

                note:
                    lireNote("amine-note")

            },

            maena: {

                lieu:
                    lireChamp("maena-lieu"),

                repas:
                    lireChamp("maena-repas"),

                phrase:
                    lireChamp("maena-phrase"),

                note:
                    lireNote("maena-note")

            },

            phraseCommune:
                lireChamp("fiche-phrase-commune"),

            musique:
                lireChamp("fiche-musique")

        };


        souvenirMessage.textContent =
            "Enregistrement en cours…";


        try {

            const sejourEnregistre =
                await enregistrerSejour(
                    nouveauxSouvenirs,
                    destinationActive
                );


            sejoursActifs[indexSejourActif] =
                sejourEnregistre;

            souvenirsActifs =
                sejourEnregistre;

            creationSejour = false;

            if (
                fichiersPhotosSelectionnes.length > 0
            ) {

                souvenirMessage.textContent =
                    "Envoi des photos…";

                await envoyerPhotos(
                    fichiersPhotosSelectionnes,
                    sejourEnregistre,
                    destinationActive
                );

            }

            if (fichierAudioSelectionne) {

                souvenirMessage.textContent =
                    "Envoi du vocal…";

                await envoyerAudio(
                    fichierAudioSelectionne,
                    sejourEnregistre,
                    destinationActive
                );

            }

            viderSelectionPhotos();
            
            await chargerPhotos(
                souvenirsActifs
            );

            viderSelectionAudio();

            await chargerAudio(
                souvenirsActifs
            );

            await actualiserCarteSouvenirs();

            afficherSouvenirs(
                souvenirsActifs
            );

            afficherModeConsultation();

        } catch (erreur) {

            console.error(
                "Enregistrement impossible :",
                erreur
            );

            souvenirMessage.textContent =
                "La sauvegarde en ligne a échoué. " +
                "Garde la fiche ouverte et réessaie.";

        }

    }
);


// =========================
// BOUTONS DES SÉJOURS
// =========================

boutonSejourPrecedent.addEventListener(
    "click",
    function() {

        afficherSejour(
            indexSejourActif - 1
        );

    }
);


boutonSejourSuivant.addEventListener(
    "click",
    function() {

        afficherSejour(
            indexSejourActif + 1
        );

    }
);


boutonAjouterSejour.addEventListener(
    "click",
    function() {

        creationSejour = true;

        sejoursActifs.push({});

        indexSejourActif =
            sejoursActifs.length - 1;

        souvenirsActifs =
            sejoursActifs[indexSejourActif];

        afficherModeEdition();

    }
);

boutonSupprimerSejour.addEventListener(
    "click",
    async function() {

        if (
            !destinationActive ||
            sejoursActifs.length <= 1
        ) {
            return;
        }


        const numero =
            indexSejourActif + 1;

        const confirmation =
            window.confirm(
                `Supprimer définitivement le séjour ${numero} à ${destinationActive.ville} ?`
            );


        if (!confirmation) {
            return;
        }


        const sejourASupprimer =
            sejoursActifs[indexSejourActif];


        try {

            if (sejourASupprimer.id) {

                const {
                    error
                } = await supabaseClient
                    .from("stays")
                    .delete()
                    .eq(
                        "id",
                        sejourASupprimer.id
                    );


                if (error) {
                    throw error;
                }

            }


            sejoursActifs.splice(
                indexSejourActif,
                1
            );


            indexSejourActif =
                Math.min(
                    indexSejourActif,
                    sejoursActifs.length - 1
                );


            souvenirsActifs =
                sejoursActifs[indexSejourActif];


            afficherSouvenirs(
                souvenirsActifs
            );

            actualiserNavigationSejours();

            await actualiserCarteSouvenirs();

            souvenirDialog.scrollTop = 0;

        } catch (erreur) {

            console.error(
                "Suppression impossible :",
                erreur
            );

            window.alert(
                "La suppression n’a pas pu être enregistrée."
            );

        }

    }
);

// =========================
// ANNULATION DE L'ÉDITION
// =========================

boutonAnnulerModification.addEventListener(
    "click",
    function() {

        if (formulaireModifie) {

            const abandonner =
                window.confirm(
                    "Abandonner les modifications ?"
                );

            if (!abandonner) {
                return;
            }

        }

        if (creationSejour) {

            sejoursActifs.splice(
                indexSejourActif,
                1
            );

            indexSejourActif =
                Math.max(
                    0,
                    sejoursActifs.length - 1
                );

            souvenirsActifs =
                sejoursActifs[indexSejourActif];

            creationSejour = false;

        }

        viderSelectionPhotos();
        viderSelectionAudio();

        afficherSouvenirs(
            souvenirsActifs
        );

        afficherModeConsultation();

    }
);


// =========================
// FERMETURE DE LA FICHE
// =========================

function demanderFermeture() {

    if (
        modeEdition &&
        formulaireModifie
    ) {

        const quitter =
            window.confirm(
                "Tes modifications ne sont pas enregistrées. " +
                "Fermer sans les conserver ?"
            );

        if (!quitter) {
            return;
        }

    }

    souvenirDialog.close();

}


boutonFermerFiche.addEventListener(
    "click",
    demanderFermeture
);


// Touche Échap

souvenirDialog.addEventListener(
    "cancel",
    function(event) {

        event.preventDefault();
        demanderFermeture();

    }
);


// Clic sur le fond assombri

souvenirDialog.addEventListener(
    "click",
    function(event) {

        const limites =
            souvenirDialog.getBoundingClientRect();

        const clicEnDehors =
            event.clientX < limites.left ||
            event.clientX > limites.right ||
            event.clientY < limites.top ||
            event.clientY > limites.bottom;


        if (
            event.target === souvenirDialog &&
            clicEnDehors
        ) {
            demanderFermeture();
        }

    }
);


souvenirDialog.addEventListener(
    "close",
    function() {

        document.body.classList.remove(
            "fiche-ouverte"
        );

        destinationActive = null;
        souvenirsActifs = {};
        sejoursActifs = [];
        indexSejourActif = 0;
        creationSejour = false;

        modeEdition = false;
        formulaireModifie = false;

    }
);


// Protection lors d'une actualisation de la page

window.addEventListener(
    "beforeunload",
    function(event) {

        if (
            !modeEdition ||
            !formulaireModifie
        ) {
            return;
        }

        event.preventDefault();
        event.returnValue = "";

    }
);


// =========================
// AUTHENTIFICATION SUPABASE
// =========================

const authScreen =
    document.querySelector("#auth-screen");

const authForm =
    document.querySelector("#auth-form");

const authEmail =
    document.querySelector("#auth-email");

const authPassword =
    document.querySelector("#auth-password");

const authSubmit =
    document.querySelector("#auth-submit");

const authMessage =
    document.querySelector("#auth-message");


function afficherEcranConnexion() {

    authScreen.hidden = false;

}


function masquerEcranConnexion() {

    authScreen.hidden = true;
    authMessage.textContent = "";
    authForm.reset();

}


async function verifierSession() {

    const {
        data,
        error
    } = await supabaseClient.auth.getSession();


    if (error) {

        afficherEcranConnexion();

        authMessage.textContent =
            "Impossible de vérifier la connexion.";

        return;

    }


    if (data.session) {

        masquerEcranConnexion();

    } else {

        afficherEcranConnexion();

    }

}


authForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        authMessage.textContent =
            "Connexion en cours…";

        authSubmit.disabled = true;


        const {
            error
        } = await supabaseClient.auth.signInWithPassword({
            email: authEmail.value.trim(),
            password: authPassword.value
        });


        authSubmit.disabled = false;


        if (error) {

            console.error(
                "Erreur de connexion Supabase :",
                error
            );

            authMessage.textContent =
                `Connexion impossible : ${error.message}`;

            return;

        }


        masquerEcranConnexion();

    }
);


// =========================
// SUIVI DE LA SESSION
// =========================

const boutonDeconnexion =
    document.querySelector("#deconnexion");

// =========================
// ESPACE MON COMPTE
// =========================

const boutonOuvrirCompte =
    document.querySelector("#ouvrir-compte");

const compteDialog =
    document.querySelector("#compte-dialog");

const boutonFermerCompte =
    document.querySelector("#fermer-compte");

const compteEmail =
    document.querySelector("#compte-email");

const compteForm =
    document.querySelector("#compte-form");

const nouveauMotDePasse =
    document.querySelector("#nouveau-mot-de-passe");

const confirmationMotDePasse =
    document.querySelector("#confirmation-mot-de-passe");

const compteMessage =
    document.querySelector("#compte-message");

const boutonEnregistrerMotDePasse =
    document.querySelector("#enregistrer-mot-de-passe");


boutonOuvrirCompte.addEventListener(
    "click",
    async function() {

        compteForm.reset();
        compteMessage.textContent = "";
        compteMessage.classList.remove("succes");
        compteEmail.textContent = "Chargement…";

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();


        if (error || !data.user) {

            compteEmail.textContent =
                "Compte indisponible";

            compteMessage.textContent =
                "Impossible de récupérer votre compte.";

        } else {

            compteEmail.textContent =
                data.user.email;

        }


        compteDialog.showModal();

    }
);


boutonFermerCompte.addEventListener(
    "click",
    function() {

        compteDialog.close();

    }
);


compteDialog.addEventListener(
    "click",
    function(event) {

        if (event.target === compteDialog) {

            compteDialog.close();

        }

    }
);


compteForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        compteMessage.textContent = "";
        compteMessage.classList.remove("succes");


        if (nouveauMotDePasse.value.length < 8) {

            compteMessage.textContent =
                "Le mot de passe doit contenir au moins 8 caractères.";

            return;

        }


        if (
            nouveauMotDePasse.value !==
            confirmationMotDePasse.value
        ) {

            compteMessage.textContent =
                "Les deux mots de passe ne correspondent pas.";

            return;

        }


        boutonEnregistrerMotDePasse.disabled = true;
        boutonEnregistrerMotDePasse.textContent =
            "Enregistrement…";


        const {
            error
        } = await supabaseClient.auth.updateUser({

            password:
                nouveauMotDePasse.value

        });


        boutonEnregistrerMotDePasse.disabled = false;
        boutonEnregistrerMotDePasse.textContent =
            "Enregistrer le mot de passe";


        if (error) {

            console.error(
                "Modification du mot de passe impossible :",
                error
            );

            compteMessage.textContent =
                `Modification impossible : ${error.message}`;

            return;

        }


        compteForm.reset();

        compteMessage.textContent =
            "Votre mot de passe a bien été modifié.";

        compteMessage.classList.add("succes");

    }
);

supabaseClient.auth.onAuthStateChange(
    function(_evenement, session) {

        if (session) {

            masquerEcranConnexion();

            chargerDestinationsDepuisSupabase();

        } else {

            destinations = [];

            marqueursDestinations.clearLayers();

            actualiserStatistiques();

            afficherEcranConnexion();

        }

    }
);


// Vérifie la session lors de l’ouverture de la page.

verifierSession();


// Déconnexion manuelle.

boutonDeconnexion.addEventListener(
    "click",
    async function() {

        boutonDeconnexion.disabled = true;
        boutonDeconnexion.textContent =
            "Déconnexion…";


        const {
            error
        } = await supabaseClient.auth.signOut();


        boutonDeconnexion.disabled = false;
        boutonDeconnexion.textContent =
            "Se déconnecter";


        if (error) {

            window.alert(
                "La déconnexion a échoué. Réessaie."
            );

        }

    }
);


// =========================
// FENÊTRE D’AJOUT D’UNE VILLE
// =========================

const ajoutVilleDialog =
    document.querySelector(
        "#ajout-ville-dialog"
    );

const boutonOuvrirAjoutVille =
    document.querySelector(
        "#ouvrir-ajout-ville"
    );

const boutonFermerAjoutVille =
    document.querySelector(
        "#fermer-ajout-ville"
    );

const boutonAnnulerAjoutVille =
    document.querySelector(
        "#annuler-ajout-ville"
    );

const ajoutVilleForm =
    document.querySelector(
        "#ajout-ville-form"
    );

const rechercheVille =
    document.querySelector(
        "#recherche-ville"
    );

const boutonRechercherVille =
    document.querySelector(
        "#rechercher-ville"
    );

const resultatsVilles =
    document.querySelector(
        "#resultats-villes"
    );

const villeSelectionnee =
    document.querySelector(
        "#ville-selectionnee"
    );

const villeSelectionneeNom =
    document.querySelector(
        "#ville-selectionnee-nom"
    );

const villeSelectionneeDetails =
    document.querySelector(
        "#ville-selectionnee-details"
    );

const nouvelleVilleDebut =
    document.querySelector(
        "#nouvelle-ville-debut"
    );

const nouvelleVilleFin =
    document.querySelector(
        "#nouvelle-ville-fin"
    );

const boutonValiderAjoutVille =
    document.querySelector(
        "#valider-ajout-ville"
    );

const ajoutVilleMessage =
    document.querySelector(
        "#ajout-ville-message"
    );


let villeCandidateSelectionnee = null;

function creerIdentifiantVille(
    nom,
    codeDepartement,
    identifiantOsm
) {

    const nomNettoye =
        nom
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-|-$/g,
                ""
            );


    const suffixe =
        codeDepartement ||
        `osm-${identifiantOsm}`;


    return `${nomNettoye}-${suffixe}`
        .toLowerCase();

}


function convertirResultatGeographique(
    resultat
) {

    const adresse =
        resultat.address ?? {};


    const nom =
        resultat.name ||
        adresse.city ||
        adresse.town ||
        adresse.village ||
        adresse.municipality ||
        resultat.display_name.split(",")[0];


    const region =
        adresse.state ||
        adresse.region ||
        "Région non identifiée";


    const departement =
        adresse.county ||
        adresse.state_district ||
        "Département non identifié";


    const codeIsoDepartement =
        adresse["ISO3166-2-lvl6"] ?? "";


    const codeDepartement =
        codeIsoDepartement
            .replace("FR-", "")
            .toLowerCase();


    return {

        id:
            creerIdentifiantVille(
                nom,
                codeDepartement,
                resultat.osm_id
            ),

        ville:
            nom,

        latitude:
            Number(resultat.lat),

        longitude:
            Number(resultat.lon),

        region:
            region,

        departement:
            departement

    };

}


function selectionnerVilleCandidate(
    ville,
    bouton
) {

    villeCandidateSelectionnee =
        ville;


    document
        .querySelectorAll(
            ".resultat-ville"
        )
        .forEach(
            function(resultat) {

                resultat.classList.remove(
                    "selectionne"
                );

            }
        );


    bouton.classList.add(
        "selectionne"
    );


    villeSelectionneeNom.textContent =
        ville.ville;

    villeSelectionneeDetails.textContent =
        `${ville.departement} · ${ville.region}`;

    villeSelectionnee.hidden = false;

    boutonValiderAjoutVille.disabled =
        false;

    ajoutVilleMessage.textContent = "";

}


function afficherResultatsVilles(
    villes
) {

    resultatsVilles.innerHTML = "";


    if (villes.length === 0) {

        resultatsVilles.textContent =
            "Aucune commune française trouvée.";

        return;

    }


    villes.forEach(
        function(ville) {

            const bouton =
                document.createElement("button");

            bouton.type = "button";
            bouton.className =
                "resultat-ville";


            const nom =
                document.createElement("strong");

            nom.textContent =
                ville.ville;


            const details =
                document.createElement("span");

            details.textContent =
                `${ville.departement} · ${ville.region}`;


            bouton.appendChild(nom);
            bouton.appendChild(details);


            bouton.addEventListener(
                "click",
                function() {

                    selectionnerVilleCandidate(
                        ville,
                        bouton
                    );

                }
            );


            resultatsVilles.appendChild(
                bouton
            );

        }
    );


    const attribution =
        document.createElement("p");

    attribution.className =
        "attribution-recherche";

    attribution.textContent =
        "Recherche © OpenStreetMap";

    resultatsVilles.appendChild(
        attribution
    );

}


async function rechercherCommune() {

    const nomRecherche =
        rechercheVille.value.trim();


    if (nomRecherche.length < 2) {

        ajoutVilleMessage.textContent =
            "Saisis au moins deux caractères.";

        return;

    }


    villeCandidateSelectionnee = null;

    villeSelectionnee.hidden = true;
    boutonValiderAjoutVille.disabled = true;

    resultatsVilles.innerHTML = "";

    ajoutVilleMessage.textContent =
        "Recherche en cours…";

    boutonRechercherVille.disabled = true;


    const parametres =
        new URLSearchParams({

            q:
                `${nomRecherche}, France`,

            format:
                "jsonv2",

            addressdetails:
                "1",

            limit:
                "5",

            countrycodes:
                "fr",

            featureType:
                "settlement",

            "accept-language":
                "fr"

        });


    try {

        const reponse =
            await fetch(
                "https://nominatim.openstreetmap.org/search?" +
                parametres.toString()
            );


        if (!reponse.ok) {

            throw new Error(
                "Service géographique indisponible"
            );

        }


        const resultats =
            await reponse.json();


        const villes =
            resultats.map(
                convertirResultatGeographique
            );


        afficherResultatsVilles(
            villes
        );

        ajoutVilleMessage.textContent = "";

    } catch (erreur) {

        console.error(
            "Recherche de commune impossible :",
            erreur
        );

        ajoutVilleMessage.textContent =
            "La recherche est indisponible. Réessaie dans quelques instants.";

    } finally {

        boutonRechercherVille.disabled =
            false;

    }

}

function ouvrirAjoutVille() {

    villeCandidateSelectionnee = null;

    ajoutVilleForm.reset();

    document
        .querySelector("#resultats-villes")
        .innerHTML = "";

    document
        .querySelector("#ville-selectionnee")
        .hidden = true;

    document
        .querySelector("#valider-ajout-ville")
        .disabled = true;

    document
        .querySelector("#ajout-ville-message")
        .textContent = "";

    ajoutVilleDialog.showModal();

    document
        .querySelector("#recherche-ville")
        .focus();

}


function fermerAjoutVille() {

    ajoutVilleDialog.close();

}

boutonRechercherVille.addEventListener(
    "click",
    rechercherCommune
);


rechercheVille.addEventListener(
    "keydown",
    function(event) {

        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        rechercherCommune();

    }
);

ajoutVilleForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        if (!villeCandidateSelectionnee) {

            ajoutVilleMessage.textContent =
                "Sélectionne une commune dans les résultats.";

            return;

        }


        const dateDebut =
            nouvelleVilleDebut.value;

        const dateFin =
            nouvelleVilleFin.value;


        if (
            dateDebut &&
            dateFin &&
            dateFin < dateDebut
        ) {

            ajoutVilleMessage.textContent =
                "La date de fin ne peut pas précéder la date de début.";

            return;

        }


        const villeExisteDeja =
            destinations.some(
                function(destination) {

                    return (
                        destination.ville
                            .toLocaleLowerCase("fr") ===
                        villeCandidateSelectionnee.ville
                            .toLocaleLowerCase("fr") &&

                        destination.departement
                            .toLocaleLowerCase("fr") ===
                        villeCandidateSelectionnee.departement
                            .toLocaleLowerCase("fr")
                    );

                }
            );


        if (villeExisteDeja) {

            ajoutVilleMessage.textContent =
                "Cette ville est déjà présente sur votre carte.";

            return;

        }


        boutonValiderAjoutVille.disabled =
            true;

        ajoutVilleMessage.textContent =
            "Ajout de la ville…";


        const nouvelleVille = {

            id:
                villeCandidateSelectionnee.id,

            name:
                villeCandidateSelectionnee.ville,

            latitude:
                villeCandidateSelectionnee.latitude,

            longitude:
                villeCandidateSelectionnee.longitude,

            region:
                villeCandidateSelectionnee.region,

            department:
                villeCandidateSelectionnee.departement

        };


        const {
            error: erreurVille
        } = await supabaseClient
            .from("cities")
            .insert(nouvelleVille);


        if (erreurVille) {

            console.error(
                "Ajout de la ville impossible :",
                erreurVille
            );

            ajoutVilleMessage.textContent =
                erreurVille.code === "23505"
                    ? "Cette ville existe déjà dans AMOR."
                    : "La ville n’a pas pu être ajoutée.";

            boutonValiderAjoutVille.disabled =
                false;

            return;

        }


        const {
            error: erreurSejour
        } = await supabaseClient
            .from("stays")
            .insert({

                city_id:
                    nouvelleVille.id,

                date_start:
                    dateDebut || null,

                date_end:
                    dateFin || null

            });


        if (erreurSejour) {

            console.error(
                "Ajout du séjour impossible :",
                erreurSejour
            );


            // Annule la création incomplète de la ville.

            await supabaseClient
                .from("cities")
                .delete()
                .eq(
                    "id",
                    nouvelleVille.id
                );


            ajoutVilleMessage.textContent =
                "Le séjour n’a pas pu être créé. La ville n’a pas été ajoutée.";

            boutonValiderAjoutVille.disabled =
                false;

            return;

        }


        const villeAjoutee =
            villeCandidateSelectionnee;


        fermerAjoutVille();


        await chargerDestinationsDepuisSupabase();


        map.setView(
            [
                villeAjoutee.latitude,
                villeAjoutee.longitude
            ],
            9
        );


        const destinationAjoutee =
            destinations.find(
                function(destination) {

                    return destination.id ===
                        villeAjoutee.id;

                }
            );


        if (destinationAjoutee) {

            await ouvrirFiche(
                destinationAjoutee
            );

        }

    }
);

boutonOuvrirAjoutVille.addEventListener(
    "click",
    ouvrirAjoutVille
);

boutonFermerAjoutVille.addEventListener(
    "click",
    fermerAjoutVille
);

boutonAnnulerAjoutVille.addEventListener(
    "click",
    fermerAjoutVille
);

ajoutVilleDialog.addEventListener(
    "cancel",
    function(event) {

        event.preventDefault();
        fermerAjoutVille();

    }
);


// =========================
// INSTALLATION DE LA PWA
// =========================

if ("serviceWorker" in navigator) {

    window.addEventListener(
        "load",
        function() {

            navigator.serviceWorker
                .register(
                    "./service-worker.js"
                )
                .then(function(registration) {

                    console.log(
                        "Service worker AMOR actif :",
                        registration.scope
                    );

                })
                .catch(function(error) {

                    console.error(
                        "Service worker AMOR non chargé :",
                        error
                    );

                });

        }
    );

}