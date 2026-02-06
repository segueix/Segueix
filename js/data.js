// Dades de l'aplicació

const VIDEOS = [
    {
        id: 1,
        title: "Introducció a React 2024",
        description: "Aprèn React des de zero amb aquest tutorial complet",
        thumbnail: "https://picsum.photos/seed/react1/320/180",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "15:30",
        views: 125000,
        likes: 8500,
        dislikes: 120,
        uploadDate: "2024-12-15",
        channelId: 1,
        categoryId: 5
    },
    {
        id: 2,
        title: "Tutorial Tailwind CSS",
        description: "Domina Tailwind CSS en menys d'una hora",
        thumbnail: "https://picsum.photos/seed/tailwind/320/180",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "45:20",
        views: 89000,
        likes: 6200,
        dislikes: 80,
        uploadDate: "2024-12-10",
        channelId: 2,
        categoryId: 5
    },
    {
        id: 3,
        title: "Millors moments Gaming 2024",
        description: "Recopilació dels millors moments de gaming d'aquest any",
        thumbnail: "https://picsum.photos/seed/gaming/320/180",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "22:15",
        views: 340000,
        likes: 25000,
        dislikes: 450,
        uploadDate: "2024-12-20",
        channelId: 3,
        categoryId: 2
    },
    {
        id: 4,
        title: "Música Relaxant per Estudiar",
        description: "2 hores de música ambient perfecta per concentrar-te",
        thumbnail: "https://picsum.photos/seed/music/320/180",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "120:00",
        views: 560000,
        likes: 42000,
        dislikes: 890,
        uploadDate: "2024-11-30",
        channelId: 4,
        categoryId: 1
    },
    {
        id: 5,
        title: "Història de Catalunya Medieval",
        description: "Descobreix els secrets de l'època medieval catalana",
        thumbnail: "https://picsum.photos/seed/history/320/180",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "35:45",
        views: 45000,
        likes: 3200,
        dislikes: 45,
        uploadDate: "2024-12-05",
        channelId: 5,
        categoryId: 3
    },
    {
        id: 6,
        title: "Millors jugades de futbol 2024",
        description: "Les jugades més espectaculars de la temporada",
        thumbnail: "https://picsum.photos/seed/football/320/180",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "18:30",
        views: 780000,
        likes: 55000,
        dislikes: 1200,
        uploadDate: "2024-12-18",
        channelId: 6,
        categoryId: 4
    }
];

const CHANNELS = [
    {
        id: 1,
        name: "CodeMaster",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=code",
        subscribers: 250000,
        description: "Tutorials de programació i desenvolupament web"
    },
    {
        id: 2,
        name: "DesignHub",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=design",
        subscribers: 180000,
        description: "Disseny web i UI/UX"
    },
    {
        id: 3,
        name: "ProGamer",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=gaming",
        subscribers: 520000,
        description: "Gaming, reviews i gameplays"
    },
    {
        id: 4,
        name: "Ambient Sounds",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=music",
        subscribers: 890000,
        description: "Música relaxant i ambient"
    },
    {
        id: 5,
        name: "HistoriaCat",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=history",
        subscribers: 75000,
        description: "Història i cultura catalana"
    },
    {
        id: 6,
        name: "SportsWorld",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sports",
        subscribers: 1200000,
        description: "Esports i destacats"
    }
];

const COMMENTS = [
    {
        id: 1,
        videoId: 1,
        author: "UserPro",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=user1",
        text: "Excel·lent tutorial! M'ha ajudat molt",
        likes: 45,
        timestamp: "2024-12-16T10:30:00Z"
    },
    {
        id: 2,
        videoId: 1,
        author: "DevExpert",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=user2",
        text: "Podries fer un seguiment sobre hooks?",
        likes: 23,
        timestamp: "2024-12-17T15:20:00Z"
    }
];

// Funcions d'utilitat per obtenir dades
function getVideoById(id) {
    return VIDEOS.find(v => v.id === parseInt(id));
}

function getChannelById(id) {
    return CHANNELS.find(c => c.id === parseInt(id));
}

function getCommentsByVideoId(videoId) {
    return COMMENTS.filter(c => c.videoId === parseInt(videoId));
}

function getVideosByCategory(categoryId) {
    return VIDEOS.filter(v => v.categoryId === parseInt(categoryId));
}

function formatViews(views) {
    if (views >= 1000000) {
        return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
        return `${(views / 1000).toFixed(1)}K`;
    }
    return views;
}

/**
 * Noms dels mesos abreviats per a mòbil
 */
const SHORT_MONTHS = [
    'gen.', 'febr.', 'març', 'abr.', 'maig', 'juny',
    'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'
];

/**
 * Formata una data de manera compacta per evitar salts de línia
 */
