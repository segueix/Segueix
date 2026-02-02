// App Principal
function isMatch(text, query) {
    if (!text || !query) {
        return false;
    }
    const normalizedQuery = String(query).trim();
    if (!normalizedQuery) {
        return false;
    }
    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedQuery}\\b`, 'i');
    return pattern.test(String(text));
}

function getVideoDisplayDuration(video) {
    const rawDuration = video?.duration || video?.contentDetails?.duration || '';
    if (!rawDuration || typeof rawDuration !== 'string') {
        return '';
    }
    if (!rawDuration.startsWith('PT')) {
        return rawDuration;
    }
    if (typeof YouTubeAPI?.parseDuration === 'function') {
        return YouTubeAPI.parseDuration(rawDuration);
    }
    const match = rawDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
        return '';
    }
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Elements del DOM
let sidebar, menuBtn, videosGrid, homePage, watchPage, loading, mainContent;
let historyPage, historyGrid, historyFilters, chipsBar;
let customCategoryModal, customCategoryInput, customCategoryAddBtn, customCategoryModalClose;
let playlistsPage, playlistsList, playlistNameInput, createPlaylistBtn;
let followPage, followGrid, followTabs;
let heroSection, heroTitle, heroDescription, heroImage, heroDuration, heroButton, heroEyebrow, heroChannel;
let pageTitle;
let backgroundModal, backgroundBtn, backgroundOptions;
let currentColorDisplay, expandedColorPicker, closeExpandedColorPicker;
let fontDecreaseBtn, fontIncreaseBtn, fontSizeDisplay;
let playlistModal, playlistModalBody;
let videoPlayer, videoPlaceholder, placeholderImage;
let channelPage, channelVideosGrid;
let channelBackBtn, channelProfileAvatar, channelProfileName, channelProfileSubscribers;
let channelProfileHandle, channelProfileDescription, channelProfileTags, channelProfileFollowBtn, channelProfileShareBtn;
let searchForm, searchInput, searchDropdown;
let extraVideosGrid;
let currentVideoId = null;
let useYouTubeAPI = false;
let selectedCategory = 'Novetats';
let historySelectedCategory = 'Novetats';
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
let isPlaylistListBound = false;
let isPlaylistQueueBound = false;
let playlistDragState = null;
let playlistQueueDragState = null;
let currentShortIndex = 0;
let currentShortsQueue = [];
let isNavigatingShort = false;
let shortModalScrollY = 0;
let shortNavHintShown = false;
let youtubeMessageListenerInitialized = false;
let searchDropdownItems = [];
let searchDropdownActiveIndex = -1;
let searchDebounceTimeout = null;
let installPromptEvent = null;
let currentFontSize = null;
let userGridPreference = '4';
let userWatchGridPreference = '3';
const featuredVideoBySection = new Map();
const customCategorySearchCache = new Map();
const customCategorySearchInFlight = new Map();
const HYBRID_CATEGORY_SORT = new Set(['Cultura', 'Diversió', 'Actualitat', 'Vida', 'El Món', 'Gaming', 'Mitjans']);

const BACKGROUND_STORAGE_KEY = 'catube_background_color';
const FONT_SIZE_STORAGE_KEY = 'catube_font_size';
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
const CHIPS_ORDER_STORAGE_KEY = 'catube_chip_order';
const CUSTOM_TAGS_STORAGE_KEY = 'catube_custom_tags';
const GRID_LAYOUT_STORAGE_KEY = 'catube_grid_layout';
const WATCH_GRID_LAYOUT_STORAGE_KEY = 'catube_watch_grid_layout';
const WATCH_CATEGORY_VIDEOS_LIMIT = 30;
const DESKTOP_BREAKPOINT = 1024;
const WATCH_SIDEBAR_VIDEOS_LIMIT = 55;
const CHANNEL_CUSTOM_CATEGORIES_KEY = 'catube_channel_custom_categories';

// Cache de canals carregats de l'API
let cachedChannels = {};

// Cache de vídeos carregats de l'API
let cachedAPIVideos = [];
let activeFollowTab = 'following';
let channelCategoryPickerCleanup = null;

function mergeChannelCategories(channel, categories) {
    if (!channel || !Array.isArray(categories) || categories.length === 0) {
        return;
    }
    channel.categories = [...new Set([...(channel.categories || []), ...categories])];
}

function resolveChannelAvatar(channelId, channelObj) {
    if (channelObj) {
        if (channelObj.avatar) return channelObj.avatar;
        if (channelObj.thumbnail) return channelObj.thumbnail;
        if (channelObj.snippet?.thumbnails?.medium?.url) return channelObj.snippet.thumbnails.medium.url;
        if (channelObj.snippet?.thumbnails?.default?.url) return channelObj.snippet.thumbnails.default.url;
    }

    const cached = cachedChannels[channelId];
    if (cached) {
        if (cached.thumbnail) return cached.thumbnail;
        if (cached.avatar) return cached.avatar;
    }

    const followAvatar = getFollowChannelAvatar(channelId);
    if (followAvatar) return followAvatar;

    return 'img/icon-192.png';
}

function isDesktopView() {
    return window.innerWidth > DESKTOP_BREAKPOINT;
}

function loadGridLayoutPreference() {
    const storedPreference = localStorage.getItem(GRID_LAYOUT_STORAGE_KEY);
    userGridPreference = storedPreference === '3' || storedPreference === '4' ? storedPreference : '4';
}

function loadWatchGridLayoutPreference() {
    const storedPreference = localStorage.getItem(WATCH_GRID_LAYOUT_STORAGE_KEY);
    userWatchGridPreference = storedPreference === '2' || storedPreference === '3' ? storedPreference : '3';
}

function updateGridLayoutControlState() {
    const controls = homePage?.querySelector('.grid-layout-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('[data-grid-layout]').forEach(button => {
        const isActive = button.dataset.gridLayout === userGridPreference;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function applyGridLayoutPreference() {
    if (!videosGrid) {
        return;
    }
    videosGrid.classList.remove('cols-3', 'cols-4');
    if (userGridPreference === '3') {
        videosGrid.classList.add('cols-3');
    } else {
        videosGrid.classList.add('cols-4');
    }
    updateGridLayoutControlState();
}

function updateWatchGridLayoutControlState() {
    const controls = watchPage?.querySelector('.watch-grid-controls');
    if (!controls) {
        return;
    }
    controls.querySelectorAll('[data-watch-grid-layout]').forEach(button => {
        const isActive = button.dataset.watchGridLayout === userWatchGridPreference;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function applyWatchGridLayoutPreference() {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer) {
        return;
    }
    extraContainer.classList.remove('cols-2', 'cols-3');
    if (userWatchGridPreference === '2') {
        extraContainer.classList.add('cols-2');
    } else {
        extraContainer.classList.add('cols-3');
    }
    updateWatchGridLayoutControlState();
}

function ensureGridLayoutControls() {
    if (!videosGrid || !homePage) {
        return;
    }
    let controls = homePage.querySelector('.grid-layout-controls');
    if (!controls) {
        const controlsMarkup = `
            <div class="grid-layout-controls" aria-label="Grid Layout Options">
                <button class="grid-layout-button" type="button" data-grid-layout="3" aria-pressed="false" aria-label="View 3 columns" title="3 Columns">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="4" height="16" rx="1" />
                        <rect x="10" y="4" width="4" height="16" rx="1" />
                        <rect x="17" y="4" width="4" height="16" rx="1" />
                    </svg>
                </button>
                <button class="grid-layout-button" type="button" data-grid-layout="4" aria-pressed="false" aria-label="View 4 columns" title="4 Columns">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="4" width="3" height="16" rx="0.5" />
                        <rect x="7.5" y="4" width="3" height="16" rx="0.5" />
                        <rect x="13" y="4" width="3" height="16" rx="0.5" />
                        <rect x="18.5" y="4" width="3" height="16" rx="0.5" />
                    </svg>
                </button>
            </div>
        `;
        videosGrid.insertAdjacentHTML('beforebegin', controlsMarkup);
        controls = homePage.querySelector('.grid-layout-controls');
    }
    if (controls && controls.dataset.bound !== 'true') {
        controls.dataset.bound = 'true';
        controls.addEventListener('click', (event) => {
            const button = event.target.closest('[data-grid-layout]');
            if (!button) {
                return;
            }
            const preference = button.dataset.gridLayout;
            if (preference !== '3' && preference !== '4') {
                return;
            }
            userGridPreference = preference;
            localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, userGridPreference);
            applyGridLayoutPreference();
        });
    }
    updateGridLayoutControlState();
}

function ensureWatchGridLayoutControls() {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer || !watchPage) {
        return;
    }

    const title = watchPage.querySelector('.extra-related-title');
    let header = watchPage.querySelector('.extra-related-header');

    if (!header && title) {
        header = document.createElement('div');
        header.className = 'extra-related-header';
        extraContainer.parentNode?.insertBefore(header, extraContainer);
        header.appendChild(title);
    } else if (header && title && title.parentNode !== header) {
        header.appendChild(title);
    }

    if (!header) {
        return;
    }

    let controls = header.querySelector('.watch-grid-controls');
    if (!controls) {
        const controlsMarkup = `
            <div class="watch-grid-controls" aria-label="Opcions de columnes">
                <button class="grid-layout-button" type="button" data-watch-grid-layout="2" aria-pressed="false" aria-label="Veure 2 columnes" title="2 Columnes">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="7" height="16" rx="1" />
                        <rect x="13" y="4" width="7" height="16" rx="1" />
                    </svg>
                </button>
                <button class="grid-layout-button" type="button" data-watch-grid-layout="3" aria-pressed="false" aria-label="Veure 3 columnes" title="3 Columnes">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="4" height="16" rx="1" />
                        <rect x="10" y="4" width="4" height="16" rx="1" />
                        <rect x="17" y="4" width="4" height="16" rx="1" />
                    </svg>
                </button>
            </div>
        `;
        header.insertAdjacentHTML('beforeend', controlsMarkup);
        controls = header.querySelector('.watch-grid-controls');
    }

    if (controls && controls.dataset.bound !== 'true') {
        controls.dataset.bound = 'true';
        controls.addEventListener('click', (event) => {
            const button = event.target.closest('[data-watch-grid-layout]');
            if (!button) {
                return;
            }
            const preference = button.dataset.watchGridLayout;
            if (preference !== '2' && preference !== '3') {
                return;
            }
            userWatchGridPreference = preference;
            localStorage.setItem(WATCH_GRID_LAYOUT_STORAGE_KEY, userWatchGridPreference);
            applyWatchGridLayoutPreference();
        });
    }
    updateWatchGridLayoutControlState();
}

const DEFAULT_EXTRA_RELATED_TITLE = 'Altres vídeos relacionats';

function setExtraRelatedTitle(text) {
    if (!watchPage) {
        return;
    }
    const title = watchPage.querySelector('.extra-related-title');
    if (title) {
        title.textContent = text || DEFAULT_EXTRA_RELATED_TITLE;
    }
}

function getPlaylistSearchKeywords(playlistName) {
    return String(playlistName || '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
}

function getPlaylistSearchVideos(playlistName) {
    const trimmedName = String(playlistName || '').trim();
    if (!trimmedName) {
        return [];
    }

    const keywords = getPlaylistSearchKeywords(trimmedName);
    const queries = keywords.length > 0 ? keywords : [trimmedName.toLowerCase()];
    const videosMap = new Map();

    queries.forEach(query => {
        const results = performLocalSearch(query);
        if (!Array.isArray(results?.videos)) {
            return;
        }
        results.videos.forEach(video => {
            const normalizedId = String(video.id);
            const existing = videosMap.get(normalizedId);
            const score = Number.isFinite(video.score) ? video.score : 0;
            if (existing) {
                existing.score = (existing.score || 0) + score;
            } else {
                videosMap.set(normalizedId, { ...video, score });
            }
        });
    });

    return Array.from(videosMap.values())
        .filter(video => !video.isShort)
        .sort((a, b) => {
            if ((b.score || 0) !== (a.score || 0)) {
                return (b.score || 0) - (a.score || 0);
            }
            const viewA = a.viewCount ?? a.views ?? 0;
            const viewB = b.viewCount ?? b.views ?? 0;
            if (viewA !== viewB) {
                return viewB - viewA;
            }
            return (a.title || '').localeCompare((b.title || ''), 'ca', { sensitivity: 'base' });
        });
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

function isMitjansChannel(channelId) {
    if (!channelId) {
        return false;
    }
    const normalizedId = String(channelId);
    let feedCats = [];
    if (cachedChannels[normalizedId]?.categories) {
        feedCats = cachedChannels[normalizedId].categories;
    } else if (typeof YouTubeAPI !== 'undefined' && Array.isArray(YouTubeAPI.feedChannels)) {
        const feedChannel = YouTubeAPI.feedChannels.find(channel => String(channel.id) === normalizedId);
        if (feedChannel?.categories) {
            feedCats = feedChannel.categories;
        }
    }

    const customCats = getChannelCustomCategories(normalizedId);
    const allCats = [...feedCats, ...customCats];
    return allCats.some(cat => String(cat).toLowerCase() === 'mitjans');
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
    button.setAttribute('aria-label', followed ? 'Deixa de seguir aquest canal' : 'Segueix aquest canal');
    button.textContent = followed ? 'Seguint' : 'Segueix';
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

function bindChannelLinks(container = document) {
    const links = container.querySelectorAll('.channel-link');
    links.forEach(link => {
        if (link.dataset.channelLinkBound === 'true') {
            return;
        }
        const channelId = link.dataset.channelId;
        if (!channelId) {
            return;
        }
        link.dataset.channelLinkBound = 'true';
        link.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            openChannelProfile(channelId);
        });
    });
}

function normalizeCustomTag(tag) {
    if (!tag || typeof tag !== 'string') {
        return '';
    }
    return tag.trim();
}

function getStandardChipLabels() {
    const configLabels = Array.isArray(CONFIG?.categories)
        ? CONFIG.categories.map(cat => cat.name).filter(Boolean)
        : [];
    return ['Novetats', ...configLabels, 'Seguint'];
}

function isStandardCategory(tag) {
    const normalized = normalizeCustomTag(tag).toLowerCase();
    if (!normalized) {
        return false;
    }
    return getStandardChipLabels().some(label => label.toLowerCase() === normalized);
}

function getCustomTags() {
    const stored = localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map(tag => normalizeCustomTag(tag))
            .filter(tag => tag);
    } catch (error) {
        console.warn('No es pot llegir catube_custom_tags', error);
        return [];
    }
}

function saveCustomTags(tags) {
    if (!Array.isArray(tags)) {
        return;
    }
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(tags));
}

function addCustomTag(tag) {
    const normalized = normalizeCustomTag(tag);
    if (!normalized) {
        return null;
    }
    if (isStandardCategory(normalized)) {
        return normalized;
    }
    const tags = getCustomTags();
    const exists = tags.some(existing => existing.toLowerCase() === normalized.toLowerCase());
    if (exists) {
        return tags.find(existing => existing.toLowerCase() === normalized.toLowerCase()) || normalized;
    }
    const nextTags = [...tags, normalized];
    saveCustomTags(nextTags);

    const storedOrder = getStoredChipOrder();
    if (storedOrder && !storedOrder.some(value => value.toLowerCase() === normalized.toLowerCase())) {
        saveChipOrder([...storedOrder, normalized]);
    }
    return normalized;
}

function getChannelCustomCategories(channelId) {
    if (!channelId) {
        return [];
    }
    const stored = localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
            return [];
        }
        const saved = parsed[String(channelId)];
        if (!Array.isArray(saved)) {
            return [];
        }
        return saved
            .map(tag => normalizeCustomTag(tag))
            .filter(tag => tag);
    } catch (error) {
        console.warn('No es pot llegir catube_channel_custom_categories', error);
        return [];
    }
}

function saveChannelCustomCategories(channelId, categories) {
    if (!channelId) {
        return;
    }
    const stored = localStorage.getItem(CHANNEL_CUSTOM_CATEGORIES_KEY);
    let parsed = {};
    if (stored) {
        try {
            parsed = JSON.parse(stored) || {};
        } catch (error) {
            console.warn('No es pot llegir catube_channel_custom_categories', error);
            parsed = {};
        }
    }
    if (!Array.isArray(categories) || categories.length === 0) {
        delete parsed[String(channelId)];
    } else {
        parsed[String(channelId)] = categories;
    }
    localStorage.setItem(CHANNEL_CUSTOM_CATEGORIES_KEY, JSON.stringify(parsed));
}

function addChannelCustomCategory(channelId, category) {
    if (!channelId) {
        return [];
    }
    const normalized = normalizeCustomTag(category);
    if (!normalized) {
        return getChannelCustomCategories(channelId);
    }
    const current = getChannelCustomCategories(channelId);
    const exists = current.some(item => item.toLowerCase() === normalized.toLowerCase());
    if (exists) {
        return current;
    }
    const next = [...current, normalized];
    saveChannelCustomCategories(channelId, next);
    return next;
}

function getCategoryLabel(category) {
    const normalized = normalizeCustomTag(category);
    if (!normalized) {
        return '';
    }
    const matched = Array.isArray(CONFIG?.categories)
        ? CONFIG.categories.find(cat => cat.id.toLowerCase() === normalized.toLowerCase()
            || cat.name.toLowerCase() === normalized.toLowerCase())
        : null;
    return matched ? matched.name : normalized;
}

function renderChannelProfileCategories(channel, channelId) {
    if (!channelProfileTags) {
        return;
    }
    const baseCategories = Array.isArray(channel?.categories) ? channel.categories : [];
    const baseLabels = baseCategories.map(getCategoryLabel).filter(Boolean);
    const customAssignments = getChannelCustomCategories(channelId);
    const customLabels = customAssignments.map(getCategoryLabel).filter(Boolean);
    const seen = new Set();
    const uniqueBaseLabels = baseLabels.filter(label => {
        const key = label.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
    const uniqueCustomLabels = customLabels.filter(label => {
        const key = label.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    const addButtonHtml = `
        <button class="channel-category-add" type="button" data-action="add-channel-category" aria-label="Afegir categoria personalitzada">+</button>
    `;

    const baseButtonsHtml = uniqueBaseLabels
        .map((label) => `
            <button class="channel-category-btn" type="button">${escapeHtml(label)}</button>
        `)
        .join('');

    const customButtonsHtml = uniqueCustomLabels
        .map(label => `
            <button class="channel-category-btn channel-category-btn--custom" type="button">${escapeHtml(label)}</button>
        `)
        .join('');

    const availableCustomTags = getCustomTags()
        .filter(tag => !seen.has(tag.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

    const pickerOptionsHtml = availableCustomTags.length > 0
        ? availableCustomTags.map(tag => `
            <button class="channel-category-option" type="button" data-channel-category-option="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
        `).join('')
        : '<span class="channel-category-empty">No hi ha categories personalitzades.</span>';

    const shouldShowAdd = uniqueBaseLabels.length > 0 || availableCustomTags.length > 0;
    const addButtonFallback = shouldShowAdd ? addButtonHtml : '';

    channelProfileTags.classList.toggle('hidden', uniqueBaseLabels.length === 0 && uniqueCustomLabels.length === 0 && !shouldShowAdd);
    channelProfileTags.innerHTML = `
        <div class="channel-profile-categories">
            ${baseButtonsHtml}
            ${customButtonsHtml}
            ${addButtonFallback}
            <div class="channel-category-picker hidden" data-channel-category-picker>
                ${pickerOptionsHtml}
            </div>
        </div>
    `;

    const addButton = channelProfileTags.querySelector('[data-action="add-channel-category"]');
    const picker = channelProfileTags.querySelector('[data-channel-category-picker]');
    const optionButtons = channelProfileTags.querySelectorAll('[data-channel-category-option]');

    if (channelCategoryPickerCleanup) {
        channelCategoryPickerCleanup();
        channelCategoryPickerCleanup = null;
    }

    const closePicker = () => {
        picker?.classList.add('hidden');
        addButton?.setAttribute('aria-expanded', 'false');
    };

    addButton?.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!picker) {
            return;
        }
        const isOpen = !picker.classList.contains('hidden');
        picker.classList.toggle('hidden', isOpen);
        addButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });

    optionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selected = button.dataset.channelCategoryOption;
            if (!selected) {
                return;
            }
            addChannelCustomCategory(channelId, selected);
            renderChannelProfileCategories(channel, channelId);
        });
    });

    const onDocumentClick = (event) => {
        if (!channelProfileTags.contains(event.target)) {
            closePicker();
        }
    };
    document.addEventListener('click', onDocumentClick);
    channelCategoryPickerCleanup = () => {
        document.removeEventListener('click', onDocumentClick);
    };
}

function isCustomCategoryTag(tag) {
    const normalized = normalizeCustomTag(tag).toLowerCase();
    if (!normalized) {
        return false;
    }
    return getCustomTags().some(existing => existing.toLowerCase() === normalized);
}

function removeCustomTag(tag) {
    const normalized = normalizeCustomTag(tag);
    if (!normalized) {
        return false;
    }
    const tags = getCustomTags();
    const nextTags = tags.filter(existing => existing.toLowerCase() !== normalized.toLowerCase());
    if (nextTags.length === tags.length) {
        return false;
    }
    saveCustomTags(nextTags);

    const storedOrder = getStoredChipOrder();
    if (storedOrder) {
        saveChipOrder(storedOrder.filter(value => value.toLowerCase() !== normalized.toLowerCase()));
    }
    return true;
}

function isCustomCategory(category) {
    const normalized = normalizeCustomTag(category).toLowerCase();
    if (!normalized) {
        return false;
    }
    return getCustomTags().some(tag => tag.toLowerCase() === normalized);
}

const SHARE_INTRO_TEXT = 'Descobreix els nostres Youtubers:';
const SHARE_IMAGE_NAME = 'icon-512.png';

async function getShareImageFile() {
    try {
        const shareImageUrl = new URL(`img/${SHARE_IMAGE_NAME}`, window.location.href);
        const response = await fetch(shareImageUrl);
        if (!response.ok) {
            return null;
        }
        const blob = await response.blob();
        return new File([blob], SHARE_IMAGE_NAME, { type: blob.type || 'image/png' });
    } catch (error) {
        console.warn('Share image unavailable', error);
        return null;
    }
}

function buildShareText(label, url) {
    return `${SHARE_INTRO_TEXT} ${label} ${url}`;
}

async function buildShareData(label, url, title = 'CaTube - Seguint!') {
    const text = buildShareText(label, url);
    const data = {
        title,
        text,
        url
    };
    const shareImage = await getShareImageFile();
    if (shareImage) {
        const files = [shareImage];
        if (!navigator.canShare || navigator.canShare({ files })) {
            data.files = files;
        }
    }
    return { data, text };
}

// Function to handle custom sharing logic
async function shareVideo(videoData) {
    // Construct the URL with the video ID parameter
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${videoData.id}`;
    const { data: shareData, text: shareText } = await buildShareData(videoData.title, shareUrl);

    // Use native sharing API if available (Mobile/Modern browsers)
    if (navigator.share) {
        navigator.share(shareData).catch((err) => console.log('Share dismissed', err));
    } else {
        // Fallback: Custom Modal for Desktop
        const existingModal = document.querySelector('.share-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active share-modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;">
                        <img src="img/icon-192.png" width="32" height="32" alt="CaTube Logo"> 
                        Seguint!
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align:center; padding-top:0;">
                    <p class="modal-description" style="margin-bottom:20px;">
                        Comparteix el vídeo: <br><strong>${videoData.title}</strong>
                    </p>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="hero-button" onclick="window.open('https://wa.me/?text=${encodeURIComponent(shareText)}', '_blank')">
                            <i data-lucide="message-circle" style="width:18px; display:inline-block; vertical-align:middle;"></i> Compartir
                        </button>
                        <button class="hero-button" style="background:#333; color:white;" onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Enllaç copiat!'); this.closest('.modal-overlay').remove();">
                            <i data-lucide="link" style="width:18px; display:inline-block; vertical-align:middle;"></i> Copiar Link
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function resolveShareChannelData(channelId, fallback = {}) {
    const channels = Array.isArray(YouTubeAPI?.getAllChannels?.())
        ? YouTubeAPI.getAllChannels()
        : [];
    const matchedChannel = channels.find(channelItem => String(channelItem.id) === String(channelId));
    const channelName = fallback.name
        || fallback.title
        || matchedChannel?.name
        || matchedChannel?.title
        || 'Canal';
    const channelDescription = fallback.description
        || matchedChannel?.description
        || matchedChannel?.about
        || 'No hi ha descripció disponible.';

    return {
        id: channelId,
        name: channelName,
        description: channelDescription
    };
}

async function shareChannelProfile(channelId, fallback = {}) {
    const channelData = resolveShareChannelData(channelId, fallback);
    const shareUrl = `${window.location.origin}${window.location.pathname}?channel=${encodeURIComponent(channelData.id)}#follow`;
    const { data: shareData, text: shareText } = await buildShareData(channelData.name, shareUrl);

    if (navigator.share) {
        navigator.share(shareData).catch((err) => console.log('Share dismissed', err));
    } else {
        const existingModal = document.querySelector('.share-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active share-modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;">
                        <img src="img/icon-192.png" width="32" height="32" alt="CaTube Logo"> 
                        Seguint!
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align:center; padding-top:0;">
                    <p class="modal-description" style="margin-bottom:20px;">
                        Comparteix el canal: <br><strong>${escapeHtml(channelData.name)}</strong><br>
                        <span style="font-size:0.9rem; color: var(--text-secondary);">${escapeHtml(channelData.description)}</span>
                    </p>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button class="hero-button" onclick="window.open('https://wa.me/?text=${encodeURIComponent(shareText)}', '_blank')">
                            <i data-lucide="message-circle" style="width:18px; display:inline-block; vertical-align:middle;"></i> Compartir
                        </button>
                        <button class="hero-button" style="background:#333; color:white;" onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Enllaç copiat!'); this.closest('.modal-overlay').remove();">
                            <i data-lucide="link" style="width:18px; display:inline-block; vertical-align:middle;"></i> Copiar Link
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function scrollToChannelFollow() {
    if (!channelProfileFollowBtn) {
        return;
    }
    channelProfileFollowBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    channelProfileFollowBtn.focus({ preventScroll: true });
}

// Setup Event Listener for the Share Button
function setupShareButtons() {
    document.addEventListener('click', (e) => {
        const shareChannelBtn = e.target.closest('[data-share-channel-id]');
        if (shareChannelBtn) {
            e.stopPropagation();
            const channelId = shareChannelBtn.dataset.shareChannelId;
            const channelName = shareChannelBtn.dataset.shareChannelName
                ? decodeURIComponent(shareChannelBtn.dataset.shareChannelName)
                : '';
            const channelDescription = shareChannelBtn.dataset.shareChannelDescription
                ? decodeURIComponent(shareChannelBtn.dataset.shareChannelDescription)
                : '';
            if (channelId) {
                shareChannelProfile(channelId, {
                    name: channelName,
                    description: channelDescription
                });
            }
            return;
        }
        const btn = e.target.closest('#shareBtn');
        if (btn) {
            e.stopPropagation();
            const videoId = currentVideoId;
            // Fallback to get title if not passed directly
            const videoTitle = document.getElementById('videoTitle') ? document.getElementById('videoTitle').textContent : 'Vídeo';

            if (videoId) {
                shareVideo({ id: videoId, title: videoTitle });
            }
        }
    });
}

// Inicialitzar l'aplicació
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    loadGridLayoutPreference();
    loadWatchGridLayoutPreference();
    applyGridLayoutPreference();
    applyWatchGridLayoutPreference();
    initEventListeners();
    initInstallPrompt();
    setupShareButtons();
    initBackgroundModal();
    initBackgroundPicker();
    initFontSizeControls();
    const urlParams = new URLSearchParams(window.location.search);
    const addTagParam = urlParams.get('add_tag');
    if (addTagParam) {
        const normalizedTag = normalizeCustomTag(addTagParam);
        if (normalizedTag) {
            if (isStandardCategory(normalizedTag)) {
                selectedCategory = normalizedTag;
            } else {
                const addedTag = addCustomTag(normalizedTag);
                selectedCategory = addedTag || selectedCategory;
            }
        }
        urlParams.delete('add_tag');
        const nextQuery = urlParams.toString();
        const newUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
        history.replaceState({}, '', newUrl);
    }
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

    const channelParam = urlParams.get('channel');
    if (!videoParam && channelParam) {
        setTimeout(() => {
            openChannelProfile(channelParam);
            if (window.location.hash === '#follow') {
                setTimeout(scrollToChannelFollow, 150);
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
    customCategoryModal = document.getElementById('customCategoryModal');
    customCategoryInput = document.getElementById('customCategoryInput');
    customCategoryAddBtn = document.getElementById('customCategoryAddBtn');
    customCategoryModalClose = document.getElementById('customCategoryModalClose');
    currentColorDisplay = document.getElementById('currentColorDisplay');
    expandedColorPicker = document.getElementById('expandedColorPicker');
    closeExpandedColorPicker = document.getElementById('closeExpandedColorPicker');
    fontDecreaseBtn = document.getElementById('fontDecreaseBtn');
    fontIncreaseBtn = document.getElementById('fontIncreaseBtn');
    fontSizeDisplay = document.getElementById('fontSizeDisplay');
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
    extraVideosGrid = document.getElementById('extraVideosGrid');
    channelPage = document.getElementById('channelPage');
    channelVideosGrid = document.getElementById('channelVideosGrid');
    channelBackBtn = document.getElementById('channelBackBtn');
    channelProfileAvatar = document.getElementById('channelProfileAvatar');
    channelProfileName = document.getElementById('channelProfileName');
    channelProfileHandle = document.getElementById('channelProfileHandle');
    channelProfileSubscribers = document.getElementById('channelProfileSubscribers');
    channelProfileDescription = document.getElementById('channelProfileDescription');
    channelProfileTags = document.getElementById('channelProfileTags');
    channelProfileFollowBtn = document.getElementById('channelProfileFollowBtn');
    channelProfileShareBtn = document.getElementById('channelProfileShareBtn');
    searchForm = document.querySelector('.search');
    searchInput = searchForm?.querySelector('.search-input') || null;
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
    if (searchForm && searchInput) {
        ensureSearchDropdown();

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) {
                hideSearchDropdown();
                return;
            }
            navigateToSearchResults(query);
        });

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            if (searchDebounceTimeout) {
                clearTimeout(searchDebounceTimeout);
            }
            if (!query) {
                hideSearchDropdown();
                return;
            }
            searchDebounceTimeout = setTimeout(() => {
                const results = performLocalSearch(query);
                showSearchDropdown(results);
            }, 300);
        });

        searchInput.addEventListener('keydown', (event) => {
            if (!searchDropdown || searchDropdown.hidden) {
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusSearchDropdownItem(0);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusSearchDropdownItem(searchDropdownItems.length - 1);
            } else if (event.key === 'Escape') {
                hideSearchDropdown();
            }
        });

        if (searchDropdown) {
            searchDropdown.addEventListener('click', (event) => {
                const item = event.target.closest('.search-result-item');
                if (!item) {
                    return;
                }
                handleSearchResultSelection(item);
            });

            searchDropdown.addEventListener('keydown', (event) => {
                if (!searchDropdownItems.length) {
                    return;
                }
                const currentIndex = searchDropdownItems.indexOf(document.activeElement);
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusSearchDropdownItem(currentIndex + 1);
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusSearchDropdownItem(currentIndex - 1);
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    hideSearchDropdown();
                    searchInput.focus();
                }
            });
        }
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
        if (event.key === 'Escape' && customCategoryModal?.classList.contains('active')) {
            closeCustomCategoryModal();
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
        if (searchDropdown && !searchDropdown.hidden) {
            const clickedInsideSearch = searchForm?.contains(e.target);
            if (!clickedInsideSearch) {
                hideSearchDropdown();
            }
        }

        const chip = e.target.closest('.chip');
        if (chip && !chip.closest('#historyPage')) {
            if (chip.classList.contains('chip-add')) {
                openCustomCategoryModal();
                return;
            }
            selectedCategory = chip.dataset.cat || 'Tot';
            document.querySelectorAll('.chip').forEach((item) => item.classList.remove('is-active'));
            chip.classList.add('is-active');
            const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
            history.pushState({}, '', basePath);
            if (!isMiniPlayerActive()) {
                stopVideoPlayback();
            }
            showHome();
            renderCategoryActions(getCategoryPageTitle(selectedCategory));
            renderFeed();
            if (isCustomCategory(selectedCategory)) {
                const activeCategory = selectedCategory;
                refreshCustomCategorySearch(activeCategory).then(() => {
                    if (selectedCategory === activeCategory) {
                        renderFeed();
                    }
                });
            }
            return;
        }

        if (window.innerWidth <= 768 && sidebar && menuBtn) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    document.addEventListener('fullscreenchange', async () => {
        // 1. Comprovem si estem veient un Short
        // Si el modal de shorts NO té la classe 'hidden', és que està obert
        const shortModal = document.getElementById('short-modal');
        const isWatchingShort = shortModal && !shortModal.classList.contains('hidden');

        // Si és un Short, NO fem res (respectem l'orientació de l'usuari o la del vídeo)
        if (isWatchingShort) {
            return;
        }

        // 2. Si NO és un Short i entrem a pantalla completa -> Forcem Horitzontal
        if (document.fullscreenElement) {
            if (screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock('landscape');
                } catch (err) {
                    console.log("No s'ha pogut bloquejar l'orientació:", err);
                }
            }
        } else {
            // 3. En sortir de pantalla completa -> Alliberem l'orientació
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
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

    if (customCategoryModal) {
        customCategoryModal.addEventListener('click', (event) => {
            if (event.target === customCategoryModal) {
                closeCustomCategoryModal();
            }
        });
    }

    if (customCategoryModalClose) {
        customCategoryModalClose.addEventListener('click', () => {
            closeCustomCategoryModal();
        });
    }

    if (customCategoryAddBtn) {
        customCategoryAddBtn.addEventListener('click', () => {
            handleCustomCategoryCreation();
        });
    }

    if (customCategoryInput) {
        customCategoryInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleCustomCategoryCreation();
            }
        });
    }
}

function initInstallPrompt() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPromptEvent = event;

        if (document.querySelector('.install-floating-btn')) {
            return;
        }

        const floatingBtn = document.createElement('button');
        floatingBtn.type = 'button';
        floatingBtn.className = 'install-floating-btn';
        floatingBtn.setAttribute('aria-label', 'Install App');
        floatingBtn.innerHTML = '<i data-lucide="download"></i><span>Install App</span>';
        document.body.appendChild(floatingBtn);

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        requestAnimationFrame(() => {
            floatingBtn.classList.add('show');
        });

        const removeButton = () => {
            if (!floatingBtn.isConnected) {
                return;
            }
            floatingBtn.classList.remove('show');
            setTimeout(() => floatingBtn.remove(), 500);
        };

        const autoHideTimeout = setTimeout(removeButton, 5000);

        floatingBtn.addEventListener('click', () => {
            clearTimeout(autoHideTimeout);
            removeButton();

            if (!installPromptEvent) {
                return;
            }
            installPromptEvent.prompt();
            installPromptEvent = null;
        });
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

    if (currentColorDisplay && expandedColorPicker) {
        currentColorDisplay.addEventListener('click', showExpandedColorPicker);
    }
    if (closeExpandedColorPicker && expandedColorPicker) {
        closeExpandedColorPicker.addEventListener('click', hideExpandedColorPicker);
    }

    const buttons = backgroundOptions.querySelectorAll('[data-color]');
    buttons.forEach(button => {
        const color = button.dataset.color;
        button.style.backgroundColor = color;
        button.addEventListener('click', () => applyBackgroundColor(color, true, true));
    });
}

function initBackgroundPicker() {
    const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
    const initial = BACKGROUND_COLORS.includes(stored) ? stored : BACKGROUND_COLORS[0];
    applyBackgroundColor(initial, false);
}

function applyBackgroundColor(color, persist = true, collapsePicker = false) {
    if (!BACKGROUND_COLORS.includes(color)) {
        return;
    }
    document.documentElement.style.setProperty('--color-background', color);
    if (persist) {
        localStorage.setItem(BACKGROUND_STORAGE_KEY, color);
    }
    if (currentColorDisplay) {
        currentColorDisplay.style.backgroundColor = color;
    }
    if (backgroundOptions) {
        backgroundOptions.querySelectorAll('[data-color]').forEach(button => {
            const isActive = button.dataset.color === color;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
    if (collapsePicker) {
        hideExpandedColorPicker();
    }
}

function showExpandedColorPicker() {
    if (!currentColorDisplay || !expandedColorPicker) {
        return;
    }
    currentColorDisplay.classList.add('hidden');
    expandedColorPicker.classList.remove('hidden');
}

function hideExpandedColorPicker() {
    if (!currentColorDisplay || !expandedColorPicker) {
        return;
    }
    expandedColorPicker.classList.add('hidden');
    currentColorDisplay.classList.remove('hidden');
}

function initFontSizeControls() {
    if (!fontDecreaseBtn || !fontIncreaseBtn || !fontSizeDisplay) {
        return;
    }
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    const storedValue = stored ? Number.parseFloat(stored) : null;
    const computedValue = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    currentFontSize = Number.isFinite(storedValue) ? storedValue : (computedValue || 16);
    document.documentElement.style.fontSize = `${currentFontSize}px`;
    updateFontSizeDisplay();

    fontDecreaseBtn.addEventListener('click', () => adjustFontSize(-1));
    fontIncreaseBtn.addEventListener('click', () => adjustFontSize(1));
}

function adjustFontSize(delta) {
    const minSize = 12;
    const maxSize = 24;
    const nextSize = Math.min(maxSize, Math.max(minSize, (currentFontSize || 16) + delta));
    if (nextSize === currentFontSize) {
        return;
    }
    currentFontSize = nextSize;
    document.documentElement.style.fontSize = `${currentFontSize}px`;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(currentFontSize));
    updateFontSizeDisplay();
}

function updateFontSizeDisplay() {
    if (!fontSizeDisplay) {
        return;
    }
    const size = currentFontSize || parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    fontSizeDisplay.textContent = `Font ${Math.round(size)}px`;
}

function openBackgroundModal() {
    if (!backgroundModal) return;
    backgroundModal.classList.add('active');
    hideExpandedColorPicker();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

function closeBackgroundModal() {
    if (!backgroundModal) return;
    backgroundModal.classList.remove('active');
}

function openCustomCategoryModal() {
    if (!customCategoryModal) {
        return;
    }
    customCategoryModal.classList.add('active');
    customCategoryModal.setAttribute('aria-hidden', 'false');
    if (customCategoryInput) {
        customCategoryInput.value = '';
        requestAnimationFrame(() => {
            customCategoryInput.focus();
        });
    }
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeCustomCategoryModal() {
    if (!customCategoryModal) {
        return;
    }
    customCategoryModal.classList.remove('active');
    customCategoryModal.setAttribute('aria-hidden', 'true');
}

function handleCustomCategoryCreation() {
    if (!customCategoryInput) {
        return;
    }
    const normalized = normalizeCustomTag(customCategoryInput.value);
    if (!normalized) {
        return;
    }
    const addedTag = addCustomTag(normalized);
    if (!addedTag) {
        return;
    }
    selectedCategory = addedTag;
    setupChipsBarOrdering();
    closeCustomCategoryModal();

    const basePath = window.location.pathname.replace(/\/index\.html$/, '/');
    history.pushState({}, '', basePath);
    if (!isMiniPlayerActive()) {
        stopVideoPlayback();
    }
    showHome();
    renderCategoryActions(getCategoryPageTitle(selectedCategory));
    renderFeed();
    if (isCustomCategory(selectedCategory)) {
        const activeCategory = selectedCategory;
        refreshCustomCategorySearch(activeCategory).then(() => {
            if (selectedCategory === activeCategory) {
                renderFeed();
            }
        });
    }
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
        pageTitle.classList.remove('page-title--with-actions');
        pageTitle.dataset.title = title;
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

function getHeroSectionKey() {
    return (pageTitle?.dataset?.title || pageTitle?.textContent || 'feed').trim();
}

function getFeaturedVideoForSection(videos, sectionKey) {
    if (!Array.isArray(videos) || videos.length === 0) {
        if (sectionKey) {
            featuredVideoBySection.delete(sectionKey);
        }
        return null;
    }

    const normalizedSection = sectionKey || 'feed';
    const usedIds = new Set();
    featuredVideoBySection.forEach((videoId, key) => {
        if (key !== normalizedSection) {
            usedIds.add(String(videoId));
        }
    });

    const watchedIds = getHistoryVideoIdSet();
    const available = videos.filter(video => {
        const videoId = String(video.id);
        if (usedIds.has(videoId)) {
            return false;
        }
        if (watchedIds.has(videoId)) {
            return false;
        }
        if (video.isShort === true) {
            return false;
        }
        const seconds = getVideoDurationSeconds(video);
        if (seconds === null || seconds < MIN_RECOMMENDED_SECONDS) {
            return false;
        }
        return true;
    });
    const newest = getNewestVideoFromList(available);
    if (newest?.video) {
        featuredVideoBySection.set(normalizedSection, String(newest.video.id));
        return newest.video;
    }

    featuredVideoBySection.delete(normalizedSection);
    return null;
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
    const duration = getVideoDisplayDuration(video);

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
        const channelId = video.channelId || '';
        heroChannel.innerHTML = channelName
            ? `<span class="channel-link" onclick="openChannelProfile('${channelId}'); event.stopPropagation();">${escapeHtml(channelName)}</span>`
            : '';
        heroChannel.classList.toggle('hidden', !channelName);
    }
}

function getChannelSearchMeta(channelId) {
    if (!channelId) {
        return { name: '', description: '' };
    }
    const normalizedId = String(channelId);
    const feedChannels = Array.isArray(YouTubeAPI?.feedChannels) ? YouTubeAPI.feedChannels : [];
    const feedChannel = feedChannels.find(channel => String(channel?.id) === normalizedId);
    const cached = cachedChannels[normalizedId] || cachedChannels[channelId] || {};
    const staticChannel = typeof getChannelById === 'function' ? getChannelById(channelId) : null;
    return {
        name: feedChannel?.name || feedChannel?.title || cached.name || cached.title || staticChannel?.name || '',
        description: feedChannel?.description || cached.description || staticChannel?.description || ''
    };
}

function getCustomCategorySearchKey(category) {
    const normalized = normalizeCustomTag(category);
    if (!normalized) {
        return '';
    }
    return normalized.toLowerCase();
}

function getCustomCategorySearchResults(category) {
    const key = getCustomCategorySearchKey(category);
    if (!key) {
        return [];
    }
    const cached = customCategorySearchCache.get(key);
    return Array.isArray(cached) ? cached : [];
}

function setCustomCategorySearchResults(category, videos) {
    const key = getCustomCategorySearchKey(category);
    if (!key) {
        return;
    }
    customCategorySearchCache.set(key, Array.isArray(videos) ? videos : []);
}

function mergeUniqueVideos(primary, secondary) {
    const seen = new Set();
    const merged = [];
    [...primary, ...secondary].forEach(video => {
        if (!video?.id) {
            return;
        }
        const key = String(video.id);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        merged.push(video);
    });
    return merged;
}

function matchesCustomCategory(video, categoryName) {
    const channelCustomCategories = getChannelCustomCategories(video.channelId);
    const hasChannelCategory = channelCustomCategories
        .some(cat => cat.toLowerCase() === categoryName.toLowerCase());
    if (hasChannelCategory) {
        return true;
    }
    const title = video.title || video.snippet?.title || '';
    const description = video.description || video.snippet?.description || '';
    const channelMeta = getChannelSearchMeta(video.channelId);
    const channelName = channelMeta.name || video.channelTitle || video.snippet?.channelTitle || '';
    const channelDescription = channelMeta.description || '';
    const tagsValue = video.tags ?? video.snippet?.tags;
    const tags = Array.isArray(tagsValue) ? tagsValue : (tagsValue ? [String(tagsValue)] : []);
    if (isMatch(title, categoryName)
        || isMatch(description, categoryName)
        || isMatch(channelName, categoryName)
        || isMatch(channelDescription, categoryName)) {
        return true;
    }
    return tags.some(tag => isMatch(tag, categoryName));
}

async function refreshCustomCategorySearch(category) {
    const key = getCustomCategorySearchKey(category);
    if (!key) {
        return null;
    }
    if (customCategorySearchInFlight.has(key)) {
        return customCategorySearchInFlight.get(key);
    }
    const task = (async () => {
        let videos = [];
        if (useYouTubeAPI && typeof YouTubeAPI?.searchVideos === 'function') {
            const result = await YouTubeAPI.searchVideos(key, CONFIG.layout.videosPerPage);
            if (!result?.error && Array.isArray(result.items)) {
                videos = result.items;
            }
        } else {
            const results = performLocalSearch(key);
            videos = Array.isArray(results?.videos) ? results.videos : [];
        }
        setCustomCategorySearchResults(key, videos);
        return videos;
    })();
    customCategorySearchInFlight.set(key, task);
    try {
        return await task;
    } finally {
        customCategorySearchInFlight.delete(key);
    }
}

function filterVideosByCategory(videos, feed) {
    if (selectedCategory === 'Tot' || selectedCategory === 'Novetats') return videos;
    if (isCustomCategory(selectedCategory)) {
        const categoryName = normalizeCustomTag(selectedCategory);
        if (!categoryName) {
            return videos;
        }
        const matched = videos.filter(video => matchesCustomCategory(video, categoryName));
        const searchResults = getCustomCategorySearchResults(categoryName);
        return mergeUniqueVideos(searchResults, matched);
    }
    if (selectedCategory === 'Seguint') {
        const followedIds = new Set(getFollowedChannelIds().map(id => String(id)));
        if (followedIds.size === 0) {
            return [];
        }
        return videos.filter(video => followedIds.has(String(video.channelId)));
    }
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

function sortVideosByRoundRobin(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    const videosByChannel = {};
    videos.forEach(video => {
        const channelId = video.channelId;
        if (!videosByChannel[channelId]) {
            videosByChannel[channelId] = [];
        }
        videosByChannel[channelId].push(video);
    });

    Object.values(videosByChannel).forEach(channelVideos => {
        channelVideos.sort((a, b) => {
            const dateA = new Date(a.publishedAt || a.uploadDate || 0);
            const dateB = new Date(b.publishedAt || b.uploadDate || 0);
            return dateB - dateA;
        });
    });

    const channelIds = Object.keys(videosByChannel);
    if (channelIds.length === 0) return [];

    const sortedVideos = [];
    let remaining = Object.values(videosByChannel).reduce((sum, list) => sum + list.length, 0);
    let lastChannelId = null;
    let channelIndex = 0;

    while (remaining > 0) {
        let picked = false;
        for (let attempts = 0; attempts < channelIds.length; attempts++) {
            const id = channelIds[channelIndex];
            channelIndex = (channelIndex + 1) % channelIds.length;
            if (!videosByChannel[id]?.length) {
                continue;
            }
            if (id === lastChannelId) {
                if (videosByChannel[id].length === remaining) {
                    // Only this channel has videos left, allow consecutive placement.
                } else {
                    continue;
                }
            }
            sortedVideos.push(videosByChannel[id].shift());
            remaining -= 1;
            lastChannelId = id;
            picked = true;
            break;
        }
        if (!picked) {
            const fallbackId = channelIds.find(id => videosByChannel[id]?.length);
            if (!fallbackId) {
                break;
            }
            sortedVideos.push(videosByChannel[fallbackId].shift());
            remaining -= 1;
            lastChannelId = fallbackId;
            channelIndex = (channelIds.indexOf(fallbackId) + 1) % channelIds.length;
        }
    }

    return sortedVideos;
}

function applyRoundRobinByPopularity(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    const byChannel = {};
    videos.forEach(video => {
        const channelId = video.channelId;
        if (!byChannel[channelId]) {
            byChannel[channelId] = [];
        }
        byChannel[channelId].push(video);
    });

    Object.values(byChannel).forEach(channelVideos => {
        channelVideos.sort((a, b) => {
            const viewsA = a.viewCount || a.views || 0;
            const viewsB = b.viewCount || b.views || 0;
            return viewsB - viewsA;
        });
    });

    const channelIds = Object.keys(byChannel).sort((a, b) => {
        const topA = byChannel[a][0]?.viewCount || byChannel[a][0]?.views || 0;
        const topB = byChannel[b][0]?.viewCount || byChannel[b][0]?.views || 0;
        return topB - topA;
    });

    const result = [];
    let remaining = Object.values(byChannel).reduce((sum, list) => sum + list.length, 0);
    let lastChannelId = null;
    let channelIndex = 0;

    while (remaining > 0) {
        let picked = false;
        for (let attempts = 0; attempts < channelIds.length; attempts++) {
            const id = channelIds[channelIndex];
            channelIndex = (channelIndex + 1) % channelIds.length;
            if (!byChannel[id]?.length) {
                continue;
            }
            if (id === lastChannelId) {
                if (byChannel[id].length === remaining) {
                    // Only this channel has videos left, allow consecutive placement.
                } else {
                    continue;
                }
            }
            result.push(byChannel[id].shift());
            remaining -= 1;
            lastChannelId = id;
            picked = true;
            break;
        }
        if (!picked) {
            const fallbackId = channelIds.find(id => byChannel[id]?.length);
            if (!fallbackId) {
                break;
            }
            result.push(byChannel[fallbackId].shift());
            remaining -= 1;
            lastChannelId = fallbackId;
            channelIndex = (channelIds.indexOf(fallbackId) + 1) % channelIds.length;
        }
    }

    return result;
}

function hybridCategorySort(videos) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const hot = [];
    const rest = [];

    videos.forEach(video => {
        const age = now - new Date(video.publishedAt || video.uploadDate || 0).getTime();
        const views = video.viewCount || video.views || 0;

        if (age < oneWeek && views > 1000) {
            hot.push(video);
        } else {
            rest.push(video);
        }
    });

    const hotRoundRobin = applyRoundRobinByPopularity(hot);
    const restRoundRobin = sortVideosByRoundRobin(rest);
    const maxHot = Math.min(hotRoundRobin.length, 8);

    if (
        hotRoundRobin.length > 0
        && restRoundRobin.length > 0
        && hotRoundRobin[maxHot - 1]?.channelId === restRoundRobin[0]?.channelId
    ) {
        const nextIndex = restRoundRobin.findIndex(
            video => video.channelId !== hotRoundRobin[maxHot - 1]?.channelId
        );
        if (nextIndex > 0) {
            const rotated = restRoundRobin.splice(0, nextIndex);
            restRoundRobin.push(...rotated);
        }
    }

    return [...hotRoundRobin.slice(0, maxHot), ...restRoundRobin];
}

function applyRoundRobinByPopularity(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return [];

    const byChannel = {};
    videos.forEach(video => {
        const channelId = video.channelId;
        if (!byChannel[channelId]) {
            byChannel[channelId] = [];
        }
        byChannel[channelId].push(video);
    });

    Object.values(byChannel).forEach(channelVideos => {
        channelVideos.sort((a, b) => {
            const viewsA = a.viewCount || a.views || 0;
            const viewsB = b.viewCount || b.views || 0;
            return viewsB - viewsA;
        });
    });

    const channelIds = Object.keys(byChannel).sort((a, b) => {
        const topA = byChannel[a][0]?.viewCount || byChannel[a][0]?.views || 0;
        const topB = byChannel[b][0]?.viewCount || byChannel[b][0]?.views || 0;
        return topB - topA;
    });

    const result = [];
    const maxVideos = Math.max(...Object.values(byChannel).map(v => v.length));

    for (let i = 0; i < maxVideos; i++) {
        channelIds.forEach(id => {
            if (byChannel[id][i]) {
                result.push(byChannel[id][i]);
            }
        });
    }

    return result;
}

function hybridCategorySort(videos) {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const hot = [];
    const rest = [];

    videos.forEach(video => {
        const age = now - new Date(video.publishedAt || video.uploadDate || 0).getTime();
        const views = video.viewCount || video.views || 0;

        if (age < oneWeek && views > 1000) {
            hot.push(video);
        } else {
            rest.push(video);
        }
    });

    const hotRoundRobin = applyRoundRobinByPopularity(hot);
    const restRoundRobin = sortVideosByRoundRobin(rest);
    const maxHot = Math.min(hotRoundRobin.length, 8);

    if (
        hotRoundRobin.length > 0
        && restRoundRobin.length > 0
        && hotRoundRobin[maxHot - 1]?.channelId === restRoundRobin[0]?.channelId
    ) {
        const nextIndex = restRoundRobin.findIndex(
            video => video.channelId !== hotRoundRobin[maxHot - 1]?.channelId
        );
        if (nextIndex > 0) {
            const rotated = restRoundRobin.splice(0, nextIndex);
            restRoundRobin.push(...rotated);
        }
    }

    return [...hotRoundRobin.slice(0, maxHot), ...restRoundRobin];
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

const MIN_RECOMMENDED_SECONDS = 240;

function getVideoDurationSeconds(video) {
    if (!video) return null;

    const directSeconds = Number(video.durationSeconds);
    if (Number.isFinite(directSeconds)) {
        return directSeconds;
    }

    const durationValue = video.contentDetails?.duration || video.duration;
    if (!durationValue || typeof durationValue !== 'string') {
        return null;
    }

    if (durationValue.startsWith('PT')) {
        const match = durationValue.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
        if (!match) return null;
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);
        return (hours * 3600) + (minutes * 60) + seconds;
    }

    const timeParts = durationValue.split(':').map(part => Number(part));
    if (timeParts.some(part => Number.isNaN(part))) {
        return null;
    }
    if (timeParts.length === 3) {
        const [hours, minutes, seconds] = timeParts;
        return (hours * 3600) + (minutes * 60) + seconds;
    }
    if (timeParts.length === 2) {
        const [minutes, seconds] = timeParts;
        return (minutes * 60) + seconds;
    }

    return null;
}

function renderFeed() {
    if (!currentFeedRenderer) return;
    if (isCustomCategory(selectedCategory)) {
        renderCategoryActions(getCategoryPageTitle(selectedCategory));
    }

    const isRecommendedPage = pageTitle?.textContent === 'Recomanat per a tu';
    let videosToFilter = currentFeedVideos;

    // If Custom Category: Search across ALL local videos (Feed + Cached Search Results)
    if (isCustomCategory(selectedCategory)) {
        const uniqueVideosMap = new Map();

        // Add current feed videos
        if (Array.isArray(currentFeedVideos)) {
            currentFeedVideos.forEach(video => {
                if (video?.id) {
                    uniqueVideosMap.set(String(video.id), video);
                }
            });
        }

        // Add cached API videos (from previous searches)
        if (Array.isArray(cachedAPIVideos)) {
            cachedAPIVideos.forEach(video => {
                if (video?.id) {
                    uniqueVideosMap.set(String(video.id), video);
                }
            });
        }

        videosToFilter = Array.from(uniqueVideosMap.values());
    }

    let filtered = filterVideosByCategory(videosToFilter, currentFeedData);

    if (selectedCategory === 'Novetats' || selectedCategory === 'Tot') {
        filtered = filtered.filter(video => {
            const channelCats = getChannelCustomCategories(video.channelId);
            let feedCats = [];
            if (currentFeedData?.channels) {
                const channel = currentFeedData.channels.find(c => String(c.id) === String(video.channelId));
                if (channel && Array.isArray(channel.categories)) {
                    feedCats = channel.categories;
                }
            } else if (cachedChannels[video.channelId]?.categories) {
                feedCats = cachedChannels[video.channelId].categories;
            }
            const isMitjans = [...channelCats, ...feedCats]
                .some(cat => String(cat).toLowerCase() === 'mitjans');
            return !isMitjans;
        });
    }

    const shouldHideWatched = selectedCategory === 'Novetats'
        || (selectedCategory !== 'Tot' && selectedCategory !== 'Novetats');
    if (shouldHideWatched) {
        filtered = filterOutWatchedVideos(filtered);
    }

    if (selectedCategory === 'Novetats') {
        filtered = sortVideosByRoundRobin(filtered);
    } else if (HYBRID_CATEGORY_SORT.has(selectedCategory)) {
        filtered = hybridCategorySort(filtered);
    }

    if (isRecommendedPage) {
        filtered = filtered.filter(video => {
            const seconds = getVideoDurationSeconds(video);
            return seconds !== null && seconds >= MIN_RECOMMENDED_SECONDS;
        });
    }

    if (selectedCategory !== 'Novetats' && selectedCategory !== 'Tot' && filtered.length === 0) {
        featuredVideoBySection.delete(getHeroSectionKey());
        updateHero(null);
        if (videosGrid) {
            if (isCustomCategoryTag(selectedCategory)) {
                videosGrid.innerHTML = `
                    <div class="empty-state empty-state-custom">
                        <button class="empty-state-action" type="button" data-follow-cta>
                            Afegeix aquesta categoria als teus Youtubers preferits
                        </button>
                        <button class="empty-state-plus" type="button" data-follow-cta aria-label="Afegir categoria a Segueix!">+</button>
                    </div>
                `;
                const followCtas = videosGrid.querySelectorAll('[data-follow-cta]');
                followCtas.forEach((followCta) => {
                    followCta.addEventListener('click', (event) => {
                        event.preventDefault();
                        setActiveNavItem('follow');
                        showFollow('all');
                    });
                });
            } else {
                videosGrid.innerHTML = `
                    <div class="empty-state">No hi ha vídeos per aquesta categoria.</div>
                `;
            }
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
                renderCategoryActions(category ? category.name : 'Categoria');
                renderFeed();
            } else {
                loadVideosByCategoryStatic(categoryId);
            }
        });
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupChipsBarOrdering();
    setupVideoCardActionButtons();
}

function setupChipsBarOrdering() {
    if (!chipsBar) {
        return;
    }

    const defaultChips = [
        ...getStandardChipLabels().map(label => ({
            label,
            value: label,
            isCustom: false
        })),
        ...getCustomTags().map(tag => ({
            label: tag,
            value: tag,
            isCustom: true
        }))
    ];

    if (defaultChips.length === 0) {
        return;
    }

    const storedOrder = getStoredChipOrder();
    const chipsByValue = new Map(defaultChips.map(chip => [chip.value, chip]));
    const orderedChips = [];

    if (storedOrder) {
        storedOrder.forEach((value) => {
            const chip = chipsByValue.get(value);
            if (chip) {
                orderedChips.push(chip);
                chipsByValue.delete(value);
            }
        });
    }

    defaultChips.forEach((chip) => {
        if (chipsByValue.has(chip.value)) {
            orderedChips.push(chip);
            chipsByValue.delete(chip.value);
        }
    });

    const activeValue = selectedCategory;
    chipsBar.innerHTML = '';
    const sortableChips = orderedChips.filter(chip => chip.value !== 'Mitjans');
    sortableChips.forEach((chip) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = chip.isCustom ? 'chip is-custom' : 'chip';
        button.dataset.cat = chip.value;
        button.textContent = chip.label;
        button.draggable = true;
        const isActive = chip.value === activeValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        chipsBar.appendChild(button);
    });
    const mitjansChip = document.createElement('button');
    mitjansChip.type = 'button';
    mitjansChip.className = 'chip';
    mitjansChip.dataset.cat = 'Mitjans';
    mitjansChip.textContent = 'Mitjans';
    mitjansChip.draggable = false;
    const isMitjansActive = 'Mitjans' === activeValue;
    mitjansChip.classList.toggle('is-active', isMitjansActive);
    mitjansChip.setAttribute('aria-pressed', isMitjansActive ? 'true' : 'false');
    chipsBar.appendChild(mitjansChip);
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'chip chip-add';
    addButton.setAttribute('aria-label', 'Afegir una categoria personalitzada');
    addButton.textContent = '+';
    addButton.draggable = false;
    chipsBar.appendChild(addButton);

    saveChipOrder(getChipOrderFromDom());

    if (chipsBar.dataset.dragBound !== 'true') {
        chipsBar.dataset.dragBound = 'true';
        chipsBar.addEventListener('dragstart', handleChipDragStart);
        chipsBar.addEventListener('dragover', handleChipDragOver);
        chipsBar.addEventListener('dragend', handleChipDragEnd);
        chipsBar.addEventListener('drop', handleChipDrop);
    }
}

function getStoredChipOrder() {
    const stored = localStorage.getItem(CHIPS_ORDER_STORAGE_KEY);
    if (!stored) {
        return null;
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        console.warn('No es pot llegir catube_chip_order', error);
        return null;
    }
}

function saveChipOrder(order) {
    if (!Array.isArray(order)) {
        return;
    }
    localStorage.setItem(CHIPS_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function getChipOrderFromDom() {
    if (!chipsBar) {
        return [];
    }
    return Array.from(chipsBar.querySelectorAll('.chip'))
        .filter(chip => !chip.classList.contains('chip-add'))
        .map(chip => chip.dataset.cat || chip.textContent.trim());
}

function activateCategory(category) {
    selectedCategory = category;
    renderCategoryActions(getCategoryPageTitle(category));
    if (!chipsBar) {
        return;
    }
    chipsBar.querySelectorAll('.chip').forEach((chip) => {
        const isActive = (chip.dataset.cat || chip.textContent.trim()) === category;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function setActiveNavItem(page) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(nav => nav.classList.remove('active'));
    const matchingNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (matchingNav) {
        matchingNav.classList.add('active');
    }
}


let draggedChip = null;

function handleChipDragStart(event) {
    const chip = event.target.closest('.chip');
    if (!chip) {
        return;
    }
    draggedChip = chip;
    chip.classList.add('is-dragging');
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', chip.dataset.cat || '');
    }
}

function handleChipDragOver(event) {
    event.preventDefault();
    if (!chipsBar || !draggedChip) {
        return;
    }
    const afterElement = getChipDragAfterElement(chipsBar, event.clientX);
    if (!afterElement) {
        chipsBar.appendChild(draggedChip);
    } else if (afterElement !== draggedChip) {
        chipsBar.insertBefore(draggedChip, afterElement);
    }
}

function handleChipDrop(event) {
    event.preventDefault();
    if (!chipsBar) {
        return;
    }
    saveChipOrder(getChipOrderFromDom());
}

function handleChipDragEnd() {
    if (draggedChip) {
        draggedChip.classList.remove('is-dragging');
        draggedChip = null;
    }
    saveChipOrder(getChipOrderFromDom());
}

function getChipDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.chip:not(.is-dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
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


function ensureSearchDropdown() {
    if (!searchForm) {
        return null;
    }
    if (searchDropdown) {
        return searchDropdown;
    }
    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.id = 'searchDropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Resultats de cerca');
    dropdown.setAttribute('aria-hidden', 'true');
    dropdown.hidden = true;
    searchForm.appendChild(dropdown);
    searchDropdown = dropdown;
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'false');
        searchInput.setAttribute('aria-controls', dropdown.id);
        searchInput.setAttribute('aria-autocomplete', 'list');
    }
    return dropdown;
}

function getMatchScore(text, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!text || !normalizedQuery) {
        return 0;
    }
    const lowerText = String(text).toLowerCase();
    if (isMatch(lowerText, normalizedQuery)) {
        return 3;
    }
    if (lowerText.startsWith(normalizedQuery)) {
        return 2;
    }
    if (normalizedQuery.length > 3 && lowerText.includes(normalizedQuery)) {
        return 1;
    }
    return 0;
}

function performLocalSearch(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return { channels: [], videos: [] };
    }

    const channelsMap = new Map();
    const feedChannels = Array.isArray(YouTubeAPI?.feedChannels) ? YouTubeAPI.feedChannels : [];
    feedChannels.forEach(channel => {
        if (!channel?.id) {
            return;
        }
        channelsMap.set(String(channel.id), {
            id: channel.id,
            name: channel.name || channel.title || '',
            avatar: channel.avatar || channel.thumbnail || '',
            subscriberCount: channel.subscriberCount ?? null
        });
    });

    Object.values(cachedChannels || {}).forEach(channel => {
        if (!channel?.id) {
            return;
        }
        const normalizedId = String(channel.id);
        if (!channelsMap.has(normalizedId)) {
            channelsMap.set(normalizedId, {
                id: channel.id,
                name: channel.name || channel.title || '',
                avatar: channel.thumbnail || '',
                subscriberCount: channel.subscriberCount ?? null
            });
        }
    });

    const channelResults = Array.from(channelsMap.values())
        .map(channel => ({
            ...channel,
            score: getMatchScore(channel.name, normalizedQuery)
        }))
        .filter(channel => channel.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return (a.name || '').localeCompare((b.name || ''), 'ca', { sensitivity: 'base' });
        });

    const videosMap = new Map();
    const feedVideos = Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [];
    feedVideos.forEach(video => {
        if (!video?.id) {
            return;
        }
        videosMap.set(String(video.id), { ...video, source: 'api' });
    });

    cachedAPIVideos.forEach(video => {
        if (!video?.id) {
            return;
        }
        const normalizedId = String(video.id);
        if (!videosMap.has(normalizedId)) {
            videosMap.set(normalizedId, { ...video, source: 'api' });
        }
    });

    if (videosMap.size === 0 && Array.isArray(VIDEOS)) {
        VIDEOS.forEach(video => {
            if (!video?.id) {
                return;
            }
            const channel = getChannelById(video.channelId);
            videosMap.set(String(video.id), {
                id: video.id,
                title: video.title,
                description: video.description || '',
                thumbnail: video.thumbnail,
                channelId: video.channelId,
                channelTitle: channel?.name || '',
                viewCount: video.views || 0,
                publishedAt: video.uploadDate,
                duration: video.duration,
                videoUrl: video.videoUrl,
                source: 'static'
            });
        });
    }

    const videoResults = Array.from(videosMap.values())
        .map(video => {
            const titleScore = getMatchScore(video.title, normalizedQuery);
            const descriptionScore = getMatchScore(video.description, normalizedQuery);
            const tagsValue = video.tags ?? video.snippet?.tags;
            const tags = Array.isArray(tagsValue) ? tagsValue : (tagsValue ? [String(tagsValue)] : []);
            const tagScore = tags.reduce((total, tag) => total + getMatchScore(tag, normalizedQuery), 0);
            return {
                ...video,
                score: (titleScore * 2) + descriptionScore + tagScore
            };
        })
        .filter(video => video.score > 0 && !video.isShort)
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            const viewA = a.viewCount ?? a.views ?? 0;
            const viewB = b.viewCount ?? b.views ?? 0;
            if (viewA !== viewB) {
                return viewB - viewA;
            }
            return (a.title || '').localeCompare((b.title || ''), 'ca', { sensitivity: 'base' });
        });

    return { channels: channelResults, videos: videoResults };
}

