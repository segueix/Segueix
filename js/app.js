// App Principal

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading, mainContent;
let historyPage, historyGrid, historyFilters, chipsBar;
let heroSection, heroTitle, heroDescription, heroImage, heroDuration, heroButton, heroEyebrow, heroChannel;
let pageTitle;
let backgroundModal, backgroundBtn, backgroundOptions;
let videoPlayer, videoPlaceholder, placeholderImage;
let currentVideoId = null;
let useYouTubeAPI = false;
let selectedCategory = 'Tot';
let historySelectedCategory = 'Tot';
let historyFilterLiked = false;
let currentFeedVideos = [];
let currentFeedData = null;
let currentFeedRenderer = null;

const BACKGROUND_STORAGE_KEY = 'catube_background_color';
const BACKGROUND_COLORS = [
    '#333333',
    '#3d3d3d',
    '#224262',
    '#33533d',
    '#5a3f29',
    '#513359'
];

const HISTORY_STORAGE_KEY = 'catube_history';
const HISTORY_LIMIT = 50;

// Cache de canals carregats de l'API
let cachedChannels = {};

// Cache de vídeos carregats de l'API
let cachedAPIVideos = [];

function mergeChannelCategories(channel, categories) {
    if (!channel || !Array.isArray(categories) || categories.length === 0) {
        return;
    }
    channel.categories = [...new Set([...(channel.categories || []), ...categories])];
}

// Inicialitzar l'aplicació
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    initEventListeners();
    initBackgroundModal();
    initBackgroundPicker();
    loadCategories();

    // Inicialitzar YouTubeAPI (carregar canals catalans)
    await YouTubeAPI.init();

    // Carregar vídeos (prioritza feed)
    if (YouTubeAPI.feedLoaded && YouTubeAPI.feedVideos.length > 0) {
        useYouTubeAPI = true;
        loadVideosFromAPI();
    } else {
        useYouTubeAPI = false;
        loadVideos();
    }

    // Carregar vídeo des de URL si hi ha paràmetre ?v=
    const urlParams = new URLSearchParams(window.location.search);
    const videoParam = urlParams.get('v');
    if (videoParam) {
        setTimeout(() => {
            if (useYouTubeAPI) {
                showVideoFromAPI(videoParam);
            } else {
                showVideo(videoParam);
            }
        }, 100);
    }

    // Inicialitzar icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// Inicialitzar elements del DOM
function initElements() {
    sidebar = document.getElementById('sidebar');
    menuBtn = document.getElementById('menuBtn');
    mainContent = document.getElementById('mainContent');
    videosGrid = document.getElementById('videosGrid');
    homePage = document.getElementById('homePage');
    watchPage = document.getElementById('watchPage');
    historyPage = document.getElementById('historyPage');
    historyGrid = document.getElementById('historyGrid');
    historyFilters = document.getElementById('historyFilters');
    chipsBar = document.querySelector('.chips-bar');
    loading = document.getElementById('loading');
    backgroundModal = document.getElementById('backgroundModal');
    backgroundBtn = document.getElementById('backgroundBtn');
    backgroundOptions = document.getElementById('backgroundOptions');
    heroSection = document.getElementById('heroSection');
    heroTitle = document.getElementById('heroTitle');
    heroDescription = document.getElementById('heroDescription');
    heroImage = document.getElementById('heroImage');
    heroDuration = document.getElementById('heroDuration');
    heroButton = document.getElementById('heroButton');
    heroEyebrow = document.getElementById('heroEyebrow');
    heroChannel = document.getElementById('heroChannel');
    pageTitle = document.getElementById('pageTitle');
    videoPlayer = document.getElementById('videoPlayer');
    videoPlaceholder = document.getElementById('videoPlaceholder');
    placeholderImage = document.getElementById('placeholderImage');
}

// Inicialitzar event listeners
function initEventListeners() {
    // Toggle sidebar (expandir/minimitzar)
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            // En mòbil, mostrar/amagar sidebar
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('open');
            } else {
                // En desktop, expandir/minimitzar
                sidebar.classList.toggle('collapsed');
                document.body.classList.toggle('sidebar-collapsed');
            }
        });
    }

    // Navegació
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const page = item.dataset.page;
            if (page === 'home') {
                historyFilterLiked = false;
                showHome();
                if (useYouTubeAPI) {
                    loadVideosFromAPI();
                } else {
                    loadVideos();
                }
            } else if (page === 'trending') {
                showHome();
                if (useYouTubeAPI) {
                    loadTrendingVideos();
                }
            } else if (page === 'history') {
                showHistory();
            }
        });
    });

    const navTriggers = document.querySelectorAll('.nav-trigger');
    navTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const page = trigger.dataset.page;
            navItems.forEach(nav => nav.classList.remove('active'));
            const matchingNav = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (matchingNav) {
                matchingNav.classList.add('active');
            }

            if (page === 'history') {
                showHistory();
            } else if (page === 'home') {
                showHome();
                if (useYouTubeAPI) {
                    loadVideosFromAPI();
                } else {
                    loadVideos();
                }
            } else if (page === 'trending') {
                showHome();
                if (useYouTubeAPI) {
                    loadTrendingVideos();
                }
            } else {
                showHome();
            }
        });
    });

    const brandLink = document.querySelector('.brand');
    if (brandLink) {
        brandLink.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            const homeNav = document.querySelector('.nav-item[data-page="home"]');
            if (homeNav) {
                homeNav.classList.add('active');
            }
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            if (!isMiniPlayerActive()) {
                stopVideoPlayback();
            }
            showHome();
            if (useYouTubeAPI) {
                loadVideosFromAPI();
            } else {
                loadVideos();
            }
        });
    }

    // Cerca
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = document.getElementById('searchInput').value.trim();
            if (query && useYouTubeAPI) {
                await searchVideos(query);
            }
        });
    }

    // Botó color de fons
    if (backgroundBtn) {
        backgroundBtn.addEventListener('click', openBackgroundModal);
    }

    if (heroButton) {
        heroButton.addEventListener('click', () => {
            const videoId = heroSection?.dataset.videoId;
            const source = heroSection?.dataset.source;
            if (!videoId) return;
            if (source === 'api') {
                showVideoFromAPI(videoId);
            } else {
                showVideo(videoId);
            }
        });
    }

    // Tancar sidebar en mòbil quan es clica fora
    if (historyFilters) {
        historyFilters.addEventListener('click', (event) => {
            const chip = event.target.closest('.chip');
            if (!chip) return;
            event.stopPropagation();
            const historyCategory = chip.dataset.historyCat;
            if (chip.dataset.historyFilter === 'liked') {
                historyFilterLiked = !historyFilterLiked;
            } else if (historyCategory) {
                historySelectedCategory = historyCategory;
            }
            updateHistoryFilterUI();
            renderHistory();
        });
    }

    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip && !chip.closest('#historyPage')) {
            selectedCategory = chip.dataset.cat || 'Tot';
            document.querySelectorAll('.chip').forEach((item) => item.classList.remove('is-active'));
            chip.classList.add('is-active');
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            if (!isMiniPlayerActive()) {
                stopVideoPlayback();
            }
            showHome();
            setPageTitle(getCategoryPageTitle(selectedCategory));
            renderFeed();
            return;
        }

        if (window.innerWidth <= 768 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    window.addEventListener('resize', () => {
        if (isMiniPlayerActive()) {
            updateMiniPlayerSize();
            return;
        }
        updatePlayerPosition();
    });
    window.addEventListener('scroll', () => {
        if (!isMiniPlayerActive()) {
            updatePlayerPosition();
        }
    });
}

