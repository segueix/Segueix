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
 * Noms dels dies de la setmana en català
 */
const CATALAN_DAYS = [
    'Diumenge', 'Dilluns', 'Dimarts', 'Dimecres',
    'Dijous', 'Divendres', 'Dissabte'
];

/**
 * Noms dels mesos en català
 */
const CATALAN_MONTHS = [
    'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
    'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
];

/**
 * Formata una data de manera natural i llegible en català
 * @param {string|Date} dateString - Data a formatar
 * @returns {string} Data formatada en català
 */
function formatDate(dateString) {
    if (!dateString) return '';

    // Si rebem una data en format ISO curt (YYYY-MM-DD), la tractem com a local
    // per evitar desplaçaments de fus horari que confonguin "avui" amb "ahir".
    const isoShortMatch = typeof dateString === 'string'
        ? dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        : null;
    const date = isoShortMatch
        ? new Date(Number(isoShortMatch[1]), Number(isoShortMatch[2]) - 1, Number(isoShortMatch[3]))
        : new Date(dateString);
    const now = new Date();

    // Normalitzar dates a mitjanit per comparacions precises de dies
    const dateAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Diferència en dies
    const diffTime = nowAtMidnight - dateAtMidnight;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Si la data és futura o invàlida, mostrem el format complet per no confondre
    if (Number.isNaN(diffDays) || diffDays < 0) {
        const day = date.getDate();
        const monthName = CATALAN_MONTHS[date.getMonth()];
        const year = date.getFullYear();
        return year === now.getFullYear()
            ? `El ${day} de ${monthName}`
            : `El ${day} de ${monthName} de ${year}`;
    }

    // Avui
    if (diffDays === 0) {
        return 'Avui';
    }

    // Ahir
    if (diffDays === 1) {
        return 'Ahir';
    }

    // Aquesta setmana (dimarts, dimecres, etc.)
    if (diffDays >= 2 && diffDays <= 6) {
        return CATALAN_DAYS[date.getDay()];
    }

    // La setmana passada (7-13 dies)
    if (diffDays >= 7 && diffDays <= 13) {
        return 'La setmana passada';
    }

    // Fa 2-3 setmanes
    if (diffDays >= 14 && diffDays <= 27) {
        const weeks = Math.floor(diffDays / 7);
        return `Fa ${weeks} setmanes`;
    }

    // Mateix mes (mostrar dia)
    if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        const day = date.getDate();
        const monthName = CATALAN_MONTHS[date.getMonth()];
        return `El ${day} de ${monthName}`;
    }

    // El mes passat
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    if (date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear()) {
        return 'El mes passat';
    }

    // Fa X mesos (2-11 mesos enrere)
    const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (monthsDiff >= 2 && monthsDiff <= 11) {
        return `Fa ${monthsDiff} mesos`;
    }

    // Mateix any (mostrar dia i mes)
    if (date.getFullYear() === now.getFullYear()) {
        const day = date.getDate();
        const monthName = CATALAN_MONTHS[date.getMonth()];
        return `El ${day} de ${monthName}`;
    }

    // Anys anteriors (mostrar dia, mes i any)
    const day = date.getDate();
    const monthName = CATALAN_MONTHS[date.getMonth()];
    const year = date.getFullYear();
    return `El ${day} de ${monthName} de ${year}`;
}
