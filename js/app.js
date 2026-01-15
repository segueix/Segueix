// App Principal

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading;
let apiModal, apiKeyInput, apiStatus, settingsBtn;
let currentVideoId = null;
let useYouTubeAPI = false;

// Vídeos de l'usuari (emmagatzemats a localStorage)
let userVideos = [];
const USER_VIDEOS_KEY = 'iutube_user_videos';

// Etiquetes de canals (categories assignades als canals - pot tenir múltiples)
let channelTags = {};
const CHANNEL_TAGS_KEY = 'iutube_channel_tags';

// Cache de canals carregats de l'API (per mostrar a la pestanya d'etiquetar)
let cachedChannels = {};

// Cache de vídeos carregats de l'API
let cachedAPIVideos = [];

// Inicialitzar l'aplicació
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    initEventListeners();
    initApiModal();
    initVideoTab();
    initTagsTab();
    loadCategories();

    // Inicialitzar YouTubeAPI (carregar canals catalans)
    await YouTubeAPI.init();

    // Comprovar si hi ha clau API guardada
    if (YouTubeAPI.hasApiKey()) {
        useYouTubeAPI = true;
        loadVideosFromAPI();
    } else {
        loadVideos();
        // Mostrar modal si no hi ha API key
        setTimeout(() => showApiModal(), 500);
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
    apiModal = document.getElementById('apiModal');
    apiKeyInput = document.getElementById('apiKeyInput');
    apiStatus = document.getElementById('apiStatus');
    settingsBtn = document.getElementById('settingsBtn');
}

// Inicialitzar event listeners
function initEventListeners() {
    // Toggle sidebar (expandir/minimitzar)
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

    // Cerca
    const searchForm = document.getElementById('searchForm');
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('searchInput').value.trim();
        if (query && useYouTubeAPI) {
            await searchVideos(query);
        }
    });

    // Botó configuració
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showApiModal);
    }

    // Tancar sidebar en mòbil quan es clica fora
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

// Inicialitzar modal API
function initApiModal() {
    const closeModal = document.getElementById('closeModal');
    const saveApiKey = document.getElementById('saveApiKey');
    const clearApiKey = document.getElementById('clearApiKey');
    const toggleApiKey = document.getElementById('toggleApiKey');
    const addChannelBtn = document.getElementById('addChannelBtn');
    const channelInput = document.getElementById('channelInput');

    // Tancar modal
    closeModal.addEventListener('click', hideApiModal);
    apiModal.addEventListener('click', (e) => {
        if (e.target === apiModal) hideApiModal();
    });

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            // Actualitzar botons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Actualitzar contingut
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
            // Carregar canals si és la pestanya de canals
            if (tabId === 'channels') {
                loadChannelsList();
            }
            // Carregar vídeos si és la pestanya de vídeos
            if (tabId === 'videos') {
                loadUserVideosList();
            }
            // Carregar canals etiquetables si és la pestanya de tags
            if (tabId === 'tags') {
                loadTaggableChannelsList();
            }
            // Reinicialitzar icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    });

    // Toggle visibilitat clau
    toggleApiKey.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        toggleApiKey.innerHTML = `<i data-lucide="${type === 'password' ? 'eye' : 'eye-off'}"></i>`;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    });

    // Desar clau API
    saveApiKey.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showApiStatus('Introdueix una clau API', 'error');
            return;
        }

        showApiStatus('Verificant clau...', 'loading');

        const result = await YouTubeAPI.verifyApiKey(key);
        if (result.valid) {
            YouTubeAPI.setApiKey(key);
            useYouTubeAPI = true;
            showApiStatus('Clau vàlida! Carregant vídeos...', 'success');
            setTimeout(() => {
                hideApiModal();
                loadVideosFromAPI();
            }, 1000);
        } else {
            showApiStatus(result.error || 'Clau API invàlida', 'error');
        }
    });

    // Esborrar clau API
    clearApiKey.addEventListener('click', () => {
        YouTubeAPI.clearApiKey();
        apiKeyInput.value = '';
        useYouTubeAPI = false;
        showApiStatus('Clau esborrada', 'success');
        loadVideos(); // Tornar a dades estàtiques
    });

    // Afegir canal
    addChannelBtn.addEventListener('click', async () => {
        await addChannel();
    });

    channelInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await addChannel();
        }
    });

    // Exportar canals
    const exportChannelsBtn = document.getElementById('exportChannelsBtn');
    exportChannelsBtn.addEventListener('click', exportChannels);

    // Importar canals
    const importChannelsBtn = document.getElementById('importChannelsBtn');
    const importFileInput = document.getElementById('importFileInput');

    importChannelsBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importChannels(e.target.files[0]);
            e.target.value = ''; // Reset input
        }
    });

    // Carregar clau existent
    if (YouTubeAPI.hasApiKey()) {
        apiKeyInput.value = YouTubeAPI.getApiKey();
    }
}

