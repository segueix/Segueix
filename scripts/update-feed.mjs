// Genera data/feed.json a partir del CSV i YouTube Data API
// Dissenyat per córrer a GitHub Actions 4 cops/dia

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv";

// Ajusta segons el que vulguis servir a l’app
const VIDEOS_PER_CHANNEL = Number(process.env.VIDEOS_PER_CHANNEL || 5);

// Concurrència per no fer 200 fetch simultanis
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);

// Fitxer final que consumirà la PWA
const OUT_FILE = path.resolve(__dirname, "../data/feed.json");

// Opcional: map local per no resoldre handles cada vegada
const MAP_FILE = path.resolve(__dirname, "../data/channel_map.json");

// API key: a GitHub Actions vindrà de secrets
const API_KEY = process.env.YOUTUBE_API_KEY || "";
if (!API_KEY) {
  console.error("Falta YOUTUBE_API_KEY (env). Afegeix secret a GitHub i passa'l al workflow.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

async function fetchText(url, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "text/csv,text/plain" } });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (names) => headers.findIndex((h) => names.includes(h));

  const idIdx = idx(["id", "channelid", "channel_id"]);
  const nameIdx = idx(["name", "channel", "title", "nom"]);
  const handleIdx = idx(["handle", "username"]);
  const urlIdx = idx(["url", "channelurl", "link"]);
  const catIdx = idx(["categories", "category", "categoria", "tags"]);

  const seen = new Set();
  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);

    const id = idIdx >= 0 ? (cols[idIdx] || "").trim() : "";
    const name = nameIdx >= 0 ? (cols[nameIdx] || "").trim() : "";
    const handleRaw = handleIdx >= 0 ? (cols[handleIdx] || "").trim() : "";
    const handle = handleRaw ? (handleRaw.startsWith("@") ? handleRaw : "@" + handleRaw) : "";
    const url = urlIdx >= 0 ? (cols[urlIdx] || "").trim() : "";

    const key = (id || handle || url).toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    const categoriesRaw = catIdx >= 0 ? (cols[catIdx] || "").trim() : "";
    const categories = categoriesRaw
      ? categoriesRaw.split(/[;,|]/).map((s) => s.trim()).filter(Boolean)
      : [];

    out.push({ id, name, handle, url, categories });
  }

  return out;
}

function readJsonIfExists(p, fallback) {
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch {}
  return fallback;
}

function writeJsonPretty(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function getUploadsPlaylistId(channelId) {
  // UCxxxx -> UUxxxx
  if (channelId && channelId.startsWith("UC")) return "UU" + channelId.slice(2);
  return "";
}

async function resolveChannelIdFromHandle(handle) {
  // handle pot venir amb @
  const clean = handle.startsWith("@") ? handle.slice(1) : handle;
  const url =
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(clean)}&key=${API_KEY}`;
  const data = await fetchJson(url);
  const id = data?.items?.[0]?.id || "";
  return id;
}

async function getPlaylistVideos(playlistId, maxResults) {
  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails` +
    `&playlistId=${encodeURIComponent(playlistId)}` +
    `&maxResults=${maxResults}` +
    `&key=${API_KEY}`;

  const data = await fetchJson(url);

  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((item) => {
      const snippet = item?.snippet || {};
      const cd = item?.contentDetails || {};
      const thumbs = snippet?.thumbnails || {};
      const thumb =
        thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || "";

      return {
        id: cd?.videoId || "",
        title: snippet?.title || "",
        description: snippet?.description || "",
        thumbnail: thumb,
        channelId: snippet?.channelId || "",
        channelTitle: snippet?.channelTitle || "",
        publishedAt: cd?.videoPublishedAt || snippet?.publishedAt || ""
      };
    })
    .filter((v) => v.id);
}