function formatDate(dateString) {
    if (!dateString) return '';

    const isoShortMatch = typeof dateString === 'string'
        ? dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        : null;
    const date = isoShortMatch
        ? new Date(Number(isoShortMatch[1]), Number(isoShortMatch[2]) - 1, Number(isoShortMatch[3]))
        : new Date(dateString);
    const now = new Date();

    const dateAtMidnightUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const nowAtMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const diffDays = Math.floor((nowAtMidnightUTC - dateAtMidnightUTC) / (1000 * 60 * 60 * 24));

    // Si la data és futura o error
    if (Number.isNaN(diffDays) || diffDays < 0) {
        const day = date.getUTCDate();
        const month = SHORT_MONTHS[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        return year === now.getUTCFullYear() ? `${day} ${month}` : `${day} ${month} ${year}`;
    }

    if (diffDays === 0) return 'Avui';
    if (diffDays === 1) return 'Ahir';
    if (diffDays >= 2 && diffDays <= 6) return `Fa ${diffDays} dies`;

    // Setmanes (Abreviat)
    if (diffDays >= 7 && diffDays <= 13) return 'Fa 1 setm.';
    if (diffDays >= 14 && diffDays <= 29) {
        return `Fa ${Math.floor(diffDays / 7)} setm.`;
    }

    // Mesos i Anys (Abreviat)
    const currentYear = now.getUTCFullYear();
    const videoYear = date.getUTCFullYear();

    // Si és del mateix any, mostrem dia i mes curt (Ex: "15 gen.")
    if (currentYear === videoYear) {
        const day = date.getUTCDate();
        const month = SHORT_MONTHS[date.getUTCMonth()];
        // Excepció: si fa menys d'un mes però salta de mes al calendari
        const monthsDiff = (now.getUTCMonth() - date.getUTCMonth());
        if (monthsDiff === 1 && diffDays < 45) return 'Fa 1 mes';
        return `${day} ${month}`;
    }

    // Si és d'anys anteriors (Ex: "15 gen. 23")
    const day = date.getUTCDate();
    const month = SHORT_MONTHS[date.getUTCMonth()];
    const shortYear = videoYear.toString().slice(-2); // "2023" -> "23"
    return `${day} ${month} ${shortYear}`;
}

/* --- NOVES FUNCIONS PER GESTIONAR L'ESBORRAT D'ETIQUETES --- */

// 1. Esborrar categoria personalitzada globalment (del llistat principal)
function deleteCustomCategoryGlobal(categoryName) {
    const rawCategory = typeof categoryName === 'string' ? categoryName : '';
    const normalized = typeof normalizeCustomTag === 'function'
        ? normalizeCustomTag(rawCategory)
        : rawCategory.trim().replace(/^"|"$/g, '');

    if (!normalized) {
        return;
    }

    if (typeof removeCustomTag === 'function') {
        removeCustomTag(normalized);
    } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('catube_custom_tags');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const next = parsed.filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
                    localStorage.setItem('catube_custom_tags', JSON.stringify(next));
                }
            } catch (error) {
                console.warn('No es pot actualitzar catube_custom_tags', error);
            }
        }
    }

    if (typeof localStorage === 'undefined') {
        return;
    }

    const storedChannels = localStorage.getItem('catube_channel_custom_categories');
    if (!storedChannels) {
        return;
    }

    try {
        const parsed = JSON.parse(storedChannels) || {};
        let updated = false;
        Object.keys(parsed).forEach((channelId) => {
            if (!Array.isArray(parsed[channelId])) {
                return;
            }
            const filtered = parsed[channelId].filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
            if (filtered.length === 0) {
                delete parsed[channelId];
                updated = true;
            } else if (filtered.length !== parsed[channelId].length) {
                parsed[channelId] = filtered;
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem('catube_channel_custom_categories', JSON.stringify(parsed));
        }
    } catch (error) {
        console.warn('No es pot actualitzar catube_channel_custom_categories', error);
    }
}

// 2. Treure etiqueta d'un canal específic (del perfil)
function removeCategoryFromChannel(channelId, categoryName) {
    if (!channelId) {
        return;
    }
    const rawCategory = typeof categoryName === 'string' ? categoryName : '';
    const normalized = typeof normalizeCustomTag === 'function'
        ? normalizeCustomTag(rawCategory)
        : rawCategory.trim().replace(/^"|"$/g, '');

    if (!normalized) {
        return;
    }

    if (typeof getChannelCustomCategories === 'function' && typeof saveChannelCustomCategories === 'function') {
        const current = getChannelCustomCategories(channelId);
        const next = current.filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
        saveChannelCustomCategories(channelId, next);
        return;
    }

    if (typeof localStorage === 'undefined') {
        return;
    }
    const stored = localStorage.getItem('catube_channel_custom_categories');
    if (!stored) {
        return;
    }
    try {
        const parsed = JSON.parse(stored) || {};
        if (!Array.isArray(parsed[String(channelId)])) {
            return;
        }
        const next = parsed[String(channelId)].filter(tag => String(tag).toLowerCase() !== normalized.toLowerCase());
        if (next.length === 0) {
            delete parsed[String(channelId)];
        } else {
            parsed[String(channelId)] = next;
        }
        localStorage.setItem('catube_channel_custom_categories', JSON.stringify(parsed));
    } catch (error) {
        console.warn('No es pot actualitzar catube_channel_custom_categories', error);
    }
}