function resetSearchDropdownNavigation() {
    searchDropdownItems.forEach(item => {
        item.classList.remove('is-active');
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('tabindex', '-1');
    });
    searchDropdownItems = searchDropdown ? Array.from(searchDropdown.querySelectorAll('.search-result-item')) : [];
    searchDropdownItems.forEach(item => {
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.setAttribute('tabindex', '-1');
    });
    searchDropdownActiveIndex = -1;
}

function focusSearchDropdownItem(index) {
    if (!searchDropdownItems.length) {
        return;
    }
    const total = searchDropdownItems.length;
    const normalizedIndex = ((index % total) + total) % total;
    searchDropdownItems.forEach((item, itemIndex) => {
        const isActive = itemIndex === normalizedIndex;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        item.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    searchDropdownActiveIndex = normalizedIndex;
    searchDropdownItems[normalizedIndex].focus();
}

function showSearchDropdown(results) {
    if (!searchDropdown || !searchInput) {
        return;
    }
    const channels = Array.isArray(results?.channels) ? results.channels.slice(0, 5) : [];
    const videos = Array.isArray(results?.videos) ? results.videos.slice(0, 8) : [];

    if (channels.length === 0 && videos.length === 0) {
        searchDropdown.innerHTML = `
            <div class="search-no-results" role="status">No s'han trobat resultats.</div>
        `;
    } else {
        const channelMarkup = channels.length ? `
            <div class="search-section" role="group" aria-label="Canals">
                <h4>Canals</h4>
                ${channels.map(channel => {
                    const avatar = channel.avatar || getFollowChannelAvatar(channel.id) || 'img/icon-192.png';
                    const subscriberText = channel.subscriberCount != null
                        ? `${formatViews(channel.subscriberCount)} subscriptors`
                        : 'Subscriptors no disponibles';
                    return `
                        <button type="button" class="search-result-item" data-result-type="channel" data-channel-id="${channel.id}">
                            <img class="search-result-avatar" src="${avatar}" alt="${escapeHtml(channel.name || 'Canal')}">
                            <div class="search-result-info">
                                <span class="name">${escapeHtml(channel.name || 'Canal')}</span>
                                <span class="meta">${subscriberText}</span>
                            </div>
                        </button>
                    `;
                }).join('')}
            </div>
        ` : '';

        const videoMarkup = videos.length ? `
            <div class="search-section" role="group" aria-label="Vídeos">
                <h4>Vídeos</h4>
                ${videos.map(video => {
                    const channelName = video.channelTitle || '';
                    const viewCount = video.viewCount ?? video.views ?? 0;
                    const meta = channelName
                        ? `${escapeHtml(channelName)} • ${formatViews(viewCount)} vis.`
                        : `${formatViews(viewCount)} vis.`;
                    return `
                        <button type="button" class="search-result-item" data-result-type="video" data-video-id="${video.id}" data-video-source="${video.source || 'api'}">
                            <img class="search-result-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}">
                            <div class="search-result-info">
                                <span class="title">${escapeHtml(video.title)}</span>
                                <span class="meta">${meta}</span>
                            </div>
                        </button>
                    `;
                }).join('')}
            </div>
        ` : '';

        searchDropdown.innerHTML = `
            ${channelMarkup}
            ${videoMarkup}
        `;
    }

    searchDropdown.hidden = false;
    searchDropdown.setAttribute('aria-hidden', 'false');
    searchDropdown.classList.add('is-visible');
    searchInput.setAttribute('aria-expanded', 'true');
    resetSearchDropdownNavigation();
}

function hideSearchDropdown() {
    if (!searchDropdown || !searchInput) {
        return;
    }
    searchDropdown.hidden = true;
    searchDropdown.setAttribute('aria-hidden', 'true');
    searchDropdown.classList.remove('is-visible');
    searchInput.setAttribute('aria-expanded', 'false');
    searchDropdown.innerHTML = '';
    searchDropdownItems = [];
    searchDropdownActiveIndex = -1;
}

function handleSearchResultSelection(item) {
    if (!item) {
        return;
    }
    const resultType = item.dataset.resultType;
    if (resultType === 'channel') {
        const channelId = item.dataset.channelId;
        if (channelId) {
            openChannelProfile(channelId);
        }
    } else if (resultType === 'video') {
        const videoId = item.dataset.videoId;
        const source = item.dataset.videoSource;
        if (videoId) {
            if (source === 'static') {
                showVideo(videoId);
            } else {
                showVideoFromAPI(videoId);
            }
        }
    }
    hideSearchDropdown();
}

function renderSearchCategoryActions(query) {
    if (!pageTitle) {
        return;
    }
    const normalizedQuery = normalizeCustomTag(query);
    if (!normalizedQuery) {
        setPageTitle(`Resultats per: "${query}"`);
        return;
    }
    const isSaved = isCustomCategory(normalizedQuery);
    pageTitle.classList.add('page-title--with-actions');
    pageTitle.dataset.title = `Resultats per: "${normalizedQuery}"`;
    pageTitle.innerHTML = `
        <span class="page-title__label">Resultats per:</span>
        <span class="page-title__query">"${escapeHtml(normalizedQuery)}"</span>
        <span class="page-title__actions">
            <button class="btn-round-icon category-toggle ${isSaved ? 'is-danger' : ''}" type="button" data-action="toggle-search-category" aria-label="${isSaved ? 'Eliminar' : 'Guardar'}">
                <i data-lucide="${isSaved ? 'minus' : 'plus'}"></i>
            </button>
            <button class="btn-round-icon search-category-share" type="button" data-action="share-search" aria-label="Compartir">
                <i data-lucide="share-2"></i>
            </button>
        </span>
    `;

    const toggleButton = pageTitle.querySelector('[data-action="toggle-search-category"]');
    const shareButton = pageTitle.querySelector('[data-action="share-search"]');

    toggleButton?.addEventListener('click', () => {
        if (isCustomCategory(normalizedQuery)) {
            if (removeCustomTag(normalizedQuery)) {
                setupChipsBarOrdering();
            }
        } else {
            const savedTag = addCustomTag(normalizedQuery);
            if (!savedTag) {
                return;
            }
            setupChipsBarOrdering();
        }
        renderSearchCategoryActions(normalizedQuery);
    });

    shareButton?.addEventListener('click', async () => {
        const shareUrl = `${window.location.origin}?add_tag=${encodeURIComponent(normalizedQuery)}`;
        const { data: shareData, text: shareText } = await buildShareData(normalizedQuery, shareUrl, 'CaTube - Categoria');
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (error) {
                console.warn('Share dismissed', error);
            }
        }
        try {
            await navigator.clipboard.writeText(shareText);
            alert('Text copiat!');
        } catch (error) {
            window.prompt('Copia el text per compartir la categoria:', shareText);
        }
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderCategoryActions(category) {
    if (!pageTitle) {
        return;
    }
    const normalizedCategory = normalizeCustomTag(category);
    if (
        !normalizedCategory
        || normalizedCategory === getCategoryPageTitle('Tot')
        || normalizedCategory === 'Categoria'
        || isStandardCategory(normalizedCategory)
    ) {
        setPageTitle(getCategoryPageTitle(category));
        return;
    }
    const isSaved = isCustomCategory(normalizedCategory);
    pageTitle.classList.add('page-title--with-actions');
    pageTitle.dataset.title = normalizedCategory;
    pageTitle.innerHTML = `
        <span class="page-title__query">${escapeHtml(normalizedCategory)}</span>
        <span class="page-title__actions">
            <button class="btn-round-icon category-toggle ${isSaved ? 'is-danger' : ''}" type="button" data-action="toggle-category" aria-label="${isSaved ? 'Eliminar' : 'Guardar'}">
                <i data-lucide="${isSaved ? 'minus' : 'plus'}"></i>
            </button>
            <button class="btn-round-icon search-category-share" type="button" data-action="share-category" aria-label="Compartir">
                <i data-lucide="share-2"></i>
            </button>
        </span>
    `;

    const toggleButton = pageTitle.querySelector('[data-action="toggle-category"]');
    const shareButton = pageTitle.querySelector('[data-action="share-category"]');

    toggleButton?.addEventListener('click', () => {
        if (isCustomCategory(normalizedCategory)) {
            if (removeCustomTag(normalizedCategory)) {
                setupChipsBarOrdering();
            }
        } else {
            const savedTag = addCustomTag(normalizedCategory);
            if (!savedTag) {
                return;
            }
            setupChipsBarOrdering();
        }
        renderCategoryActions(normalizedCategory);
    });

    shareButton?.addEventListener('click', async () => {
        const shareUrl = `${window.location.origin}?add_tag=${encodeURIComponent(normalizedCategory)}`;
        const { data: shareData, text: shareText } = await buildShareData(normalizedCategory, shareUrl, 'CaTube - Categoria');
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (error) {
                console.warn('Share dismissed', error);
            }
        }
        try {
            await navigator.clipboard.writeText(shareText);
            alert('Text copiat!');
        } catch (error) {
            window.prompt('Copia el text per compartir la categoria:', shareText);
        }
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function navigateToSearchResults(query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return;
    }
    hideSearchDropdown();
    if (searchInput) {
        searchInput.value = '';
    }

    if (useYouTubeAPI && !YouTubeAPI?.feedLoaded) {
        searchVideos(trimmedQuery);
        return;
    }

    const results = performLocalSearch(trimmedQuery);
    showHome();
    renderSearchCategoryActions(trimmedQuery);
    featuredVideoBySection.delete(getHeroSectionKey());
    updateHero(null);

    if (!videosGrid) {
        return;
    }

    if (results.channels.length === 0 && results.videos.length === 0) {
        videosGrid.innerHTML = `
            <div class="search-error">
                <i data-lucide="search-x"></i>
                <p>No s'han trobat resultats locals.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        return;
    }

    const channelSection = results.channels.length ? `
        <section class="search-results-section">
            <h2 class="search-results-title">Canals</h2>
            <div class="follow-grid search-channel-grid">
                ${results.channels.map(channel => {
                    const avatar = channel.avatar || getFollowChannelAvatar(channel.id) || 'img/icon-192.png';
                    const isMitjans = isMitjansChannel(channel.id);
                    const followButtonHtml = isMitjans
                        ? ''
                        : `
                            <button class="follow-toggle-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                                Segueix
                            </button>
                        `;
                    return `
                        <div class="follow-card search-channel-card" data-channel-id="${channel.id}">
                            <div class="follow-avatar-wrap">
                                <img class="follow-avatar" src="${avatar}" alt="${escapeHtml(channel.name || 'Canal')}" loading="lazy">
                            </div>
                            <div class="follow-name">${escapeHtml(channel.name || 'Canal')}</div>
                            ${followButtonHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        </section>
    ` : '';

    const sortedSearchVideos = sortVideosByRoundRobin(results.videos);
    const videoSection = sortedSearchVideos.length ? `
        <section class="search-results-section">
            <h2 class="search-results-title">Vídeos</h2>
            <div class="videos-grid">
                ${sortedSearchVideos.map(video => createVideoCardAPI(video)).join('')}
            </div>
        </section>
    ` : '';

    videosGrid.innerHTML = `
        ${channelSection}
        ${videoSection}
    `;
    videosGrid.querySelectorAll('.search-channel-card').forEach(card => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('[data-follow-channel]')) {
                return;
            }
            openChannelProfile(card.dataset.channelId);
        });
    });

    videosGrid.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            const video = sortedSearchVideos.find(item => String(item.id) === String(videoId));
            if (video?.source === 'static') {
                showVideo(videoId);
            } else {
                showVideoFromAPI(videoId);
            }
        });
    });

    bindFollowButtons(videosGrid);
    bindChannelLinks(videosGrid);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

// Cercar vídeos
async function searchVideos(query) {
    showLoading();
    renderSearchCategoryActions(query);
    showHome();

    const result = await YouTubeAPI.searchVideos(query, CONFIG.layout.videosPerPage);

    if (result.error) {
        hideLoading();
        featuredVideoBySection.delete(getHeroSectionKey());
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
        featuredVideoBySection.delete(getHeroSectionKey());
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
        const filteredResults = detailsResult.filter(video => {
            if (video.isShort) {
                return false;
            }
            const seconds = getVideoDurationSeconds(video);
            return Number.isFinite(seconds) && seconds >= 180;
        });
        if (filteredResults.length > 0) {
            const sortedResults = sortVideosByRoundRobin(filteredResults);
            renderVideos(sortedResults);
        } else {
            featuredVideoBySection.delete(getHeroSectionKey());
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
        }
    } else {
        featuredVideoBySection.delete(getHeroSectionKey());
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
    ensureGridLayoutControls();
    applyGridLayoutPreference();
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

    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'api');

    const isCategoryView = selectedCategory !== 'Tot' && selectedCategory !== 'Novetats';
    const listVideos = isCategoryView && featured
        ? videos.filter(video => String(video.id) !== String(featured.id))
        : videos;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const shorts = listVideos.filter(video => video.isShort);
    const normal = listVideos.filter(video => !video.isShort);

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
    bindChannelLinks(videosGrid);

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

// ==================== SHORTS MANAGEMENT ====================

function openShortModal(videoId) {
    const modal = document.getElementById('short-modal');
    if (!modal) return;

    shortModalScrollY = window.scrollY || 0;
    shortNavHintShown = false;

    if (isPlaylistMode && activePlaylistQueue.length > 0) {
        currentShortsQueue = activePlaylistQueue;
        currentShortIndex = currentPlaylistIndex;
    } else {
        let sourceVideos = currentFeedVideos;
        if (!sourceVideos || sourceVideos.length === 0 || !sourceVideos.some(v => v.isShort)) {
            sourceVideos = cachedAPIVideos;
        }
        currentShortsQueue = sourceVideos.filter(v => v.isShort);

        if (currentShortsQueue.length === 0) {
            console.warn('No hi ha shorts disponibles');
            return;
        }

        const currentVideoIdStr = String(videoId);
        if (!currentShortsQueue.find(v => String(v.id) === currentVideoIdStr)) {
            const video = cachedAPIVideos.find(v => String(v.id) === currentVideoIdStr)
                || { id: videoId, isShort: true, title: '', channelTitle: '' };
            currentShortsQueue.unshift(video);
        }

        currentShortIndex = currentShortsQueue.findIndex(v => String(v.id) === currentVideoIdStr);
        if (currentShortIndex === -1) currentShortIndex = 0;
    }

    const panel = modal.querySelector('.short-modal-panel');
    if (panel) {
        panel.classList.add('immersive');
    }

    loadShort(currentShortIndex);
    setupShortScroll();

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getLikedShorts() {
    const stored = localStorage.getItem('catube_shorts_likes');
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Invalid shorts likes stored value', error);
        return [];
    }
}

function isShortLiked(videoId) {
    const likes = getLikedShorts();
    return likes.includes(String(videoId));
}

function toggleShortLike(video) {
    const videoId = typeof video === 'object' ? video.id : video;
    const likes = getLikedShorts();
    const id = String(videoId);
    const index = likes.indexOf(id);
    let isLiked = false;

    if (index === -1) {
        likes.push(id);
        isLiked = true;
    } else {
        likes.splice(index, 1);
    }

    localStorage.setItem('catube_shorts_likes', JSON.stringify(likes));
    return isLiked;
}

function loadShort(index) {
    if (index < 0 || index >= currentShortsQueue.length) return;

    const short = currentShortsQueue[index];
    const iframe = document.getElementById('short-iframe');
    const origin = encodeURIComponent(window.location.origin || '');
    const src = `https://www.youtube.com/embed/${encodeURIComponent(short.id)}?playsinline=1&rel=0&modestbranding=1&autoplay=1&enablejsapi=1&origin=${origin}&hl=ca&cc_lang_pref=ca&gl=AD`;

    iframe.src = src;
    iframe.dataset.shortPaused = 'false';

    const titleEl = document.getElementById('shortTitle');
    const channelEl = document.getElementById('shortChannel');
    if (titleEl) titleEl.textContent = short.title || '';
    if (channelEl) channelEl.textContent = short.channelTitle || '';

    const likeBtn = document.getElementById('shortLikeBtn');
    if (likeBtn) {
        if (isShortLiked(short.id)) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }

        likeBtn.onclick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            const nowLiked = toggleShortLike(short.id);
            if (nowLiked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        };
    }

    const shareBtn = document.getElementById('shortShareBtn');
    if (shareBtn) {
        shareBtn.onclick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            shareVideo({
                id: short.id,
                title: short.title || 'Short'
            });
        };
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    updateShortNavButtons();

    if (index === 0 && !shortNavHintShown) {
        triggerShortNavHint();
    }
}

function navigateShort(direction) {
    handleScrollIntent(direction);
}

function handleScrollIntent(direction) {
    if (isNavigatingShort) return;

    const newIndex = currentShortIndex + direction;

    if (newIndex >= 0 && newIndex < currentShortsQueue.length) {
        isNavigatingShort = true;

        if (isPlaylistMode) {
            currentPlaylistIndex = newIndex;
            const nextVideo = currentShortsQueue[newIndex];

            if (nextVideo && !nextVideo.isShort) {
                closeShortModal();
                loadVideoInSequence();
                setTimeout(() => {
                    isNavigatingShort = false;
                }, 800);
                return;
            }
        }

        currentShortIndex = newIndex;
        loadShort(currentShortIndex);
        setTimeout(() => {
            isNavigatingShort = false;
        }, 800);
    }
}

function updateShortNavButtons() {
    const prevBtn = document.querySelector('.short-nav-prev');
    const nextBtn = document.querySelector('.short-nav-next');

    if (prevBtn) prevBtn.disabled = currentShortIndex === 0;
    if (nextBtn) nextBtn.disabled = currentShortIndex === currentShortsQueue.length - 1;
}

function triggerShortNavHint() {
    const prevBtn = document.querySelector('.short-nav-prev');
    const nextBtn = document.querySelector('.short-nav-next');

    if (!prevBtn || !nextBtn) return;

    prevBtn.classList.add('short-nav-hint');
    nextBtn.classList.add('short-nav-hint');
    shortNavHintShown = true;

    setTimeout(() => {
        prevBtn.classList.remove('short-nav-hint');
        nextBtn.classList.remove('short-nav-hint');
    }, 2000);
}

function setupShortScroll() {
    const playerWrap = document.getElementById('shortPlayerWrap')
        || document.querySelector('.short-player-wrap');
    const gestureOverlay = document.getElementById('shortGestureOverlay');

    if (!playerWrap || !gestureOverlay || gestureOverlay.dataset.shortScrollBound === 'true') return;

    gestureOverlay.dataset.shortScrollBound = 'true';
    let startY = 0;
    let startX = 0;
    let startTime = 0;
    let isDragging = false;

    const handleStart = (e) => {
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startTime = Date.now();
        isDragging = true;
    };

    const handleEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;

        const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const deltaY = startY - endY;
        const deltaX = startX - endX;
        const elapsed = Date.now() - startTime;
        const isTap = Math.abs(deltaY) < 10 && Math.abs(deltaX) < 10 && elapsed < 250;

        if (isTap) {
            toggleShortPlayback();
        } else if (deltaY > 50) {
            handleScrollIntent(1);
        } else if (deltaY < -50) {
            handleScrollIntent(-1);
        }
    };

    gestureOverlay.addEventListener('touchstart', handleStart, { passive: true });
    gestureOverlay.addEventListener('touchend', handleEnd);
    gestureOverlay.addEventListener('mousedown', handleStart);
    gestureOverlay.addEventListener('mouseup', handleEnd);

    gestureOverlay.addEventListener('wheel', (e) => {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 1 : -1;
        handleScrollIntent(direction);
    }, { passive: false });
}

function toggleShortPlayback() {
    const iframe = document.getElementById('short-iframe');
    if (!iframe || !iframe.contentWindow) {
        return;
    }
    const isPaused = iframe.dataset.shortPaused === 'true';
    const func = isPaused ? 'playVideo' : 'pauseVideo';
    iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func,
        args: []
    }), '*');
    iframe.dataset.shortPaused = isPaused ? 'false' : 'true';
}