// Afegir canal
async function addChannel() {
    const channelInput = document.getElementById('channelInput');
    const channelStatus = document.getElementById('channelStatus');
    let input = channelInput.value.trim();

    if (!input) {
        showChannelStatus('Introdueix un ID o URL de canal', 'error');
        return;
    }

    if (!YouTubeAPI.hasApiKey()) {
        showChannelStatus('Necessites configurar la clau API primer', 'error');
        return;
    }

    // Comprovar si és una URL amb @username
    const handle = extractHandle(input);
    if (handle) {
        showChannelStatus('Cercant canal...', 'loading');

        const result = await YouTubeAPI.getChannelByHandle(handle);
        if (result.channel) {
            // Afegir el canal amb l'ID obtingut
            const addResult = await YouTubeAPI.addUserChannel(result.channel.id);
            if (addResult.success) {
                showChannelStatus(`Canal "${addResult.channel.name}" afegit correctament!`, 'success');
                channelInput.value = '';
                loadChannelsList();
            } else {
                showChannelStatus(addResult.error, 'error');
            }
        } else {
            showChannelStatus(result.error || 'Canal no trobat', 'error');
        }
        return;
    }

    // Extreure ID del canal si és una URL tradicional
    const channelId = extractChannelId(input);

    if (!channelId) {
        showChannelStatus('Format no vàlid. Usa l\'ID del canal, URL o @username.', 'error');
        return;
    }

    showChannelStatus('Verificant canal...', 'loading');

    const result = await YouTubeAPI.addUserChannel(channelId);

    if (result.success) {
        showChannelStatus(`Canal "${result.channel.name}" afegit correctament!`, 'success');
        channelInput.value = '';
        loadChannelsList();
    } else {
        showChannelStatus(result.error, 'error');
    }
}

// Extreure handle (@username) d'una URL o input directe
function extractHandle(input) {
    // Format: @username directe
    if (input.startsWith('@')) {
        return input.substring(1);
    }

    // Format: youtube.com/@username o youtube.com/@username/videos
    const handleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
    if (handleMatch) {
        return handleMatch[1];
    }

    return null;
}

// Extreure ID del canal d'una URL
function extractChannelId(input) {
    // Si ja és un ID (comença amb UC)
    if (input.startsWith('UC') && input.length === 24) {
        return input;
    }

    // URL format: youtube.com/channel/UC...
    const channelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (channelMatch) {
        return channelMatch[1];
    }

    // Si és un string de 24 caràcters, assumim que és un ID
    if (input.length === 24) {
        return input;
    }

    return null;
}

// Mostrar estat del canal
function showChannelStatus(message, type) {
    const channelStatus = document.getElementById('channelStatus');
    channelStatus.textContent = message;
    channelStatus.className = `channel-status ${type}`;

    // Amagar després de 3 segons si és success
    if (type === 'success') {
        setTimeout(() => {
            channelStatus.className = 'channel-status';
        }, 3000);
    }
}

