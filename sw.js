// Service Worker per PWA

// !!! IMPORTANT: CANVIA AQUEST NÚMERO CADA VEGADA QUE PUBLIQUIS !!!
const CACHE_NAME = 'mytube-v2'; 

const urlsToCache = [
    './',                // Recorda posar el punt davant!
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/config.js',
    './js/data.js',
    './js/youtube.js',   // Afegeix youtube.js si no hi era
    './manifest.json'
];

// Instal·lació
self.addEventListener('install', (event) => {
    // Forçar que el nou Service Worker s'activi immediatament, sense esperar
    self.skipWaiting(); 
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache obert');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activació
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminant cache antic:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Dir als navegadors oberts: "Fes servir la nova versió JA!"
            return self.clients.claim(); 
        })
    );
});

// Fetch (gestió de xarxa)
self.addEventListener('fetch', (event) => {
    // Ignorar extensions de Chrome o esquemes no suportats
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retornar cache si existeix
                if (response) {
                    return response;
                }
                
                // Si no, buscar a internet
                return fetch(event.request).then((response) => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
    );
});