function closeShortModal() {
    const modal = document.getElementById('short-modal');
    const iframe = document.getElementById('short-iframe');

    iframe.src = '';
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    window.scrollTo({ top: shortModalScrollY, behavior: 'auto' });

    currentShortIndex = 0;
    currentShortsQueue = [];
    isNavigatingShort = false;
}

function getLikedVideoIds() {
    const stored = localStorage.getItem('user_liked_videos');
    const likedVideos = getLikedVideos();
    const storedIds = likedVideos.map(video => String(video.id));
    if (!stored) {
        return storedIds;
    }
    try {
        const parsed = JSON.parse(stored);
        const legacyIds = Array.isArray(parsed) ? parsed : [];
        return [...new Set([...legacyIds, ...storedIds])];
    } catch (error) {
        console.warn('No es pot llegir user_liked_videos', error);
        return storedIds;
    }
}

function setLikedVideoIds(ids) {
    const normalizedIds = [...new Set(ids.map(id => String(id)))];
    localStorage.setItem('user_liked_videos', JSON.stringify(normalizedIds));
    const existing = getLikedVideos();
    const next = normalizedIds.map(id => existing.find(video => String(video.id) === id) || normalizeLikedVideo({ id }))
        .filter(Boolean);
    setLikedVideos(next);
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

const LIKED_VIDEOS_STORAGE_KEY = 'catube_liked_videos';

function getLikedVideos() {
    const stored = localStorage.getItem(LIKED_VIDEOS_STORAGE_KEY);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('No es pot llegir catube_liked_videos', error);
        return [];
    }
}

