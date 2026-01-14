const fs = require('fs');
const https = require('https');

// Configuració
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNELS_FILE = 'js/channels-ca.json';
const OUTPUT_FILE = 'feed.json';

// Funció fetch millorada
const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({}); // Si falla el JSON, no trenquem tot el procés
                }
            });
        }).on('error', (e) => resolve({})); // Si falla la xarxa, continuem
    });
};

async function main() {
    try {
        const channelsRaw = fs.readFileSync(CHANNELS_FILE, 'utf8');
        const channels = JSON.parse(channelsRaw);
        
        console.log(`Iniciant càrrega paral·lela per a ${channels.length} canals...`);
        const startTime = Date.now();

        // TRUC PROFESSIONAL: Creem totes les peticions a la vegada (Array de Promeses)
        const requests = channels.map(channel => {
            const uploadPlaylistId = channel.id.replace('UC', 'UU');
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=5&key=${API_KEY}`;
            
            // Retornem la promesa de la petició + dades del canal per no perdre l'origen
            return fetchJson(url).then(data => ({
                data: data,
                channelId: channel.id
            }));
        });

        // Esperem que TOTES acabin (això és molt ràpid)
        const results = await Promise.all(requests);

        let allVideos = [];

        // Processem els resultats
        results.forEach(result => {
            if (result.data && result.data.items) {
                const videos = result.data.items.map(item => ({
                    id: item.snippet.resourceId.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                    channelTitle: item.snippet.channelTitle,
                    publishedAt: item.snippet.publishedAt,
                    channelId: result.channelId
                }));
                allVideos = allVideos.concat(videos);
            }
        });

        // Ordenem per data
        allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        // Guardem només els 100 últims vídeos (per no fer el fitxer gegant)
        const finalData = JSON.stringify(allVideos.slice(0, 100), null, 2);
        fs.writeFileSync(OUTPUT_FILE, finalData);
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Fet! Processat en ${duration} segons.`);

    } catch (error) {
        console.error('Error fatal:', error);
        process.exit(1);
    }
}

main();
