// App Principal

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading, mainContent;
let historyPage, historyGrid, historyFilters, chipsBar;
let playlistsPage, playlistsList, playlistNameInput, createPlaylistBtn;
let followPage, followGrid, followTabs;
let heroSection, heroTitle, heroDescription, heroImage, heroDuration, heroButton, heroEyebrow, heroChannel;
let pageTitle;
let backgroundModal, backgroundBtn, backgroundOptions;
let playlistModal, playlistModalBody;
let videoPlayer, videoPlaceholder, placeholderImage;
let channelPage, channelVideosGrid;
let channelBackBtn, channelProfileAvatar, channelProfileName, channelProfileSubscribers;
let channelProfileHandle, channelProfileDescription, channelProfileFollowBtn;
let currentVideoId = null;
let useYouTubeAPI = false;
let selectedCategory = 'Tot';
let historySelectedCategory = 'Tot';
let historyFilterLiked = false;
let currentFeedVideos = [];
let currentFeedData = null;
let currentFeedRenderer = null;
let activePlaylistVideo = null;
let activePlaylistQueue = [];
let currentPlaylistIndex = 0;
let activePlaylistId = null;
let activePlaylistName = '';
let isPlaylistNavigation = false;
let isPlaylistMode = false;
let youtubeMessageListenerInitialized = false;

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
const PLAYLIST_STORAGE_KEY = 'catube_playlists';
const FOLLOW_STORAGE_KEY = 'catube_follows';

// Cache de canals carregats de l'API
let cachedChannels = {};

// Cache de vídeos carregats de l'API
let cachedAPIVideos = [];
let activeFollowTab = 'following';

function mergeChannelCategories(channel, categories) {
    if (!channel || !Array.isArray(categories) || categories.length === 0) {
        return;
    }
    channel.categories = [...new Set([...(channel.categories || []), ...categories])];
}

function getFollowedChannelIds() {
    const stored = localStorage.getItem(FOLLOW_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir catube_follows', error);
        return [];
    }
}

function saveFollowedChannelIds(ids) {
    localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify(ids));
}

function isChannelFollowed(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    return getFollowedChannelIds().some(id => String(id) === normalizedId);
}

function toggleFollowChannel(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    const current = new Set(getFollowedChannelIds().map(id => String(id)));
    if (current.has(normalizedId)) {
        current.delete(normalizedId);
    } else {
        current.add(normalizedId);
    }
    saveFollowedChannelIds(Array.from(current));
    return current.has(normalizedId);
}

function updateFollowButtonState(button, channelId) {
    if (!button) {
        return;
    }
    const followed = isChannelFollowed(channelId);
    button.classList.toggle('is-followed', followed);
    button.setAttribute('aria-pressed', followed ? 'true' : 'false');
    button.textContent = followed ? 'Seguint' : 'Segueix';
    button.setAttribute('aria-label', followed ? 'Deixa de seguir aquest canal' : 'Segueix aquest canal');
}

function refreshFollowButtons(channelId) {
    document.querySelectorAll(`[data-follow-channel="${channelId}"]`).forEach(button => {
        updateFollowButtonState(button, channelId);
    });
}

function bindFollowButtons(container = document) {
    const buttons = container.querySelectorAll('[data-follow-channel]');
    buttons.forEach(button => {
        if (button.dataset.followBound === 'true') {
            return;
        }
        button.dataset.followBound = 'true';
        const channelId = button.dataset.followChannel;
        updateFollowButtonState(button, channelId);
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const normalizedId = String(channelId);
            const nowFollowed = toggleFollowChannel(normalizedId);
            updateFollowButtonState(button, normalizedId);
            refreshFollowButtons(channelId);
            if (activeFollowTab === 'following' && !nowFollowed) {
                const card = button.closest('.follow-card');
                if (card) {
                    card.remove();
                }
                if (followGrid && followGrid.children.length === 0) {
                    renderFollowEmptyState();
                }
            }
        });
    });
}

function getFollowChannelAvatar(channelId) {
    const cached = cachedChannels[channelId];
    if (cached?.thumbnail) {
        return cached.thumbnail;
    }
    return null;
}


