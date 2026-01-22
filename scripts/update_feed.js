// Configuració: La teva URL de Google Sheets (Publicat com a CSV)
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv';

const fs = require('fs');
const https = require('https');
const path = require('path');

// La clau API es llegeix dels Secrets de GitHub per seguretat
const API_KEY = process.env.YOUTUBE_API_KEY;
const OUTPUT_FEED_JSON = path.join(process.cwd(), 'data', 'feed.json');
const OUTPUT_FEED_JS = 'feed_updates.js';
const VIDEOS_PER_CHANNEL = Number.parseInt(process.env.VIDEOS_PER_CHANNEL ?? '5', 10);
const FETCH_PER_CHANNEL = VIDEOS_PER_CHANNEL * 3;

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

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} ${data.slice(0, 800)}`));
                }
                resolve(data);
            });
        }).on('error', (e) => reject(e));
    });
};

const fetchYouTubeData = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`YouTube API HTTP ${response.status} Body: ${body.slice(0, 1200)}`);
    }

    const data = await response.json();
    return data;
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
function isoDurationToSeconds(iso) {
    if (!iso) return 0;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function truncateText(text, maxLength = 300) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trim()}...`;
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
                const hData = await fetchYouTubeData(hUrl);
                if (hData.items?.length > 0) uploadPlaylistId = hData.items[0].contentDetails.relatedPlaylists.uploads;
            } else if (channel.id.startsWith('UC')) {
                uploadPlaylistId = channel.id.replace('UC', 'UU');
            }

            if (!uploadPlaylistId) return null;

            const maxResults = Math.min(FETCH_PER_CHANNEL, 50);
            const vUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=${maxResults}&key=${API_KEY}`;
            const vData = await fetchYouTubeData(vUrl);
            return { items: vData.items || [], channelInfo: channel };
        });

        const results = await Promise.all(playlistRequests);
        let baseVideos = [];
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
                        categories: res.channelInfo.categories,
                        sourceChannelId: res.channelInfo.id,
                        duration: '',
                        durationSeconds: 0,
                        isShort: false,
                        viewCount: 0,
                        likeCount: 0,
                        commentCount: 0
                    };
                    baseVideos.push(video);
                    videoIdsForDetails.push(video.id);
                });
            }
        });

        let detailedVideos = [];
        if (videoIdsForDetails.length > 0) {
            console.log("Carregant duracions...");
            for (let i = 0; i < videoIdsForDetails.length; i += 50) {
                const chunk = videoIdsForDetails.slice(i, i + 50);
                const dUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${API_KEY}`;
                const dData = await fetchYouTubeData(dUrl);
                if (dData.items) {
                    dData.items.forEach(v => {
                        const duration = v.contentDetails?.duration || '';
                        const durationSeconds = isoDurationToSeconds(duration);
                        detailedVideos.push({
                            id: v.id,
                            title: v.snippet?.title || '',
                            thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.high?.url || '',
                            channelId: v.snippet?.channelId || '',
                            channelTitle: v.snippet?.channelTitle || '',
                            publishedAt: v.snippet?.publishedAt || '',
                            duration,
                            durationSeconds,
                            isShort: durationSeconds > 0 && durationSeconds <= 120,
                            viewCount: Number(v.statistics?.viewCount || 0),
                            likeCount: Number(v.statistics?.likeCount || 0),
                            commentCount: Number(v.statistics?.commentCount || 0)
                        });
                    });
                }
            }
        }

        const detailsById = new Map(detailedVideos.map(video => [video.id, video]));
        const finalVideos = baseVideos.map(video => {
            const details = detailsById.get(video.id);
            if (!details) {
                return video;
            }
            return {
                ...video,
                ...details,
                categories: video.categories,
                sourceChannelId: video.sourceChannelId
            };
        });

        const videosByChannel = new Map();
        finalVideos.forEach((video) => {
            const key = video.sourceChannelId || video.channelId;
            if (!videosByChannel.has(key)) {
                videosByChannel.set(key, []);
            }
            videosByChannel.get(key).push(video);
        });

        const feedVideos = [];
        channels.forEach((channel) => {
            const channelVideos = videosByChannel.get(channel.id) || [];
            console.log(`📺 Canal ${channel.name || channel.id}: ${channelVideos.length} vídeos abans de filtrar.`);
            const selected = channelVideos.slice(0, VIDEOS_PER_CHANNEL);
            console.log(`✅ Canal ${channel.name || channel.id}: ${selected.length} vídeos seleccionats.`);
            feedVideos.push(...selected);
        });

        feedVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        const feedPayload = feedVideos.slice(0, 100);
        const videosWithViews = feedPayload.filter(video => (video.viewCount || 0) > 0);
        console.log(`📊 Vídeos amb viewCount > 0: ${videosWithViews.length}/${feedPayload.length}`);
        videosWithViews.slice(0, 3).forEach(video => {
            console.log(`📈 ${video.id}: ${video.viewCount}`);
        });
        const channelIds = Array.from(new Set(feedPayload.map(video => video.channelId).filter(Boolean)));
        const channelMetadata = {};
        if (channelIds.length > 0) {
            console.log(`🔎 Carregant metadades per ${channelIds.length} canals...`);
            const channelChunks = chunkArray(channelIds, 50);
            for (const chunk of channelChunks) {
                const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${chunk.join(',')}&key=${API_KEY}`;
                const cData = await fetchYouTubeData(cUrl);
                if (Array.isArray(cData.items)) {
                    cData.items.forEach(item => {
                        const thumbnail = item.snippet?.thumbnails?.high?.url
                            || item.snippet?.thumbnails?.medium?.url
                            || '';
                        const customUrl = item.snippet?.customUrl || '';
                        const handle = customUrl
                            ? (customUrl.startsWith('@') ? customUrl : `@${customUrl}`)
                            : '';
                        channelMetadata[item.id] = {
                            name: item.snippet?.title || '',
                            avatar: thumbnail,
                            description: truncateText(item.snippet?.description || ''),
                            handle
                        };
                    });
                }
            }
        }

        const categoriesBySourceId = new Map(
            channels.map(channel => [channel.id, channel.categories || []])
        );
        const categoriesByChannelId = new Map();
        finalVideos.forEach(video => {
            if (!video.channelId) return;
            const sourceCategories = categoriesBySourceId.get(video.sourceChannelId) || [];
            if (!categoriesByChannelId.has(video.channelId)) {
                categoriesByChannelId.set(video.channelId, new Set());
            }
            const bucket = categoriesByChannelId.get(video.channelId);
            sourceCategories.forEach(category => bucket.add(category));
        });

        Object.keys(channelMetadata).forEach(channelId => {
            const categories = Array.from(categoriesByChannelId.get(channelId) || []);
            if (categories.length > 0) {
                channelMetadata[channelId].categories = categories;
            }
        });

        const dataDir = path.join(process.cwd(), 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const feedOutput = {
            generatedAt: new Date().toISOString(),
            channels: channelMetadata,
            videos: feedPayload
        };
        fs.writeFileSync(OUTPUT_FEED_JSON, JSON.stringify(feedOutput, null, 2));
        fs.writeFileSync(
            OUTPUT_FEED_JS,
            `// Auto-generated by scripts/update_feed.js\nwindow.FEED_UPDATES = ${JSON.stringify(feedPayload, null, 2)};\n`
        );
        console.log("Feed escrit a:", OUTPUT_FEED_JSON);
        console.log("Existeix:", fs.existsSync(OUTPUT_FEED_JSON));
        console.log("Mida:", fs.statSync(OUTPUT_FEED_JSON).size);
        console.log(`🚀 Feed actualitzat correctament amb ${finalVideos.length} vídeos.`);

    } catch (error) {
        console.error("❌ Error en el procés:", error.message);
        process.exit(1);
    }
}

main();
