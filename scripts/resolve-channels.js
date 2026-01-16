const fs = require('fs');
const path = require('path');
const https = require('https');

// URL del CSV de Google Sheets
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv';

// On volem guardar el fitxer final?
const OUTPUT_FILE = path.join(__dirname, '../data/channels.json');

// Clau API (passada com a argument des de GitHub Actions)
const API_KEY = process.argv[2];

// Funció per descarregar gestionant REDIRECCIONS (Vital per Google Sheets)
async function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            // Si Google ens redirigeix (301, 302, 307), seguim la nova URL
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

// Obtenir detalls del canal via API de YouTube
async function getChannelDetails(channelId) {
    if (!API_KEY) return null;
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.items ? json.items[0] : null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    console.log('--- INICIANT ACTUALITZACIÓ DE CANALS ---');
    console.log(`Script: resolve-channels.js`);
    console.log(`Destí: ${OUTPUT_FILE}`);
    
    try {
        // 1. Descarregar CSV
        console.log('Descarregant CSV de Google Sheets...');
        const csvData = await fetchCSV(SHEET_CSV_URL);
        
        // Separem per línies i ignorem la primera (capçalera)
        const lines = csvData.split('\n').slice(1);
        
        const channels = [];
        
        // 2. Processar línies
        for (const line of lines) {
            // Busquem qualsevol cosa que sembli un ID de YouTube (comença per UC i té 24 caràcters)
            // Això és més robust que separar per comes si el CSV està brut
            const match = line.match(/UC[\w-]{21,22}/);
            
            if (match) {
                const channelId = match[0];
                console.log(`Processant ID: ${channelId}`);
                
                if (API_KEY) {
                    const details = await getChannelDetails(channelId);
                    if (details) {
                        channels.push({
                            id: channelId,
                            name: details.snippet.title,
                            thumbnail: details.snippet.thumbnails.high?.url || details.snippet.thumbnails.default?.url,
                            description: details.snippet.description,
                            stats: details.statistics,
                            customUrl: details.snippet.customUrl
                        });
                        console.log(`   > OK: ${details.snippet.title}`);
                    } else {
                        console.log(`   > Error API: No s'han trobat dades`);
                    }
                } else {
                    // Si no hi ha API key (test local), guardem l'ID pelat
                    channels.push({ id: channelId, name: 'Canal (Sense API)' });
                }
            }
        }

        // 3. Guardar JSON
        const output = {
            lastUpdated: new Date().toISOString(),
            totalChannels: channels.length,
            channels: channels
        };

        // Assegurar que el directori data existeix
        const dataDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dataDir)){
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        console.log(`✅ EXIT: S'ha guardat data/channels.json amb ${channels.length} canals.`);

    } catch (error) {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    }
}

main();