// Inicialitzar modal de colors
function initBackgroundModal() {
    const closeModal = document.getElementById('closeBackgroundModal');

    if (!backgroundModal || !closeModal || !backgroundOptions) {
        console.warn('⚠️  Modal de color de fons no disponible');
        return;
    }

    closeModal.addEventListener('click', closeBackgroundModal);
    backgroundModal.addEventListener('click', (e) => {
        if (e.target === backgroundModal) closeBackgroundModal();
    });

    const buttons = backgroundOptions.querySelectorAll('[data-color]');
    buttons.forEach(button => {
        const color = button.dataset.color;
        button.style.backgroundColor = color;
        button.addEventListener('click', () => applyBackgroundColor(color));
    });
}

function initBackgroundPicker() {
    const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    const initial = BACKGROUND_COLORS.includes(stored) ? stored : BACKGROUND_COLORS[0];
    applyBackgroundColor(initial, false);
}

function applyBackgroundColor(color, persist = true) {
    if (!BACKGROUND_COLORS.includes(color)) {
        return;
    }
    document.documentElement.style.setProperty('--color-background', color);
    if (persist) {
        localStorage.setItem(BACKGROUND_STORAGE_KEY, color);
    }
    if (backgroundOptions) {
        backgroundOptions.querySelectorAll('[data-color]').forEach(button => {
            const isActive = button.dataset.color === color;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
}

function openBackgroundModal() {
    if (!backgroundModal) return;
    backgroundModal.classList.add('active');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeBackgroundModal() {
    if (!backgroundModal) return;
    backgroundModal.classList.remove('active');
}

// Mostrar/amagar loading
function showLoading() {
    loading.classList.add('active');
}

function hideLoading() {
    loading.classList.remove('active');
}

function setPageTitle(title) {
    if (pageTitle) {
        pageTitle.textContent = title;
    }
}

function getCategoryPageTitle(category) {
    if (!category || category === 'Tot') {
        return 'Recomanat per a tu';
    }
    return category;
}

function getNewestVideoFromList(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return null;

    return videos.reduce((latest, video) => {
        const dateValue = video.publishedAt || video.uploadDate || video.snippet?.publishedAt;
        const videoDate = dateValue ? new Date(dateValue) : null;
        if (!videoDate || Number.isNaN(videoDate.getTime())) return latest;
        if (!latest || videoDate > latest.date) {
            return { video, date: videoDate };
        }
        return latest;
    }, null);
}

function updateHero(video, source = 'static') {
    if (!heroSection || !video) {
        if (heroSection) {
            heroSection.classList.add('hidden');
        }
        return;
    }

    const title = video.title || video.snippet?.title || 'Vídeo destacat';
    const description = video.description || video.snippet?.description || '';
    const thumbnail = video.thumbnail || video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.standard?.url || video.snippet?.thumbnails?.high?.url || '';
    const duration = video.duration || video.contentDetails?.duration || '';

    heroSection.classList.remove('hidden');
    heroSection.dataset.videoId = video.id;
    heroSection.dataset.source = source;
    heroTitle.textContent = title;
    heroDescription.textContent = description ? description.substring(0, 140) + (description.length > 140 ? '...' : '') : '';
    heroImage.src = thumbnail;
    heroImage.alt = title;
    if (duration) {
        heroDuration.textContent = duration;
        heroDuration.classList.remove('hidden');
    } else {
        heroDuration.textContent = '';
        heroDuration.classList.add('hidden');
    }

    if (heroEyebrow) {
        heroEyebrow.textContent = source === 'api' ? 'Destacat del moment' : 'Destacat de la setmana';
    }

    if (heroChannel) {
        const channelName = video.channelTitle
            || (typeof getChannelById === 'function' ? getChannelById(video.channelId)?.name : '')
            || '';
        heroChannel.textContent = channelName;
        heroChannel.classList.toggle('hidden', !channelName);
    }
}

function filterVideosByCategory(videos, feed) {
    if (selectedCategory === 'Tot') return videos;
    if (!feed || !Array.isArray(feed.channels)) return videos;

    const map = new Map();
    feed.channels.forEach((channel) => {
        const cats = Array.isArray(channel.categories) ? channel.categories : [];
        map.set(channel.id, cats.map(cat => String(cat).toLowerCase()));
    });

    const wanted = selectedCategory.toLowerCase();
    return videos.filter((video) => {
        const cats = map.get(video.channelId) || [];
        return cats.includes(wanted);
    });
}

function getFeedDataForFilter() {
    if (Array.isArray(YouTubeAPI?.feedChannels) && YouTubeAPI.feedChannels.length > 0) {
        return { channels: YouTubeAPI.feedChannels };
    }

    const cached = Object.values(cachedChannels || {});
    if (cached.length > 0) {
        return { channels: cached };
    }

    return null;
}

function setFeedContext(videos, feedData, renderer) {
    currentFeedVideos = Array.isArray(videos) ? videos : [];
    currentFeedData = feedData;
    currentFeedRenderer = renderer;
    renderFeed();
}

function renderFeed() {
    if (!currentFeedRenderer) return;
    const filtered = filterVideosByCategory(currentFeedVideos, currentFeedData);

    if (selectedCategory !== 'Tot' && filtered.length === 0) {
        updateHero(null);
        if (videosGrid) {
            videosGrid.innerHTML = `
                <div class="empty-state">No hi ha vídeos per aquesta categoria.</div>
            `;
        }
        return;
    }

    currentFeedRenderer(filtered);
}

// Carregar categories
function loadCategories() {
    if (!CONFIG.features.categories) return;

    const categoriesList = document.getElementById('categoriesList');
    categoriesList.innerHTML = CONFIG.categories.map(cat => `
        <a href="#" class="category-item" data-category="${cat.id}">
            <i data-lucide="${cat.icon}"></i>
            <span>${cat.name}</span>
        </a>
    `).join('');

    // Event listeners per categories
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            // Treure classe active de tots els nav items i categories
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.category-item').forEach(cat => cat.classList.remove('active'));
            item.classList.add('active');

            const categoryId = item.dataset.category;
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            showHome();
            if (useYouTubeAPI) {
                const category = CONFIG.categories.find(c => c.id === categoryId);
                selectedCategory = category ? category.name : 'Tot';
                setPageTitle(category ? category.name : 'Categoria');
                renderFeed();
            } else {
                loadVideosByCategoryStatic(categoryId);
            }
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==================== CARREGAR VÍDEOS AMB API ====================

// Carregar vídeos populars des de l'API
async function loadVideosFromAPI() {
    showLoading();
    setPageTitle('Recomanat per a tu');

    const result = await YouTubeAPI.getPopularVideos(CONFIG.layout.videosPerPage);

    if (result.error) {
        console.error('Error:', result.error);
        hideLoading();
        loadVideos(); // Fallback a dades estàtiques
        return;
    }

    // ✅ AFEGIR VÍDEOS A LA CACHE
    result.items.forEach(video => {
        if (!cachedAPIVideos.find(v => v.id === video.id)) {
            cachedAPIVideos.push(video);
        }
        if (video.channelId) {
            if (!cachedChannels[video.channelId]) {
                cachedChannels[video.channelId] = {
                    id: video.channelId,
                    name: video.channelTitle,
                    thumbnail: video.channelThumbnail || null,
                    categories: []
                };
            }
            mergeChannelCategories(cachedChannels[video.channelId], video.categories);
        }
    });

    setFeedContext(result.items, getFeedDataForFilter(), renderVideos);
    hideLoading();
}

// Carregar vídeos en tendència
async function loadTrendingVideos() {
    showLoading();
    setPageTitle('Tendències');

    const result = await YouTubeAPI.getPopularVideos(24);

    if (result.error) {
        hideLoading();
        return;
    }

    setFeedContext(result.items, getFeedDataForFilter(), renderVideos);
    hideLoading();
}

// Cercar vídeos
async function searchVideos(query) {
    showLoading();
    setPageTitle(`Resultats per: "${query}"`);
    showHome();

    const result = await YouTubeAPI.searchVideos(query, CONFIG.layout.videosPerPage);

    if (result.error) {
        hideLoading();
        updateHero(null);
        // Mostrar missatge d'error
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="alert-circle"></i>
                <p>${result.error}</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }

    if (result.items.length === 0) {
        updateHero(null);
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="video-off"></i>
                <p>No s'han trobat vídeos per aquesta cerca.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        hideLoading();
        return;
    }

    // Per cerques, obtenim més detalls dels vídeos
    const videoIds = result.items.map(v => v.id).join(',');
    const detailsResult = await fetchVideoDetails(videoIds);

    if (detailsResult.length > 0) {
        renderVideos(detailsResult);
    } else {
        renderSearchResults(result.items);
    }

    hideLoading();
}

// Obtenir detalls de múltiples vídeos
async function fetchVideoDetails(videoIds) {
    const apiKey = YouTubeAPI.getApiKey();
    if (!apiKey) return [];

    try {
        const response = await fetch(
            `${YouTubeAPI.BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
        );
        if (!response.ok) return [];

        const data = await response.json();
        return YouTubeAPI.transformVideoResults(data.items);
    } catch (error) {
        return [];
    }
}

// Renderitzar vídeos de l'API
function renderVideos(videos) {
    // Guardar vídeos i canals a la cache
    videos.forEach(video => {
        if (!cachedAPIVideos.find(v => v.id === video.id)) {
            cachedAPIVideos.push(video);
        }
        // Guardar informació del canal
        if (video.channelId) {
            if (!cachedChannels[video.channelId]) {
                cachedChannels[video.channelId] = {
                    id: video.channelId,
                    name: video.channelTitle,
                    thumbnail: video.channelThumbnail || null,
                    categories: []
                };
            }
            mergeChannelCategories(cachedChannels[video.channelId], video.categories);
        }
    });

    const newest = getNewestVideoFromList(videos);
    updateHero(newest?.video, 'api');

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const shorts = videos.filter(video => video.isShort);
    const normal = videos.filter(video => !video.isShort);

    const shortsSection = isMobile && shorts.length > 0 ? `
        <div class="shorts-section">
            <h2 class="shorts-title">Shorts</h2>
            <div class="shorts-row">
                ${shorts.map(video => createShortCard(video)).join('')}
            </div>
        </div>
    ` : '';

    const normalVideos = isMobile ? normal : normal;

    videosGrid.innerHTML = `
        ${shortsSection}
        ${normalVideos.map(video => createVideoCardAPI(video)).join('')}
    `;

    // Event listeners
    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            showVideoFromAPI(videoId);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function createShortCard(video) {
    return `
        <button class="short-card" type="button" data-video-id="${video.id}" onclick="openShortModal('${video.id}')">
            <img class="short-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
            <div class="short-meta">
                <div class="short-title">${escapeHtml(video.title)}</div>
                <div class="short-channel">${escapeHtml(video.channelTitle)}</div>
            </div>
        </button>
    `;
}

function openShortModal(videoId) {
    const modal = document.getElementById('short-modal');
    const iframe = document.getElementById('short-iframe');
    const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1&autoplay=1&hl=ca&cc_lang_pref=ca&gl=AD`;

    iframe.src = src;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function closeShortModal() {
    const modal = document.getElementById('short-modal');
    const iframe = document.getElementById('short-iframe');

    iframe.src = '';
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
}

function getLikedVideoIds() {
    const stored = localStorage.getItem('user_liked_videos');
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir user_liked_videos', error);
        return [];
    }
}

function setLikedVideoIds(ids) {
    localStorage.setItem('user_liked_videos', JSON.stringify(ids));
}

const HEART_TOGGLE_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
        <path d="M128 224s-96-54-96-118c0-36 28-58 56-58 24 0 40 18 40 18s16-18 40-18c28 0 56 22 56 58 0 64-96 118-96 118z"></path>
    </svg>
`;

function setupLikeBadge(videoId) {
    const likeBadge = document.getElementById('likeToggle');
    if (!likeBadge) {
        return;
    }

    const normalizedId = String(videoId);

    likeBadge.setAttribute('role', 'button');
    likeBadge.dataset.videoId = normalizedId;

    const likedIds = getLikedVideoIds();
    const isLiked = likedIds.includes(normalizedId);
    likeBadge.classList.toggle('liked', isLiked);
    likeBadge.setAttribute('aria-pressed', isLiked ? 'true' : 'false');

    if (likeBadge._likeHandler) {
        likeBadge.removeEventListener('click', likeBadge._likeHandler);
        likeBadge.removeEventListener('keydown', likeBadge._likeHandler);
    }

    likeBadge._likeHandler = (event) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        if (event.type === 'keydown') {
            event.preventDefault();
        }

        const ids = getLikedVideoIds();
        const wasLiked = ids.includes(normalizedId);
        const nextIds = wasLiked
            ? ids.filter(id => id !== normalizedId)
            : [...ids, normalizedId];
        setLikedVideoIds(nextIds);

        const isNowLiked = !wasLiked;
        likeBadge.classList.toggle('liked', isNowLiked);
        likeBadge.setAttribute('aria-pressed', isNowLiked ? 'true' : 'false');

    };

    likeBadge.addEventListener('click', likeBadge._likeHandler);
    likeBadge.addEventListener('keydown', likeBadge._likeHandler);
}

function isMiniPlayerActive() {
    return videoPlayer?.classList.contains('mini-player-active');
}

function setPlaceholderImage(thumbnail, title = '') {
    if (!placeholderImage) {
        return;
    }
    placeholderImage.src = thumbnail || '';
    placeholderImage.alt = title || '';
}

function updatePlayerPosition() {
    if (!videoPlayer || !videoPlaceholder) {
        return;
    }
    if (isMiniPlayerActive()) {
        return;
    }
    if (videoPlaceholder.classList.contains('hidden')) {
        return;
    }

    const rect = videoPlaceholder.getBoundingClientRect();
    videoPlayer.style.top = `${rect.top + window.scrollY}px`;
    videoPlayer.style.left = `${rect.left + window.scrollX}px`;
    videoPlayer.style.width = `${rect.width}px`;
    videoPlayer.style.height = `${rect.height}px`;
}

function updateMiniPlayerSize() {
    if (!videoPlayer) {
        return;
    }
    const width = Math.min(360, window.innerWidth - 32);
    const height = Math.round((width * 9) / 16);
    videoPlayer.style.width = `${width}px`;
    videoPlayer.style.height = `${height}px`;
}

function clearPlayOverlay() {
    if (!videoPlaceholder) {
        return;
    }
    const overlay = videoPlaceholder.querySelector('.play-overlay');
    if (overlay) {
        overlay.remove();
    }
    videoPlaceholder.onclick = null;
}

function ensurePlayOverlay(onPlay) {
    if (!videoPlaceholder) {
        return;
    }
    let overlay = videoPlaceholder.querySelector('.play-overlay');
    if (!overlay) {
        overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.className = 'play-overlay';
        overlay.setAttribute('aria-label', 'Reproduir vídeo');
        overlay.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5v14l11-7z"></path>
            </svg>
        `;
        videoPlaceholder.appendChild(overlay);
    }

    if (overlay._playHandler) {
        overlay.removeEventListener('click', overlay._playHandler);
    }

    overlay._playHandler = (event) => {
        event.stopPropagation();
        onPlay();
    };

    overlay.addEventListener('click', overlay._playHandler);
    videoPlaceholder.onclick = onPlay;
}

function queuePlayback({ videoId, source, videoUrl, thumbnail, title }) {
    if (!videoPlaceholder) {
        return;
    }
    videoPlaceholder.classList.remove('hidden');
    videoPlaceholder.classList.remove('is-placeholder-hidden');
    setPlaceholderImage(thumbnail, title);
    ensurePlayOverlay(() => loadNewVideoInMiniPlayer(
        videoId,
        source,
        videoUrl,
        thumbnail,
        title
    ));
}

function loadNewVideoInMiniPlayer(videoId, source, videoUrl, thumbnail, title) {
    if (!videoPlayer) {
        return;
    }
    updatePlayerIframe({ source, videoId, videoUrl });
    clearPlayOverlay();
    preparePlayerForPlayback({ thumbnail, title });
    setupMiniPlayerToggle();
}

function addAutoplayParam(url) {
    if (!url) {
        return url;
    }
    let newUrl = url;
    if (!newUrl.includes('playsinline=1')) {
        const separator = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${separator}playsinline=1`;
    }
    if (!newUrl.includes('autoplay=1')) {
        const separator = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${separator}autoplay=1`;
    }
    return newUrl;
}

function updatePlayerIframe({ source, videoId, videoUrl }) {
    if (!videoPlayer) {
        return;
    }
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.matchMedia('(max-width: 768px)').matches;
    if (videoId) {
        videoPlayer.dataset.playingVideoId = videoId;
    }
    const iframeSrc = source === 'api'
        ? `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&autoplay=1&hl=ca&cc_lang_pref=ca&gl=AD`
        : addAutoplayParam(videoUrl);
    const existingIframe = videoPlayer.querySelector('iframe');
    if (!isMobile && existingIframe) {
        existingIframe.src = iframeSrc;
        return;
    }
    videoPlayer.innerHTML = `
        <div class="drag-handle" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" aria-hidden="true" focusable="false">
                <polygon points="50,5 65,30 55,30 55,40 45,40 45,30 35,30" fill="white"/>
                <polygon points="50,95 35,70 45,70 45,60 55,60 55,70 65,70" fill="white"/>
                <polygon points="5,50 30,35 30,45 40,45 40,55 30,55 30,65" fill="white"/>
                <polygon points="95,50 70,65 70,55 60,55 60,45 70,45 70,35" fill="white"/>
                <circle cx="50" cy="50" r="8" fill="white"/>
            </svg>
        </div>
        <button class="expand-mini-player-btn" type="button" aria-label="Restaurar reproductor">
            <i data-lucide="maximize"></i>
        </button>
        <button class="close-mini-player-btn" type="button" aria-label="Tancar mini reproductor">
            <i data-lucide="x"></i>
        </button>
        <div class="video-embed-wrap">
            <iframe
                src="${iframeSrc}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
        </div>
    `;
    setupDragHandle();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function makeDraggable(element, handle) {
    if (!element || !handle) {
        return;
    }

    const startDrag = (clientX, clientY) => {
        const rect = element.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        element.style.setProperty('top', `${rect.top}px`, 'important');
        element.style.setProperty('left', `${rect.left}px`, 'important');
        element.style.setProperty('bottom', 'auto', 'important');
        element.style.setProperty('right', 'auto', 'important');

        const handleMove = (moveX, moveY) => {
            const width = rect.width;
            const height = rect.height;
            const maxLeft = Math.max(0, window.innerWidth - width);
            const maxTop = Math.max(0, window.innerHeight - height);
            const nextLeft = Math.min(Math.max(0, moveX - offsetX), maxLeft);
            const nextTop = Math.min(Math.max(0, moveY - offsetY), maxTop);
            element.style.setProperty('left', `${nextLeft}px`, 'important');
            element.style.setProperty('top', `${nextTop}px`, 'important');
        };

        const onMouseMove = (event) => {
            handleMove(event.clientX, event.clientY);
        };

        const onTouchMove = (event) => {
            if (!event.touches || event.touches.length === 0) {
                return;
            }
            handleMove(event.touches[0].clientX, event.touches[0].clientY);
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', stopDrag);
            document.removeEventListener('touchcancel', stopDrag);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', stopDrag);
        document.addEventListener('touchcancel', stopDrag);
    };

    const onMouseDown = (event) => {
        event.preventDefault();
        startDrag(event.clientX, event.clientY);
    };

    const onTouchStart = (event) => {
        if (!event.touches || event.touches.length === 0) {
            return;
        }
        event.preventDefault();
        startDrag(event.touches[0].clientX, event.touches[0].clientY);
    };

    if (handle._dragHandlers) {
        handle.removeEventListener('mousedown', handle._dragHandlers.onMouseDown);
        handle.removeEventListener('touchstart', handle._dragHandlers.onTouchStart);
    }

    handle._dragHandlers = { onMouseDown, onTouchStart };
    handle.addEventListener('mousedown', onMouseDown);
    handle.addEventListener('touchstart', onTouchStart, { passive: false });
}

function setupDragHandle() {
    const handle = videoPlayer?.querySelector('.drag-handle');
    if (!handle) {
        return;
    }
    makeDraggable(videoPlayer, handle);

    const closeButton = videoPlayer.querySelector('.close-mini-player-btn');
    const expandButton = videoPlayer.querySelector('.expand-mini-player-btn');
    if (!closeButton) {
        return;
    }

    const miniPlayerControls = [closeButton, expandButton].filter(Boolean);

    if (closeButton._closeHandlers) {
        closeButton.removeEventListener('click', closeButton._closeHandlers.onClose);
        closeButton.removeEventListener('mousedown', closeButton._closeHandlers.stopPropagation);
        closeButton.removeEventListener('touchstart', closeButton._closeHandlers.stopPropagation);
    }

    if (expandButton?._expandHandlers) {
        expandButton.removeEventListener('click', expandButton._expandHandlers.onExpand);
        expandButton.removeEventListener('mousedown', expandButton._expandHandlers.stopPropagation);
        expandButton.removeEventListener('touchstart', expandButton._expandHandlers.stopPropagation);
    }

    const stopPropagation = (event) => {
        event.stopPropagation();
    };

    const onClose = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isWatchPageVisible = watchPage && !watchPage.classList.contains('hidden');

        if (isWatchPageVisible) {
            if (videoPlayer) {
                videoPlayer.innerHTML = '';
                videoPlayer.style.display = 'none';
                videoPlayer.classList.remove('mini-player-active');
                videoPlayer.style.top = '';
                videoPlayer.style.left = '';
                videoPlayer.style.width = '';
                videoPlayer.style.height = '';
            }

            if (videoPlaceholder) {
                videoPlaceholder.classList.remove('hidden');
                videoPlaceholder.classList.remove('is-placeholder-hidden');
                ensurePlayOverlay(() => {
                    if (currentVideoId) {
                        if (useYouTubeAPI) {
                            showVideoFromAPI(currentVideoId);
                        } else {
                            showVideo(currentVideoId);
                        }
                    }
                });
            }
        } else {
            stopVideoPlayback();
        }
    };

    const onExpand = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const playingId = videoPlayer.dataset.playingVideoId;
        const currentPageId = currentVideoId;
        if (playingId && playingId !== currentPageId) {
            if (useYouTubeAPI) {
                showVideoFromAPI(playingId);
            } else {
                showVideo(playingId);
            }
        }
        setMiniPlayerState(false);
    };

    closeButton._closeHandlers = { onClose, stopPropagation };
    closeButton.addEventListener('click', onClose);
    closeButton.addEventListener('mousedown', stopPropagation);
    closeButton.addEventListener('touchstart', stopPropagation);

    if (expandButton) {
        expandButton._expandHandlers = { onExpand, stopPropagation };
        expandButton.addEventListener('click', onExpand);
        expandButton.addEventListener('mousedown', stopPropagation);
        expandButton.addEventListener('touchstart', stopPropagation);
    }

    miniPlayerControls.forEach(control => {
        control.addEventListener('pointerdown', stopPropagation);
    });
}

function preparePlayerForPlayback({ thumbnail, title }) {
    if (!videoPlayer) {
        return;
    }

    const miniActive = isMiniPlayerActive();

    if (!miniActive) {
        videoPlayer.classList.remove('mini-player-active');
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
    }
    videoPlayer.style.display = 'block';

    if (videoPlaceholder) {
        videoPlaceholder.classList.remove('hidden');
        if (miniActive) {
            videoPlaceholder.classList.remove('is-placeholder-hidden');
        } else {
            videoPlaceholder.classList.add('is-placeholder-hidden');
            clearPlayOverlay();
        }
    }

    setPlaceholderImage(thumbnail, title);
    setupDragHandle();
    if (miniActive) {
        updateMiniPlayerSize();
    } else {
        requestAnimationFrame(updatePlayerPosition);
    }
}

function handlePlayerVisibilityOnNavigation() {
    if (!videoPlayer) {
        return;
    }
    if (isMiniPlayerActive()) {
        videoPlayer.style.display = 'block';
        return;
    }
    stopVideoPlayback();
}

function updateMiniPlayerToggleIcon(isActive) {
    const miniToggle = document.getElementById('miniPlayerToggle');
    if (!miniToggle) {
        return;
    }
    miniToggle.disabled = isActive;
    miniToggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    miniToggle.setAttribute('aria-label', isActive ? 'Restaurar reproductor' : 'Mini reproductor');
    miniToggle.innerHTML = `<i data-lucide="minimize-2"></i>`;
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function setMiniPlayerState(isActive) {
    if (!videoPlayer) {
        return;
    }

    videoPlayer.classList.toggle('mini-player-active', isActive);

    if (isActive) {
        if (videoPlaceholder) {
            videoPlaceholder.classList.remove('hidden');
            videoPlaceholder.classList.remove('is-placeholder-hidden');
        }
        videoPlayer.style.removeProperty('top');
        videoPlayer.style.removeProperty('left');
        videoPlayer.style.removeProperty('bottom');
        videoPlayer.style.removeProperty('right');
        updateMiniPlayerSize();
    } else {
        if (mainContent) {
            mainContent.classList.remove('hidden');
        }
        if (historyPage) {
            historyPage.classList.add('hidden');
        }
        if (chipsBar) {
            chipsBar.classList.add('hidden');
        }
        homePage.classList.add('hidden');
        watchPage.classList.remove('hidden');
        if (videoPlaceholder) {
            videoPlaceholder.classList.add('is-placeholder-hidden');
        }
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
        updatePlayerPosition();
        if (videoPlaceholder) {
            requestAnimationFrame(() => {
                videoPlaceholder.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    updateMiniPlayerToggleIcon(isActive);
}

function setupMiniPlayerToggle() {
    const miniToggle = document.getElementById('miniPlayerToggle');

    if (!miniToggle || !videoPlayer) {
        return;
    }

    if (miniToggle._miniHandler) {
        miniToggle.removeEventListener('click', miniToggle._miniHandler);
    }

    miniToggle._miniHandler = () => {
        const isActive = isMiniPlayerActive();
        setMiniPlayerState(!isActive);
    };

    miniToggle.addEventListener('click', miniToggle._miniHandler);
    setMiniPlayerState(isMiniPlayerActive());
}

// Renderitzar resultats de cerca (sense estadístiques)
function renderSearchResults(videos) {
    const newest = getNewestVideoFromList(videos);
    updateHero(newest?.video, 'api');

    videosGrid.innerHTML = videos.map(video => `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                    <div class="video-metadata">
                        <div class="channel-name">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            <span>${formatDate(video.publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            showVideoFromAPI(videoId);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Crear targeta de vídeo (API)
function createVideoCardAPI(video) {
    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                    <div class="video-metadata">
                        <div class="channel-name">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(video.viewCount || 0)} visualitzacions</span>
                            <span>•</span>
                            <span>${formatDate(video.publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Mostrar vídeo des de l'API
async function showVideoFromAPI(videoId) {
    const isMini = videoPlayer?.classList.contains('mini-player-active');
    currentVideoId = videoId;
    showLoading();

    // Actualitzar URL
    history.pushState({ videoId }, '', `?v=${videoId}`);

    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    homePage.classList.add('hidden');
    watchPage.classList.remove('hidden');

    // 1. Renderitzat immediat des del catxé si està disponible
    const cachedVideo = cachedAPIVideos.find(video => video.id === videoId);
    if (isMini) {
        queuePlayback({
            videoId,
            source: 'api',
            thumbnail: cachedVideo?.thumbnail || '',
            title: cachedVideo?.title || ''
        });
    } else {
        updatePlayerIframe({ source: 'api', videoId });
        preparePlayerForPlayback({
            thumbnail: cachedVideo?.thumbnail || '',
            title: cachedVideo?.title || ''
        });
    }
    if (cachedVideo) {
        addToHistory({
            ...cachedVideo,
            historySource: 'api'
        });
        document.getElementById('videoTitle').textContent = cachedVideo.title || '';
        document.getElementById('videoDate').textContent = cachedVideo.publishedAt
            ? formatDate(cachedVideo.publishedAt)
            : '';
        document.getElementById('videoViews').textContent = `${formatViews(cachedVideo.viewCount || 0)} visualitzacions`;

        const channelInfo = document.getElementById('channelInfo');
        if (channelInfo) {
            const cachedChannelTitle = cachedVideo.channelTitle || '';
            channelInfo.innerHTML = `
                <div class="channel-header">
                    <div class="channel-meta">
                        <div class="channel-name-large">${escapeHtml(cachedChannelTitle)}</div>
                        <a href="https://www.youtube.com/channel/${cachedVideo.channelId || ''}" target="_blank" rel="noopener noreferrer" class="subscribe-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: #cc0000; color: white;">
                            Canal Youtube
                        </a>
                    </div>
                    <div class="channel-actions">
                        <button class="info-badge" id="likeToggle" type="button" aria-pressed="false" aria-label="M'agrada">
                            ${HEART_TOGGLE_SVG}
                        </button>
                        <button class="icon-btn-ghost" id="miniPlayerToggle" type="button" aria-label="Mini reproductor" aria-pressed="false">
                            <i data-lucide="minimize-2"></i>
                        </button>
                        <button class="icon-btn-ghost" id="shareBtn" aria-label="Compartir">
                            <i data-lucide="share-2"></i>
                        </button>
                    </div>
                </div>
                <div class="video-description"></div>
            `;
            setupLikeBadge(videoId);
            setupMiniPlayerToggle();
        }
    }

    // 2. Enriquiment progressiu via API
    try {
        const videoResult = await YouTubeAPI.getVideoDetails(videoId);

        if (videoResult.video) {
            const video = videoResult.video;
            addToHistory({
                ...video,
                historySource: 'api'
            });
            if (isMini) {
                queuePlayback({
                    videoId,
                    source: 'api',
                    thumbnail: video.thumbnail,
                    title: video.title
                });
            } else {
                setPlaceholderImage(video.thumbnail, video.title);
            }

            // 1. Actualitzar estadístiques principals
            document.getElementById('videoTitle').textContent = video.title;
            document.getElementById('videoDate').textContent = formatDate(video.publishedAt);
            document.getElementById('videoViews').textContent = `${formatViews(video.viewCount)} visualitzacions`;

            // Obtenir informació del canal
            const channelResult = await YouTubeAPI.getChannelDetails(video.channelId);

            if (channelResult.channel) {
                const channel = channelResult.channel;
                const channelInfo = document.getElementById('channelInfo');
                const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
                channelInfo.innerHTML = `
                    <div class="channel-header">
                        <div class="channel-meta">
                            <div class="channel-name-large">${escapeHtml(channel.title)}</div>
                            <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="subscribe-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: #cc0000; color: white;">
                                Canal Youtube
                            </a>
                        </div>
                        <div class="channel-actions">
                            <button class="info-badge" id="likeToggle" type="button" aria-pressed="false" aria-label="M'agrada">
                                ${HEART_TOGGLE_SVG}
                            </button>
                            <button class="icon-btn-ghost" id="miniPlayerToggle" type="button" aria-label="Mini reproductor" aria-pressed="false">
                                <i data-lucide="minimize-2"></i>
                            </button>
                            <button class="icon-btn-ghost" id="shareBtn" aria-label="Compartir">
                                <i data-lucide="share-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="video-description">${escapeHtml(video.description).substring(0, 500)}${video.description.length > 500 ? '...' : ''}</div>
                `;
                setupLikeBadge(videoId);
                setupMiniPlayerToggle();
            }
        }
    } catch (error) {
        console.warn("L'API ha fallat, però almenys es veu la info bàsica", error);
    }

    // Carregar comentaris
    if (CONFIG.features.comments) {
        loadCommentsFromAPI(videoId);
    }

    // Carregar vídeos relacionats
    if (CONFIG.features.recommendations) {
        loadRelatedVideosFromAPI(videoId);
    }

    window.scrollTo(0, 0);
    hideLoading();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Carregar comentaris des de l'API
async function loadCommentsFromAPI(videoId) {
    const result = await YouTubeAPI.getVideoComments(videoId, 20);
    const commentsSection = document.getElementById('commentsSection');

    if (result.error || result.items.length === 0) {
        commentsSection.innerHTML = '<p class="no-comments">No hi ha comentaris disponibles</p>';
        return;
    }

    commentsSection.innerHTML = `
        <h2 class="comments-header">${result.items.length} comentaris</h2>
        ${result.items.map(comment => `
            <div class="comment">
                <img src="${comment.authorAvatar}" alt="${escapeHtml(comment.authorName)}" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHtml(comment.authorName)}</span>
                        <span class="comment-date">${formatDate(comment.publishedAt)}</span>
                    </div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-actions">
                        <button class="comment-like-btn">
                            <i data-lucide="thumbs-up"></i>
                            <span>${comment.likeCount}</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('')}
    `;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Carregar vídeos relacionats des de l'API
async function loadRelatedVideosFromAPI(videoId) {
    const relatedContainer = document.getElementById('relatedVideos');

    // La API de vídeos relacionats pot no funcionar, fem fallback a vídeos populars
    let result = await YouTubeAPI.getRelatedVideos(videoId, 10);

    if (result.error || result.items.length === 0) {
        result = await YouTubeAPI.getPopularVideos(10);
    }

    if (result.items.length === 0) {
        relatedContainer.innerHTML = '<p>No hi ha vídeos relacionats</p>';
        return;
    }

    // Obtenir detalls dels vídeos
    const videoIds = result.items.map(v => v.id).join(',');
    const details = await fetchVideoDetails(videoIds);
    const videos = details.length > 0 ? details : result.items;

    relatedContainer.innerHTML = videos.map(video => `
        <div class="related-video" data-video-id="${video.id}">
            <div class="related-thumbnail">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
            </div>
            <div class="related-info">
                <div class="related-title-text">${escapeHtml(video.title)}</div>
                <div class="related-channel">${escapeHtml(video.channelTitle)}</div>
                <div class="related-stats">
                    ${video.viewCount ? formatViews(video.viewCount) + ' visualitzacions • ' : ''}${formatDate(video.publishedAt)}
                </div>
            </div>
        </div>
    `).join('');

    // Event listeners
    const relatedVideoElements = document.querySelectorAll('.related-video');
    relatedVideoElements.forEach(element => {
        element.addEventListener('click', () => {
            const id = element.dataset.videoId;
            showVideoFromAPI(id);
        });
    });
}

// ==================== DADES ESTÀTIQUES (FALLBACK) ====================

// Carregar vídeos estàtics
function loadVideos() {
    setPageTitle('Recomanat per a tu');
    setFeedContext(VIDEOS, getFeedDataForFilter(), renderStaticVideos);
}

function renderStaticVideos(videos) {
    const newest = getNewestVideoFromList(videos);
    updateHero(newest?.video, 'static');

    videosGrid.innerHTML = videos.map(video => createVideoCard(video)).join('');

    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            showVideo(videoId);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Carregar vídeos per categoria (estàtic)
function loadVideosByCategoryStatic(categoryId) {
    const videos = getVideosByCategory(categoryId);
    const category = CONFIG.categories.find(c => c.id === categoryId);
    setPageTitle(category ? category.name : 'Categoria');
    const newest = getNewestVideoFromList(videos);
    updateHero(newest?.video, 'static');
    videosGrid.innerHTML = videos.map(video => createVideoCard(video)).join('');

    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            showVideo(videoId);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Crear targeta de vídeo (estàtic)
function createVideoCard(video) {
    const channel = getChannelById(video.channelId);

    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <span class="video-duration">${video.duration}</span>
            </div>
            <div class="video-details">
                <img src="${channel.avatar}" alt="${channel.name}" class="channel-avatar">
                <div class="video-info-container">
                    <h3 class="video-card-title">${video.title}</h3>
                    <div class="video-metadata">
                        <div class="channel-name">${channel.name}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(video.views)} visualitzacions</span>
                            <span>•</span>
                            <span>${formatDate(video.uploadDate)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function stopVideoPlayback() {
    if (videoPlayer) {
        videoPlayer.innerHTML = '';
        videoPlayer.classList.remove('mini-player-active');
        videoPlayer.style.display = 'none';
        videoPlayer.style.width = '';
        videoPlayer.style.height = '';
        videoPlayer.style.top = '';
        videoPlayer.style.left = '';
    }
    if (videoPlaceholder) {
        videoPlaceholder.classList.add('hidden');
        videoPlaceholder.classList.remove('is-placeholder-hidden');
    }
    if (placeholderImage) {
        placeholderImage.src = '';
        placeholderImage.alt = '';
    }
    currentVideoId = null;
}

// Mostrar pàgina principal
function showHome() {
    handlePlayerVisibilityOnNavigation();
    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.remove('hidden');
    }
    homePage.classList.remove('hidden');
    watchPage.classList.add('hidden');
    if (!isMiniPlayerActive()) {
        currentVideoId = null;
    }
    window.scrollTo(0, 0);
}

// Mostrar vídeo (estàtic)
function showVideo(videoId) {
    const isMini = videoPlayer?.classList.contains('mini-player-active');
    currentVideoId = videoId;
    const video = getVideoById(videoId);
    const channel = getChannelById(video.channelId);

    addToHistory({
        ...video,
        historySource: 'static'
    });

    history.pushState({ videoId }, '', `?v=${videoId}`);

    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    homePage.classList.add('hidden');
    watchPage.classList.remove('hidden');

    if (isMini) {
        queuePlayback({
            videoId,
            source: 'static',
            videoUrl: video.videoUrl,
            thumbnail: video.thumbnail,
            title: video.title
        });
    } else {
        updatePlayerIframe({
            source: 'static',
            videoId,
            videoUrl: video.videoUrl
        });
        preparePlayerForPlayback({
            thumbnail: video.thumbnail,
            title: video.title
        });
    }

    // 1. Actualitzar estadístiques principals
    document.getElementById('videoTitle').textContent = video.title;
    document.getElementById('videoDate').textContent = formatDate(video.uploadDate);
    document.getElementById('videoViews').textContent = `${formatViews(video.views)} visualitzacions`;

    // 2. Mostrar Likes
    const channelInfo = document.getElementById('channelInfo');
    const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
    channelInfo.innerHTML = `
        <div class="channel-header">
            <div class="channel-meta">
                <div class="channel-name-large">${channel.name}</div>
                <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="subscribe-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: #cc0000; color: white;">
                    Canal Youtube
                </a>
            </div>
            <div class="channel-actions">
                <button class="info-badge" id="likeToggle" type="button" aria-pressed="false" aria-label="M'agrada">
                    ${HEART_TOGGLE_SVG}
                </button>
                <button class="icon-btn-ghost" id="miniPlayerToggle" type="button" aria-label="Mini reproductor" aria-pressed="false">
                    <i data-lucide="minimize-2"></i>
                </button>
                <button class="icon-btn-ghost" id="shareBtn" aria-label="Compartir">
                    <i data-lucide="share-2"></i>
                </button>
            </div>
        </div>
        <div class="video-description">${video.description}</div>
    `;
    setupLikeBadge(videoId);
    setupMiniPlayerToggle();

    if (CONFIG.features.comments) {
        loadComments(videoId);
    }

    if (CONFIG.features.recommendations) {
        loadRelatedVideos(videoId);
    }

    window.scrollTo(0, 0);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getHistoryItems() {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir catube_history', error);
        return [];
    }
}

function saveHistoryItems(items) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
}

function addToHistory(video) {
    if (!video || video.id === undefined || video.id === null) {
        return;
    }

    const history = getHistoryItems();
    const normalizedId = String(video.id);
    const existingIndex = history.findIndex(item => String(item.id) === normalizedId);

    if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
    }

    history.unshift(video);

    if (history.length > HISTORY_LIMIT) {
        history.length = HISTORY_LIMIT;
    }

    saveHistoryItems(history);
}

function getStaticCategoryName(video) {
    const map = {
        1: 'Vida',
        2: 'Gaming',
        3: 'Cultura',
        4: 'Societat',
        5: 'Humor'
    };
    return map[video.categoryId] || null;
}

function getHistoryVideoCategories(video) {
    if (!video) return [];
    if (Array.isArray(video.categories) && video.categories.length > 0) {
        return video.categories;
    }
    if (video.categoryName) {
        return [video.categoryName];
    }
    if (video.category) {
        return [video.category];
    }
    if (video.categoryId) {
        const mapped = getStaticCategoryName(video);
        return mapped ? [mapped] : [];
    }
    return [];
}

function getFilteredHistoryItems() {
    const history = getHistoryItems();
    const likedIds = getLikedVideoIds();
    let filtered = history;

    if (historyFilterLiked) {
        filtered = filtered.filter(video => likedIds.includes(String(video.id)));
    }

    if (historySelectedCategory !== 'Tot') {
        const wanted = historySelectedCategory.toLowerCase();
        filtered = filtered.filter(video =>
            getHistoryVideoCategories(video).some(cat => String(cat).toLowerCase() === wanted)
        );
    }

    return filtered;
}

function updateHistoryFilterUI() {
    if (!historyFilters) return;

    historyFilters.querySelectorAll('[data-history-cat]').forEach(chip => {
        const isActive = chip.dataset.historyCat === historySelectedCategory;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const likedChip = historyFilters.querySelector('[data-history-filter="liked"]');
    if (likedChip) {
        likedChip.classList.toggle('is-active', historyFilterLiked);
        likedChip.setAttribute('aria-pressed', historyFilterLiked ? 'true' : 'false');
    }
}

function createHistoryCard(video) {
    const source = video.historySource || 'api';
    const isShort = video.isShort;
    const isStatic = source === 'static';
    const channel = isStatic ? getChannelById(video.channelId) : null;
    const title = video.title || video.snippet?.title || '';
    const thumbnail = video.thumbnail || video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.standard?.url || video.snippet?.thumbnails?.high?.url || '';
    const duration = video.duration || video.contentDetails?.duration || '';
    const channelTitle = video.channelTitle || channel?.name || '';
    const publishedAt = video.publishedAt || video.uploadDate || video.snippet?.publishedAt || '';
    const views = video.viewCount || video.views || 0;

    return `
        <div class="video-card" data-video-id="${video.id}" data-video-source="${source}">
            <div class="video-thumbnail${isShort ? ' is-short' : ''}">
                <img src="${thumbnail}" alt="${escapeHtml(title)}" loading="lazy">
                <button class="delete-history-btn" type="button" aria-label="Eliminar de l'historial" data-history-id="${video.id}">
                    <i data-lucide="x"></i>
                </button>
                ${isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${duration ? `<span class="video-duration">${duration}</span>` : ''}
            </div>
            <div class="video-details">
                ${channel ? `<img src="${channel.avatar}" alt="${escapeHtml(channel.name)}" class="channel-avatar">` : ''}
                <div class="video-info-container">
                    <h3 class="video-card-title">${escapeHtml(title)}</h3>
                    <div class="video-metadata">
                        <div class="channel-name">${escapeHtml(channelTitle)}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(views)} visualitzacions</span>
                            ${publishedAt ? `<span>•</span><span>${formatDate(publishedAt)}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderHistory() {
    if (!historyGrid) return;

    const historyItems = getFilteredHistoryItems();
    const totalHistoryItems = getHistoryItems();

    if (historyItems.length === 0) {
        const message = totalHistoryItems.length === 0
            ? 'Encara no hi ha vídeos a l\'historial.'
            : 'No hi ha vídeos que coincideixin amb aquests filtres.';
        historyGrid.innerHTML = `<div class="empty-state">${message}</div>`;
        return;
    }

    historyGrid.innerHTML = historyItems.map(video => createHistoryCard(video)).join('');

    const cards = historyGrid.querySelectorAll('.video-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            const source = card.dataset.videoSource;
            if (source === 'static') {
                showVideo(videoId);
            } else {
                showVideoFromAPI(videoId);
            }
        });
    });

    const deleteButtons = historyGrid.querySelectorAll('.delete-history-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const targetId = button.dataset.historyId;
            const history = getHistoryItems().filter(item => String(item.id) !== String(targetId));
            saveHistoryItems(history);
            renderHistory();
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function showHistory() {
    handlePlayerVisibilityOnNavigation();
    if (mainContent) {
        mainContent.classList.add('hidden');
    }
    if (historyPage) {
        historyPage.classList.remove('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    updateHistoryFilterUI();
    renderHistory();
    window.scrollTo(0, 0);
}

// Carregar comentaris (estàtic)
function loadComments(videoId) {
    const comments = getCommentsByVideoId(videoId);
    const commentsSection = document.getElementById('commentsSection');

    if (comments.length === 0) return;

    commentsSection.innerHTML = `
        <h2 class="comments-header">${comments.length} comentaris</h2>
        ${comments.map(comment => `
            <div class="comment">
                <img src="${comment.avatar}" alt="${comment.author}" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.author}</span>
                        <span class="comment-date">${formatDate(comment.timestamp)}</span>
                    </div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-actions">
                        <button class="comment-like-btn">
                            <i data-lucide="thumbs-up"></i>
                            <span>${comment.likes}</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('')}
    `;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Carregar vídeos relacionats (estàtic)
function loadRelatedVideos(currentVideoId) {
    const relatedVideos = VIDEOS.filter(v => v.id !== parseInt(currentVideoId)).slice(0, 10);
    const relatedContainer = document.getElementById('relatedVideos');

    relatedContainer.innerHTML = relatedVideos.map(video => {
        const channel = getChannelById(video.channelId);
        return `
            <div class="related-video" data-video-id="${video.id}">
                <div class="related-thumbnail">
                    <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                    <span class="video-duration">${video.duration}</span>
                </div>
                <div class="related-info">
                    <div class="related-title-text">${video.title}</div>
                    <div class="related-channel">${channel.name}</div>
                    <div class="related-stats">
                        ${formatViews(video.views)} visualitzacions • ${formatDate(video.uploadDate)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const relatedVideoElements = document.querySelectorAll('.related-video');
    relatedVideoElements.forEach(element => {
        element.addEventListener('click', () => {
            const videoId = element.dataset.videoId;
            showVideo(videoId);
        });
    });
}

// ==================== UTILITATS ====================

// Escapar HTML per evitar XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Gestionar navegació del navegador (back/forward)
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.videoId) {
        if (useYouTubeAPI) {
            showVideoFromAPI(e.state.videoId);
        } else {
            showVideo(e.state.videoId);
        }
    } else {
        showHome();
        if (useYouTubeAPI) {
            loadVideosFromAPI();
        } else {
            loadVideos();
        }
    }
});