function setLikedVideos(videos) {
    localStorage.setItem(LIKED_VIDEOS_STORAGE_KEY, JSON.stringify(videos));
}

function isLiked(videoId) {
    if (!videoId) {
        return false;
    }
    const normalizedId = String(videoId);
    return getLikedVideos().some(video => String(video.id) === normalizedId);
}

function normalizeLikedVideo(video) {
    if (!video) {
        return null;
    }
    return {
        id: video.id,
        title: video.title || video.snippet?.title || '',
        thumbnail: video.thumbnail || video.snippet?.thumbnails?.medium?.url || '',
        channelId: video.channelId || video.snippet?.channelId || '',
        channelTitle: video.channelTitle || video.channel?.name || video.snippet?.channelTitle || '',
        publishedAt: video.publishedAt || video.uploadDate || '',
        viewCount: video.viewCount || video.views || 0
    };
}

function toggleLikeVideo(video) {
    if (!video || video.id === undefined || video.id === null) {
        return false;
    }
    const likedVideos = getLikedVideos();
    const normalizedId = String(video.id);
    const existingIndex = likedVideos.findIndex(item => String(item.id) === normalizedId);
    let nowLiked = false;

    if (existingIndex !== -1) {
        likedVideos.splice(existingIndex, 1);
        nowLiked = false;
    } else {
        const normalizedVideo = normalizeLikedVideo(video);
        if (normalizedVideo) {
            likedVideos.unshift(normalizedVideo);
            nowLiked = true;
        }
    }

    setLikedVideos(likedVideos);
    setLikedVideoIds(likedVideos.map(item => String(item.id)));
    return nowLiked;
}

