// Configuració de l'aplicació
const CONFIG = {
    branding: {
        name: "Segueix!",
        tagline: "La teva plataforma de vídeos personalitzada"
    },
    
    theme: {
        primaryColor: "#FF0000",
        secondaryColor: "#282828",
        backgroundColor: "#333333",
        textColor: "#FFFFFF"
    },
    
    features: {
        comments: true,
        likes: true,
        subscriptions: true,
        search: true,
        recommendations: true,
        categories: true
    },
    
    layout: {
        showSidebar: true,
        videosPerPage: 12
    },
    
    // Categories personalitzades
    categories: [
        { id: "el-mon", name: "El Món", icon: "users" },
        { id: "cultura", name: "Cultura", icon: "book-open" },
        { id: "diversio", name: "Diversió", icon: "laugh" },
        { id: "gaming", name: "Gaming", icon: "gamepad-2" },
        { id: "vida", name: "Vida", icon: "heart" },
        { id: "mitjans", name: "Mitjans", icon: "tv" },
        { id: "digitals", name: "Digitals", icon: "monitor" }
    ],
    
    navigation: {
        showHome: true,
        showTrending: true,
        showSubscriptions: true,
        showLibrary: true,
        showHistory: true
    }
};

// Aplicar tema personalitzat
function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', CONFIG.theme.primaryColor);
    root.style.setProperty('--color-secondary', CONFIG.theme.secondaryColor);
    root.style.setProperty('--color-background', CONFIG.theme.backgroundColor);
    root.style.setProperty('--color-text', CONFIG.theme.textColor);
    
    document.title = CONFIG.branding.name;
    
    const logoText = document.querySelector('.logo-text');
    if (logoText) {
        logoText.textContent = CONFIG.branding.name;
    }
}

// Aplicar tema quan es carrega la pàgina
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTheme);
} else {
    applyTheme();
}

const SEGUEIX_API_URL = 'https://script.google.com/macros/s/AKfycbxheg82HKVeBl4rw6RNze_HBTKD-GwM49iBYKsBMWWdBqea6_DMG9rYWwa5VLJy6sS4/exec';
