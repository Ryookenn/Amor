// =========================
// SERVICE WORKER AMOR
// =========================

const CACHE_NAME =
    "amor-static-v1";


const FICHIERS_ESSENTIELS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./config.js",
    "./manifest.webmanifest",
    "./assets/icons/amor-favicon-32.png",
    "./assets/icons/amor-apple-touch-icon.png",
    "./assets/icons/amor-pwa-192.png",
    "./assets/icons/amor-pwa-512.png",
    "./assets/icons/amor-symbol.svg"
];


self.addEventListener(
    "install",
    function(event) {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(function(cache) {

                    return cache.addAll(
                        FICHIERS_ESSENTIELS
                    );

                })
                .then(function() {

                    return self.skipWaiting();

                })

        );

    }
);


self.addEventListener(
    "activate",
    function(event) {

        event.waitUntil(

            caches
                .keys()
                .then(function(cacheNames) {

                    return Promise.all(

                        cacheNames
                            .filter(function(cacheName) {

                                return (
                                    cacheName !==
                                    CACHE_NAME
                                );

                            })
                            .map(function(cacheName) {

                                return caches.delete(
                                    cacheName
                                );

                            })

                    );

                })
                .then(function() {

                    return self.clients.claim();

                })

        );

    }
);


self.addEventListener(
    "fetch",
    function(event) {

        const request =
            event.request;

        const requestUrl =
            new URL(request.url);


        if (
            request.method !== "GET" ||
            requestUrl.origin !==
                self.location.origin
        ) {
            return;
        }


        event.respondWith(

            fetch(request)
                .then(function(response) {

                    if (
                        !response ||
                        response.status !== 200
                    ) {
                        return response;
                    }


                    const copieReponse =
                        response.clone();


                    caches
                        .open(CACHE_NAME)
                        .then(function(cache) {

                            cache.put(
                                request,
                                copieReponse
                            );

                        });


                    return response;

                })
                .catch(function() {

                    return caches
                        .match(request)
                        .then(function(responseEnCache) {

                            if (responseEnCache) {
                                return responseEnCache;
                            }


                            if (
                                request.mode ===
                                "navigate"
                            ) {
                                return caches.match(
                                    "./index.html"
                                );
                            }


                            return new Response(
                                "Ressource indisponible hors connexion.",
                                {
                                    status: 503,
                                    statusText:
                                        "Service Unavailable"
                                }
                            );

                        });

                })

        );

    }
);