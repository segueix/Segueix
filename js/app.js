// App Principal

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading;
let heroSection, heroTitle, heroDescription, heroImage, heroDuration, heroButton, heroEyebrow, heroChannel;
let pageTitle;
let backgroundModal, backgroundBtn, backgroundOptions;
let currentVideoId = null;
let useYouTubeAPI = false;
let selectedCategory = 'Tot';
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
    videosGrid = document.getElementById('videosGrid');
    homePage = document.getElementById('homePage');
    watchPage = document.getElementById('watchPage');
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
            stopVideoPlayback();
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
    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip) {
            selectedCategory = chip.dataset.cat || 'Tot';
            document.querySelectorAll('.chip').forEach((item) => item.classList.remove('is-active'));
            chip.classList.add('is-active');
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            stopVideoPlayback();
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
    const thumbnail = video.thumbnail || video.snippet?.thumbnails?.high?.url || '';
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
            stopVideoPlayback();
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
    const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1&autoplay=1`;

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
    currentVideoId = videoId;
    showLoading();

    // Actualitzar URL
    history.pushState({ videoId }, '', `?v=${videoId}`);

    // Mostrar pàgina de vídeo
    homePage.classList.add('hidden');
    watchPage.classList.remove('hidden');

    // Carregar reproductor
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.innerHTML = `
        <div class="video-embed-wrap">
            <iframe
                src="https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&autoplay=1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
        </div>
    `;

    // Obtenir detalls del vídeo
    const videoResult = await YouTubeAPI.getVideoDetails(videoId);

    if (videoResult.video) {
        const video = videoResult.video;

        // Títol del vídeo
        document.getElementById('videoTitle').textContent = video.title;

        // Nom del canal
        document.getElementById('channelName').textContent = video.channelTitle || '';

        // Estadístiques (visualitzacions i data)
        document.getElementById('videoViews').textContent = `${formatViews(video.viewCount)} visualitzacions`;
        document.getElementById('videoDate').textContent = formatDateFull(video.publishedAt);

        // Likes
        document.getElementById('videoLikes').textContent = formatViews(video.likeCount);

        // Descripció
        const descriptionText = document.getElementById('videoDescription');
        descriptionText.textContent = video.description || 'Sense descripció';

        // Configurar toggle de descripció
        initDescriptionToggle();

        // Configurar botó subscriu-te amb enllaç al canal de YouTube
        const subscribeBtn = document.getElementById('subscribeBtn');
        if (subscribeBtn && video.channelId) {
            subscribeBtn.href = `https://www.youtube.com/channel/${video.channelId}?sub_confirmation=1`;
        }
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

// Inicialitzar el toggle de descripció
function initDescriptionToggle() {
    const descriptionBox = document.getElementById('descriptionBox');
    const descriptionToggle = document.getElementById('descriptionToggle');

    if (!descriptionBox || !descriptionToggle) return;

    // Resetar estat
    descriptionBox.classList.remove('expanded');
    descriptionToggle.textContent = 'Mostra més';

    descriptionToggle.onclick = (e) => {
        e.stopPropagation();
        descriptionBox.classList.toggle('expanded');
        descriptionToggle.textContent = descriptionBox.classList.contains('expanded') ? 'Mostra menys' : 'Mostra més';
    };

    descriptionBox.onclick = () => {
        if (!descriptionBox.classList.contains('expanded')) {
            descriptionBox.classList.add('expanded');
            descriptionToggle.textContent = 'Mostra menys';
        }
    };
}

