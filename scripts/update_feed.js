// Configuració: La teva URL de Google Sheets (Publicat com a CSV)
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv';

const fs = require('fs');
const https = require('https');

// La clau API es llegeix dels Secrets de GitHub per seguretat
const API_KEY = process.env.YOUTUBE_API_KEY;
const OUTPUT_FILE = 'feed.json';

/**
 * Funció per descarregar dades que sap seguir TOTES les redireccions (301, 302, 307, 308)
 */
const fetchData = (url) => {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        https.get(url, options, (res) => {
            // Si el codi és 3xx (redirecció) i hi ha una nova ubicació, la seguim
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Redirecció detectada (${res.statusCode}). Seguint cap a: ${res.headers.location}`);
                return fetchData(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Error de connexió: ${res.statusCode}`));
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (e) => reject(e));
    });
};

/**
 * Converteix el contingut CSV en una llista d'objectes (canals)
 */
function parseCSV(csvText) {
    const cleanText = csvText.replace(/^\uFEFF/, ''); // Elimina BOM si n'hi ha
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) return [];

    let separator = ',';
    const firstLine = lines[0];
    // Detectem si el separador és coma o punt i coma
    if (firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length)) {
        separator = ';';
    }

    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    const idIdx = headers.indexOf('id');
    const nameIdx = headers.indexOf('name');
    const catIdx = headers.indexOf('category');

    if (idIdx === -1) {
        console.error("❌ No s'ha trobat la columna 'ID'. Capçaleres detectades:", headers);
        return [];
    }

    const parseCategories = (value) => {
        if (!value) return [];
        return value.split(/[;,]/).map(c => c.trim()).filter(Boolean);
    };

    return lines.slice(1).map(line => {
        const values = line.split(separator);
        return {
            id: values[idIdx]?.trim(),
            name: values[nameIdx]?.trim(),
            categories: parseCategories(values[catIdx])
        };
    }).filter(c => c.id && c.id !== ''); 
}

/**
 * Converteix durada ISO 8601 a segons
 */
function parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
}

async function main() {
    try {
        console.log("--- Iniciant actualització des de Google Sheets ---");
        
        const csvContent = await fetchData(SHEET_CSV_URL);
        const channels = parseCSV(csvContent);
        
        if (channels.length === 0) {
            console.log("Dades rebudes (primeres 100 lletres):", csvContent.substring(0, 100));
            throw new Error("No s'han trobat canals vàlids. Revisa el format de l'Excel.");
        }

        console.log(`✅ S'han trobat ${channels.length} canals vàlids.`);

        const playlistRequests = channels.map(async (channel) => {
            let uploadPlaylistId = '';
            if (channel.id.startsWith('@')) {
                const hUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(channel.id)}&key=${API_KEY}`;
                const hRes = await fetchData(hUrl);
                const hData = JSON.parse(hRes);
                if (hData.items?.length > 0) uploadPlaylistId = hData.items[0].contentDetails.relatedPlaylists.uploads;
            } else if (channel.id.startsWith('UC')) {
                uploadPlaylistId = channel.id.replace('UC', 'UU');
            }

            if (!uploadPlaylistId) return null;

            const vUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=5&key=${API_KEY}`;
            const vRes = await fetchData(vUrl);
            const vData = JSON.parse(vRes);
            return { items: vData.items || [], channelInfo: channel };
        });

        const results = await Promise.all(playlistRequests);
        let allVideos = [];
        let videoIdsForDetails = [];

        results.forEach(res => {
            if (res?.items) {
                res.items.forEach(item => {
                    const video = {
                        id: item.snippet.resourceId.videoId,
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high?.url,
                        channelId: item.snippet.channelId,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        categories: res.channelInfo.categories 
                    };
                    allVideos.push(video);
                    videoIdsForDetails.push(video.id);
                });
            }
        });

        if (videoIdsForDetails.length > 0) {
            console.log("Filtrant Shorts...");
            const durationMap = {};
            for (let i = 0; i < videoIdsForDetails.length; i += 50) {
                const chunk = videoIdsForDetails.slice(i, i + 50);
                const dUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(',')}&key=${API_KEY}`;
                const dRes = await fetchData(dUrl);
                const dData = JSON.parse(dRes);
                if (dData.items) {
                    dData.items.forEach(v => {
                        durationMap[v.id] = parseDuration(v.contentDetails.duration) <= 60;
                    });
                }
            }
            allVideos = allVideos.map(v => ({ ...v, isShort: durationMap[v.id] || false }));
        }

        allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allVideos.slice(0, 100), null, 2));
        console.log(`🚀 Feed actualitzat correctament amb ${allVideos.length} vídeos.`);

    } catch (error) {
        console.error("❌ Error en el procés:", error.message);
        process.exit(1);
    }
}

main();