// Exportar canals a fitxer JSON
function exportChannels() {
    const channels = YouTubeAPI.userChannels;

    if (channels.length === 0) {
        showImportStatus('No hi ha canals per exportar', 'error');
        return;
    }

    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        appName: 'iuTube',
        channels: channels
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `iutube-canals-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showImportStatus(`${channels.length} canals exportats correctament`, 'success');
}

// Importar canals des de fitxer JSON
function importChannels(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Validar format
            if (!data.channels || !Array.isArray(data.channels)) {
                showImportStatus('Format de fitxer invàlid', 'error');
                return;
            }

            let imported = 0;
            let skipped = 0;

            data.channels.forEach(channel => {
                // Validar que té ID
                if (!channel.id) {
                    skipped++;
                    return;
                }

                // Comprovar si ja existeix
                const exists = YouTubeAPI.userChannels.find(c => c.id === channel.id) ||
                               YouTubeAPI.catalanChannels.find(c => c.id === channel.id);

                if (!exists) {
                    YouTubeAPI.userChannels.push({
                        id: channel.id,
                        name: channel.name || 'Canal importat',
                        category: channel.category || 'usuari',
                        addedBy: 'import'
                    });
                    imported++;
                } else {
                    skipped++;
                }
            });

            // Guardar
            YouTubeAPI.saveUserChannels();
            loadChannelsList();

            if (imported > 0) {
                showImportStatus(`${imported} canals importats${skipped > 0 ? `, ${skipped} omesos (duplicats)` : ''}`, 'success');
            } else {
                showImportStatus('Tots els canals ja existeixen', 'error');
            }

        } catch (error) {
            console.error('Error important canals:', error);
            showImportStatus('Error llegint el fitxer', 'error');
        }
    };

    reader.onerror = () => {
        showImportStatus('Error llegint el fitxer', 'error');
    };

    reader.readAsText(file);
}

// Mostrar estat d'importació
function showImportStatus(message, type) {
    const importStatus = document.getElementById('importStatus');
    importStatus.textContent = message;
    importStatus.className = `import-status ${type}`;

    // Amagar després de 5 segons si és success
    if (type === 'success') {
        setTimeout(() => {
            importStatus.className = 'import-status';
        }, 5000);
    }
}

// Carregar llista de canals
function loadChannelsList() {
    const verifiedList = document.getElementById('verifiedChannelsList');
    const userList = document.getElementById('userChannelsList');
    const verifiedSection = verifiedList.closest('.channels-section');

    // Canals verificats - amagar secció si està buida
    if (YouTubeAPI.catalanChannels.length > 0) {
        verifiedSection.style.display = 'block';
        verifiedList.innerHTML = YouTubeAPI.catalanChannels.map(channel => `
            <div class="channel-item">
                <div class="channel-item-info">
                    <div class="channel-item-name">${escapeHtml(channel.name)}</div>
                    <div class="channel-item-category">${channel.category}</div>
                </div>
                <span class="channel-item-badge">Verificat</span>
            </div>
        `).join('');
    } else {
        verifiedSection.style.display = 'none';
    }

    // Canals de l'usuari
    if (YouTubeAPI.userChannels.length > 0) {
        userList.innerHTML = YouTubeAPI.userChannels.map(channel => `
            <div class="channel-item">
                <div class="channel-item-info">
                    <div class="channel-item-name">${escapeHtml(channel.name)}</div>
                    <div class="channel-item-category">${channel.category}</div>
                </div>
                <span class="channel-item-badge user">Personal</span>
                <button class="channel-item-remove" data-channel-id="${channel.id}" title="Eliminar">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `).join('');

        // Event listeners per eliminar
        const removeButtons = userList.querySelectorAll('.channel-item-remove');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const channelId = btn.dataset.channelId;
                YouTubeAPI.removeUserChannel(channelId);
                loadChannelsList();
                showChannelStatus('Canal eliminat', 'success');
            });
        });
    } else {
        userList.innerHTML = '<div class="empty-channels">No has afegit cap canal. Afegeix canals catalans per personalitzar el teu feed.</div>';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Mostrar/amagar modal
function showApiModal() {
    apiModal.classList.add('active');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function hideApiModal() {
    apiModal.classList.remove('active');
}

// Mostrar estat API
function showApiStatus(message, type) {
    apiStatus.textContent = message;
    apiStatus.className = `api-status ${type}`;
}

// Mostrar/amagar loading
function showLoading() {
    loading.classList.add('active');
}

function hideLoading() {
    loading.classList.remove('active');
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
            await loadVideosByCategoryWithUser(categoryId);
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
    document.querySelector('.page-title').textContent = 'Recomanats per a tu';

    const result = await YouTubeAPI.getPopularVideos(CONFIG.layout.videosPerPage);

    if (result.error) {
        console.error('Error:', result.error);
        hideLoading();
        loadVideos(); // Fallback a dades estàtiques
        return;
    }

    renderVideos(result.items);
    hideLoading();
}

// Carregar vídeos en tendència
async function loadTrendingVideos() {
    showLoading();
    document.querySelector('.page-title').textContent = 'Tendències';

    const result = await YouTubeAPI.getPopularVideos(24);

    if (result.error) {
        hideLoading();
        return;
    }

    renderVideos(result.items);
    hideLoading();
}

// Cercar vídeos
async function searchVideos(query) {
    showLoading();
    document.querySelector('.page-title').textContent = `Resultats per: "${query}"`;
    showHome();

    const result = await YouTubeAPI.searchVideos(query, CONFIG.layout.videosPerPage);

    if (result.error) {
        hideLoading();
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

// Carregar vídeos per categoria
async function loadVideosByCategory(categoryId) {
    showLoading();
    const category = CONFIG.categories.find(c => c.id == categoryId);
    document.querySelector('.page-title').textContent = category ? category.name : 'Categoria';
    showHome();

    const result = await YouTubeAPI.getVideosByCategory(categoryId, CONFIG.layout.videosPerPage);

    if (result.error || result.items.length === 0) {
        // Fallback: cercar per nom de categoria
        const searchResult = await YouTubeAPI.searchVideos(category.name, CONFIG.layout.videosPerPage);
        if (searchResult.items.length > 0) {
            const videoIds = searchResult.items.map(v => v.id).join(',');
            const details = await fetchVideoDetails(videoIds);
            renderVideos(details.length > 0 ? details : searchResult.items);
        }
        hideLoading();
        return;
    }

    renderVideos(result.items);
    hideLoading();
}

// Renderitzar vídeos de l'API
function renderVideos(videos) {
    // Guardar vídeos i canals a la cache
    videos.forEach(video => {
        if (!cachedAPIVideos.find(v => v.id === video.id)) {
            cachedAPIVideos.push(video);
        }
        // Guardar informació del canal
        if (video.channelId && !cachedChannels[video.channelId]) {
            cachedChannels[video.channelId] = {
                id: video.channelId,
                name: video.channelTitle,
                thumbnail: video.channelThumbnail || null
            };
        }
    });

    videosGrid.innerHTML = videos.map(video => createVideoCardAPI(video)).join('');

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

// Renderitzar resultats de cerca (sense estadístiques)
function renderSearchResults(videos) {
    videosGrid.innerHTML = videos.map(video => `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
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
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
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
        <iframe
            src="https://www.youtube.com/embed/${videoId}?autoplay=1"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
    `;

    // Obtenir detalls del vídeo
    const videoResult = await YouTubeAPI.getVideoDetails(videoId);

    if (videoResult.video) {
        const video = videoResult.video;

        document.getElementById('videoTitle').textContent = video.title;
        document.getElementById('videoViews').innerHTML = `
            <i data-lucide="eye"></i>
            ${formatViews(video.viewCount)} visualitzacions
        `;
        document.getElementById('videoDate').textContent = formatDate(video.publishedAt);
        document.getElementById('videoLikes').textContent = formatViews(video.likeCount);

        // Obtenir informació del canal
        const channelResult = await YouTubeAPI.getChannelDetails(video.channelId);

        if (channelResult.channel) {
            const channel = channelResult.channel;
            const channelInfo = document.getElementById('channelInfo');
            channelInfo.innerHTML = `
                <div class="channel-header">
                    <img src="${channel.thumbnail}" alt="${escapeHtml(channel.title)}" class="channel-avatar-large">
                    <div class="channel-details">
                        <div class="channel-name-large">${escapeHtml(channel.title)}</div>
                        <div class="channel-subscribers">${formatViews(channel.subscriberCount)} subscriptors</div>
                    </div>
                    ${CONFIG.features.subscriptions ? `
                        <button class="subscribe-btn">Subscriu-te</button>
                    ` : ''}
                </div>
                <div class="video-description">${escapeHtml(video.description).substring(0, 500)}${video.description.length > 500 ? '...' : ''}</div>
            `;
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
    videosGrid.innerHTML = VIDEOS.map(video => createVideoCard(video)).join('');

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
        <iframe
            src="${video.videoUrl}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
    `;

    document.getElementById('videoTitle').textContent = video.title;
    document.getElementById('videoViews').innerHTML = `
        <i data-lucide="eye"></i>
        ${formatViews(video.views)} visualitzacions
    `;
    document.getElementById('videoDate').textContent = formatDate(video.uploadDate);
    document.getElementById('videoLikes').textContent = formatViews(video.likes);

    const channelInfo = document.getElementById('channelInfo');
    channelInfo.innerHTML = `
        <div class="channel-header">
            <img src="${channel.avatar}" alt="${channel.name}" class="channel-avatar-large">
            <div class="channel-details">
                <div class="channel-name-large">${channel.name}</div>
                <div class="channel-subscribers">${formatViews(channel.subscribers)} subscriptors</div>
            </div>
            ${CONFIG.features.subscriptions ? `
                <button class="subscribe-btn">Subscriu-te</button>
            ` : ''}
        </div>
        <div class="video-description">${video.description}</div>
    `;

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

// Carregar vídeo des de URL si hi ha paràmetre ?v=
const urlParams = new URLSearchParams(window.location.search);
const videoParam = urlParams.get('v');
if (videoParam) {
    setTimeout(() => {
        if (YouTubeAPI.hasApiKey()) {
            showVideoFromAPI(videoParam);
        } else {
            showVideo(videoParam);
        }
    }, 100);
}

// ==================== GESTIÓ DE VÍDEOS D'USUARI ====================

// Carregar vídeos de l'usuari des de localStorage
function loadUserVideos() {
    const stored = localStorage.getItem(USER_VIDEOS_KEY);
    if (stored) {
        try {
            userVideos = JSON.parse(stored);
        } catch (e) {
            userVideos = [];
        }
    }
}

// Guardar vídeos de l'usuari a localStorage
function saveUserVideos() {
    localStorage.setItem(USER_VIDEOS_KEY, JSON.stringify(userVideos));
}

// Extreure ID del vídeo de YouTube d'una URL
function extractVideoId(url) {
    if (!url) return null;

    // Format: youtube.com/watch?v=VIDEO_ID
    let match = url.match(/[?&]v=([^&]+)/);
    if (match) return match[1];

    // Format: youtu.be/VIDEO_ID
    match = url.match(/youtu\.be\/([^?&]+)/);
    if (match) return match[1];

    // Format: youtube.com/embed/VIDEO_ID
    match = url.match(/youtube\.com\/embed\/([^?&]+)/);
    if (match) return match[1];

    // Format: youtube.com/v/VIDEO_ID
    match = url.match(/youtube\.com\/v\/([^?&]+)/);
    if (match) return match[1];

    // Si ja és un ID (11 caràcters)
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
        return url;
    }

    return null;
}

