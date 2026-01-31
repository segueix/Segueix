// Configuració de l'aplicació
const CONFIG = {
    branding: {
        name: "iuTube",
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
        { id: "societat", name: "Societat", icon: "users" },
        { id: "cultura", name: "Cultura", icon: "book-open" },
        { id: "humor", name: "Humor", icon: "laugh" },
        { id: "gaming", name: "Gaming", icon: "gamepad-2" },
        { id: "vida", name: "Vida", icon: "heart" },
        { id: "mitjans", name: "Mitjans", icon: "tv" }
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
