const fs = require('fs');
const https = require('https');

// Configuració
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNELS_FILE = 'js/channels-ca.json';
const OUTPUT_FILE = 'feed.json';

// Funció fetch bàsica
const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({});
                }
            });
        }).on('error', (e) => resolve({}));
    });
};

// Funció per convertir durada (PT1M30S) a segons
function parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
}

async function main() {
    try {
        const channelsRaw = fs.readFileSync(CHANNELS_FILE, 'utf8');
        // AFEGIM .channels PER ACCEDIR A LA LLISTA CORRECTAMENT
        const channels = JSON.parse(channelsRaw).channels;
        
        console.log(`Iniciant càrrega intel·ligent per a ${channels.length} canals...`);
        const startTime = Date.now();

        // PAS 1: OBTENIR LA ID DE LA LLISTA D'UPLOADS (Sigui per ID o per Handle)
        const playlistRequests = channels.map(async (channel) => {
            let uploadPlaylistId = '';

            // CAS A: És un Handle (@Nom)
            if (channel.id.startsWith('@')) {
                const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(channel.id)}&key=${API_KEY}`;
                const handleData = await fetchJson(handleUrl);
                
                if (handleData.items && handleData.items.length > 0) {
                    uploadPlaylistId = handleData.items[0].contentDetails.relatedPlaylists.uploads;
                } else {
                    console.warn(`⚠️ No s'ha trobat el canal: ${channel.id}`);
                    return null;
                }
            } 
            // CAS B: Ja és una ID antiga (UC...)
            else if (channel.id.startsWith('UC')) {
                uploadPlaylistId = channel.id.replace('UC', 'UU');
            }
            // CAS C: Alguna cosa rara
            else {
                console.warn(`⚠️ ID desconeguda: ${channel.id}`);
                return null;
            }

            // Ara que tenim la Playlist ID, demanem els vídeos
            const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=5&key=${API_KEY}`;
            const videosData = await fetchJson(videosUrl);

            return {
                data: videosData,
                channelId: channel.id // Guardem l'original (encara que sigui @nom)
            };
        });

        // Esperem totes les peticions
        const results = await Promise.all(playlistRequests);
        
        let allVideos = [];
        let videoIdsToCheck = [];

        // Pre-processament per recollir IDs i mirar durada
        results.forEach(result => {
            if (result && result.data && result.data.items) {
                result.data.items.forEach(item => {
                    allVideos.push({
                        id: item.snippet.resourceId.videoId,
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        channelId: result.channelId
                    });
                    videoIdsToCheck.push(item.snippet.resourceId.videoId);
                });
            }
        });

        // PAS 2: FILTRAR SHORTS (Mirar durada)
        if (videoIdsToCheck.length > 0) {
            // YouTube només deixa demanar 50 IDs de cop, fem paquets
            const chunkSize = 50;
            let videoDetails = [];
            
            for (let i = 0; i < videoIdsToCheck.length; i += chunkSize) {
                const chunk = videoIdsToCheck.slice(i, i + chunkSize);
                const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(',')}&key=${API_KEY}`;
                const detailsData = await fetchJson(detailsUrl);
                if (detailsData.items) {
                    videoDetails = videoDetails.concat(detailsData.items);
                }
            }

            // Creem un diccionari { "VIDEO_ID": "SHORT/NORMAL" }
            const durationMap = {};
            videoDetails.forEach(v => {
                const seconds = parseDuration(v.contentDetails.duration);
                durationMap[v.id] = (seconds <= 60) ? true : false; // true = és Short
            });

            // Afegim la info al llistat final
            allVideos = allVideos.map(video => ({
                ...video,
                isShort: durationMap[video.id] || false
            }));
        }

        // Ordenem per data
        allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        // Guardem
        const finalData = JSON.stringify(allVideos.slice(0, 100), null, 2);
        fs.writeFileSync(OUTPUT_FILE, finalData);
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Fet! Processat en ${duration} segons. Canals amb @nom acceptats.`);

    } catch (error) {
        console.error('Error fatal:', error);
        process.exit(1);
    }
}

main();