// Inicialitzar el tab de vídeos
function initVideoTab() {
    const addVideoBtn = document.getElementById('addVideoBtn');
    const videoUrlInput = document.getElementById('videoUrlInput');

    if (addVideoBtn) {
        addVideoBtn.addEventListener('click', addUserVideo);
    }

    if (videoUrlInput) {
        videoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addUserVideo();
            }
        });
    }

    // Carregar vídeos guardats
    loadUserVideos();
}

// Afegir vídeo de l'usuari
async function addUserVideo() {
    const videoUrlInput = document.getElementById('videoUrlInput');
    const categorySelect = document.getElementById('videoCategorySelect');
    const url = videoUrlInput.value.trim();
    const category = categorySelect.value;

    if (!url) {
        showVideoStatus('Introdueix una URL de vídeo', 'error');
        return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
        showVideoStatus('URL no vàlida. Usa una URL de YouTube.', 'error');
        return;
    }

    // Comprovar si ja existeix
    if (userVideos.find(v => v.id === videoId)) {
        showVideoStatus('Aquest vídeo ja està afegit', 'error');
        return;
    }

    showVideoStatus('Obtenint informació del vídeo...', 'loading');

    // Intentar obtenir informació del vídeo via API si està disponible
    let videoInfo = {
        id: videoId,
        title: 'Vídeo de YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        channelTitle: 'Canal desconegut',
        category: category,
        addedAt: new Date().toISOString()
    };

    if (YouTubeAPI.hasApiKey()) {
        try {
            const result = await YouTubeAPI.getVideoDetails(videoId);
            if (result.video) {
                videoInfo.title = result.video.title;
                videoInfo.thumbnail = result.video.thumbnail;
                videoInfo.channelTitle = result.video.channelTitle;
                videoInfo.duration = result.video.duration;
                videoInfo.viewCount = result.video.viewCount;
                videoInfo.publishedAt = result.video.publishedAt;
            }
        } catch (e) {
            console.log('No s\'ha pogut obtenir info del vídeo:', e);
        }
    }

    // Afegir a la llista
    userVideos.push(videoInfo);
    saveUserVideos();

    // Netejar input
    videoUrlInput.value = '';

    showVideoStatus(`Vídeo "${videoInfo.title}" afegit a ${getCategoryName(category)}!`, 'success');
    loadUserVideosList();
}

