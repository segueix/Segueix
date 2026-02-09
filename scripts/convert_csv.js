// scripts/convert_csv.js
const https = require('https');

// CONFIGURACIÓ
const API_KEY = process.env.YOUTUBE_API_KEY; // O posa la teva clau aquí temporalment
// Posa aquí la llista dels teus canals (o la URL del CSV si prefereixes descarregar-lo)
// Format: "Nom del canal (@Handle)"
const HANDLES_TO_CONVERT = [ 
  "@institutnovahistoria3353",
  "@CFEMcomfuncionaelmon",
  "@ELBUIRACDEMEMÒRIES",
  "@3CatCultura",
  "@cup_comarques_gironines",
  "@forumdedebats1906",
  "@laclaudelanostrahistoria7400",
  "@museuterra",
  "@godaigarcia",
  "@NexeNacional",
  "@Isab3lyP3dro",
  "@SmileandLearn-Català",
  "@UepComanamIB3",
  "@elsullsdeclio",
  "@pitunolla",
  "@elfoment"
];

const fetchYouTubeData = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error API: ${response.status}`);
    return await response.json();
};

async function main() {
    console.log("ID,NOM_ORIGINAL (Per referència)");
    console.log("--------------------------------");

    for (const handle of HANDLES_TO_CONVERT) {
        if (!handle.startsWith('@')) {
            console.log(`${handle}, (Ja és un ID o no té @)`);
            continue;
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(handle)}&key=${API_KEY}`;
            const data = await fetchYouTubeData(url);

            if (data.items && data.items.length > 0) {
                const id = data.items[0].id;
                const title = data.items[0].snippet.title;
                // Aquest és el format que necessites pel teu CSV:
                console.log(`${id},${title}`); 
            } else {
                console.error(`ERROR: No s'ha trobat ID per: ${handle}`);
            }
        } catch (error) {
            console.error(`ERROR API amb ${handle}: ${error.message}`);
        }
        
        // Petita pausa per no saturar l'API
        await new Promise(r => setTimeout(r, 100));
    }
}

main();