function updateLikeButtonState(button, liked) {
    if (!button) {
        return;
    }
    button.classList.toggle('is-liked', liked);
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
    const icon = button.querySelector('i');
    if (icon) {
        icon.classList.toggle('fas', liked);
        icon.classList.toggle('far', !liked);
    }
}

function bindLikeButton(container, video) {
    const likeButton = container.querySelector('#likeToggle');
    if (!likeButton || !video) {
        return;
    }
    if (likeButton.dataset.likeBound === 'true') {
        return;
    }
    likeButton.dataset.likeBound = 'true';
    const liked = isLiked(video.id);
    updateLikeButtonState(likeButton, liked);

    const handleLike = (event) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const nowLiked = toggleLikeVideo(video);
        updateLikeButtonState(likeButton, nowLiked);
    };

    likeButton.addEventListener('click', handleLike);
    likeButton.addEventListener('keydown', handleLike);
}

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
    likeBadge.classList.toggle('is-liked', isLiked);
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
        likeBadge.classList.toggle('is-liked', isNowLiked);
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
        playlist.videos.push(video);
    }
    savePlaylists(playlists);
    if (activePlaylistId === playlistId && isPlaylistMode) {
        activePlaylistQueue = playlist.videos;
        updatePlaylistModeBadge();
        renderPlaylistQueue();
    }
}