// Inicialitzar l'aplicació
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    initEventListeners();
    initBackgroundModal();
    initBackgroundPicker();
    loadCategories();
    renderPlaylistsPage();
    initYouTubeMessageListener();

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
    playlistsPage = document.getElementById('playlistsPage');
    playlistsList = document.getElementById('playlistsList');
    playlistNameInput = document.getElementById('playlistNameInput');
    createPlaylistBtn = document.getElementById('createPlaylistBtn');
    followPage = document.getElementById('followPage');
    followGrid = document.getElementById('followGrid');
    followTabs = document.getElementById('followTabs');
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
    playlistModal = document.getElementById('playlistModal');
    playlistModalBody = document.getElementById('playlistModalBody');
    videoPlayer = document.getElementById('videoPlayer');
    videoPlaceholder = document.getElementById('videoPlaceholder');
    placeholderImage = document.getElementById('placeholderImage');
    channelPage = document.getElementById('channelPage');
    channelVideosGrid = document.getElementById('channelVideosGrid');
    channelBackBtn = document.getElementById('channelBackBtn');
    channelProfileAvatar = document.getElementById('channelProfileAvatar');
    channelProfileName = document.getElementById('channelProfileName');
    channelProfileHandle = document.getElementById('channelProfileHandle');
    channelProfileSubscribers = document.getElementById('channelProfileSubscribers');
    channelProfileDescription = document.getElementById('channelProfileDescription');
    channelProfileFollowBtn = document.getElementById('channelProfileFollowBtn');
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
            } else if (page === 'follow') {
                showFollow();
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
            } else if (page === 'playlists') {
                showPlaylists();
            } else if (page === 'follow') {
                showFollow();
            } else {
                showHome();
            }
        });
    });

    if (followTabs) {
        followTabs.querySelectorAll('.follow-tab').forEach(tab => {
            tab.addEventListener('click', (event) => {
                event.preventDefault();
                const tabId = tab.dataset.followTab;
                if (tabId) {
                    setActiveFollowTab(tabId);
                }
            });
        });
    }

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

    if (channelBackBtn) {
        channelBackBtn.addEventListener('click', (event) => {
            event.preventDefault();
            showFollow();
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

    if (createPlaylistBtn) {
        createPlaylistBtn.addEventListener('click', () => {
            const name = playlistNameInput?.value?.trim();
            if (!name) return;
            createPlaylist(name);
            if (playlistNameInput) {
                playlistNameInput.value = '';
            }
            renderPlaylistsPage();
        });
    }

    if (playlistNameInput) {
        playlistNameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createPlaylistBtn?.click();
            }
        });
    }

    if (playlistModal) {
        const closeBtn = playlistModal.querySelector('.playlist-modal-close');
        const backdrop = playlistModal.querySelector('.playlist-modal-backdrop');
        closeBtn?.addEventListener('click', closePlaylistModal);
        backdrop?.addEventListener('click', closePlaylistModal);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && playlistModal && !playlistModal.classList.contains('hidden')) {
            closePlaylistModal();
        }
    });

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
    setupVideoCardActionButtons();
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
    setupVideoCardActionButtons();
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
    setupVideoCardActionButtons();
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

const PLAYLIST_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" class="icon-playlist" aria-hidden="true" focusable="false">
        <rect x="40" y="10" width="20" height="80" rx="10" ry="10" fill="white"></rect>
        <rect x="10" y="40" width="80" height="20" rx="10" ry="10" fill="white"></rect>
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

function getPreferredThumbnail(video) {
    return video.thumbnail
        || video.snippet?.thumbnails?.maxres?.url
        || video.snippet?.thumbnails?.standard?.url
        || video.snippet?.thumbnails?.high?.url
        || video.snippet?.thumbnails?.medium?.url
        || video.snippet?.thumbnails?.default?.url
        || '';
}

function getPlaylists() {
    const stored = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir playlists', error);
        return [];
    }
}

function savePlaylists(playlists) {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
}

function createPlaylist(name, video) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const playlists = getPlaylists();
    const playlist = {
        id: `pl_${Date.now()}`,
        name: trimmedName,
        videos: []
    };
    if (video) {
        playlist.videos.push(video);
    }
    playlists.push(playlist);
    savePlaylists(playlists);
}