async function getVideoDetailsBatch(videoIds) {
  if (!videoIds.length) return [];
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails` +
    `&id=${encodeURIComponent(videoIds.join(","))}` +
    `&key=${API_KEY}`;

  const data = await fetchJson(url);
  const items = Array.isArray(data?.items) ? data.items : [];

  return items
    .map((item) => {
      const sn = item?.snippet || {};
      const st = item?.statistics || {};
      const cd = item?.contentDetails || {};
      const thumbs = sn?.thumbnails || {};
      const thumb =
        thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || "";

      return {
        id: item?.id || "",
        title: sn?.title || "",
        description: sn?.description || "",
        thumbnail: thumb,
        channelId: sn?.channelId || "",
        channelTitle: sn?.channelTitle || "",
        publishedAt: sn?.publishedAt || "",
        duration: cd?.duration || "",
        viewCount: Number(st?.viewCount || 0),
        likeCount: Number(st?.likeCount || 0),
        commentCount: Number(st?.commentCount || 0)
      };
    })
    .filter((v) => v.id);
}

async function promisePool(items, worker, concurrency) {
  const results = [];
  let idx = 0;

  async function runOne() {
    while (idx < items.length) {
      const cur = idx++;
      const r = await worker(items[cur], cur);
      results[cur] = r;
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(runners);
  return results;
}

function sortByPublishedDesc(videos) {
  return videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

async function main() {
  console.log("update-feed: descarregant CSV...");
  const csvText = await fetchText(CSV_URL);
  const channelsRaw = parseCSV(csvText);

  console.log(`update-feed: canals al CSV: ${channelsRaw.length}`);

  const channelMap = readJsonIfExists(MAP_FILE, { handles: {} });
  if (!channelMap.handles) channelMap.handles = {};

  // 1) Assegura channelId per a cada canal
  const channels = [];
  for (const ch of channelsRaw) {
    let id = (ch.id || "").trim();

    if (!id && ch.handle) {
      const key = ch.handle.toLowerCase();
      id = channelMap.handles[key] || "";
      if (!id) {
        console.log(`update-feed: resolent handle ${ch.handle} -> channelId...`);
        try {
          id = await resolveChannelIdFromHandle(ch.handle);
          if (id) channelMap.handles[key] = id;
        } catch (e) {
          console.log(`update-feed: no s'ha pogut resoldre ${ch.handle}: ${e.message}`);
        }
      }
    }

    if (!id || !id.startsWith("UC")) {
      continue;
    }

    channels.push({
      id,
      name: ch.name || "",
      handle: ch.handle || "",
      url: ch.url || "",
      categories: ch.categories || []
    });
  }

  console.log(`update-feed: canals vàlids amb UC...: ${channels.length}`);

  // Desa map actualitzat (si hem resolt handles nous)
  writeJsonPretty(MAP_FILE, channelMap);

  // 2) Baixa vídeos per canal (playlistItems)
  const perChannel = await promisePool(
    channels,
    async (channel) => {
      const playlistId = getUploadsPlaylistId(channel.id);
      if (!playlistId) return { channel, videos: [] };

      try {
        const vids = await getPlaylistVideos(playlistId, VIDEOS_PER_CHANNEL);
        return { channel, videos: vids };
      } catch (e) {
        console.log(`update-feed: error playlistItems canal ${channel.id}: ${e.message}`);
        return { channel, videos: [] };
      }
    },
    CONCURRENCY
  );

  // 3) Aplega ids i demana detalls en lots de 50 (videos.list)
  const flat = perChannel.flatMap((x) => x.videos);
  const uniqueIds = Array.from(new Set(flat.map((v) => v.id))).filter(Boolean);

  console.log(`update-feed: vídeos candidats: ${flat.length}, ids únics: ${uniqueIds.length}`);

  const detailed = [];
  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batch = uniqueIds.slice(i, i + 50);
    try {
      const batchDetails = await getVideoDetailsBatch(batch);
      detailed.push(...batchDetails);
    } catch (e) {
      console.log(`update-feed: error videos.list batch ${i / 50}: ${e.message}`);
    }
  }

  // 4) Ordena i prepara output
  sortByPublishedDesc(detailed);

  const out = {
    generatedAt: new Date().toISOString(),
    channelsCount: channels.length,
    videosCount: detailed.length,
    videos: detailed,
    channels: channels
  };

  writeJsonPretty(OUT_FILE, out);

  console.log(`update-feed: escrit ${OUT_FILE}`);
  console.log("update-feed: done");
}

main().catch((e) => {
  console.error("update-feed: error fatal:", e);
  process.exit(1);
});