function removeVideoFromPlaylist(playlistId, videoId) {
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const removedIndex = playlist.videos.findIndex(video => String(video.id) === String(videoId));
    playlist.videos = playlist.videos.filter(video => String(video.id) !== String(videoId));
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        activePlaylistQueue = playlist.videos;
        if (removedIndex !== -1) {
            if (removedIndex < currentPlaylistIndex) {
                currentPlaylistIndex = Math.max(currentPlaylistIndex - 1, 0);
            } else if (removedIndex === currentPlaylistIndex) {
                currentPlaylistIndex = Math.min(currentPlaylistIndex, activePlaylistQueue.length - 1);
            }
        }
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

function reorderPlaylistVideos(playlistId, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const playlists = getPlaylists();
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return;
    const videos = playlist.videos;
    if (!Array.isArray(videos)) return;
    if (fromIndex < 0 || fromIndex >= videos.length || toIndex < 0 || toIndex >= videos.length) {
        return;
    }
    const [moved] = videos.splice(fromIndex, 1);
    videos.splice(toIndex, 0, moved);
    savePlaylists(playlists);
    if (activePlaylistId === playlistId) {
        if (fromIndex === currentPlaylistIndex) {
            currentPlaylistIndex = toIndex;
        } else if (fromIndex < currentPlaylistIndex && toIndex >= currentPlaylistIndex) {
            currentPlaylistIndex = Math.max(currentPlaylistIndex - 1, 0);
        } else if (fromIndex > currentPlaylistIndex && toIndex <= currentPlaylistIndex) {
            currentPlaylistIndex = Math.min(currentPlaylistIndex + 1, videos.length - 1);
        }
        activePlaylistQueue = [...videos];
        updatePlaylistModeBadge();
        renderPlaylistQueue();
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
        const playlistName = list.name;
        const firstVideo = list.videos[0];
        const thumbnail = firstVideo?.thumbnail || 'img/icon-512.png';
        const videoCount = list.videos.length;
        const videosMarkup = list.videos.length > 0
            ? `
                <div class="playlist-video-list" data-playlist-id="${list.id}">
                    ${list.videos.map((video, index) => `
                        <div class="playlist-video-row" draggable="true" data-playlist-id="${list.id}" data-video-index="${index}">
                            <span class="playlist-drag-handle" aria-hidden="true">
                                <i data-lucide="grip-vertical"></i>
                            </span>
                            <img class="playlist-video-thumb" src="${video.thumbnail || 'img/icon-192.png'}" alt="">
                            <div class="playlist-video-title">${escapeHtml(video.title || 'Vídeo')}</div>
                            <button class="playlist-video-remove" type="button" data-playlist-id="${list.id}" data-video-id="${video.id}" aria-label="Eliminar vídeo">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `
            : `<div class="playlist-video-empty">No hi ha vídeos a la llista.</div>`;
        return `
            <div class="playlist-card">
                <div class="playlist-card-thumb" onclick="startPlaylistPlayback('${list.id}')" title="Reproduir llista">
                    <img src="${thumbnail}" alt="${escapeHtml(list.name)}" loading="lazy">
                    <div class="playlist-play-btn" style="pointer-events:none;">
                        <i data-lucide="play" style="width:16px; height:16px; margin-right:4px;"></i> Reproduir
                    </div>
                    <button class="playlist-delete" type="button" data-playlist-id="${list.id}" aria-label="Esborrar llista" onclick="event.stopPropagation(); removePlaylist('${list.id}'); renderPlaylistsPage();">×</button>
                </div>
                <div class="playlist-card-body">
                    <div class="playlist-card-title">
                        ${escapeHtml(list.name)}
                        <button class="btn-round-icon" 
                                onclick="event.stopPropagation(); shareSegueixPlaylist('${escapeHtml(list.name)}')" 
                                title="Compartir llista" 
                                style="width:32px; height:32px; min-width:32px; min-height:32px; background:rgba(255,255,255,0.1);">
                            <i data-lucide="share-2" style="width:16px; height:16px;"></i>
                        </button>
                    </div>
                    <div class="playlist-card-meta">${videoCount} vídeos</div>
                    ${videosMarkup}
                </div>
            </div>
        `;
    }).join('');

    bindPlaylistListInteractions();
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
        const isMitjans = isMitjansChannel(channel.id);
        const followButtonHtml = isMitjans
            ? ''
            : `
                <button class="follow-toggle-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                    Segueix
                </button>
            `;
        return `
            <div class="follow-card" data-channel-id="${channel.id}">
                <div class="follow-avatar-wrap">
                    <img class="follow-avatar" src="${avatar}" alt="${escapeHtml(name)}" loading="lazy">
                </div>
                <div class="follow-name">${escapeHtml(name)}</div>
                ${followButtonHtml}
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
    if (video.isShort) {
        openShortModal(video.id);
        isPlaylistNavigation = false;
        return;
    }
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
        exitPlaylistMode({ showQueueMessage: true });
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

function exitPlaylistMode({ showQueueMessage = false } = {}) {
    isPlaylistMode = false;
    activePlaylistQueue = [];
    currentPlaylistIndex = 0;
    activePlaylistId = null;
    activePlaylistName = '';
    updatePlaylistModeBadge();
    const queueContainer = document.getElementById('playlistQueueContainer');
    const relatedContainer = document.getElementById('relatedVideos');

    if (queueContainer) {
        if (showQueueMessage) {
            queueContainer.innerHTML = '<div class="playlist-queue-title">No hi ha més vídeos en aquesta llista</div>';
            queueContainer.classList.remove('hidden');
        } else {
            queueContainer.innerHTML = '';
            queueContainer.classList.add('hidden');
        }
    }
    if (relatedContainer) {
        relatedContainer.style.display = 'block';
    }
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
                        <span>${escapeHtml(list.name)}</span>
                        <span class="playlist-count-badge">${list.videos.length} vídeos</span>
                    </button>
                `).join('')}
            </div>
        `
        : `<p class="modal-description" style="text-align:center; opacity:0.7;">No tens llistes creades.</p>`;

    playlistModalBody.innerHTML = `
        ${listSection}
        <div class="playlist-modal-create" style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1); display:flex; gap:10px;">
            <input class="playlist-input" type="text" id="playlistModalInput" placeholder="Nom nova llista..." autocomplete="off">
            <button class="playlist-create-btn" type="button" id="playlistModalCreateBtn">
                <i data-lucide="plus"></i>
            </button>
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
    const createAction = () => {
        const name = modalInput?.value?.trim();
        if (!name || !activePlaylistVideo) return;
        createPlaylist(name, activePlaylistVideo);
        renderPlaylistsPage();
        closePlaylistModal();
    };

    if (modalCreateBtn) modalCreateBtn.addEventListener('click', createAction);
    if (modalInput) {
        modalInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                createAction();
            }
        });
        requestAnimationFrame(() => modalInput.focus());
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getPlaylistVideoData(video) {
    const source = video.historySource || (video.videoUrl ? 'static' : 'api');
    return {
        id: video.id,
        title: video.title || video.snippet?.title || '',
        thumbnail: getPreferredThumbnail(video),
        channelTitle: video.channelTitle || video.snippet?.channelTitle || '',
        channelId: video.channelId || video.snippet?.channelId || '',
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
            let likeVideo = { id: videoId };
            if (button.dataset.likeVideo) {
                try {
                    likeVideo = JSON.parse(decodeURIComponent(button.dataset.likeVideo));
                } catch (error) {
                    console.warn('No es pot llegir el vídeo preferit', error);
                }
            }
            const nowLiked = toggleLikeVideo(likeVideo);
            button.classList.toggle('is-liked', nowLiked);
            button.setAttribute('aria-pressed', nowLiked ? 'true' : 'false');
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
    const queueContainer = document.getElementById('playlistQueueContainer');
    const relatedContainer = document.getElementById('relatedVideos');

    if (relatedContainer && window.innerWidth > 1024) {
        relatedContainer.style.display = 'block';
    }

    if (!queueContainer) return;

    if (!isPlaylistMode || activePlaylistQueue.length === 0) {
        queueContainer.classList.add('hidden');
        return;
    }

    queueContainer.classList.remove('hidden');

    queueContainer.innerHTML = `
        <div class="playlist-queue-title">
            <span>Reprodueix: ${escapeHtml(activePlaylistName)}</span>
            <span style="font-size:0.85rem; opacity:0.7;">${currentPlaylistIndex + 1} / ${activePlaylistQueue.length}</span>
        </div>
        <div class="playlist-queue-list" data-playlist-id="${activePlaylistId}">
            ${activePlaylistQueue.map((video, index) => {
                const isActive = index === currentPlaylistIndex;
                return `
                <div class="playlist-queue-item${isActive ? ' is-active' : ''}" draggable="true"
                     data-playlist-index="${index}" onclick="playVideoFromPlaylistIndex(${index})">
                    <div class="playlist-queue-handle" aria-hidden="true">
                        <i data-lucide="grip-vertical"></i>
                    </div>
                    <div style="position:relative; flex-shrink:0;">
                        <img src="${video.thumbnail || 'img/icon-192.png'}" alt="">
                        ${isActive ? '<div style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center;"><i data-lucide="bar-chart-2" style="color:white;"></i></div>' : ''}
                    </div>
                    <div class="playlist-queue-meta">
                        <div style="font-weight:600; font-size:0.9rem; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(video.title)}
                        </div>
                        <div style="font-size:0.75rem; color:var(--color-text-secondary);">
                            ${escapeHtml(video.channelTitle || '')}
                        </div>
                    </div>
                    <div class="playlist-queue-actions">
                        <button class="playlist-queue-remove" type="button" data-video-id="${video.id}" aria-label="Eliminar vídeo">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;

    bindPlaylistQueueInteractions();
    const activeItem = queueContainer.querySelector('.is-active');
    if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function playVideoFromPlaylistIndex(index) {
    if (index >= 0 && index < activePlaylistQueue.length) {
        currentPlaylistIndex = index;
        loadVideoInSequence();
    }
}

function bindPlaylistListInteractions() {
    if (!playlistsList || isPlaylistListBound) return;

    playlistsList.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.playlist-video-remove');
        if (!removeButton) return;
        event.stopPropagation();
        removeVideoFromPlaylist(removeButton.dataset.playlistId, removeButton.dataset.videoId);
        renderPlaylistsPage();
    });

    playlistsList.addEventListener('dragstart', (event) => {
        const row = event.target.closest('.playlist-video-row');
        if (!row) return;
        playlistDragState = {
            playlistId: row.dataset.playlistId,
            fromIndex: Number(row.dataset.videoIndex)
        };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.videoIndex);
        row.classList.add('is-dragging');
    });

    playlistsList.addEventListener('dragover', (event) => {
        const row = event.target.closest('.playlist-video-row');
        if (!row || !playlistDragState) return;
        if (row.dataset.playlistId !== playlistDragState.playlistId) return;
        event.preventDefault();
        row.classList.add('is-drag-over');
    });

    playlistsList.addEventListener('dragleave', (event) => {
        const row = event.target.closest('.playlist-video-row');
        if (row) row.classList.remove('is-drag-over');
    });

    playlistsList.addEventListener('drop', (event) => {
        const row = event.target.closest('.playlist-video-row');
        if (!row || !playlistDragState) return;
        if (row.dataset.playlistId !== playlistDragState.playlistId) return;
        event.preventDefault();
        row.classList.remove('is-drag-over');
        const toIndex = Number(row.dataset.videoIndex);
        reorderPlaylistVideos(playlistDragState.playlistId, playlistDragState.fromIndex, toIndex);
        playlistDragState = null;
        renderPlaylistsPage();
    });

    playlistsList.addEventListener('dragend', (event) => {
        const row = event.target.closest('.playlist-video-row');
        if (row) row.classList.remove('is-dragging');
        playlistsList.querySelectorAll('.playlist-video-row.is-drag-over')
            .forEach(item => item.classList.remove('is-drag-over'));
        playlistDragState = null;
    });

    isPlaylistListBound = true;
}

function bindPlaylistQueueInteractions() {
    const queueContainer = document.getElementById('playlistQueueContainer');
    if (!queueContainer || isPlaylistQueueBound) return;

    queueContainer.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.playlist-queue-remove');
        if (!removeButton) return;
        event.preventDefault();
        event.stopPropagation();
        if (!activePlaylistId) return;
        removeVideoFromPlaylist(activePlaylistId, removeButton.dataset.videoId);
    }, true);

    queueContainer.addEventListener('dragstart', (event) => {
        const item = event.target.closest('.playlist-queue-item');
        if (!item) return;
        const list = queueContainer.querySelector('.playlist-queue-list');
        if (!list) return;
        playlistQueueDragState = {
            playlistId: list.dataset.playlistId,
            fromIndex: Number(item.dataset.playlistIndex)
        };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.dataset.playlistIndex);
        item.classList.add('is-dragging');
    });

    queueContainer.addEventListener('dragover', (event) => {
        const item = event.target.closest('.playlist-queue-item');
        if (!item || !playlistQueueDragState) return;
        event.preventDefault();
        item.classList.add('is-drag-over');
    });

    queueContainer.addEventListener('dragleave', (event) => {
        const item = event.target.closest('.playlist-queue-item');
        if (item) item.classList.remove('is-drag-over');
    });

    queueContainer.addEventListener('drop', (event) => {
        const item = event.target.closest('.playlist-queue-item');
        if (!item || !playlistQueueDragState) return;
        event.preventDefault();
        item.classList.remove('is-drag-over');
        const toIndex = Number(item.dataset.playlistIndex);
        reorderPlaylistVideos(playlistQueueDragState.playlistId, playlistQueueDragState.fromIndex, toIndex);
        playlistQueueDragState = null;
    });

    queueContainer.addEventListener('dragend', (event) => {
        const item = event.target.closest('.playlist-queue-item');
        if (item) item.classList.remove('is-dragging');
        queueContainer.querySelectorAll('.playlist-queue-item.is-drag-over')
            .forEach(row => row.classList.remove('is-drag-over'));
        playlistQueueDragState = null;
    });

    isPlaylistQueueBound = true;
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
    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'api');

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
                        <div class="channel-name channel-link" data-channel-id="${video.channelId}">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            <!-- Si hi ha comptador de vistes, fes servir "vis." -->
                            <!-- Exemple si s'afegeix: <span>${formatViews(video.viewCount)} vis.</span> -->
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
    bindChannelLinks(videosGrid);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

// Crear targeta de vídeo (API)
function createVideoCardAPI(video) {
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
    const duration = getVideoDisplayDuration(video);
    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail${video.isShort ? ' is-short' : ''}">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${video.isShort ? '<span class="video-short-badge">SHORT</span>' : ''}
                ${duration ? `<span class="video-duration">${duration}</span>` : ''}
            </div>
            <div class="video-details">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${video.channelId}">${escapeHtml(video.channelTitle)}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(video.viewCount || 0)} vis.</span>
                            <span>•</span>
                            <span>${formatDate(video.publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDesktopSidebar(channel, channelVideos, currentVideoId) {
    const channelInfoContainer = document.getElementById('sidebarChannelInfo');
    const channelVideosContainer = document.getElementById('sidebarChannelVideos');

    if (!channelInfoContainer || !channelVideosContainer) {
        return;
    }

    const filteredVideos = channelVideos
        .filter(v => String(v.id) !== String(currentVideoId))
        .slice(0, WATCH_SIDEBAR_VIDEOS_LIMIT);

    const avatar = resolveChannelAvatar(channel.id, channel);
    const subsText = channel.subscriberCount
        ? formatViews(channel.subscriberCount) + ' subscriptors'
        : '';
    const description = channel.description || 'Sense descripció disponible.';

    const channelName = channel.title || channel.name || 'Canal';
    const isMitjans = isMitjansChannel(channel.id);
    const followButtonHtml = isMitjans
        ? ''
        : `
            <button class="follow-channel-btn" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                Segueix
            </button>
        `;
    channelInfoContainer.innerHTML = `
        <div class="sidebar-channel-header channel-link" data-channel-id="${channel.id}">
            <img class="sidebar-channel-avatar" src="${avatar}" alt="${escapeHtml(channelName)}">
            <div>
                <h3 class="sidebar-channel-name">${escapeHtml(channelName)}</h3>
                ${subsText ? `<span class="sidebar-channel-subs">${subsText}</span>` : ''}
            </div>
        </div>
        <div class="sidebar-channel-description">${escapeHtml(description)}</div>
        <div class="sidebar-channel-actions">
            ${followButtonHtml}
            <button class="btn-round-icon" type="button" data-share-channel-id="${channel.id}" data-share-channel-name="${encodeURIComponent(channelName)}" data-share-channel-description="${encodeURIComponent(description)}" title="Compartir canal">
                <i data-lucide="share-2"></i>
            </button>
        </div>
    `;

    if (filteredVideos.length > 0) {
        channelVideosContainer.innerHTML = `
            <h4 class="sidebar-channel-videos-title">Més vídeos d'aquest canal</h4>
            ${filteredVideos.map(video => `
                <div class="sidebar-video-item" data-video-id="${video.id}">
                    <img class="sidebar-video-thumb" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                    <div class="sidebar-video-info">
                        <div class="sidebar-video-title">${escapeHtml(video.title)}</div>
                        <div class="sidebar-video-stats">
                            ${video.viewCount ? formatViews(video.viewCount) + ' vis.' : ''}
                            ${video.publishedAt ? '• ' + formatDate(video.publishedAt) : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
    } else {
        channelVideosContainer.innerHTML = '<p class="sidebar-channel-videos-title">No hi ha més vídeos d\'aquest canal.</p>';
    }

    bindFollowButtons(channelInfoContainer);
    bindChannelLinks(channelInfoContainer);
    channelVideosContainer.querySelectorAll('.sidebar-video-item').forEach(item => {
        item.addEventListener('click', () => {
            showVideoFromAPI(item.dataset.videoId);
        });
    });
}

function getStaticChannelVideos(channelId) {
    const localVideos = typeof VIDEOS !== 'undefined' && Array.isArray(VIDEOS) ? VIDEOS : [];
    return localVideos
        .filter(video => String(video.channelId) === String(channelId) && !video.isShort)
        .map(video => ({
            id: video.id,
            title: video.title,
            thumbnail: video.thumbnail || 'img/icon-192.png',
            viewCount: video.views,
            publishedAt: video.uploadDate
        }));
}

function renderChannelSidebarFromApi(channelId, currentVideoId, channelResult, fallbackTitle = '') {
    if (!isDesktopView()) {
        return;
    }
    const channelList = Array.isArray(YouTubeAPI?.getAllChannels?.())
        ? YouTubeAPI.getAllChannels()
        : [];
    const matchedChannel = channelList.find(channelItem => String(channelItem.id) === String(channelId));
    const channelData = matchedChannel
        ? { ...channelResult?.channel, ...matchedChannel }
        : channelResult?.channel
        || cachedChannels[channelId]
        || { id: channelId, title: fallbackTitle };

    const feedVideos = Array.isArray(YouTubeAPI?.feedVideos) ? YouTubeAPI.feedVideos : [];
    const channelVideos = [...feedVideos, ...cachedAPIVideos]
        .filter(v => String(v.channelId) === String(channelId) && !v.isShort);

    renderDesktopSidebar(channelData, channelVideos, currentVideoId);
}

function renderChannelSidebarFromStatic(channel, currentVideoId) {
    if (!isDesktopView() || !channel) {
        return;
    }
    const channelData = {
        ...channel,
        title: channel.name,
        subscriberCount: channel.subscribers,
        avatar: channel.avatar
    };
    const channelVideos = getStaticChannelVideos(channel.id);
    renderDesktopSidebar(channelData, channelVideos, currentVideoId);
}

function renderCategoryVideosBelow(currentChannelId, currentVideoId) {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer) {
        return;
    }
    setExtraRelatedTitle(DEFAULT_EXTRA_RELATED_TITLE);

    let videos = currentFeedVideos || [];

    if (selectedCategory && selectedCategory !== 'Novetats' && selectedCategory !== 'Tot') {
        videos = filterVideosByCategory(videos, currentFeedData);
    }

    videos = videos.filter(v => {
        if (String(v.channelId) === String(currentChannelId)) {
            return false;
        }
        if (String(v.id) === String(currentVideoId)) {
            return false;
        }
        if (v.isShort) {
            return false;
        }
        if (selectedCategory === 'Novetats' || selectedCategory === 'Tot') {
            const channelCats = getChannelCustomCategories(v.channelId);
            let feedCats = [];
            if (currentFeedData?.channels) {
                const channel = currentFeedData.channels.find(c => String(c.id) === String(v.channelId));
                if (channel && Array.isArray(channel.categories)) {
                    feedCats = channel.categories;
                }
            } else if (cachedChannels[v.channelId]?.categories) {
                feedCats = cachedChannels[v.channelId].categories;
            }
            const isMitjans = [...channelCats, ...feedCats]
                .some(cat => String(cat).toLowerCase() === 'mitjans');
            if (isMitjans) {
                return false;
            }
        }
        return true;
    });

    videos = videos.slice(0, WATCH_CATEGORY_VIDEOS_LIMIT);

    if (videos.length === 0) {
        extraContainer.innerHTML = '<div class="empty-state">No hi ha més vídeos d\'aquesta categoria.</div>';
        return;
    }

    extraContainer.innerHTML = videos.map(video => createVideoCardAPI(video)).join('');
    ensureWatchGridLayoutControls();
    applyWatchGridLayoutPreference();

    extraContainer.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            showVideoFromAPI(card.dataset.videoId);
        });
    });
    bindChannelLinks(extraContainer);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

async function renderPlaylistRelatedVideos(playlistName) {
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    if (!extraContainer) {
        return;
    }
    const trimmedName = String(playlistName || '').trim();
    if (!trimmedName) {
        extraContainer.innerHTML = '<div class="empty-state">No hi ha vídeos relacionats.</div>';
        return;
    }

    setExtraRelatedTitle(`Resultats de la llista: ${trimmedName}`);

    const videos = getPlaylistSearchVideos(trimmedName);

    if (videos.length === 0) {
        extraContainer.innerHTML = '<div class="empty-state">No hi ha vídeos relacionats.</div>';
        return;
    }

    extraContainer.innerHTML = videos.map(video => createVideoCardAPI(video)).join('');
    ensureWatchGridLayoutControls();
    applyWatchGridLayoutPreference();

    extraContainer.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            const video = videos.find(item => String(item.id) === String(videoId));
            if (video?.source === 'static') {
                showVideo(videoId);
            } else {
                showVideoFromAPI(videoId);
            }
        });
    });
    bindChannelLinks(extraContainer);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
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
            const channelList = Array.isArray(YouTubeAPI?.getAllChannels?.())
                ? YouTubeAPI.getAllChannels()
                : [];
            const matchedChannel = channelList.find(channelItem => String(channelItem.id) === String(cachedVideo.channelId));
            const cachedChannelAvatar = resolveChannelAvatar(
                cachedVideo.channelId,
                matchedChannel || { thumbnail: cachedVideo.channelThumbnail }
            );
            const channel = {
                id: cachedVideo.channelId || '',
                title: cachedChannelTitle,
                subscriberCount: matchedChannel?.subscriberCount
            };
            const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
            const watchUrl = `https://www.youtube.com/watch?v=${cachedVideo.id || videoId}`;
            const subsText = channel.subscriberCount
                ? formatViews(channel.subscriberCount) + ' subscriptors'
                : 'Subscriptors ocults';
            const isMitjans = isMitjansChannel(channel.id);
            const followButtonHtml = isMitjans
                ? ''
                : `
                            <button class="follow-btn-pill" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                                Segueix
                            </button>
                        `;
            channelInfo.innerHTML = `
                <div class="video-info-modern">
                    <div class="channel-header-row">
                        <div class="channel-identity-modern channel-link" data-channel-id="${channel.id}">
                            <img src="${cachedChannelAvatar}" alt="${escapeHtml(channel.title)}" class="channel-avatar-small">
                            <div class="channel-text-modern">
                                <div class="channel-name-row">
                                    <h1 class="channel-name-modern">${escapeHtml(channel.title)}</h1>
                                </div>
                                <span class="channel-subs-modern">${subsText}</span>
                            </div>
                        </div>
                        <div class="channel-actions-inline">
                            ${followButtonHtml}
                            <button class="btn-heart" id="likeToggle" type="button" aria-label="M'agrada" aria-pressed="false">
                                <i data-lucide="heart"></i>
                            </button>
                        </div>
                    </div>

                    <div class="video-metadata-bar">
                        <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn-pill-red">
                            Canal Youtube
                        </a>
                        
                        <div class="action-group">
                            <button class="btn-round-icon" id="playlistBtn" title="Llista de reproducció">
                                <i data-lucide="list-video"></i>
                            </button>
                            <button class="btn-round-icon" id="shareBtn" title="Compartir">
                                <i data-lucide="share-2"></i>
                            </button>
                            <button class="btn-round-icon" id="miniPlayerToggle" type="button" title="Mini reproductor">
                                <i data-lucide="minimize-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="video-description"></div>
                </div>
                <a href="${watchUrl}" target="_blank" class="btn-comment-youtube">
                    Comenta a Youtube
                </a>
            `;
            bindLikeButton(channelInfo, cachedVideo);
            setupMiniPlayerToggle();
            bindFollowButtons(channelInfo);
            bindChannelLinks(channelInfo);
            const playlistBtn = document.getElementById('playlistBtn');
            if (playlistBtn) {
                playlistBtn.addEventListener('click', () => {
                    openPlaylistModal(getPlaylistVideoData(cachedVideo));
                });
            }
        }
    }

    // 2. Enriquiment progressiu via API
    let video;
    let channelResult;
    try {
        const videoResult = await YouTubeAPI.getVideoDetails(videoId);

        if (videoResult.video) {
            video = videoResult.video;
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
            channelResult = await YouTubeAPI.getChannelDetails(video.channelId);

            if (channelResult.channel) {
                const channel = channelResult.channel;
                const currentVideo = video;
                const channelInfo = document.getElementById('channelInfo');
                const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
                const watchUrl = `https://www.youtube.com/watch?v=${video.id || videoId}`;
                const channelList = Array.isArray(YouTubeAPI?.getAllChannels?.())
                    ? YouTubeAPI.getAllChannels()
                    : [];
                const matchedChannel = channelList.find(channelItem => String(channelItem.id) === String(currentVideo.channelId));
                const channelAvatar = resolveChannelAvatar(channel.id, { ...channel, ...matchedChannel });
                const subsText = channel.subscriberCount
                    ? formatViews(channel.subscriberCount) + ' subscriptors'
                    : 'Subscriptors ocults';
                const isMitjans = isMitjansChannel(channel.id);
                const followButtonHtml = isMitjans
                    ? ''
                    : `
                            <button class="follow-btn-pill" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                                Segueix
                            </button>
                        `;
                channelInfo.innerHTML = `
                    <div class="video-info-modern">
                        <div class="channel-header-row">
                            <div class="channel-identity-modern channel-link" data-channel-id="${channel.id}">
                                <img src="${channelAvatar}" alt="${escapeHtml(channel.title)}" class="channel-avatar-small">
                                <div class="channel-text-modern">
                                    <div class="channel-name-row">
                                        <h1 class="channel-name-modern">${escapeHtml(channel.title)}</h1>
                                    </div>
                                    <span class="channel-subs-modern">${subsText}</span>
                                </div>
                        </div>
                        <div class="channel-actions-inline">
                            ${followButtonHtml}
                            <button class="btn-heart" id="likeToggle" type="button" aria-label="M'agrada" aria-pressed="false">
                                <i data-lucide="heart"></i>
                            </button>
                        </div>
                    </div>

                        <div class="video-metadata-bar">
                            <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn-pill-red">
                                Canal Youtube
                            </a>
                            
                            <div class="action-group">
                                <button class="btn-round-icon" id="playlistBtn" title="Llista de reproducció">
                                    <i data-lucide="list-video"></i>
                                </button>
                                <button class="btn-round-icon" id="shareBtn" title="Compartir">
                                    <i data-lucide="share-2"></i>
                                </button>
                                <button class="btn-round-icon" id="miniPlayerToggle" type="button" title="Mini reproductor">
                                    <i data-lucide="minimize-2"></i>
                                </button>
                            </div>
                        </div>
                        <div class="video-description">
                            ${escapeHtml(video.description || '').substring(0, 500)}${video.description?.length > 500 ? '...' : ''}
                        </div>
                    </div>
                    <a href="${watchUrl}" target="_blank" class="btn-comment-youtube">
                        Comenta a Youtube
                    </a>
                `;
                bindLikeButton(channelInfo, video);
                setupMiniPlayerToggle();
                bindFollowButtons(channelInfo);
                bindChannelLinks(channelInfo);
                const playlistBtn = document.getElementById('playlistBtn');
                if (playlistBtn) {
                    playlistBtn.addEventListener('click', () => {
                        openPlaylistModal(getPlaylistVideoData(video));
                    });
                }
            }
        }
    } catch (error) {
        console.warn("L'API ha fallat, però almenys es veu la info bàsica", error);
    }

    // Carregar vídeos relacionats o cua de la llista
    const channelId = video?.channelId || cachedVideo?.channelId;
    if (isPlaylistMode) {
        renderPlaylistQueue();
        if (channelId) {
            renderChannelSidebarFromApi(channelId, videoId, channelResult, video?.channelTitle || cachedVideo?.channelTitle || '');
        }
        renderPlaylistRelatedVideos(activePlaylistName);
    } else if (CONFIG.features.recommendations) {
        if (channelId && isDesktopView()) {
            renderChannelSidebarFromApi(channelId, videoId, channelResult, video?.channelTitle || cachedVideo?.channelTitle || '');
            renderCategoryVideosBelow(channelId, videoId);
        } else if (channelId) {
            renderCategoryVideosBelow(channelId, videoId);
        }
    }

    window.scrollTo(0, 0);
    hideLoading();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

// Carregar vídeos relacionats des de l'API
async function loadRelatedVideosFromAPI(videoId) {
    const relatedContainer = document.getElementById('relatedVideos');
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    const sidebarLimit = 8;
    setExtraRelatedTitle(DEFAULT_EXTRA_RELATED_TITLE);

    // La API de vídeos relacionats pot no funcionar, fem fallback a vídeos populars
    let result = await YouTubeAPI.getRelatedVideos(videoId, 20);

    if (result.error || result.items.length === 0) {
        result = await YouTubeAPI.getPopularVideos(20);
    }

    if (result.items.length === 0) {
        relatedContainer.innerHTML = '<p>No hi ha vídeos relacionats</p>';
        if (extraContainer) {
            extraContainer.innerHTML = '';
        }
        return;
    }

    // Obtenir detalls dels vídeos
    const videoIds = result.items.map(v => v.id).join(',');
    const details = await fetchVideoDetails(videoIds);
    let videos = details.length > 0 ? details : result.items;
    videos = videos.filter(v => !v.isShort);

    const sidebarVideos = videos.slice(0, sidebarLimit);
    const extraVideos = videos.slice(sidebarLimit);

    relatedContainer.innerHTML = sidebarVideos.map(video => {
        const duration = getVideoDisplayDuration(video);
        return `
        <div class="related-video" data-video-id="${video.id}">
            <div class="related-thumbnail">
                <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy">
                ${duration ? `<span class="video-duration">${duration}</span>` : ''}
            </div>
            <div class="related-info">
                <div class="related-title-text">${escapeHtml(video.title)}</div>
                <div class="related-channel">${escapeHtml(video.channelTitle)}</div>
                <div class="related-stats">
                    ${video.viewCount ? formatViews(video.viewCount) + ' vis. • ' : ''}${formatDate(video.publishedAt)}
                </div>
            </div>
        </div>
    `;
    }).join('');

    if (extraContainer) {
        extraContainer.innerHTML = extraVideos.map(video => createVideoCardAPI(video)).join('');
        if (extraVideos.length > 0) {
            ensureWatchGridLayoutControls();
            applyWatchGridLayoutPreference();
        }
    }

    // Event listeners
    const relatedVideoElements = relatedContainer.querySelectorAll('.related-video');
    relatedVideoElements.forEach(element => {
        element.addEventListener('click', () => {
            const id = element.dataset.videoId;
            showVideoFromAPI(id);
        });
    });

    if (extraContainer) {
        extraContainer.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', () => {
                showVideoFromAPI(card.dataset.videoId);
            });
        });
        bindChannelLinks(extraContainer);
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

// ==================== DADES ESTÀTIQUES (FALLBACK) ====================

// Carregar vídeos estàtics
function loadVideos() {
    setPageTitle('Recomanat per a tu');
    setFeedContext(VIDEOS, getFeedDataForFilter(), renderStaticVideos);
}

function renderStaticVideos(videos) {
    ensureGridLayoutControls();
    applyGridLayoutPreference();
    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'static');

    videosGrid.innerHTML = videos.map(video => createVideoCard(video)).join('');

    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            showVideo(videoId);
        });
    });
    bindChannelLinks(videosGrid);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
}