function addVideoToPlaylist(playlistId, video) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const exists = playlist.videos.some(item => String(item.id) === String(video.id));
    if (!exists) {
        playlist.videos.unshift(video);
    }
    savePlaylists(playlists);
}

function removeVideoFromPlaylist(playlistId, videoId) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    playlist.videos = playlist.videos.filter(video => String(video.id) !== String(videoId));
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        activePlaylistQueue = playlist.videos;
        if (currentPlaylistIndex >= activePlaylistQueue.length) {
            currentPlaylistIndex = Math.max(activePlaylistQueue.length - 1, 0);
        }
        if (activePlaylistQueue.length === 0) {
            exitPlaylistMode();
        } else {
            updatePlaylistModeBadge();
            renderPlaylistQueue();
        }
    }
}

function removePlaylist(playlistId) {
    const playlists = getPlaylists().filter(item => item.id !== playlistId);
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        exitPlaylistMode();
    }
}

function renderPlaylistsPage() {
    if (!playlistsList) return;
    const playlists = getPlaylists();
    if (playlists.length === 0) {
        playlistsList.innerHTML = `<div class="playlist-empty">Encara no tens cap llista creada.</div>`;
        return;
    }

    playlistsList.innerHTML = playlists.map(list => {
        const firstVideo = list.videos[0];
        const thumbnail = firstVideo?.thumbnail || 'img/icon-512.png';
        const videoCount = list.videos.length;
        return `
            <div class="playlist-card">
                <div class="playlist-card-thumb">
                    <img src="${thumbnail}" alt="${escapeHtml(list.name)}" loading="lazy">
                    <button class="playlist-play-btn" type="button" data-playlist-id="${list.id}" aria-label="Reproduir tota la llista">
                        Reproduir tot
                    </button>
                    <button class="playlist-delete" type="button" data-playlist-id="${list.id}" aria-label="Esborrar llista">×</button>
                </div>
                <div class="playlist-card-body">
                    <div class="playlist-card-title">${escapeHtml(list.name)}</div>
                    <div class="playlist-card-meta">${videoCount} vídeos</div>
                    <div class="playlist-video-list">
                        ${list.videos.length > 0
                            ? list.videos.map(video => `
                                <div class="playlist-video-row" data-playlist-id="${list.id}" data-video-id="${video.id}">
                                    <img class="playlist-video-thumb" src="${video.thumbnail || 'img/icon-192.png'}" alt="${escapeHtml(video.title)}" loading="lazy">
                                    <span class="playlist-video-title">${escapeHtml(video.title)}</span>
                                    <button class="playlist-video-remove" type="button" data-playlist-id="${list.id}" data-video-id="${video.id}" aria-label="Eliminar vídeo">×</button>
                                </div>
                            `).join('')
                            : `<div class="playlist-video-empty">Encara no hi ha vídeos.</div>`}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    playlistsList.querySelectorAll('.playlist-delete').forEach(button => {
        button.addEventListener('click', () => {
            removePlaylist(button.dataset.playlistId);
            renderPlaylistsPage();
        });
    });

    playlistsList.querySelectorAll('.playlist-play-btn').forEach(button => {
        button.addEventListener('click', () => {
            startPlaylistPlayback(button.dataset.playlistId);
        });
    });

    playlistsList.querySelectorAll('.playlist-video-remove').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            removeVideoFromPlaylist(button.dataset.playlistId, button.dataset.videoId);
            renderPlaylistsPage();
        });
    });
}

async function renderFollowPage() {
    if (!followGrid) {
        return;
    }
    followGrid.innerHTML = '<div class="empty-state">Carregant canals...</div>';

    const allChannels = Array.isArray(YouTubeAPI?.getAllChannels?.())
        ? YouTubeAPI.getAllChannels()
        : [];

    if (!allChannels.length) {
        followGrid.innerHTML = '<div class="empty-state">No hi ha canals disponibles ara mateix.</div>';
        return;
    }

    const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
    const channels = activeFollowTab === 'following'
        ? allChannels.filter(channel => followedIds.has(String(channel.id)))
        : allChannels;

    if (channels.length === 0) {
        renderFollowEmptyState();
        return;
    }

    const sortedChannels = channels
        .map(channel => ({
            ...channel,
            name: channel.name || channel.title || ''
        }));
    sortedChannels.sort((a, b) => a.name.localeCompare(b.name, 'ca', { sensitivity: 'base' }));

    followGrid.innerHTML = sortedChannels.map(channel => {
        const name = channel.name || 'Canal';
        const avatar = channel.avatar || channel.thumbnail || getFollowChannelAvatar(channel.id) || 'img/icon-192.png';
        return `
            <div class="follow-card" data-channel-id="${channel.id}">
                <div class="follow-avatar-wrap">
                    <img class="follow-avatar" src="${avatar}" alt="${escapeHtml(name)}" loading="lazy">
                </div>
                <div class="follow-name">${escapeHtml(name)}</div>
                <button class="follow-toggle-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                    Segueix
                </button>
            </div>
        `;
    }).join('');

    bindFollowButtons(followGrid);
    followGrid.querySelectorAll('.follow-card').forEach(card => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('[data-follow-channel]')) {
                return;
            }
            openChannelProfile(card.dataset.channelId);
        });
    });
}

function renderFollowEmptyState() {
    if (!followGrid) {
        return;
    }
    if (activeFollowTab === 'following') {
        followGrid.innerHTML = `
            <div class="empty-state">
                Encara no segueixes cap canal.
                <button class="follow-empty-link" type="button" data-follow-tab-link="all">Veure tots els canals</button>
            </div>
        `;
        const link = followGrid.querySelector('[data-follow-tab-link="all"]');
        if (link) {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                setActiveFollowTab('all');
            });
        }
    } else {
        followGrid.innerHTML = '<div class="empty-state">No hi ha canals disponibles ara mateix.</div>';
    }
}

function setActiveFollowTab(tabId) {
    activeFollowTab = tabId;
    if (followTabs) {
        followTabs.querySelectorAll('.follow-tab').forEach(tab => {
            const isActive = tab.dataset.followTab === activeFollowTab;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }
    renderFollowPage();
}

function playPlaylist(playlistId) {
    startPlaylistPlayback(playlistId);
}

function startPlaylistPlayback(playlistId) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist || !Array.isArray(playlist.videos) || playlist.videos.length === 0) {
        return;
    }
    isPlaylistMode = true;
    activePlaylistQueue = [...playlist.videos];
    currentPlaylistIndex = 0;
    activePlaylistId = playlist.id;
    activePlaylistName = playlist.name || 'Llista';
    loadVideoInSequence();
}

function loadVideoInSequence() {
    if (!activePlaylistQueue.length || currentPlaylistIndex >= activePlaylistQueue.length) {
        exitPlaylistMode();
        return;
    }
    const video = activePlaylistQueue[currentPlaylistIndex];
    if (!video) {
        exitPlaylistMode();
        return;
    }
    isPlaylistMode = true;
    updatePlaylistModeBadge();
    isPlaylistNavigation = true;
    if (video.source === 'static') {
        showVideo(video.id);
    } else {
        showVideoFromAPI(video.id);
    }
    isPlaylistNavigation = false;
}

function handlePlaylistVideoEnded() {
    if (!isPlaylistMode || activePlaylistQueue.length === 0) {
        return;
    }
    if (currentPlaylistIndex < activePlaylistQueue.length - 1) {
        currentPlaylistIndex += 1;
        loadVideoInSequence();
    } else {
        exitPlaylistMode();
    }
}

function updatePlaylistModeBadge() {
    const container = document.querySelector('.video-info');
    if (!container) {
        return;
    }
    const existing = document.getElementById('playlistModeBadge');
    if (!isPlaylistMode) {
        existing?.remove();
        return;
    }
    const badge = existing || document.createElement('div');
    badge.id = 'playlistModeBadge';
    badge.className = 'playlist-mode-badge';
    const position = activePlaylistQueue.length > 0
        ? `${currentPlaylistIndex + 1}/${activePlaylistQueue.length}`
        : '';
    badge.textContent = `Mode llista · ${activePlaylistName} ${position}`.trim();
    if (!existing) {
        container.insertBefore(badge, container.firstChild);
    }
}

function exitPlaylistMode() {
    isPlaylistMode = false;
    activePlaylistQueue = [];
    currentPlaylistIndex = 0;
    activePlaylistId = null;
    activePlaylistName = '';
    updatePlaylistModeBadge();
}

function openPlaylistModal(video) {
    if (!playlistModal || !playlistModalBody) return;
    activePlaylistVideo = video;
    renderPlaylistModal();
    playlistModal.classList.remove('hidden');
    playlistModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function closePlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.add('hidden');
    playlistModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    activePlaylistVideo = null;
}

function renderPlaylistModal() {
    if (!playlistModalBody) return;
    const playlists = getPlaylists();

    const listSection = playlists.length > 0
        ? `
            <div class="playlist-modal-buttons">
                ${playlists.map(list => `
                    <button class="playlist-select-btn" type="button" data-playlist-id="${list.id}">
                        ${escapeHtml(list.name)}
                    </button>
                `).join('')}
            </div>
        `
        : `<p class="modal-description">Crea una llista per començar.</p>`;

    playlistModalBody.innerHTML = `
        ${listSection}
        <div class="playlist-modal-create">
            <div class="modal-description">Crea una llista</div>
            <input class="playlist-input" type="text" id="playlistModalInput" placeholder="Nom de la llista">
            <button class="playlist-create-btn" type="button" id="playlistModalCreateBtn">OK</button>
        </div>
    `;

    playlistModalBody.querySelectorAll('.playlist-select-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (activePlaylistVideo) {
                addVideoToPlaylist(button.dataset.playlistId, activePlaylistVideo);
                renderPlaylistsPage();
            }
            closePlaylistModal();
        });
    });

    const modalInput = playlistModalBody.querySelector('#playlistModalInput');
    const modalCreateBtn = playlistModalBody.querySelector('#playlistModalCreateBtn');
    if (modalCreateBtn) {
        modalCreateBtn.addEventListener('click', () => {
            const name = modalInput?.value?.trim();
            if (!name || !activePlaylistVideo) return;
            createPlaylist(name, activePlaylistVideo);
            renderPlaylistsPage();
            closePlaylistModal();
        });
    }
    if (modalInput) {
        modalInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                modalCreateBtn?.click();
            }
        });
    }
}

function getPlaylistVideoData(video) {
    const source = video.historySource || (video.videoUrl ? 'static' : 'api');
    return {
        id: video.id,
        title: video.title || video.snippet?.title || '',
        thumbnail: getPreferredThumbnail(video),
        channelTitle: video.channelTitle || video.snippet?.channelTitle || '',
        duration: video.duration || video.contentDetails?.duration || '',
        source
    };
}

function setupVideoCardActionButtons() {
    document.querySelectorAll('.video-card .playlist-action').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const payload = button.dataset.playlistVideo;
            if (!payload) return;
            const video = JSON.parse(decodeURIComponent(payload));
            openPlaylistModal(video);
        });
    });

    document.querySelectorAll('.video-card .like-action').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const videoId = String(button.dataset.videoId || '');
            if (!videoId) return;
            const likedIds = getLikedVideoIds();
            const wasLiked = likedIds.includes(videoId);
            const next = wasLiked ? likedIds.filter(id => id !== videoId) : [...likedIds, videoId];
            setLikedVideoIds(next);
            button.classList.toggle('is-liked', !wasLiked);
        });
    });
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

function setVideoTitleText(title) {
    const titleElement = document.getElementById('videoTitle');
    if (!titleElement) {
        return;
    }
    titleElement.textContent = title || '';
    updatePlaylistModeBadge();
}

function renderPlaylistQueue() {
    const relatedContainer = document.getElementById('relatedVideos');
    if (!relatedContainer) {
        return;
    }
    if (!isPlaylistMode || activePlaylistQueue.length === 0) {
        return;
    }
    relatedContainer.innerHTML = `
        <div class="playlist-queue">
            <div class="playlist-queue-title">Cua de la llista</div>
            <div class="playlist-queue-list">
                ${activePlaylistQueue.map((video, index) => `
                    <button class="playlist-queue-item${index === currentPlaylistIndex ? ' is-active' : ''}" type="button" data-queue-index="${index}">
                        <img src="${video.thumbnail || 'img/icon-192.png'}" alt="${escapeHtml(video.title)}" loading="lazy">
                        <div class="playlist-queue-meta">
                            <div class="playlist-queue-name">${escapeHtml(video.title)}</div>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    relatedContainer.querySelectorAll('.playlist-queue-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = Number(item.dataset.queueIndex || 0);
            if (Number.isNaN(index)) {
                return;
            }
            currentPlaylistIndex = index;
            loadVideoInSequence();
        });
    });
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
    if (isYouTubeEmbed(newUrl) && !newUrl.includes('enablejsapi=1')) {
        const origin = encodeURIComponent(window.location.origin || '');
        const separator = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${separator}enablejsapi=1&origin=${origin}`;
    }
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

function initYouTubeMessageListener() {
    if (youtubeMessageListenerInitialized) {
        return;
    }
    window.addEventListener('message', handleYouTubeMessage);
    youtubeMessageListenerInitialized = true;
}

function handleYouTubeMessage(event) {
    if (!event.origin || !/youtube\.com|youtube-nocookie\.com/.test(event.origin)) {
        return;
    }
    let payload = event.data;
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (error) {
            return;
        }
    }
    if (payload?.event === 'onStateChange' && payload?.info === 0) {
        handlePlaylistVideoEnded();
    }
}

function isYouTubeEmbed(url) {
    if (!url) {
        return false;
    }
    return url.includes('youtube.com/embed') || url.includes('youtube-nocookie.com/embed');
}

function setupYouTubeIframeMessaging(iframe) {
    if (!iframe || !isYouTubeEmbed(iframe.src)) {
        return;
    }
    const sendListenerCommand = () => {
        if (!iframe.contentWindow) {
            return;
        }
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'listening',
            id: 'catube-player'
        }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'addEventListener',
            args: ['onStateChange']
        }), '*');
    };
    if (iframe._ytListener) {
        iframe.removeEventListener('load', iframe._ytListener);
    }
    iframe._ytListener = sendListenerCommand;
    iframe.addEventListener('load', sendListenerCommand);
    setTimeout(sendListenerCommand, 300);
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
    const origin = encodeURIComponent(window.location.origin || '');
    const iframeSrc = source === 'api'
        ? `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&autoplay=1&enablejsapi=1&origin=${origin}&hl=ca&cc_lang_pref=ca&gl=AD`
        : addAutoplayParam(videoUrl);
    const existingIframe = videoPlayer.querySelector('iframe');
    if (!isMobile && existingIframe) {
        existingIframe.src = iframeSrc;
        existingIframe.id = 'catube-player';
        setupYouTubeIframeMessaging(existingIframe);
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
                id="catube-player"
                src="${iframeSrc}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
        </div>
    `;
    const newIframe = videoPlayer.querySelector('iframe');
    if (newIframe) {
        setupYouTubeIframeMessaging(newIframe);
    }
    setupDragHandle();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
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
    setupVideoCardActionButtons();
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
        if (followPage) {
            followPage.classList.add('hidden');
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

    const likedIds = getLikedVideoIds();
    videosGrid.innerHTML = videos.map(video => {
        const isLiked = likedIds.includes(String(video.id));
        const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
        return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn like-action${isLiked ? ' is-liked' : ''}" type="button" data-video-id="${video.id}" aria-label="Preferit">
                                <i data-lucide="heart"></i>
                            </button>
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            <span>${formatDate(video.publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');

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
    setupVideoCardActionButtons();
}

// Crear targeta de vídeo (API)
function createVideoCardAPI(video) {
    const likedIds = getLikedVideoIds();
    const isLiked = likedIds.includes(String(video.id));
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn like-action${isLiked ? ' is-liked' : ''}" type="button" data-video-id="${video.id}" aria-label="Preferit">
                                <i data-lucide="heart"></i>
                            </button>
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
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
    if (!isPlaylistNavigation) {
        exitPlaylistMode();
    }
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
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
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
        setVideoTitleText(cachedVideo.title || '');
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
                        <button class="follow-channel-btn" type="button" data-follow-channel="${cachedVideo.channelId || ''}" aria-pressed="false">
                            Segueix
                        </button>
                        <a href="https://www.youtube.com/channel/${cachedVideo.channelId || ''}" target="_blank" rel="noopener noreferrer" class="subscribe-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: #cc0000; color: white;">
                            Canal Youtube
                        </a>
                    </div>
                    <div class="channel-actions">
                        <button class="info-badge" id="likeToggle" type="button" aria-pressed="false" aria-label="M'agrada">
                            ${HEART_TOGGLE_SVG}
                        </button>
                        <button class="icon-btn-ghost" id="addToPlaylistBtn" type="button" aria-label="Afegir a una llista">
                            ${PLAYLIST_ICON_SVG}
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
            bindFollowButtons(channelInfo);
            const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
            if (addToPlaylistBtn) {
                addToPlaylistBtn.addEventListener('click', () => {
                    openPlaylistModal(getPlaylistVideoData(cachedVideo));
                });
            }
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
            setVideoTitleText(video.title);
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
                            <button class="follow-channel-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                                Segueix
                            </button>
                            <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="subscribe-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: #cc0000; color: white;">
                                Canal Youtube
                            </a>
                        </div>
                        <div class="channel-actions">
                            <button class="info-badge" id="likeToggle" type="button" aria-pressed="false" aria-label="M'agrada">
                                ${HEART_TOGGLE_SVG}
                            </button>
                            <button class="icon-btn-ghost" id="addToPlaylistBtn" type="button" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
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
                bindFollowButtons(channelInfo);
                const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
                if (addToPlaylistBtn) {
                    addToPlaylistBtn.addEventListener('click', () => {
                        openPlaylistModal(getPlaylistVideoData(video));
                    });
                }
            }
        }
    } catch (error) {
        console.warn("L'API ha fallat, però almenys es veu la info bàsica", error);
    }

    // Carregar comentaris
    if (CONFIG.features.comments) {
        loadCommentsFromAPI(videoId);
    }

    // Carregar vídeos relacionats o cua de la llista
    if (isPlaylistMode) {
        renderPlaylistQueue();
    } else if (CONFIG.features.recommendations) {
        loadRelatedVideosFromAPI(videoId);
    }

    window.scrollTo(0, 0);
    hideLoading();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
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
    setupVideoCardActionButtons();
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
    setupVideoCardActionButtons();
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
    const likedIds = getLikedVideoIds();
    const isLiked = likedIds.includes(String(video.id));
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));

    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <span class="video-duration">${video.duration}</span>
            </div>
            <div class="video-details">
                <img src="${channel.avatar}" alt="${channel.name}" class="channel-avatar">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${video.title}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn like-action${isLiked ? ' is-liked' : ''}" type="button" data-video-id="${video.id}" aria-label="Preferit">
                                <i data-lucide="heart"></i>
                            </button>
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
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
    exitPlaylistMode();
    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
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
    if (!isPlaylistNavigation) {
        exitPlaylistMode();
    }
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
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
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
    setVideoTitleText(video.title);
    document.getElementById('videoDate').textContent = formatDate(video.uploadDate);
    document.getElementById('videoViews').textContent = `${formatViews(video.views)} visualitzacions`;

    // 2. Mostrar Likes
    const channelInfo = document.getElementById('channelInfo');
    const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
    channelInfo.innerHTML = `
        <div class="channel-header">
            <div class="channel-meta">
                <div class="channel-name-large">${channel.name}</div>
                <button class="follow-channel-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                    Segueix
                </button>
                <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="subscribe-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: #cc0000; color: white;">
                    Canal Youtube
                </a>
            </div>
            <div class="channel-actions">
                <button class="info-badge" id="likeToggle" type="button" aria-pressed="false" aria-label="M'agrada">
                    ${HEART_TOGGLE_SVG}
                </button>
                <button class="icon-btn-ghost" id="addToPlaylistBtn" type="button" aria-label="Afegir a una llista">
                    ${PLAYLIST_ICON_SVG}
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
    bindFollowButtons(channelInfo);
    const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
    if (addToPlaylistBtn) {
        addToPlaylistBtn.addEventListener('click', () => {
            openPlaylistModal(getPlaylistVideoData(video));
        });
    }

    if (CONFIG.features.comments) {
        loadComments(videoId);
    }

    if (isPlaylistMode) {
        renderPlaylistQueue();
    } else if (CONFIG.features.recommendations) {
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
    const likedIds = getLikedVideoIds();
    const isLiked = likedIds.includes(String(video.id));
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));

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
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn like-action${isLiked ? ' is-liked' : ''}" type="button" data-video-id="${video.id}" aria-label="Preferit">
                                <i data-lucide="heart"></i>
                            </button>
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
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
    exitPlaylistMode();
    if (mainContent) {
        mainContent.classList.add('hidden');
    }
    if (historyPage) {
        historyPage.classList.remove('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    updateHistoryFilterUI();
    renderHistory();
    window.scrollTo(0, 0);
}

function showPlaylists() {
    handlePlayerVisibilityOnNavigation();
    exitPlaylistMode();
    if (mainContent) {
        mainContent.classList.add('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.remove('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    renderPlaylistsPage();
    window.scrollTo(0, 0);
}

function showFollow() {
    handlePlayerVisibilityOnNavigation();
    exitPlaylistMode();
    if (mainContent) {
        mainContent.classList.add('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.remove('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    setActiveFollowTab('following');
    window.scrollTo(0, 0);
}

function openChannelProfile(channelId) {
    if (!channelId) {
        return;
    }
    handlePlayerVisibilityOnNavigation();
    exitPlaylistMode();
    const normalizedId = String(channelId);
    const channels = Array.isArray(YouTubeAPI?.getAllChannels?.())
        ? YouTubeAPI.getAllChannels()
        : [];
    const channel = channels.find(item => String(item.id) === normalizedId);
    if (!channelPage || !channelVideosGrid) {
        return;
    }

    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
    if (historyPage) {
        historyPage.classList.add('hidden');
    }
    if (playlistsPage) {
        playlistsPage.classList.add('hidden');
    }
    if (followPage) {
        followPage.classList.add('hidden');
    }
    if (channelPage) {
        channelPage.classList.add('hidden');
    }
    if (chipsBar) {
        chipsBar.classList.add('hidden');
    }
    if (homePage) {
        homePage.classList.add('hidden');
    }
    if (watchPage) {
        watchPage.classList.add('hidden');
    }
    channelPage.classList.remove('hidden');

    const channelName = channel?.name || channel?.title || 'Canal';
    const channelAvatar = channel?.avatar || channel?.thumbnail || getFollowChannelAvatar(normalizedId) || 'img/icon-192.png';
    if (channelProfileAvatar) {
        channelProfileAvatar.src = channelAvatar;
        channelProfileAvatar.alt = channelName;
    }
    if (channelProfileName) {
        channelProfileName.textContent = channelName;
    }
    if (channelProfileHandle) {
        if (channel?.handle) {
            channelProfileHandle.textContent = channel.handle;
            channelProfileHandle.classList.remove('hidden');
        } else {
            channelProfileHandle.textContent = '';
            channelProfileHandle.classList.add('hidden');
        }
    }
    if (channelProfileSubscribers) {
        if (channel?.subscriberCount) {
            channelProfileSubscribers.textContent = `${formatViews(channel.subscriberCount)} subscriptors`;
            channelProfileSubscribers.classList.remove('hidden');
        } else {
            channelProfileSubscribers.textContent = '';
            channelProfileSubscribers.classList.add('hidden');
        }
    }
    if (channelProfileDescription) {
        channelProfileDescription.textContent = channel?.description || 'No hi ha descripció disponible.';
    }
    if (channelProfileFollowBtn) {
        channelProfileFollowBtn.dataset.followChannel = normalizedId;
        channelProfileFollowBtn.dataset.followBound = 'false';
    }
    bindFollowButtons(channelPage);

    const feedVideos = Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [];
    const combinedVideos = [...feedVideos, ...cachedAPIVideos];
    const videosById = new Map();
    combinedVideos.forEach(video => {
        if (String(video.channelId) !== normalizedId) {
            return;
        }
        videosById.set(String(video.id), video);
    });

    const channelVideos = Array.from(videosById.values());
    if (channelVideos.length === 0) {
        channelVideosGrid.innerHTML = '<div class="empty-state">Encara no hi ha vídeos d\'aquest canal.</div>';
        return;
    }

    channelVideosGrid.innerHTML = channelVideos.map(video => createVideoCardAPI(video)).join('');
    channelVideosGrid.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            showVideoFromAPI(card.dataset.videoId);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
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
