// Configuració: La teva URL de Google Sheets (Publicat com a CSV)
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?output=csv';

const fs = require('fs');
const https = require('https');

// La clau API es llegeix dels Secrets de GitHub per seguretat
const API_KEY = process.env.YOUTUBE_API_KEY;
const OUTPUT_FILE = 'feed.json';

/**
 * Funció auxiliar per descarregar dades d'una URL
 */
const fetchData = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (e) => reject(e));
    });
};

/**
 * Converteix el contingut CSV en una llista d'objectes (canals)
 * Millorat per detectar separadors (coma o punt i coma)
 */
function parseCSV(csvText) {
    // Eliminem caràcters invisibles (BOM) que poden aparèixer al principi
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) return [];

    // Detectem si el separador és una coma (,) o un punt i coma (;)
    let separator = ',';
    const firstLine = lines[0];
    if (firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length)) {
        separator = ';';
    }

    // Detectem les capçaleres de la primera fila
    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    const idIdx = headers.indexOf('id');
    const nameIdx = headers.indexOf('name');
    const catIdx = headers.indexOf('category');

    if (idIdx === -1) {
        console.error("❌ No s'ha trobat la columna 'ID'. Capçaleres detectades:", headers);
        return [];
    }

    return lines.slice(1).map(line => {
        const values = line.split(separator);
        return {
            id: values[idIdx]?.trim(),
            name: values[nameIdx]?.trim(),
            // Separem les categories per ";" i creem una llista neta
            categories: values[catIdx] ? values[catIdx].split(';').map(c => c.trim()) : []
        };
    }).filter(c => c.id); // Només canals que tinguin contingut a la columna ID
}

/**
 * Converteix la durada ISO 8601 de YouTube (ex: PT1M30S) a segons
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
        
        // 1. Descarreguem la llista de canals de l'Excel
        const csvContent = await fetchData(SHEET_CSV_URL);
        const channels = parseCSV(csvContent);
        console.log(`S'han trobat ${channels.length} canals vàlids al full de càlcul.`);

        if (channels.length === 0) {
            console.log("Dades rebudes del CSV per depuració:", csvContent.substring(0, 100));
            throw new Error("No s'han trobat canals per processar. Revisa les capçaleres de l'Excel.");
        }

        // 2. Obtenim els vídeos recents de cada canal
        const playlistRequests = channels.map(async (channel) => {
            let uploadPlaylistId = '';

            if (channel.id.startsWith('@')) {
                const hUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(channel.id)}&key=${API_KEY}`;
                const hRes = await fetchData(hUrl);
                const hData = JSON.parse(hRes);
                if (hData.items?.length > 0) {
                    uploadPlaylistId = hData.items[0].contentDetails.relatedPlaylists.uploads;
                }
            } else if (channel.id.startsWith('UC')) {
                uploadPlaylistId = channel.id.replace('UC', 'UU');
            }

            if (!uploadPlaylistId) {
                console.warn(`⚠️ No es pot carregar el canal: ${channel.id}`);
                return null;
            }

            const vUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=5&key=${API_KEY}`;
            const vRes = await fetchData(vUrl);
            const vData = JSON.parse(vRes);
            
            return {
                items: vData.items || [],
                channelInfo: channel
            };
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
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        categories: res.channelInfo.categories 
                    };
                    allVideos.push(video);
                    videoIdsForDetails.push(video.id);
                });
            }
        });

        // 3. Filtre de Shorts
        if (videoIdsForDetails.length > 0) {
            console.log("Filtrant Shorts i vídeos curts...");
            const durationMap = {};
            for (let i = 0; i < videoIdsForDetails.length; i += 50) {
                const chunk = videoIdsForDetails.slice(i, i + 50);
                const dUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(',')}&key=${API_KEY}`;
                const dRes = await fetchData(dUrl);
                const dData = JSON.parse(dRes);
                if (dData.items) {
                    dData.items.forEach(v => {
                        const seconds = parseDuration(v.contentDetails.duration);
                        durationMap[v.id] = (seconds <= 60);
                    });
                }
            }
            allVideos = allVideos.map(v => ({ ...v, isShort: durationMap[v.id] || false }));
        }

        allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allVideos.slice(0, 100), null, 2));
        console.log(`✅ Fet! El fitxer ${OUTPUT_FILE} s'ha actualitzat correctament.`);

    } catch (error) {
        console.error("❌ Error en el procés:", error);
        process.exit(1);
    }
}

main();