// Carregar vídeos per categoria (estàtic)
function loadVideosByCategoryStatic(categoryId) {
    ensureGridLayoutControls();
    applyGridLayoutPreference();
    const videos = filterOutWatchedVideos(getVideosByCategory(categoryId));
    const category = CONFIG.categories.find(c => c.id === categoryId);
    renderCategoryActions(category ? category.name : 'Categoria');
    const featured = getFeaturedVideoForSection(videos, getHeroSectionKey());
    updateHero(featured, 'static');
    const listVideos = featured
        ? videos.filter(video => String(video.id) !== String(featured.id))
        : videos;
    videosGrid.innerHTML = listVideos.map(video => createVideoCard(video)).join('');

    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            showVideo(videoId);
        });
    });
    bindChannelLinks(videosGrid);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Crear targeta de vídeo (estàtic)
function createVideoCard(video) {
    const channel = getChannelById(video.channelId);
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));

    return `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <span class="video-duration">${video.duration}</span>
            </div>
            <div class="video-details">
                <img src="${channel.avatar}" alt="${channel.name}" class="channel-avatar channel-link" data-channel-id="${channel.id}">
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${video.title}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${channel.id}">${channel.name}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(video.views)} vis.</span>
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
    const watchUrl = video.videoUrl
        ? video.videoUrl.replace('embed/', 'watch?v=')
        : `https://www.youtube.com/watch?v=${videoId}`;
    const subsText = channel.subscriberCount
        ? formatViews(channel.subscriberCount) + ' subscriptors'
        : 'Subscriptors ocults';
    const isMitjans = isMitjansChannel(channel.id);
    const followButtonHtml = isMitjans
        ? ''
        : `
                    <button class="follow-btn-pill" type="button" data-follow-channel="${channel.id}" aria-pressed="false">
                        Segueix
                    </button>
                `;
    channelInfo.innerHTML = `
        <div class="video-info-modern">
            <div class="channel-header-row">
                <div class="channel-identity-modern channel-link" data-channel-id="${channel.id}">
                    <img src="${channel.avatar || 'img/icon-192.png'}" alt="${escapeHtml(channel.name)}" class="channel-avatar-small">
                    <div class="channel-text-modern">
                        <div class="channel-name-row">
                            <h1 class="channel-name-modern">${escapeHtml(channel.name)}</h1>
                        </div>
                        <span class="channel-subs-modern">${subsText}</span>
                    </div>
                </div>
                <div class="channel-actions-inline">
                    ${followButtonHtml}
                    <button class="btn-heart" id="likeToggle" type="button" aria-label="M'agrada" aria-pressed="false">
                        <i data-lucide="heart"></i>
                    </button>
                </div>
            </div>

            <div class="video-metadata-bar">
                <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn-pill-red">
                    Canal Youtube
                </a>
                
                <div class="action-group">
                    <button class="btn-round-icon" id="playlistBtn" title="Llista de reproducció">
                        <i data-lucide="list-video"></i>
                    </button>
                    <button class="btn-round-icon" id="shareBtn" title="Compartir">
                        <i data-lucide="share-2"></i>
                    </button>
                    <button class="btn-round-icon" id="miniPlayerToggle" type="button" title="Mini reproductor">
                        <i data-lucide="minimize-2"></i>
                    </button>
                </div>
            </div>
            <div class="video-description">
                ${escapeHtml(video.description || '').substring(0, 500)}${video.description?.length > 500 ? '...' : ''}
            </div>
        </div>
        <a href="${watchUrl}" target="_blank" class="btn-comment-youtube">
            Comenta a Youtube
        </a>
    `;
    const likeVideoData = {
        ...video,
        channel: {
            id: channel.id,
            name: channel.name
        }
    };
    bindLikeButton(channelInfo, likeVideoData);
    setupMiniPlayerToggle();
    bindFollowButtons(channelInfo);
    bindChannelLinks(channelInfo);
    const playlistBtn = document.getElementById('playlistBtn');
    if (playlistBtn) {
        playlistBtn.addEventListener('click', () => {
            openPlaylistModal(getPlaylistVideoData(video));
        });
    }

    if (isPlaylistMode) {
        renderPlaylistQueue();
        renderChannelSidebarFromStatic(channel, videoId);
        renderPlaylistRelatedVideos(activePlaylistName);
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

function getHistoryVideoIdSet() {
    return new Set(getHistoryItems().map(item => String(item.id)));
}

function filterOutWatchedVideos(videos) {
    const watchedIds = getHistoryVideoIdSet();
    if (!Array.isArray(videos) || videos.length === 0 || watchedIds.size === 0) {
        return videos;
    }
    return videos.filter(video => !watchedIds.has(String(video.id)));
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

    const historyEntry = {
        ...video,
        viewedAt: new Date().toISOString()
    };

    history.unshift(historyEntry);

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
        4: 'El Món',
        5: 'Diversió'
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
    const duration = getVideoDisplayDuration(video);
    const channelTitle = video.channelTitle || channel?.name || '';
    const views = video.viewCount || video.views || 0;
    const likedIds = getLikedVideoIds();
    const isLiked = likedIds.includes(String(video.id));
    const payload = encodeURIComponent(JSON.stringify(getPlaylistVideoData(video)));
    const likePayload = encodeURIComponent(JSON.stringify({
        id: video.id,
        title,
        thumbnail,
        channelId: video.channelId || channel?.id || '',
        channelTitle,
        viewCount: views
    }));

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
                ${channel ? `<img src="${channel.avatar}" alt="${escapeHtml(channel.name)}" class="channel-avatar channel-link" data-channel-id="${channel.id}">` : ''}
                <div class="video-info-container">
                    <div class="video-info-header">
                        <h3 class="video-card-title">${escapeHtml(title)}</h3>
                        <div class="video-card-actions">
                            <button class="video-action-btn like-action heart-toggle${isLiked ? ' is-liked' : ''}" type="button" data-video-id="${video.id}" data-like-video="${likePayload}" aria-label="Preferit" aria-pressed="${isLiked ? 'true' : 'false'}">
                                ${HEART_TOGGLE_SVG}
                            </button>
                            <button class="video-action-btn playlist-action" type="button" data-playlist-video="${payload}" aria-label="Afegir a una llista">
                                ${PLAYLIST_ICON_SVG}
                            </button>
                        </div>
                    </div>
                    <div class="video-metadata">
                        <div class="channel-name channel-link" data-channel-id="${video.channelId || channel?.id || ''}">${escapeHtml(channelTitle)}</div>
                        <div class="video-stats">
                            <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                            <span>${formatViews(views)} vis.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderHistory() {
    if (!historyGrid) return;

    let historyItems = getFilteredHistoryItems();
    const totalHistoryItems = getHistoryItems();
    // FIX: Explicitly sort history items by date (newest first) to ensure correct grouping
    historyItems.sort((a, b) => {
        const dateA = new Date(a.viewedAt || a.publishedAt || a.uploadDate || 0).getTime();
        const dateB = new Date(b.viewedAt || b.publishedAt || b.uploadDate || 0).getTime();
        return dateB - dateA;
    });

    if (historyItems.length === 0) {
        const message = totalHistoryItems.length === 0
            ? 'Encara no hi ha vídeos a l\'historial.'
            : 'No hi ha vídeos que coincideixin amb aquests filtres.';
        historyGrid.innerHTML = `<div class="empty-state">${message}</div>`;
        return;
    }

    let currentLabel = null;
    const groupedMarkup = historyItems.map(video => {
        const viewedAt = video.viewedAt || video.publishedAt || video.uploadDate || video.snippet?.publishedAt || '';
        const label = viewedAt ? formatDate(viewedAt) : 'Sense data';
        const heading = label !== currentLabel
            ? `<h2 class="history-group-title">${escapeHtml(label)}</h2>`
            : '';
        currentLabel = label;
        return `${heading}${createHistoryCard(video)}`;
    }).join('');
    historyGrid.innerHTML = groupedMarkup;

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
    bindChannelLinks(historyGrid);

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
    historySelectedCategory = 'Tot';
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

function showFollow(tab = 'following') {
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
    setActiveFollowTab(tab);
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
    if (channelProfileTags) {
        renderChannelProfileCategories(channel, normalizedId);
    }
    if (channelProfileFollowBtn) {
        channelProfileFollowBtn.dataset.followChannel = normalizedId;
        channelProfileFollowBtn.dataset.followBound = 'false';
        if (isMitjansChannel(normalizedId)) {
            channelProfileFollowBtn.classList.add('hidden');
        } else {
            channelProfileFollowBtn.classList.remove('hidden');
        }
    }
    if (channelProfileShareBtn) {
        channelProfileShareBtn.dataset.shareChannelId = normalizedId;
        channelProfileShareBtn.dataset.shareChannelName = encodeURIComponent(channelName);
        channelProfileShareBtn.dataset.shareChannelDescription = encodeURIComponent(channel?.description || 'No hi ha descripció disponible.');
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
    bindChannelLinks(channelVideosGrid);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
    window.scrollTo(0, 0);
    if (window.location.hash === '#follow') {
        setTimeout(scrollToChannelFollow, 150);
    }
}

function mapStaticVideoToCardData(video) {
    const channel = getChannelById(video.channelId);
    return {
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration,
        isShort: video.isShort,
        channelId: video.channelId,
        channelTitle: channel?.name || '',
        viewCount: video.views,
        publishedAt: video.uploadDate,
        videoUrl: video.videoUrl
    };
}
// Carregar vídeos relacionats (estàtic)
function loadRelatedVideos(currentVideoId) {
    setExtraRelatedTitle(DEFAULT_EXTRA_RELATED_TITLE);
    const relatedVideos = VIDEOS
        .filter(v => v.id !== parseInt(currentVideoId) && !v.isShort)
        .slice(0, 20);
    const relatedContainer = document.getElementById('relatedVideos');
    const extraContainer = extraVideosGrid || document.getElementById('extraVideosGrid');
    const sidebarLimit = 8;

    const sidebarVideos = relatedVideos.slice(0, sidebarLimit);
    const extraVideos = relatedVideos.slice(sidebarLimit);

    relatedContainer.innerHTML = sidebarVideos.map(video => {
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
                        ${formatViews(video.views)} vis. • ${formatDate(video.uploadDate)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (extraContainer) {
        extraContainer.innerHTML = extraVideos
            .map(video => createVideoCardAPI(mapStaticVideoToCardData(video)))
            .join('');
        if (extraVideos.length > 0) {
            ensureWatchGridLayoutControls();
            applyWatchGridLayoutPreference();
        }
    }

    const relatedVideoElements = document.querySelectorAll('.related-video');
    relatedVideoElements.forEach(element => {
        element.addEventListener('click', () => {
            const videoId = element.dataset.videoId;
            showVideo(videoId);
        });
    });

    if (extraContainer) {
        extraContainer.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', () => {
                showVideo(card.dataset.videoId);
            });
        });
        bindChannelLinks(extraContainer);
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    setupVideoCardActionButtons();
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

// --- FUNCIONS PER COMPARTIR LLISTES (SEGUEIX) - VERSIÓ CORREGIDA ---

// 1. Funció per ENVIAR (Adaptada a la teva estructura de playlists)
async function shareSegueixPlaylist(playlistName) {
    const stored = localStorage.getItem('catube_playlists');
    const allPlaylists = stored ? JSON.parse(stored) : [];
    const targetPlaylist = allPlaylists.find(p => p.name === playlistName);

    if (!targetPlaylist || !targetPlaylist.videos || targetPlaylist.videos.length === 0) {
        return alert('Aquesta llista és buida o no existeix.');
    }

    // 1. Show Loading Modal
    const loadingModal = document.createElement('div');
    loadingModal.className = 'modal-overlay active share-modal-overlay';
    loadingModal.innerHTML = `
        <div class="modal modal-small">
            <div class="modal-body" style="text-align:center; padding: 30px;">
                <div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto 15px auto;"></div>
                <p style="margin-bottom: 10px;">Verificant seguretat i generant enllaç...</p>
                
                <p style="font-size: 10px; color: #888; margin-top: 15px; line-height: 1.3;">
                    Protegit per reCAPTCHA. S'apliquen la 
                    <a href="https://policies.google.com/privacy" target="_blank" style="color:#888;text-decoration:underline;">Política de Privacitat</a> i els 
                    <a href="https://policies.google.com/terms" target="_blank" style="color:#888;text-decoration:underline;">Termes del Servei</a> de Google.
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(loadingModal);

    try {
        const urls = targetPlaylist.videos.map(v => `https://www.youtube.com/watch?v=${v.id}`);
        const siteKey = '6LfJHl4sAAAAAHIgz-uIlDp1AQvQknLIVz-YTJnh';

        // Check if library loaded
        if (typeof grecaptcha === 'undefined') {
            throw new Error("No s'ha pogut carregar el sistema de seguretat de Google. Revisa la teva connexió o bloquejadors d'anuncis.");
        }

        // 2. Execute reCAPTCHA
        grecaptcha.ready(async function() {
            try {
                // Get the token
                const token = await grecaptcha.execute(siteKey, {action: 'share_playlist'});
                
                // 3. Send Data + Token to Backend
                const res = await fetch(SEGUEIX_API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        nom: playlistName, 
                        urls: urls,
                        recaptchaToken: token 
                    })
                });
                
                const data = await res.json();
                loadingModal.remove();

                if (data.status === 'success') {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?list=${data.id}`;
                    
                    // Native Share or Fallback
                    if (navigator.share) {
                        try {
                            await navigator.share({
                                title: `Llista: ${playlistName}`,
                                text: `Mira aquesta llista de reproducció "${playlistName}" a CaTube!`,
                                url: shareUrl
                            });
                        } catch (err) {
                            console.log('User cancelled share');
                        }
                    } else {
                        showManualShareModal(playlistName, shareUrl);
                    }
                } else {
                    throw new Error(data.message || 'Error desconegut al servidor');
                }
            } catch (err) {
                loadingModal.remove();
                console.error(err);
                alert('Error de seguretat o connexió: ' + err.message);
            }
        });

    } catch (err) {
        loadingModal.remove();
        alert('Error: ' + err.message);
    }
}

function showManualShareModal(name, url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal modal-small">
            <div class="modal-header">
                <h2 class="modal-title">Comparteix la llista</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="text-align:center; padding: 20px;">
                <p style="margin-bottom:15px;">Copia l'enllaç per enviar-lo per on vulguis:</p>
                <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 0.85rem; margin-bottom: 20px; user-select: all;">
                    ${url}
                </div>
                <button class="hero-button" id="copyBtn">
                    <i data-lucide="copy"></i> Copiar Enllaç
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    modal.querySelector('#copyBtn').onclick = function() {
        navigator.clipboard.writeText(url);
        this.innerHTML = '<i data-lucide="check"></i> Copiat!';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };
}

// 2. Listener per DETECTAR llistes compartides
document.addEventListener('DOMContentLoaded', async () => {
    // DETECT SHARED PLAYLIST
    const params = new URLSearchParams(window.location.search);
    if (params.has('list')) {
        const listId = params.get('list');

        // 1. IMMEDIATE NAVIGATION TO LIBRARY
        // This gives context to the user that they are adding to their library
        if (typeof showPlaylists === 'function') {
            showPlaylists();
            // Update Navigation UI manually to ensure 'active' state is correct
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            const libNav = document.querySelector('.nav-item[data-page="playlists"]');
            if (libNav) libNav.classList.add('active');
        }
        
        // 2. Initial Loading Modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'importPlaylistModal';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal modal-small">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <div class="spinner" style="width:20px;height:20px;border-width:2px;margin-right:10px;"></div>
                        Carregant Llista...
                    </h2>
                </div>
                <div class="modal-body" style="text-align:center; padding: 40px 20px;">
                    <p class="modal-description">Connectant amb el servidor...</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Clean URL immediately
        window.history.replaceState({}, document.title, window.location.pathname);

        (async () => {
            try {
                // 3. Fetch Playlist Data from Sheet
                const res = await fetch(`${SEGUEIX_API_URL}?id=${listId}`);
                const data = await res.json();

                if (data.status === 'success') {
                    let ids = [];
                    
                    // ROBUST ID EXTRACTION
                    if (data.urls && typeof data.urls === 'string') {
                        ids = data.urls.split(',').map(url => {
                            const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
                            return match ? match[1] : url.trim(); 
                        }).filter(id => id && id.length > 0);
                    } else if (data.ids && typeof data.ids === 'string') {
                        ids = data.ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    }

                    if (ids.length === 0) throw new Error("La llista està buida.");

                    const playlistName = data.nom || 'Llista Compartida';
                    modal.querySelector('.modal-description').textContent = `Obtenint dades de ${ids.length} vídeos...`;

                    // 4. PREPARE LOCAL DATA SOURCES (Prioritize Feed & Cache)
                    const feedVideos = (typeof YouTubeAPI !== 'undefined' && Array.isArray(YouTubeAPI.feedVideos)) ? YouTubeAPI.feedVideos : [];
                    const allKnownVideos = [
                        ...feedVideos, 
                        ...(window.cachedAPIVideos || []), 
                        ...(window.VIDEOS || [])
                    ];

                    // 5. RESOLVE VIDEOS
                    const resolvedVideos = [];
                    const missingIds = [];
                    
                    ids.forEach(id => {
                        const found = allKnownVideos.find(v => String(v.id) === String(id));
                        if (found) {
                            resolvedVideos.push(getPlaylistVideoData(found));
                        } else {
                            missingIds.push(id);
                        }
                    });

                    // 6. FETCH MISSING FROM API
                    if (missingIds.length > 0) {
                        let apiKey = null;
                        if (typeof YouTubeAPI !== 'undefined' && YouTubeAPI.getApiKey) apiKey = YouTubeAPI.getApiKey();
                        if (!apiKey) apiKey = localStorage.getItem('catube_api_key') || localStorage.getItem('youtube_api_key');

                        if (apiKey) {
                            try {
                                for (let i = 0; i < missingIds.length; i += 50) {
                                    const chunk = missingIds.slice(i, i + 50).join(',');
                                    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${chunk}&key=${apiKey}`;
                                    
                                    const ytRes = await fetch(apiUrl);
                                    if (ytRes.ok) {
                                        const ytData = await ytRes.json();
                                        if (ytData.items) {
                                            const newItems = ytData.items.map(item => ({
                                                id: item.id,
                                                title: item.snippet.title,
                                                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || 'img/icon-192.png',
                                                channelTitle: item.snippet.channelTitle,
                                                source: 'api'
                                            }));

                                            if (!window.cachedAPIVideos) window.cachedAPIVideos = [];
                                            window.cachedAPIVideos.push(...newItems);
                                            
                                            newItems.forEach(item => resolvedVideos.push(getPlaylistVideoData(item)));
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error("Error fetching YouTube details:", e);
                            }
                        }
                    }

                    // 7. CONSTRUCT FINAL LIST
                    const orderedVideos = [];
                    ids.forEach(id => {
                        let v = resolvedVideos.find(rv => String(rv.id) === String(id));
                        if (!v) {
                            v = {
                                id: id,
                                title: `Video ${id}`, 
                                thumbnail: 'img/icon-192.png', 
                                channelTitle: 'Informació no disponible',
                                source: 'api'
                            };
                        } else {
                            if (!v.source) v.source = 'api';
                        }
                        orderedVideos.push(v);
                    });

                    // 8. SAVE TO PLAYLISTS
                    const playlists = getPlaylists();
                    const newId = `shared_${listId}`;
                    const existingIndex = playlists.findIndex(p => p.id === newId);
                    
                    const newPlaylistObj = {
                        id: newId,
                        name: playlistName,
                        videos: orderedVideos
                    };

                    if (existingIndex >= 0) playlists[existingIndex] = newPlaylistObj;
                    else playlists.push(newPlaylistObj);
                    
                    savePlaylists(playlists);

                    // REFRESH UI (Since we are already on the Library page, this will show the new playlist in the background)
                    if (typeof renderPlaylistsPage === 'function' && !playlistsPage.classList.contains('hidden')) {
                        renderPlaylistsPage();
                    }

                    // 9. SHOW RESULT MODAL
                    const modalHeader = modal.querySelector('.modal-header');
                    modalHeader.innerHTML = `
                        <h2 class="modal-title" style="display:flex; align-items:center; gap:10px; overflow:hidden; white-space:nowrap; max-width:85%;">
                            <i data-lucide="library" style="flex-shrink:0; color:#fff;"></i> 
                            <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(playlistName)}</span>
                        </h2>
                        <button class="modal-close" onclick="document.getElementById('importPlaylistModal').remove()">
                            <i data-lucide="x"></i>
                        </button>
                    `;

                    const listHtml = orderedVideos.map(video => `
                        <div class="playlist-import-item" onclick="document.getElementById('importPlaylistModal').remove(); if(typeof showVideoFromAPI === 'function') { showVideoFromAPI('${video.id}'); }" style="display:flex; gap:10px; align-items:center; padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                            <img src="${video.thumbnail}" style="width:60px; height:34px; object-fit:cover; border-radius:4px; flex-shrink:0; background:#333;">
                            <div style="min-width:0; flex-grow:1;">
                                <div style="font-size:0.85rem; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color: var(--text-primary);">${escapeHtml(video.title)}</div>
                                <div style="font-size:0.75rem; color:var(--color-text-secondary);">${escapeHtml(video.channelTitle || '')}</div>
                            </div>
                            <i data-lucide="play-circle" style="width:16px; height:16px; opacity:0.5;"></i>
                        </div>
                    `).join('');

                    modal.querySelector('.modal-body').innerHTML = `
                        <div style="padding: 15px; background: rgba(46, 204, 113, 0.1); border-bottom:1px solid rgba(255,255,255,0.05); color: #2ecc71; font-size:0.9rem;">
                            <i data-lucide="check-circle" style="width:16px; vertical-align:text-bottom;"></i>
                            Llista guardada correctament!
                        </div>
                        <div style="max-height: 50vh; overflow-y: auto; text-align:left;">
                            ${listHtml}
                        </div>
                    `;
                    modal.querySelector('.modal-body').style.padding = '0';
                    if (typeof lucide !== 'undefined') lucide.createIcons();

                } else {
                    throw new Error('Llista no trobada');
                }
            } catch (err) {
                console.error(err);
                modal.querySelector('.modal-header').innerHTML = `
                    <h2 class="modal-title">Error</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i data-lucide="x"></i></button>
                `;
                modal.querySelector('.modal-body').innerHTML = `
                    <p style="color:#ff6b6b;">${err.message || "Error desconegut."}</p>
                `;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        })();
    }
});

