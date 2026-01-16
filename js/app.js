// App Principal

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading;
let currentVideoId = null;
let useYouTubeAPI = false;

// Cache de vídeos carregats de l'API
let cachedAPIVideos = [];

// Cache de canals carregats de l'API
let cachedChannels = {};

// Inicialitzar l'aplicació
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    initEventListeners();
    loadCategories();

    // Inicialitzar YouTubeAPI (carregar canals catalans)
    await YouTubeAPI.init();

    // Comprovar si hi ha clau API guardada
    if (YouTubeAPI.hasApiKey()) {
        useYouTubeAPI = true;
        loadVideosFromAPI();
    } else {
        loadVideos();
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

    // Tancar sidebar en mòbil quan es clica fora
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
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
        hideFeaturedVideo();
        loadVideos(); // Fallback a dades estàtiques
        return;
    }

    // Mostrar el primer vídeo com a destacat
    if (result.items.length > 0) {
        showFeaturedVideo(result.items[0], 'home');
        // Renderitzar la resta de vídeos (excloent el destacat)
        renderVideos(result.items.slice(1));
    } else {
        hideFeaturedVideo();
        renderVideos(result.items);
    }

    hideLoading();
}

// Carregar vídeos en tendència
async function loadTrendingVideos() {
    showLoading();
    document.querySelector('.page-title').textContent = 'Tendències';

    const result = await YouTubeAPI.getPopularVideos(24);

    if (result.error) {
        hideLoading();
        hideFeaturedVideo();
        return;
    }

    // Mostrar el primer vídeo com a destacat
    if (result.items.length > 0) {
        showFeaturedVideo(result.items[0], 'trending');
        renderVideos(result.items.slice(1));
    } else {
        hideFeaturedVideo();
        renderVideos(result.items);
    }

    hideLoading();
}

// Cercar vídeos
async function searchVideos(query) {
    showLoading();
    document.querySelector('.page-title').textContent = `Resultats per: "${query}"`;
    showHome();
    hideFeaturedVideo(); // Amagar el vídeo destacat en cerques

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
    // Nota: El vídeo destacat es gestiona a les funcions de càrrega
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

// Carregar vídeos per categoria
async function loadVideosByCategoryWithUser(categoryId) {
    showLoading();
    const category = CONFIG.categories.find(c => c.id === categoryId);
    document.querySelector('.page-title').textContent = category ? category.name : 'Categoria';
    showHome();

    // Obtenir vídeos de canals amb aquesta categoria assignada via CSV
    let categoryVideos = [];

    cachedAPIVideos.forEach(video => {
        // Comprovar categories del CSV (YouTubeAPI.catalanChannels)
        const csvChannel = YouTubeAPI.catalanChannels.find(c => c.id === video.channelId);
        if (csvChannel && csvChannel.categories && csvChannel.categories.includes(categoryId)) {
            if (!categoryVideos.find(v => v.id === video.id)) {
                categoryVideos.push(video);
            }
        }
    });

    if (categoryVideos.length > 0) {
        // Mostrar el primer vídeo com a destacat amb el color de la categoria
        showFeaturedVideo(categoryVideos[0], categoryId);
        // Renderitzar la resta de vídeos
        if (categoryVideos.length > 1) {
            renderCategoryVideos(categoryVideos.slice(1));
        } else {
            videosGrid.innerHTML = '';
        }
    } else {
        hideFeaturedVideo();
        videosGrid.innerHTML = `
            <div class="empty-category">
                <i data-lucide="video-off"></i>
                <p>No hi ha vídeos en aquesta categoria</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    hideLoading();
}

// Renderitzar vídeos per categoria
function renderCategoryVideos(videos) {
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
                            <span>${video.publishedAt ? formatDate(video.publishedAt) : ''}</span>
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

// ==================== VÍDEO DESTACAT DEL MOMENT ====================

// Secció actual per al vídeo destacat
let currentSection = 'home';

// Noms de les seccions per al badge
const sectionNames = {
    'home': 'Inici',
    'trending': 'Tendències',
    'societat': 'Societat',
    'cultura': 'Cultura',
    'humor': 'Humor',
    'gaming': 'Gaming',
    'vida': 'Vida'
};

// Mostrar vídeo destacat
function showFeaturedVideo(video, section = 'home') {
    const featuredSection = document.getElementById('featuredVideoSection');
    const featuredContainer = document.getElementById('featuredVideoContainer');
    const featuredBadge = document.getElementById('featuredBadge');

    if (!featuredSection || !featuredContainer || !video) {
        if (featuredSection) featuredSection.style.display = 'none';
        return;
    }

    currentSection = section;

    // Actualitzar classe de color
    featuredSection.className = `featured-video-section section-${section}`;
    featuredSection.style.display = 'block';

    // Actualitzar badge
    featuredBadge.textContent = sectionNames[section] || section;

    // Renderitzar contingut
    featuredContainer.innerHTML = `
        <div class="featured-video-thumbnail" data-video-id="${video.id}">
            <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
            ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
            <div class="play-overlay">
                <i data-lucide="play"></i>
            </div>
        </div>
        <div class="featured-video-info">
            <h3 class="video-title">${escapeHtml(video.title)}</h3>
            <div class="video-channel">${escapeHtml(video.channelTitle || '')}</div>
            <div class="video-stats">
                ${video.viewCount ? `<i data-lucide="eye" style="width: 14px; height: 14px;"></i><span>${formatViews(video.viewCount)} visualitzacions</span><span>•</span>` : ''}
                <span>${video.publishedAt ? formatDate(video.publishedAt) : ''}</span>
            </div>
            ${video.description ? `<p class="video-description">${escapeHtml(video.description.substring(0, 200))}${video.description.length > 200 ? '...' : ''}</p>` : ''}
        </div>
    `;

    // Event listener per reproduir el vídeo
    const thumbnail = featuredContainer.querySelector('.featured-video-thumbnail');
    if (thumbnail) {
        thumbnail.addEventListener('click', () => {
            showVideoFromAPI(video.id);
        });
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Amagar vídeo destacat
function hideFeaturedVideo() {
    const featuredSection = document.getElementById('featuredVideoSection');
    if (featuredSection) {
        featuredSection.style.display = 'none';
    }
}

