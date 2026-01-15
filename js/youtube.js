// Servei YouTube Data API v3

const YouTubeAPI = {
    BASE_URL: 'https://www.googleapis.com/youtube/v3',

    // Configuració de llengua
    language: 'ca',        // Català
    regionCode: 'ES',      // Espanya (inclou Catalunya)

    // Configuració de cache
    CACHE_DURATION: 2 * 60 * 60 * 1000, // 2 hores en mil·lisegons

    // Canals catalans (ara buit - l'usuari afegeix manualment)
    catalanChannels: [
    { id: "@EnricAdventures", name: "Enric Adventures", category: "vida" },
    { id: "@unquartdegalves", name: "Un Quart de Galves", category: "societat" },
    { id: "@lescaquimat4658", name: "L'ESCACIMAT", category: "cultura" },
    { id: "@EnricBastardas1", name: "Enric Bastardas", category: "humor" },
    { id: "@AyaZholvaX", name: "Aya_ZholvaX: Boardgames", category: "gaming" },
],

    // Paraules clau per detectar contingut català
    catalanKeywords: [
        "català", "catalana", "catalans", "catalanes",
        "catalunya", "catalonia",
        "barcelona", "girona", "tarragona", "lleida",
        "en català", "parlem", "benvinguts", "benvingudes",
        "avui", "d'avui", "som-hi", "endavant",
        "entrevista", "notícies", "informatiu"
    ],

    userChannels: [],      // Canals afegits per l'usuari

    // Inicialitzar dades de canals catalans
    async init() {
        this.loadUserChannels();
        console.log(`iuTube: ${this.catalanChannels.length} canals catalans verificats`);
        console.log(`iuTube: Cache configurat per ${this.CACHE_DURATION / 1000 / 60} minuts`);
    },

    // ==================== CACHE ====================

    // Obtenir dades del cache
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(`iutube_cache_${key}`);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age > this.CACHE_DURATION) {
                localStorage.removeItem(`iutube_cache_${key}`);
                return null;
            }

            console.log(`iuTube: Cache hit per "${key}" (${Math.round(age / 1000 / 60)} min)`);
            return data;
        } catch (e) {
            return null;
        }
    },

    // Guardar dades al cache
    saveToCache(key, data) {
        try {
            localStorage.setItem(`iutube_cache_${key}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            console.log(`iuTube: Guardat al cache "${key}"`);
        } catch (e) {
            console.warn('iuTube: No s\'ha pogut guardar al cache:', e);
        }
    },

    // Netejar cache antic
    clearOldCache() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('iutube_cache_'));
        keys.forEach(key => {
            try {
                const { timestamp } = JSON.parse(localStorage.getItem(key));
                if (Date.now() - timestamp > this.CACHE_DURATION) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        });
    },

    // ==================== PLAYLIST (BAIX COST) ====================

    // Convertir channel ID a uploads playlist ID
    // UC... -> UU...
    getUploadsPlaylistId(channelId) {
        if (channelId.startsWith('UC')) {
            return 'UU' + channelId.substring(2);
        }
        return channelId;
    },

    // Obtenir vídeos d'una playlist (COSTA 1 UNITAT!)
    async getPlaylistVideos(playlistId, maxResults = 5) {
        const apiKey = this.getApiKey();
        if (!apiKey) return [];

        try {
            const response = await fetch(
                `${this.BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`
            );

            if (!response.ok) {
                console.log(`iuTube: Error ${response.status} per playlist ${playlistId}`);
                return [];
            }

            const data = await response.json();
            if (!data.items) return [];

            return data.items.map(item => ({
                id: item.contentDetails.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                channelId: item.snippet.channelId,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.contentDetails.videoPublishedAt || item.snippet.publishedAt
            }));
        } catch (error) {
            console.error(`iuTube: Error obtenint playlist ${playlistId}:`, error);
            return [];
        }
    },

    // Vídeos per canal (configurable)
    VIDEOS_PER_CHANNEL: 10,

    // Obtenir vídeos de múltiples canals catalans (MOLT EFICIENT!)
    async getVideosFromCatalanChannelsEfficient(maxResults = 100) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        // Comprovar cache
        const cached = this.getFromCache('catalan_videos');
        if (cached) {
            return { items: cached, error: null, fromCache: true };
        }

        const allChannels = this.getAllChannels();

        if (allChannels.length === 0) {
            return { items: [], error: 'No hi ha canals configurats' };
        }

        console.log(`iuTube: Obtenint ${this.VIDEOS_PER_CHANNEL} vídeos de ${allChannels.length} canals`);

        try {
            let allVideos = [];

            // Obtenir vídeos de cada canal en paral·lel
            const promises = allChannels.map(async (channel) => {
                const playlistId = this.getUploadsPlaylistId(channel.id);
                const videos = await this.getPlaylistVideos(playlistId, this.VIDEOS_PER_CHANNEL);

                if (videos.length > 0) {
                    console.log(`iuTube: ${videos.length} vídeos de ${channel.name}`);
                }

                return videos;
            });

            const results = await Promise.all(promises);
            allVideos = results.flat();

            console.log(`iuTube: Total ${allVideos.length} vídeos obtinguts`);

            if (allVideos.length === 0) {
                return { items: [], error: 'No s\'han trobat vídeos' };
            }

            // Obtenir detalls (estadístiques) - COSTA 1 UNITAT per fins a 50 vídeos
            // Si tenim més de 50, fem múltiples crides
            let allDetailedVideos = [];
            for (let i = 0; i < allVideos.length; i += 50) {
                const batch = allVideos.slice(i, i + 50);
                const videoIds = batch.map(v => v.id).join(',');

                const detailsResponse = await fetch(
                    `${this.BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
                );

                if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json();
                    const videos = this.transformVideoResults(detailsData.items);
                    allDetailedVideos = allDetailedVideos.concat(videos);
                }
            }

            // Ordenar per data de publicació (nou a vell)
            allDetailedVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            // Intercalar vídeos per evitar repeticions i donar rellevància a canals menys freqüents
            const intercalatedVideos = this.intercalateVideos(allDetailedVideos);

            // Guardar al cache
            this.saveToCache('catalan_videos', intercalatedVideos);

            return { items: intercalatedVideos.slice(0, maxResults), error: null };
        } catch (error) {
            console.error('iuTube: Error obtenint vídeos catalans:', error);
            return { items: [], error: error.message };
        }
    },

    // Vídeos inicials per canal (intercalats al principi)
    INITIAL_VIDEOS_PER_CHANNEL: 3,

    // Intercalar vídeos per evitar repeticions del mateix canal
    // i donar més rellevància a canals que publiquen menys freqüentment
    intercalateVideos(videos) {
        if (videos.length <= 1) return videos;

        // Agrupar vídeos per canal (ja venen ordenats per data)
        const videosByChannel = {};
        videos.forEach(video => {
            const channelId = video.channelId;
            if (!videosByChannel[channelId]) {
                videosByChannel[channelId] = [];
            }
            videosByChannel[channelId].push(video);
        });

        const channelIds = Object.keys(videosByChannel);
        if (channelIds.length === 1) {
            // Només un canal, retornar ordenats per data
            return videos;
        }

        const result = [];

        // FASE 1: Intercalar els primers N vídeos de cada canal
        // Això garanteix que tots els canals tinguin presència al principi
        const initialVideos = {};
        channelIds.forEach(channelId => {
            initialVideos[channelId] = videosByChannel[channelId].splice(0, this.INITIAL_VIDEOS_PER_CHANNEL);
        });

        // Intercalar els vídeos inicials (round-robin per data)
        let hasMore = true;
        while (hasMore) {
            hasMore = false;
            // Ordenar canals pel vídeo més recent disponible
            const sortedChannels = channelIds
                .filter(id => initialVideos[id].length > 0)
                .sort((a, b) => {
                    const dateA = new Date(initialVideos[a][0].publishedAt);
                    const dateB = new Date(initialVideos[b][0].publishedAt);
                    return dateB - dateA;
                });

            for (const channelId of sortedChannels) {
                if (initialVideos[channelId].length > 0) {
                    result.push(initialVideos[channelId].shift());
                    hasMore = true;
                }
            }
        }

        // FASE 2: Afegir la resta de vídeos amb l'algorisme de pes
        // Calcular pes per cada canal (menys vídeos = més pes)
        const remainingTotal = channelIds.reduce((sum, id) => sum + videosByChannel[id].length, 0);
        if (remainingTotal === 0) return result;

        const channelWeights = {};
        channelIds.forEach(channelId => {
            const count = videosByChannel[channelId].length;
            // Pes invers: canals amb menys vídeos tenen més prioritat
            channelWeights[channelId] = count > 0 ? remainingTotal / count : 0;
        });

        let lastChannelId = result.length > 0 ? result[result.length - 1].channelId : null;

        // Mentre quedin vídeos per processar
        while (channelIds.some(id => videosByChannel[id].length > 0)) {
            let bestChannel = null;
            let bestScore = -Infinity;

            // Trobar el millor canal per al següent vídeo
            for (const channelId of channelIds) {
                if (videosByChannel[channelId].length === 0) continue;

                // Evitar repetir el mateix canal consecutivament
                if (channelId === lastChannelId && channelIds.filter(id => videosByChannel[id].length > 0).length > 1) {
                    continue;
                }

                // Calcular puntuació: pes del canal + bonus per tenir vídeos nous
                const weight = channelWeights[channelId];
                const nextVideo = videosByChannel[channelId][0];
                const recency = new Date(nextVideo.publishedAt).getTime();

                // Normalitzar recency i combinar amb pes
                const score = weight * 1000 + recency / 1000000000000;

                if (score > bestScore) {
                    bestScore = score;
                    bestChannel = channelId;
                }
            }

            // Si no hem trobat cap canal (tots són el mateix), agafar l'últim
            if (!bestChannel) {
                bestChannel = channelIds.find(id => videosByChannel[id].length > 0);
            }

            if (bestChannel && videosByChannel[bestChannel].length > 0) {
                result.push(videosByChannel[bestChannel].shift());
                lastChannelId = bestChannel;
            } else {
                break;
            }
        }

        return result;
    },

    // Carregar canals afegits per l'usuari des de localStorage
    loadUserChannels() {
        const stored = localStorage.getItem('user_catalan_channels');
        this.userChannels = stored ? JSON.parse(stored) : [];
    },

    // Desar canals de l'usuari a localStorage
    saveUserChannels() {
        localStorage.setItem('user_catalan_channels', JSON.stringify(this.userChannels));
    },

    // Afegir un canal de l'usuari
    async addUserChannel(channelId) {
        // Verificar que el canal existeix
        const channelInfo = await this.getChannelDetails(channelId);
        if (channelInfo.channel) {
            const newChannel = {
                id: channelId,
                name: channelInfo.channel.title,
                category: 'usuari',
                addedBy: 'user'
            };
            // Evitar duplicats
            if (!this.userChannels.find(c => c.id === channelId) &&
                !this.catalanChannels.find(c => c.id === channelId)) {
                this.userChannels.push(newChannel);
                this.saveUserChannels();
                // Netejar cache per forçar recàrrega amb el nou canal
                localStorage.removeItem('iutube_cache_catalan_videos');
                return { success: true, channel: newChannel };
            }
            return { success: false, error: 'El canal ja existeix' };
        }
        return { success: false, error: 'Canal no trobat' };
    },

    // Eliminar un canal de l'usuari
    removeUserChannel(channelId) {
        this.userChannels = this.userChannels.filter(c => c.id !== channelId);
        this.saveUserChannels();
        // Netejar cache per forçar recàrrega sense el canal
        localStorage.removeItem('iutube_cache_catalan_videos');
    },

    // Obtenir tots els canals (verificats + usuari)
    getAllChannels() {
        return [...this.catalanChannels, ...this.userChannels];
    },

    // Comprovar si un text conté paraules clau catalanes
    containsCatalanKeywords(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return this.catalanKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    },

    // Filtrar vídeos per contingut català
    filterCatalanContent(videos) {
        const channelIds = this.getAllChannels().map(c => c.id);
        return videos.filter(video => {
            // Prioritat 1: És d'un canal verificat
            if (channelIds.includes(video.channelId)) return true;
            // Prioritat 2: Conté paraules clau catalanes
            if (this.containsCatalanKeywords(video.title) ||
                this.containsCatalanKeywords(video.description)) return true;
            return false;
        });
    },

    // Obtenir data de fa X setmanes (per filtrar vídeos recents)
    getDateWeeksAgo(weeks) {
        const date = new Date();
        date.setDate(date.getDate() - (weeks * 7));
        return date.toISOString();
    },

    // Obtenir la clau API des de localStorage
    getApiKey() {
        return localStorage.getItem('youtube_api_key') || '';
    },

    // Desar la clau API a localStorage
    setApiKey(key) {
        localStorage.setItem('youtube_api_key', key);
    },

    // Esborrar la clau API
    clearApiKey() {
        localStorage.removeItem('youtube_api_key');
    },

    // Comprovar si hi ha clau API configurada
    hasApiKey() {
        return !!this.getApiKey();
    },

    // Verificar si la clau API és vàlida
    async verifyApiKey(key) {
        try {
            const response = await fetch(
                `${this.BASE_URL}/videos?part=snippet&chart=mostPopular&maxResults=1&key=${key}`
            );

            if (response.ok) {
                console.log('iuTube: Clau API vàlida');
                return { valid: true, error: null };
            }

            // Obtenir detalls de l'error
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'Error desconegut';
            const errorReason = errorData.error?.errors?.[0]?.reason || '';

            console.error('iuTube: Error API:', errorMessage, errorReason);

            // Missatges d'error més clars
            let userMessage = 'Clau API invàlida';
            if (errorReason === 'keyInvalid') {
                userMessage = 'La clau API no és vàlida. Comprova que l\'has copiat correctament.';
            } else if (errorReason === 'ipRefererBlocked') {
                userMessage = 'La clau API té restriccions d\'IP o referrer. Configura-la sense restriccions a Google Cloud Console.';
            } else if (errorReason === 'accessNotConfigured') {
                userMessage = 'L\'API de YouTube Data v3 no està activada. Activa-la a Google Cloud Console.';
            } else if (errorReason === 'quotaExceeded') {
                userMessage = 'Has superat la quota diària de l\'API. Espera fins demà o crea un altre projecte.';
            } else if (response.status === 403) {
                userMessage = 'Accés denegat. Comprova les restriccions de la clau a Google Cloud Console.';
            }

            return { valid: false, error: userMessage };
        } catch (error) {
            console.error('iuTube: Error de xarxa verificant API key:', error);
            return { valid: false, error: 'Error de connexió. Comprova la teva connexió a internet.' };
        }
    },

    // Cercar vídeos
    async searchVideos(query, maxResults = 12) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        try {
            const response = await fetch(
                `${this.BASE_URL}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&relevanceLanguage=${this.language}&regionCode=${this.regionCode}&key=${apiKey}`
            );

            if (!response.ok) {
                // Obtenir detalls de l'error
                const errorData = await response.json().catch(() => ({}));
                const errorReason = errorData.error?.errors?.[0]?.reason || '';

                if (response.status === 403) {
                    if (errorReason === 'quotaExceeded') {
                        return { items: [], error: 'Quota excedida. L\'API de cerca consumeix molta quota. Espera fins demà.' };
                    }
                    return { items: [], error: 'La cerca no està permesa amb la teva clau API. Configura-la sense restriccions a Google Cloud Console > Credentials > API restrictions > Don\'t restrict key' };
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return { items: this.transformSearchResults(data.items), error: null };
        } catch (error) {
            console.error('iuTube: Error cercant vídeos:', error);
            return { items: [], error: error.message };
        }
    },

    // Obtenir vídeos dels canals catalans verificats
    async getVideosFromCatalanChannels(maxResults = 12) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.log('iuTube: No hi ha API key');
            return { items: [], error: 'No API key' };
        }

        const allChannels = this.getAllChannels();
        console.log(`iuTube: Cercant vídeos de ${allChannels.length} canals catalans`);

        if (allChannels.length === 0) {
            return { items: [], error: 'No hi ha canals catalans configurats' };
        }

        try {
            // Seleccionar canals aleatoris per varietat
            const shuffled = [...allChannels].sort(() => 0.5 - Math.random());
            const selectedChannels = shuffled.slice(0, 8);

            let allVideos = [];

            // Obtenir vídeos de cada canal (en paral·lel per ser més ràpid)
            const promises = selectedChannels.map(async (channel) => {
                try {
                    const response = await fetch(
                        `${this.BASE_URL}/search?part=snippet&type=video&channelId=${channel.id}&maxResults=3&order=date&key=${apiKey}`
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                            console.log(`iuTube: ${data.items.length} vídeos de ${channel.name}`);
                            return data.items.map(item => ({
                                id: item.id.videoId,
                                title: item.snippet.title,
                                description: item.snippet.description,
                                thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
                                channelId: item.snippet.channelId,
                                channelTitle: item.snippet.channelTitle,
                                publishedAt: item.snippet.publishedAt,
                                isVerifiedCatalan: true
                            }));
                        }
                    } else {
                        console.log(`iuTube: Error ${response.status} per canal ${channel.name}`);
                    }
                } catch (e) {
                    console.log(`iuTube: Error canal ${channel.name}:`, e.message);
                }
                return [];
            });

            const results = await Promise.all(promises);
            allVideos = results.flat();

            console.log(`iuTube: Total ${allVideos.length} vídeos catalans trobats`);

            // Obtenir detalls complets (estadístiques)
            if (allVideos.length > 0) {
                const videoIds = allVideos.map(v => v.id).join(',');
                const detailsResponse = await fetch(
                    `${this.BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
                );

                if (detailsResponse.ok) {
                    const detailsData = await detailsResponse.json();
                    const detailedVideos = this.transformVideoResults(detailsData.items);
                    // Marcar com a verificats
                    detailedVideos.forEach(v => v.isVerifiedCatalan = true);
                    // Barrejar i limitar
                    return {
                        items: detailedVideos.sort(() => 0.5 - Math.random()).slice(0, maxResults),
                        error: null
                    };
                }
            }

            return { items: allVideos.slice(0, maxResults), error: null };
        } catch (error) {
            console.error('iuTube: Error obtenint vídeos catalans:', error);
            return { items: [], error: error.message };
        }
    },

    // Obtenir vídeos populars (usa canals catalans - MOLT EFICIENT)
    async getPopularVideos(maxResults = 12) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        console.log('iuTube: Obtenint vídeos catalans...');

        // ESTRATÈGIA EFICIENT: Usar playlistItems dels canals catalans
        // Costa ~12 unitats (11 canals + 1 per detalls) vs 100+ amb search
        const result = await this.getVideosFromCatalanChannelsEfficient(maxResults);

        if (result.items && result.items.length > 0) {
            if (result.fromCache) {
                console.log('iuTube: Vídeos carregats des del cache (0 unitats consumides)');
            } else {
                console.log(`iuTube: ${result.items.length} vídeos catalans carregats (~12 unitats consumides)`);
            }
            return result;
        }

        // FALLBACK: Si no hi ha vídeos dels canals, usar populars de la regió
        console.log('iuTube: Fallback a vídeos populars de la regió');
        try {
            const response = await fetch(
                `${this.BASE_URL}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${this.regionCode}&maxResults=${maxResults}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return { items: this.transformVideoResults(data.items), error: null };
        } catch (error) {
            console.error('iuTube: Error obtenint vídeos populars:', error);
            return { items: [], error: error.message };
        }
    },

    // Obtenir vídeos per categoria (amb preferència per català)
    async getVideosByCategory(categoryId, maxResults = 12) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        try {
            // Primer intentem cercar vídeos de la categoria en català
            const searchResponse = await fetch(
                `${this.BASE_URL}/search?part=snippet&type=video&videoCategoryId=${categoryId}&maxResults=${maxResults}&relevanceLanguage=${this.language}&regionCode=${this.regionCode}&order=viewCount&key=${apiKey}`
            );

            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.items && searchData.items.length > 0) {
                    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
                    const detailsResponse = await fetch(
                        `${this.BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
                    );
                    if (detailsResponse.ok) {
                        const detailsData = await detailsResponse.json();
                        return { items: this.transformVideoResults(detailsData.items), error: null };
                    }
                }
            }

            // Fallback: vídeos populars de la categoria
            const response = await fetch(
                `${this.BASE_URL}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&videoCategoryId=${categoryId}&regionCode=${this.regionCode}&maxResults=${maxResults}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return { items: this.transformVideoResults(data.items), error: null };
        } catch (error) {
            console.error('Error obtenint vídeos per categoria:', error);
            return { items: [], error: error.message };
        }
    },

    // Obtenir detalls d'un vídeo
    async getVideoDetails(videoId) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { video: null, error: 'No API key' };

        try {
            const response = await fetch(
                `${this.BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return { video: this.transformVideoDetails(data.items[0]), error: null };
            }
            return { video: null, error: 'Video not found' };
        } catch (error) {
            console.error('Error obtenint detalls del vídeo:', error);
            return { video: null, error: error.message };
        }
    },

    // Obtenir informació del canal
    async getChannelDetails(channelId) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { channel: null, error: 'No API key' };

        try {
            const response = await fetch(
                `${this.BASE_URL}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return { channel: this.transformChannelDetails(data.items[0]), error: null };
            }
            return { channel: null, error: 'Channel not found' };
        } catch (error) {
            console.error('Error obtenint detalls del canal:', error);
            return { channel: null, error: error.message };
        }
    },

    // Obtenir informació del canal per handle (@username)
    async getChannelByHandle(handle) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { channel: null, error: 'No API key' };

        // Netejar el handle (treure @ si hi és)
        const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;

        try {
            const response = await fetch(
                `${this.BASE_URL}/channels?part=snippet,statistics&forHandle=${cleanHandle}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return { channel: this.transformChannelDetails(data.items[0]), error: null };
            }
            return { channel: null, error: 'Canal no trobat' };
        } catch (error) {
            console.error('Error obtenint canal per handle:', error);
            return { channel: null, error: error.message };
        }
    },

    // Obtenir vídeos relacionats (amb preferència per català)
    async getRelatedVideos(videoId, maxResults = 10) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        try {
            const response = await fetch(
                `${this.BASE_URL}/search?part=snippet&type=video&relatedToVideoId=${videoId}&maxResults=${maxResults}&relevanceLanguage=${this.language}&regionCode=${this.regionCode}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return { items: this.transformSearchResults(data.items), error: null };
        } catch (error) {
            console.error('Error obtenint vídeos relacionats:', error);
            return { items: [], error: error.message };
        }
    },

    // Obtenir comentaris d'un vídeo
    async getVideoComments(videoId, maxResults = 20) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        try {
            const response = await fetch(
                `${this.BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return { items: this.transformComments(data.items), error: null };
        } catch (error) {
            console.error('Error obtenint comentaris:', error);
            return { items: [], error: error.message };
        }
    },

    // Obtenir categories de vídeos
    async getVideoCategories(regionCode = 'ES') {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        try {
            const response = await fetch(
                `${this.BASE_URL}/videoCategories?part=snippet&regionCode=${regionCode}&key=${apiKey}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                items: data.items
                    .filter(cat => cat.snippet.assignable)
                    .map(cat => ({
                        id: cat.id,
                        name: cat.snippet.title
                    })),
                error: null
            };
        } catch (error) {
            console.error('Error obtenint categories:', error);
            return { items: [], error: error.message };
        }
    },

    // Transformar resultats de cerca
    transformSearchResults(items) {
        if (!items) return [];
        return items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt
        }));
    },

    // Transformar resultats de vídeos amb estadístiques
    transformVideoResults(items) {
        if (!items) return [];
        return items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: this.parseDuration(item.contentDetails?.duration),
            isShort: this.isShortVideo(item.contentDetails?.duration),
            viewCount: parseInt(item.statistics?.viewCount || 0),
            likeCount: parseInt(item.statistics?.likeCount || 0),
            commentCount: parseInt(item.statistics?.commentCount || 0)
        }));
    },

    // Transformar detalls d'un vídeo
    transformVideoDetails(item) {
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.maxres?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: this.parseDuration(item.contentDetails?.duration),
            isShort: this.isShortVideo(item.contentDetails?.duration),
            viewCount: parseInt(item.statistics?.viewCount || 0),
            likeCount: parseInt(item.statistics?.likeCount || 0),
            commentCount: parseInt(item.statistics?.commentCount || 0),
            tags: item.snippet.tags || []
        };
    },

    // Transformar detalls del canal
    transformChannelDetails(item) {
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            subscriberCount: parseInt(item.statistics?.subscriberCount || 0),
            videoCount: parseInt(item.statistics?.videoCount || 0),
            viewCount: parseInt(item.statistics?.viewCount || 0)
        };
    },

    // Transformar comentaris
    transformComments(items) {
        if (!items) return [];
        return items.map(item => {
            const comment = item.snippet.topLevelComment.snippet;
            return {
                id: item.id,
                authorName: comment.authorDisplayName,
                authorAvatar: comment.authorProfileImageUrl,
                text: comment.textDisplay,
                likeCount: comment.likeCount,
                publishedAt: comment.publishedAt
            };
        });
    },

    // Comprovar si un vídeo és Short (<= 60 segons)
    isShortVideo(isoDuration) {
        const seconds = this.parseDurationSeconds(isoDuration);
        if (seconds === null) return false;
        return seconds <= 60;
    },

    // Parsejar duració ISO 8601 a segons
    parseDurationSeconds(isoDuration) {
        if (!isoDuration) return null;

        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return null;

        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);

        return (hours * 3600) + (minutes * 60) + seconds;
    },

    // Parsejar duració ISO 8601 a format llegible
    parseDuration(isoDuration) {
        if (!isoDuration) return '0:00';

        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '0:00';

        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
};