// Formatar data completa (ex: "15 gen. 2024")
function formatDateFull(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Carregar comentaris des de l'API
async function loadCommentsFromAPI(videoId) {
    const result = await YouTubeAPI.getVideoComments(videoId, 20);
    const commentsCount = document.getElementById('commentsCount');
    const commentsList = document.getElementById('commentsList');

    if (result.error || result.items.length === 0) {
        commentsCount.textContent = '0 comentaris';
        commentsList.innerHTML = `
            <div class="yt-no-comments">
                <i data-lucide="message-circle-off"></i>
                <p>No hi ha comentaris disponibles per a aquest vídeo</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }

    // Actualitzar comptador de comentaris
    commentsCount.textContent = `${result.items.length} comentaris`;

    // Renderitzar comentaris amb estil YouTube
    commentsList.innerHTML = result.items.map(comment => `
        <div class="yt-comment">
            <img src="${comment.authorAvatar}" alt="${escapeHtml(comment.authorName)}" class="yt-comment-avatar">
            <div class="yt-comment-content">
                <div class="yt-comment-header">
                    <span class="yt-comment-author">${escapeHtml(comment.authorName)}</span>
                    <span class="yt-comment-date">${formatTimeAgo(comment.publishedAt)}</span>
                </div>
                <div class="yt-comment-text">${formatCommentText(comment.text)}</div>
                <div class="yt-comment-actions">
                    <button class="yt-comment-action-btn yt-comment-like-btn">
                        <i data-lucide="thumbs-up"></i>
                    </button>
                    ${comment.likeCount > 0 ? `<span class="yt-comment-like-count">${formatViews(comment.likeCount)}</span>` : ''}
                    <button class="yt-comment-action-btn yt-comment-dislike-btn">
                        <i data-lucide="thumbs-down"></i>
                    </button>
                    <button class="yt-comment-action-btn yt-comment-reply-btn">Respon</button>
                </div>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Formatar text del comentari (convertir URLs i salts de línia)
function formatCommentText(text) {
    if (!text) return '';
    // Escapar HTML
    let formatted = escapeHtml(text);
    // Convertir URLs a enllaços
    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #3ea6ff;">$1</a>'
    );
    // Convertir salts de línia
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

// Formatar temps relatiu (fa X temps)
function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = [
        { label: 'any', plural: 'anys', seconds: 31536000 },
        { label: 'mes', plural: 'mesos', seconds: 2592000 },
        { label: 'setmana', plural: 'setmanes', seconds: 604800 },
        { label: 'dia', plural: 'dies', seconds: 86400 },
        { label: 'hora', plural: 'hores', seconds: 3600 },
        { label: 'minut', plural: 'minuts', seconds: 60 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `fa ${count} ${count === 1 ? interval.label : interval.plural}`;
        }
    }

    return 'fa un moment';
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
    if (!watchPage || watchPage.classList.contains('hidden')) {
        return;
    }
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        videoPlayer.innerHTML = '';
    }
    currentVideoId = null;
}

// Mostrar pàgina principal
function showHome() {
    homePage.classList.remove('hidden');
    watchPage.classList.add('hidden');
    currentVideoId = null;
    window.scrollTo(0, 0);
}

// Mostrar vídeo (estàtic)
function showVideo(videoId) {
    currentVideoId = videoId;
    const video = getVideoById(videoId);
    const channel = getChannelById(video.channelId);

    history.pushState({ videoId }, '', `?v=${videoId}`);

    homePage.classList.add('hidden');
    watchPage.classList.remove('hidden');

    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.innerHTML = `
        <div class="video-embed-wrap">
            <iframe
                src="${video.videoUrl}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
        </div>
    `;

    // Títol del vídeo
    document.getElementById('videoTitle').textContent = video.title;

    // Estadístiques (visualitzacions i data)
    document.getElementById('videoViews').textContent = `${formatViews(video.views)} visualitzacions`;
    document.getElementById('videoDate').textContent = formatDateFull(video.uploadDate);

    // Likes
    document.getElementById('videoLikes').textContent = formatViews(video.likes);

    // Descripció
    const descriptionText = document.getElementById('videoDescription');
    descriptionText.textContent = video.description || 'Sense descripció';

    // Configurar toggle de descripció
    initDescriptionToggle();

    // Avatar del canal
    const channelAvatar = document.getElementById('channelAvatar');
    channelAvatar.src = channel.avatar;
    channelAvatar.alt = channel.name;

    // Nom del canal
    document.getElementById('channelName').textContent = channel.name;

    // Subscriptors
    document.getElementById('channelSubscribers').textContent = `${formatViews(channel.subscribers)} subscriptors`;

    // Mostrar/amagar botó de subscripció
    const subscribeBtn = document.getElementById('subscribeBtn');
    if (CONFIG.features.subscriptions) {
        subscribeBtn.style.display = 'block';
    } else {
        subscribeBtn.style.display = 'none';
    }

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

// Carregar comentaris (estàtic)
function loadComments(videoId) {
    const comments = getCommentsByVideoId(videoId);
    const commentsCount = document.getElementById('commentsCount');
    const commentsList = document.getElementById('commentsList');

    if (comments.length === 0) {
        commentsCount.textContent = '0 comentaris';
        commentsList.innerHTML = `
            <div class="yt-no-comments">
                <i data-lucide="message-circle-off"></i>
                <p>No hi ha comentaris disponibles per a aquest vídeo</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }

    // Actualitzar comptador de comentaris
    commentsCount.textContent = `${comments.length} comentaris`;

    // Renderitzar comentaris amb estil YouTube
    commentsList.innerHTML = comments.map(comment => `
        <div class="yt-comment">
            <img src="${comment.avatar}" alt="${escapeHtml(comment.author)}" class="yt-comment-avatar">
            <div class="yt-comment-content">
                <div class="yt-comment-header">
                    <span class="yt-comment-author">${escapeHtml(comment.author)}</span>
                    <span class="yt-comment-date">${formatTimeAgo(comment.timestamp)}</span>
                </div>
                <div class="yt-comment-text">${formatCommentText(comment.text)}</div>
                <div class="yt-comment-actions">
                    <button class="yt-comment-action-btn yt-comment-like-btn">
                        <i data-lucide="thumbs-up"></i>
                    </button>
                    ${comment.likes > 0 ? `<span class="yt-comment-like-count">${formatViews(comment.likes)}</span>` : ''}
                    <button class="yt-comment-action-btn yt-comment-dislike-btn">
                        <i data-lucide="thumbs-down"></i>
                    </button>
                    <button class="yt-comment-action-btn yt-comment-reply-btn">Respon</button>
                </div>
            </div>
        </div>
    `).join('');

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
