// Servei YouTube Data API v3

const FEED_URL = 'data/feed.json';

const YouTubeAPI = {
    BASE_URL: 'https://www.googleapis.com/youtube/v3',

    // Configuració de llengua
    language: 'ca',        // Català
    regionCode: 'AD',      // Andorra (per prioritzar contingut català)

    // Configuració de cache
    CACHE_DURATION: 2 * 60 * 60 * 1000, // 2 hores en mil·lisegons

    // Cache de channel IDs resolts (per evitar crides repetides)
    resolvedChannelIds: {},

    // Canals catalans - FALLBACK si no es pot carregar el feed
    catalanChannels: [
        { id: "@EnricAdventures", name: "Enric Adventures", categories: ["vida"] },
        { id: "@unquartdegalves", name: "Un Quart de Galves", categories: ["societat"] },
        { id: "@lescaquimat4658", name: "L'ESCACIMAT", categories: ["cultura", "societat"] },
        { id: "@EnricBastardas1", name: "Enric Bastardas", categories: ["humor", "societat"] },
        { id: "@AyaZholvaX", name: "Aya_ZholvaX: Boardgames", categories: ["gaming", "cultura"] },
    ],

    // Canals carregats des del feed
    feedChannels: [],
    feedVideos: [],
    feedLoaded: false,

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
        this.loadResolvedChannelIds();
        
        // Intentar carregar el feed
        await this.loadFeed();
        
        console.log(`iuTube: ${this.getAllChannels().length} canals configurats`);
        console.log(`iuTube: Cache configurat per ${this.CACHE_DURATION / 1000 / 60} minuts`);
    },

    // ==================== CARREGAR FEED ====================

    // Carregar canals i vídeos des del feed
    async loadFeed() {
        try {
            const cacheBustedUrl = `${FEED_URL}?t=${Date.now()}`;
            const response = await fetch(cacheBustedUrl, { cache: 'no-store' });
            if (!response.ok) {
                console.log('iuTube: Feed no disponible, usant canals per defecte');
                return;
            }

            const feedData = await response.json();
            const feedGeneratedAt = feedData?.generatedAt
                || feedData?.meta?.generatedAt
                || response.headers.get('last-modified');
            this.handleFeedGeneratedAt(feedGeneratedAt);
            const feedItems = Array.isArray(feedData)
                ? feedData
                : (Array.isArray(feedData.items) ? feedData.items : (Array.isArray(feedData.videos) ? feedData.videos : []));

            const feedChannelsMap = feedData?.channels && typeof feedData.channels === 'object'
                ? feedData.channels
                : null;

            if (Array.isArray(feedItems) && feedItems.length > 0) {
                // Guardar vídeos del feed
                this.feedVideos = feedItems;

                if (feedChannelsMap) {
                    this.feedChannels = Object.entries(feedChannelsMap).map(([id, channel]) => ({
                        id,
                        name: channel.name || '',
                        avatar: channel.avatar || '',
                        description: channel.description || '',
                        handle: channel.handle || '',
                        subscriberCount: channel.subscriberCount ?? null,
                        categories: this.normalizeCategories(channel.categories || [])
                    }));
                } else {
                    // Fallback per feeds antics
                    const channelsMap = {};
                    feedItems.forEach(video => {
                        if (video.channelTitle && !channelsMap[video.channelTitle]) {
                            channelsMap[video.channelTitle] = {
                                id: video.channelId || null,
                                name: video.channelTitle,
                                avatar: '',
                                description: '',
                                handle: '',
                                subscriberCount: null,
                                categories: this.normalizeCategories(video.categories)
                            };
                        }
                    });

                    this.feedChannels = Object.values(channelsMap);
                }

                this.feedLoaded = true;

                console.log(`iuTube: Carregats ${this.feedVideos.length} vídeos i ${this.feedChannels.length} canals des del feed`);
            }
        } catch (error) {
            console.log('iuTube: Error carregant el feed:', error.message);
        }
    },

    handleFeedGeneratedAt(feedGeneratedAt) {
        if (!feedGeneratedAt) {
            return;
        }
        const prev = localStorage.getItem('iutube_feed_generatedAt');
        if (prev !== feedGeneratedAt) {
            localStorage.setItem('iutube_feed_generatedAt', feedGeneratedAt);
            localStorage.removeItem('iutube_cache_catalan_videos');
            localStorage.removeItem('iutube_cache_feed_json');
        }
    },

    // Normalitzar categories (minúscules, sense espais extra)
    normalizeCategories(categories) {
        if (!categories) return [];
        if (typeof categories === 'string') {
            // Si és un string, separar per ;
            return categories.split(';').map(c => c.trim().toLowerCase()).filter(c => c);
        }
        if (Array.isArray(categories)) {
            return categories.map(c => c.trim().toLowerCase()).filter(c => c);
        }
        return [];
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

    // Carregar channel IDs resolts des de localStorage
    loadResolvedChannelIds() {
        const stored = localStorage.getItem('iutube_resolved_channel_ids');
        if (stored) {
            try {
                this.resolvedChannelIds = JSON.parse(stored);
            } catch (e) {
                this.resolvedChannelIds = {};
            }
        }
    },

    // Guardar channel IDs resolts a localStorage
    saveResolvedChannelIds() {
        localStorage.setItem('iutube_resolved_channel_ids', JSON.stringify(this.resolvedChannelIds));
    },

    // ==================== RESOLUCIÓ DE HANDLES ====================

    // Resoldre un handle (@username) o channel ID a un channel ID UC...
    async resolveChannelId(channelIdOrHandle) {
        // Si ja és un channel ID (comença amb UC), retornar-lo
        if (channelIdOrHandle && channelIdOrHandle.startsWith('UC')) {
            return channelIdOrHandle;
        }

        // Comprovar si ja l'hem resolt abans (cache local)
        if (channelIdOrHandle && this.resolvedChannelIds[channelIdOrHandle]) {
            console.log(`iuTube: Channel ID resolt des de cache: ${channelIdOrHandle} -> ${this.resolvedChannelIds[channelIdOrHandle]}`);
            return this.resolvedChannelIds[channelIdOrHandle];
        }

        // Si és un handle, buscar el channel ID via API
        if (channelIdOrHandle && channelIdOrHandle.startsWith('@')) {
            const result = await this.getChannelByHandle(channelIdOrHandle);
            if (result.channel) {
                // Guardar al cache local
                this.resolvedChannelIds[channelIdOrHandle] = result.channel.id;
                this.saveResolvedChannelIds();
                console.log(`iuTube: Resolt ${channelIdOrHandle} -> ${result.channel.id}`);
                return result.channel.id;
            }
        }

        console.warn(`iuTube: No s'ha pogut resoldre: ${channelIdOrHandle}`);
        return null;
    },

    // ==================== PLAYLIST (BAIX COST) ====================

    // Convertir channel ID a uploads playlist ID
    // UC... -> UU...
    getUploadsPlaylistId(channelId) {
        if (channelId && channelId.startsWith('UC')) {
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
                thumbnail: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.standard?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
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
  VIDEOS_PER_CHANNEL: 50,

    // Obtenir vídeos de múltiples canals catalans (MOLT EFICIENT!)
  async getVideosFromCatalanChannelsEfficient(maxResults = 1000) {
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
                // Resoldre handle a channel ID si cal
                let channelId = channel.id;
                if (channelId && channelId.startsWith('@')) {
                    channelId = await this.resolveChannelId(channelId);
                    if (!channelId) {
                        console.warn(`iuTube: No s'ha pogut resoldre el canal ${channel.name} (${channel.id})`);
                        return [];
                    }
                }

                if (!channelId) {
                    console.warn(`iuTube: Canal sense ID: ${channel.name}`);
                    return [];
                }

                const playlistId = this.getUploadsPlaylistId(channelId);
                const videos = await this.getPlaylistVideos(playlistId, this.VIDEOS_PER_CHANNEL);

                if (videos.length > 0) {
                    console.log(`iuTube: ${videos.length} vídeos de ${channel.name}`);
                    // Afegir categories del canal als vídeos
                    videos.forEach(v => {
                        v.categories = channel.categories || [];
                    });
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
                    // Preservar categories
                    videos.forEach(v => {
                        const original = batch.find(b => b.id === v.id);
                        if (original) {
                            v.categories = original.categories || [];
                        }
                    });
                    allDetailedVideos = allDetailedVideos.concat(videos);
                }
            }

            // Ordenar per data de publicació (nou a vell)
            allDetailedVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            // Intercalar vídeos per evitar repeticions
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
    intercalateVideos(videos) {
        if (videos.length <= 1) return videos;

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
            return videos;
        }

        const result = [];

    // FASE 1: Intercalar els primers N vídeos de cada canal
    const initialVideos = {};
    const INITIAL_COUNT = Math.min(5, this.INITIAL_VIDEOS_PER_CHANNEL);
    channelIds.forEach(channelId => {
      initialVideos[channelId] = videosByChannel[channelId].splice(0, INITIAL_COUNT);
    });

        let hasMore = true;
        while (hasMore) {
            hasMore = false;
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

        // FASE 2: Afegir la resta de vídeos
        const remainingTotal = channelIds.reduce((sum, id) => sum + videosByChannel[id].length, 0);
        if (remainingTotal === 0) return result;

        const channelWeights = {};
        channelIds.forEach(channelId => {
            const count = videosByChannel[channelId].length;
            channelWeights[channelId] = count > 0 ? remainingTotal / count : 0;
        });

        let lastChannelId = result.length > 0 ? result[result.length - 1].channelId : null;

        while (channelIds.some(id => videosByChannel[id].length > 0)) {
            let bestChannel = null;
            let bestScore = -Infinity;

            for (const channelId of channelIds) {
                if (videosByChannel[channelId].length === 0) continue;

                if (channelId === lastChannelId && channelIds.filter(id => videosByChannel[id].length > 0).length > 1) {
                    continue;
                }

                const weight = channelWeights[channelId];
                const nextVideo = videosByChannel[channelId][0];
                const recency = new Date(nextVideo.publishedAt).getTime();
                const score = weight * 1000 + recency / 1000000000000;

                if (score > bestScore) {
                    bestScore = score;
                    bestChannel = channelId;
                }
            }

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
        const channelInfo = await this.getChannelDetails(channelId);
        if (channelInfo.channel) {
            const newChannel = {
                id: channelId,
                name: channelInfo.channel.title,
                categories: ['usuari'],
                addedBy: 'user'
            };
            if (!this.userChannels.find(c => c.id === channelId) &&
                !this.catalanChannels.find(c => c.id === channelId)) {
                this.userChannels.push(newChannel);
                this.saveUserChannels();
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
        localStorage.removeItem('iutube_cache_catalan_videos');
    },

    // Obtenir tots els canals (feed.json com a font única)
    getAllChannels() {
        if (this.feedLoaded && this.feedChannels.length > 0) {
            return this.feedChannels;
        }
        return [];
    },

    // Obtenir vídeos per categoria (suporta múltiples categories per canal)
    getVideosByCategories(videos, categoryId) {
        const normalizedCategory = categoryId.toLowerCase();
        return videos.filter(video => {
            const categories = video.categories || [];
            return categories.some(cat => cat.toLowerCase() === normalizedCategory);
        });
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
            if (channelIds.includes(video.channelId)) return true;
            if (this.containsCatalanKeywords(video.title) ||
                this.containsCatalanKeywords(video.description)) return true;
            return false;
        });
    },

    // Obtenir data de fa X setmanes
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

            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'Error desconegut';
            const errorReason = errorData.error?.errors?.[0]?.reason || '';

            console.error('iuTube: Error API:', errorMessage, errorReason);

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
                const errorData = await response.json().catch(() => ({}));
                const errorReason = errorData.error?.errors?.[0]?.reason || '';

                if (response.status === 403) {
                    if (errorReason === 'quotaExceeded') {
                        return { items: [], error: 'Quota excedida. L\'API de cerca consumeix molta quota. Espera fins demà.' };
                    }
                    return { items: [], error: 'La cerca no està permesa amb la teva clau API.' };
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

    // Obtenir vídeos populars (prioritza feed, després API)
    async getPopularVideos(maxResults = 12) {
    // PRIORITAT 1: Usar vídeos del feed si estan disponibles
    if (this.feedLoaded && this.feedVideos.length > 0) {
        console.log(`iuTube: Mostrant ${this.feedVideos.length} vídeos des de ${FEED_URL}`);
        
        // Transformar al format esperat
        const videos = this.feedVideos.map(v => ({
            id: v.id,
            title: v.title,
            thumbnail: v.thumbnail,
            channelId: v.channelId || null,
            channelTitle: v.channelTitle,
            publishedAt: v.publishedAt,
            duration: v.duration ? this.parseDuration(v.duration) : null,
            durationSeconds: v.durationSeconds || this.parseDurationSeconds(v.duration) || 0,
            isShort: v.isShort || false,
            viewCount: v.viewCount || 0,
            likeCount: v.likeCount || 0,
            commentCount: v.commentCount || 0,
            categories: v.categories || []
        }));
        
    return { items: videos, error: null, fromFeed: true };
    }

    // PRIORITAT 2: Si hi ha API key, obtenir vídeos frescos
    const apiKey = this.getApiKey();
    if (apiKey) {
        console.log('iuTube: Obtenint vídeos catalans via API...');
        const result = await this.getVideosFromCatalanChannelsEfficient(maxResults);
        if (result.items && result.items.length > 0) {
            return result;
        }
    }

    // FALLBACK: Retornar error si no hi ha res
    return { items: [], error: `No hi ha vídeos disponibles. Comprova ${FEED_URL} o configura una API key.` };
},

    // Obtenir vídeos per categoria
    async getVideosByCategory(categoryId, maxResults = 12) {
        const apiKey = this.getApiKey();
        if (!apiKey) return { items: [], error: 'No API key' };

        // Primer, obtenir vídeos del cache i filtrar per categoria
        const cached = this.getFromCache('catalan_videos');
        if (cached) {
            const filtered = this.getVideosByCategories(cached, categoryId);
            if (filtered.length > 0) {
                console.log(`iuTube: ${filtered.length} vídeos trobats per categoria "${categoryId}" (cache)`);
                return { items: filtered.slice(0, maxResults), error: null };
            }
        }

        // Si no hi ha cache, carregar tots els vídeos i filtrar
        const result = await this.getVideosFromCatalanChannelsEfficient(100);
        if (result.items && result.items.length > 0) {
            const filtered = this.getVideosByCategories(result.items, categoryId);
            if (filtered.length > 0) {
                console.log(`iuTube: ${filtered.length} vídeos trobats per categoria "${categoryId}"`);
                return { items: filtered.slice(0, maxResults), error: null };
            }
        }

        return { items: [], error: 'No s\'han trobat vídeos per aquesta categoria' };
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
            let resolvedId = channelId;
            if (channelId && channelId.startsWith('@')) {
                resolvedId = await this.resolveChannelId(channelId);
                if (!resolvedId) {
                    return { channel: null, error: 'No s\'ha pogut resoldre el handle' };
                }
            }

            const response = await fetch(
                `${this.BASE_URL}/channels?part=snippet,statistics&id=${resolvedId}&key=${apiKey}`
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

    // Obtenir vídeos relacionats
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
            thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            categories: []
        }));
    },

    // Transformar resultats de vídeos amb estadístiques
    transformVideoResults(items) {
        if (!items) return [];
        return items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: this.parseDuration(item.contentDetails?.duration),
            isShort: this.isShortVideo(item.contentDetails?.duration),
            viewCount: parseInt(item.statistics?.viewCount || 0),
            likeCount: parseInt(item.statistics?.likeCount || 0),
            commentCount: parseInt(item.statistics?.commentCount || 0),
            categories: []
        }));
    },

    // Transformar detalls d'un vídeo
    transformVideoDetails(item) {
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.standard?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            duration: this.parseDuration(item.contentDetails?.duration),
            isShort: this.isShortVideo(item.contentDetails?.duration),
            viewCount: parseInt(item.statistics?.viewCount || 0),
            likeCount: parseInt(item.statistics?.likeCount || 0),
            commentCount: parseInt(item.statistics?.commentCount || 0),
            tags: item.snippet.tags || [],
            categories: []
        };
    },

    // Transformar detalls del canal
    transformChannelDetails(item) {
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
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

    // Comprovar si un vídeo és Short (<= 120 segons)
    isShortVideo(isoDuration) {
        const seconds = this.parseDurationSeconds(isoDuration);
        if (seconds === null) return false;
        return seconds <= 120;
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
