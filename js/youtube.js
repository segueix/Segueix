// Servei YouTube Data API v3
// Mode escalable: els usuaris NO criden l'API per "popular". Consumeixen data/feed.json generat per GitHub Actions.

const YouTubeAPI = {
  BASE_URL: "https://www.googleapis.com/youtube/v3",

  // Font de canals
  CHANNELS_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv",

  // Feed cuinat (actualitzat 4 cops/dia per GitHub Actions)
  FEED_URL: "data/feed.json",

  // Configuració de llengua
  language: "ca",
  regionCode: "ES",

  // Cache general (vídeos, etc.)
  CACHE_DURATION: 2 * 60 * 60 * 1000,

  // Cache del feed (recomanat: 6 hores)
  FEED_CACHE_DURATION: 6 * 60 * 60 * 1000,

  // Canals carregats (del feed)
  catalanChannels: [],
  userChannels: [],

  // Paraules clau per detectar contingut català
  catalanKeywords: [
    "català",
    "catalana",
    "catalans",
    "catalanes",
    "catalunya",
    "catalonia",
    "barcelona",
    "girona",
    "tarragona",
    "lleida",
    "en català",
    "parlem",
    "benvinguts",
    "benvingudes",
    "avui",
    "d'avui",
    "som-hi",
    "endavant",
    "entrevista",
    "notícies",
    "informatiu"
  ],

  // Inicialitzar
  async init() {
    this.loadUserChannels();
    await this.loadFeed();

    console.log(`iuTube: canals feed: ${this.catalanChannels.length}`);
    console.log(`iuTube: cache videos: ${this.CACHE_DURATION / 1000 / 60} minuts`);
  },

  // Cache simple amb TTL configurable
  getFromCacheWithTTL(key, ttlMs) {
    try {
      const cached = localStorage.getItem(`iutube_cache_${key}`);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > ttlMs) {
        localStorage.removeItem(`iutube_cache_${key}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  saveToCacheWithTTL(key, data) {
    try {
      localStorage.setItem(
        `iutube_cache_${key}`,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch (e) {
      console.warn("iuTube: No s'ha pogut guardar al cache:", e);
    }
  },

  // Carrega feed.json (i canals + vídeos)
  async loadFeed() {
    try {
      const cached = this.getFromCacheWithTTL("feed_json", this.FEED_CACHE_DURATION);
      if (cached && cached.videos && cached.channels) {
        this._applyFeed(cached);
        console.log("iuTube: feed carregat del cache");
        return;
      }

      const url = this.FEED_URL + "?t=" + Date.now();
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error carregant feed: ${res.status}`);

      const feed = await res.json();
      this.saveToCacheWithTTL("feed_json", feed);
      this._applyFeed(feed);

      console.log(`iuTube: feed carregat: ${feed.videosCount || 0} vídeos`);
    } catch (e) {
      console.error("iuTube: no s'ha pogut carregar feed.json:", e);
      // Sense feed, l'app pot quedar buida en "popular"
      this.catalanChannels = [];
    }
  },

  _applyFeed(feed) {
    this.catalanChannels = Array.isArray(feed.channels) ? feed.channels : [];
    this._feedVideos = Array.isArray(feed.videos) ? feed.videos : [];
  },

  // Canals usuari
  loadUserChannels() {
    const stored = localStorage.getItem("user_catalan_channels");
    this.userChannels = stored ? JSON.parse(stored) : [];
  },

  saveUserChannels() {
    localStorage.setItem("user_catalan_channels", JSON.stringify(this.userChannels));
  },

  // Manté aquesta funció per si vols afegir canals manualment (sense API)
  // Si vols validar canal, cal backend o API key de l'usuari.
  async addUserChannel(channelId) {
    const newChannel = {
      id: channelId,
      name: channelId,
      categories: ["usuari"],
      handle: "",
      thumbnail: "",
      addedBy: "user"
    };

    if (!this.userChannels.find((c) => c.id === channelId)) {
      this.userChannels.push(newChannel);
      this.saveUserChannels();
      localStorage.removeItem("iutube_cache_catalan_videos");
      return { success: true, channel: newChannel };
    }
    return { success: false, error: "El canal ja existeix" };
  },

  removeUserChannel(channelId) {
    this.userChannels = this.userChannels.filter((c) => c.id !== channelId);
    this.saveUserChannels();
    localStorage.removeItem("iutube_cache_catalan_videos");
  },

  getAllChannels() {
    return [...this.catalanChannels, ...this.userChannels];
  },

  // Cache general per vídeos (2h)
  getFromCache(key) {
    return this.getFromCacheWithTTL(key, this.CACHE_DURATION);
  },

  saveToCache(key, data) {
    this.saveToCacheWithTTL(key, data);
  },

  // Popular: retorna vídeos del feed (0 quota)
  async getPopularVideos(maxResults = 12) {
    // Cache de vídeos (2h) sobre el feed ja carregat
    const cached = this.getFromCache("catalan_videos");
    if (cached) return { items: cached.slice(0, maxResults), error: null, fromCache: true };

    const vids = Array.isArray(this._feedVideos) ? this._feedVideos : [];
    if (!vids.length) return { items: [], error: "No hi ha feed disponible", fromCache: false };

    this.saveToCache("catalan_videos", vids);
    return { items: vids.slice(0, maxResults), error: null, fromCache: false };
  },

  // Cerca: desactivada per defecte (escala malament amb 10.000 usuaris)
  // Si vols, podem fer-la via Worker/Backend.
  async searchVideos(query, maxResults = 12) {
    return { items: [], error: "Cerca desactivada en mode públic (quota).", disabled: true };
  },

  // Helpers de filtre (si els fas servir en UI)
  containsCatalanKeywords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.catalanKeywords.some((k) => lowerText.includes(k.toLowerCase()));
  },

  transformVideoResults(items) {
    if (!items) return [];
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      channelId: item.channelId,
      channelTitle: item.channelTitle,
      publishedAt: item.publishedAt,
      duration: item.duration,
      viewCount: Number(item.viewCount || 0),
      likeCount: Number(item.likeCount || 0),
      commentCount: Number(item.commentCount || 0)
    }));
  }
};
