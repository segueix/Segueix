const fs = require('fs');
const path = require('path');
const https = require('https');

// URL del CSV
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv';
const OUTPUT_FILE = path.join(__dirname, '../data/channels.json');
const API_KEY = process.argv[2];

// Descarregar CSV seguint redireccions
async function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchCSV(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Buscar canal per ID (UC...)
async function getChannelById(id) {
    if (!API_KEY) return null;
    return new Promise((resolve) => {
        https.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${id}&key=${API_KEY}`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { const j = JSON.parse(data); resolve(j.items ? j.items[0] : null); } catch { resolve(null); }
            });
        });
    });
}

// Buscar canal per Handle (@Nom)
async function getChannelByHandle(handle) {
    if (!API_KEY) return null;
    const cleanHandle = handle.replace('@', '');
    return new Promise((resolve) => {
        https.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${cleanHandle}&key=${API_KEY}`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { const j = JSON.parse(data); resolve(j.items ? j.items[0] : null); } catch { resolve(null); }
            });
        });
    });
}

async function main() {
    console.log('--- INICIANT RESOLUCIÓ DE CANALS (HÍBRID) ---');
    
    try {
        const csvData = await fetchCSV(SHEET_CSV_URL);
        const lines = csvData.split('\n').slice(1);
        const channels = [];
        
        for (const line of lines) {
            // Netejar la línia i buscar parts
            const parts = line.split(',');
            // Busquem alguna part que sembli un Handle (@...) o un ID (UC...)
            const handleOrId = parts.find(p => p && (p.trim().startsWith('@') || p.trim().startsWith('UC')));
            
            if (handleOrId) {
                const term = handleOrId.trim();
                let details = null;

                console.log(`Processant: ${term}`);

                if (API_KEY) {
                    if (term.startsWith('@')) {
                        details = await getChannelByHandle(term);
                    } else if (term.startsWith('UC')) {
                        details = await getChannelById(term);
                    }
                }

                if (details) {
                    channels.push({
                        id: details.id,
                        name: details.snippet.title,
                        thumbnail: details.snippet.thumbnails.high?.url || details.snippet.thumbnails.default?.url,
                        description: details.snippet.description,
                        stats: details.statistics
                    });
                    console.log(`   ✅ Trobat: ${details.snippet.title}`);
                } else {
                    console.log(`   ❌ No s'han trobat dades per ${term}`);
                }
                
                // Petita pausa per no saturar l'API
                await new Promise(r => setTimeout(r, 100));
            }
        }

        const output = {
            lastUpdated: new Date().toISOString(),
            totalChannels: channels.length,
            channels: channels
        };

        const dataDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        
        console.log(`\n🎉 Finalitzat! Canals guardats: ${channels.length}`);

    } catch (error) {
        console.error('Error fatal:', error);
        process.exit(1);
    }
}

main();