// 3. Renderitzar la vista compartida
function renderSharedPlaylist(name, stringIds = '') {
    const ids = Array.isArray(stringIds)
        ? stringIds
        : (typeof stringIds === 'string' ? stringIds.split(',') : []);

    // CORRECCIÓ: Busquem els vídeos a les teves caches existents (API + Estàtics)
    // Combinem totes les fonts possibles per trobar la info del vídeo
    const allKnownVideos = [...(window.cachedAPIVideos || []), ...(window.VIDEOS || [])];

    const videos = ids.map(id => {
        // Intentem trobar el vídeo complet
        return allKnownVideos.find(v => String(v.id) === String(id))
            || { id: id, title: 'Vídeo Carregant...', thumbnail: 'img/icon-192.png', channelTitle: '...' }; // Fallback
    });

    // Netegem la vista principal
    if (pageTitle) pageTitle.textContent = `Llista compartida: ${name}`;
    if (chipsBar) chipsBar.classList.add('hidden'); // Amaguem filtres

    const container = document.getElementById('videosGrid');
    if (!container) return;

    // Header amb botó de guardar
    const headerHTML = `
        <div style="grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#222; padding:15px; border-radius:10px;">
            <div>
                <h2 style="margin:0; font-size:1.2rem;">📂 ${escapeHtml(name)}</h2>
                <p style="margin:0; opacity:0.7;">${videos.length} vídeos compartits</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="saveImportedPlaylist('${escapeHtml(name)}', '${stringIds}')" class="hero-button" style="padding:8px 16px; font-size:0.9rem;">
                    💾 Guardar a la meva Biblioteca
                </button>
                <a href="${window.location.pathname}" class="hero-button" style="background:#444; text-decoration:none; padding:8px 16px; font-size:0.9rem;">
                    Sortir
                </a>
            </div>
        </div>
    `;

    // Reutilitzem la teva funció createVideoCardAPI per mantenir el disseny
    const videosHTML = videos.map(v => typeof createVideoCardAPI === 'function' ? createVideoCardAPI(v) : '').join('');

    container.innerHTML = headerHTML + videosHTML;

    // Reactivem els clicks a les targetes
    container.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            if (typeof showVideoFromAPI === 'function') showVideoFromAPI(card.dataset.videoId);
        });
    });
}

// 4. Funció per GUARDAR (Correctament integrada a la teva App)
function saveImportedPlaylist(name, stringIds = '') {
    const ids = Array.isArray(stringIds)
        ? stringIds
        : (typeof stringIds === 'string' ? stringIds.split(',') : []);
    const allKnownVideos = [...(window.cachedAPIVideos || []), ...(window.VIDEOS || [])];

    // Reconstruïm els objectes de vídeo
    const resolvedVideos = ids.map(id => {
        const found = allKnownVideos.find(v => String(v.id) === String(id));
        if (found) return getPlaylistVideoData(found); // Utilitzem la teva funció helper
        return { id: id, title: 'Vídeo desconegut', source: 'api' };
    });

    // CORRECCIÓ: Utilitzem la teva estructura 'catube_playlists'
    const playlists = getPlaylists(); // La teva funció existent
    const newPlaylist = {
        id: `pl_${Date.now()}`,
        name: `${name} (Importada)`,
        videos: resolvedVideos
    };

    playlists.push(newPlaylist);
    savePlaylists(playlists); // La teva funció existent

    alert(`Llista "${newPlaylist.name}" guardada correctament a la Biblioteca!`);
}
