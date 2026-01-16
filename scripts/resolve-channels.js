#!/usr/bin/env node

/**
 * Script per resoldre handles de YouTube (@NomCanal) a IDs de canal
 *
 * Ús: node scripts/resolve-channels.js <API_KEY>
 *
 * Aquest script:
 * 1. Descarrega el CSV de Google Sheets
 * 2. Resol cada handle a un ID de canal usant l'API de YouTube
 * 3. Guarda els resultats a data/channels.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// URL del CSV de Google Sheets
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv';

// Obtenir API key dels arguments
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error('Error: Necessites proporcionar una API key de YouTube');
    console.error('Ús: node scripts/resolve-channels.js <API_KEY>');
    process.exit(1);
}

// Funció per fer peticions HTTPS
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Parsejar CSV
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const channels = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (values.length >= 3) {
            const [handle, name, categories] = values;
            channels.push({
                handle: handle.trim(),
                name: name.trim(),
                categories: categories.split(';').map(c => c.trim().toLowerCase())
            });
        }
    }
    return channels;
}

// Parsejar una línia CSV
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

// Resoldre handle a ID de canal
async function resolveHandle(handle, apiKey) {
    const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${cleanHandle}&key=${apiKey}`;

    try {
        const response = await fetchUrl(url);
        const data = JSON.parse(response);

        if (data.items && data.items.length > 0) {
            return {
                id: data.items[0].id,
                snippet: data.items[0].snippet
            };
        }
        return null;
    } catch (error) {
        console.error(`Error resolent ${handle}:`, error.message);
        return null;
    }
}

// Funció principal
async function main() {
    console.log('Descarregant CSV de Google Sheets...');

    try {
        const csvText = await fetchUrl(CSV_URL);
        const channels = parseCSV(csvText);

        console.log(`Trobats ${channels.length} canals al CSV`);
        console.log('Resolent handles a IDs...\n');

        const resolvedChannels = [];
        const errors = [];

        for (const channel of channels) {
            process.stdout.write(`Resolent ${channel.handle}... `);

            const result = await resolveHandle(channel.handle, API_KEY);

            if (result) {
                resolvedChannels.push({
                    id: result.id,
                    handle: channel.handle,
                    name: channel.name,
                    categories: channel.categories,
                    thumbnail: result.snippet?.thumbnails?.default?.url || null
                });
                console.log(`OK (${result.id})`);
            } else {
                errors.push(channel.handle);
                console.log('ERROR');
            }

            // Petit delay per no superar la quota
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Crear directori data si no existeix
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Guardar JSON
        const outputPath = path.join(dataDir, 'channels.json');
        const output = {
            lastUpdated: new Date().toISOString(),
            source: CSV_URL,
            totalChannels: resolvedChannels.length,
            channels: resolvedChannels
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        console.log('\n========================================');
        console.log(`Canals resolts: ${resolvedChannels.length}/${channels.length}`);
        if (errors.length > 0) {
            console.log(`Errors: ${errors.join(', ')}`);
        }
        console.log(`Guardat a: ${outputPath}`);
        console.log('========================================');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