// Obtenir nom de categoria
function getCategoryName(categoryId) {
    const cat = CONFIG.categories.find(c => c.id === categoryId);
    return cat ? cat.name : categoryId;
}

// Mostrar estat del vídeo
function showVideoStatus(message, type) {
    const videoStatus = document.getElementById('videoStatus');
    if (!videoStatus) return;

    videoStatus.textContent = message;
    videoStatus.className = `video-status ${type}`;

    if (type === 'success') {
        setTimeout(() => {
            videoStatus.className = 'video-status';
            videoStatus.textContent = '';
        }, 3000);
    }
}

// Carregar llista de vídeos de l'usuari
function loadUserVideosList() {
    const userVideosList = document.getElementById('userVideosList');
    if (!userVideosList) return;

    if (userVideos.length === 0) {
        userVideosList.innerHTML = '<div class="empty-channels">No has afegit cap vídeo. Afegeix vídeos amb la URL de YouTube.</div>';
        return;
    }

    userVideosList.innerHTML = userVideos.map(video => `
        <div class="channel-item video-item">
            <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" class="video-item-thumb">
            <div class="channel-item-info">
                <div class="channel-item-name">${escapeHtml(video.title)}</div>
                <div class="channel-item-category">${getCategoryName(video.category)}</div>
            </div>
            <button class="channel-item-remove" data-video-id="${video.id}" title="Eliminar">
                <i data-lucide="x"></i>
            </button>
        </div>
    `).join('');

    // Event listeners per eliminar
    const removeButtons = userVideosList.querySelectorAll('.channel-item-remove');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const videoId = btn.dataset.videoId;
            removeUserVideo(videoId);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Eliminar vídeo de l'usuari
function removeUserVideo(videoId) {
    userVideos = userVideos.filter(v => v.id !== videoId);
    saveUserVideos();
    loadUserVideosList();
    showVideoStatus('Vídeo eliminat', 'success');
}

// Carregar vídeos per categoria (incloent vídeos d'usuari)
async function loadVideosByCategoryWithUser(categoryId) {
    showLoading();
    const category = CONFIG.categories.find(c => c.id === categoryId);
    document.querySelector('.page-title').textContent = category ? category.name : 'Categoria';
    showHome();

    // Combinar vídeos de l'usuari i vídeos de canals etiquetats
    let categoryVideos = [];

    // Afegir vídeos de l'usuari amb aquesta categoria
    userVideos.forEach(video => {
        if (video.category === categoryId) {
            categoryVideos.push({
                ...video,
                source: 'user'
            });
        }
    });

    // Afegir vídeos de canals que tenen aquesta categoria assignada (manualment o via CSV)
    cachedAPIVideos.forEach(video => {
        // Comprovar categories assignades manualment
        let channelCategories = channelTags[video.channelId] || [];

        // Comprovar categories del CSV (YouTubeAPI.catalanChannels)
        const csvChannel = YouTubeAPI.catalanChannels.find(c => c.id === video.channelId);
        if (csvChannel && csvChannel.categories) {
            channelCategories = [...new Set([...channelCategories, ...csvChannel.categories])];
        }

        if (channelCategories.includes(categoryId)) {
            // Evitar duplicats
            if (!categoryVideos.find(v => v.id === video.id)) {
                categoryVideos.push({
                    ...video,
                    source: 'api'
                });
            }
        }
    });

    if (categoryVideos.length > 0) {
        renderUserVideos(categoryVideos);
    } else {
        videosGrid.innerHTML = `
            <div class="empty-category">
                <i data-lucide="video-off"></i>
                <p>No hi ha vídeos en aquesta categoria</p>
                <p class="empty-hint">Afegeix vídeos o etiqueta canals des de Configuració → Etiquetar</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    hideLoading();
}

// Renderitzar vídeos de l'usuari
function renderUserVideos(videos) {
    videosGrid.innerHTML = videos.map(video => `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                    <div class="video-metadata">
                        <div class="channel-name">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            ${video.viewCount ? `<i data-lucide="eye" style="width: 12px; height: 12px;"></i><span>${formatViews(video.viewCount)} visualitzacions</span><span>•</span>` : ''}
                            <span>${video.publishedAt ? formatDate(video.publishedAt) : formatDate(video.addedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

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

// ==================== GESTIÓ D'ETIQUETES DE CANALS ====================

// Carregar etiquetes de canals des de localStorage
function loadChannelTags() {
    const stored = localStorage.getItem(CHANNEL_TAGS_KEY);
    if (stored) {
        try {
            channelTags = JSON.parse(stored);
        } catch (e) {
            channelTags = {};
        }
    }
}

// Guardar etiquetes de canals a localStorage
function saveChannelTags() {
    localStorage.setItem(CHANNEL_TAGS_KEY, JSON.stringify(channelTags));
}

// Inicialitzar el tab d'etiquetes
function initTagsTab() {
    loadChannelTags();
}

// Carregar llista de canals etiquetables
function loadTaggableChannelsList() {
    const taggableChannelsList = document.getElementById('taggableChannelsList');
    if (!taggableChannelsList) return;

    // Obtenir tots els canals (dels vídeos cached i dels canals de l'usuari)
    let allChannels = [];

    // Afegir canals de l'API cached
    Object.values(cachedChannels).forEach(channel => {
        if (!allChannels.find(c => c.id === channel.id)) {
            allChannels.push({
                ...channel,
                categories: channelTags[channel.id] || []
            });
        }
    });

    // Afegir canals dels canals catalans i de l'usuari si estan disponibles
    if (typeof YouTubeAPI !== 'undefined') {
        [...(YouTubeAPI.catalanChannels || []), ...(YouTubeAPI.userChannels || [])].forEach(channel => {
            if (!allChannels.find(c => c.id === channel.id)) {
                allChannels.push({
                    id: channel.id,
                    name: channel.name,
                    thumbnail: null,
                    categories: channelTags[channel.id] || []
                });
            }
        });
    }

    if (allChannels.length === 0) {
        taggableChannelsList.innerHTML = `
            <div class="empty-channels">
                No hi ha canals. Navega per la pàgina principal per carregar vídeos o afegeix canals a la pestanya "Canals".
            </div>
        `;
        return;
    }

    // Ordenar per nom
    allChannels.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    taggableChannelsList.innerHTML = allChannels.map(channel => `
        <div class="taggable-channel-item" data-channel-id="${channel.id}">
            <div class="taggable-channel-info">
                <div class="channel-item-name">${escapeHtml(channel.name || 'Canal desconegut')}</div>
                <div class="channel-categories-display">
                    ${channel.categories.length > 0 ?
                        channel.categories.map(cat => `<span class="category-badge">${getCategoryName(cat)}</span>`).join('') :
                        '<span class="no-category">Sense categories</span>'}
                </div>
            </div>
            <div class="channel-categories-selector">
                ${CONFIG.categories.map(cat => `
                    <label class="category-checkbox">
                        <input type="checkbox"
                            data-channel-id="${channel.id}"
                            data-category="${cat.id}"
                            ${channel.categories.includes(cat.id) ? 'checked' : ''}>
                        <span>${cat.name}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Event listeners per canviar categories
    const checkboxes = taggableChannelsList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const channelId = e.target.dataset.channelId;
            const categoryId = e.target.dataset.category;
            const isChecked = e.target.checked;
            toggleChannelCategory(channelId, categoryId, isChecked);
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Alternar categoria d'un canal
function toggleChannelCategory(channelId, categoryId, add) {
    if (!channelTags[channelId]) {
        channelTags[channelId] = [];
    }

    if (add) {
        if (!channelTags[channelId].includes(categoryId)) {
            channelTags[channelId].push(categoryId);
        }
    } else {
        channelTags[channelId] = channelTags[channelId].filter(c => c !== categoryId);
        // Eliminar entrada si no té categories
        if (channelTags[channelId].length === 0) {
            delete channelTags[channelId];
        }
    }

    saveChannelTags();

    // Actualitzar la visualització de categories
    loadTaggableChannelsList();

    showTagStatus('Categories actualitzades!', 'success');
}

// Mostrar estat de l'etiquetatge
function showTagStatus(message, type) {
    const tagStatus = document.getElementById('tagStatus');
    if (!tagStatus) return;

    tagStatus.textContent = message;
    tagStatus.className = `tag-status ${type}`;

    if (type === 'success') {
        setTimeout(() => {
            tagStatus.className = 'tag-status';
            tagStatus.textContent = '';
        }, 2000);
    }
}
