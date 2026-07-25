const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const home = os.homedir();
const configPath = path.join(home, '.config', 'configstore', 'firebase-tools.json');
let token;

if (fs.existsSync(configPath)) {
  const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  token = data.tokens.access_token;
}

if (!token) {
  console.error("Token not found");
  process.exit(1);
}

function queryFirestore(project, dbId, collection) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/${dbId}/documents/${collection}?pageSize=100`;
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

const dbIds = [
  'ai-studio-3c2fbe40-9855-4dc7-9503-eb81553a0d39',
  'ai-studio-490e1a3c-049f-4114-8d21-e37e2a6d0c04',
  'ai-studio-8e115ebf-f608-40c5-8a7f-5c347ac6f2d9',
  'ai-studio-e0debfb2-c256-4adc-8ab1-821a7adfaccd'
];

async function run() {
  for (const dbId of dbIds) {
    console.log(`\n=================== DATABASE: ${dbId} ===================`);
    try {
      const clients = await queryFirestore('kalu-folden', dbId, 'clients');
      const count = clients.documents ? clients.documents.length : 0;
      console.log(`TOTAL CLIENTS: ${count}`);
      if (clients.documents) {
        clients.documents.forEach(doc => {
          const fields = doc.fields;
          const nombre = fields.nombre ? fields.nombre.stringValue : 'N/A';
          console.log(` - Client: ${nombre}`);
        });
      }
    } catch (e) {
      console.log(`Clients query failed:`, e.message);
    }

    try {
      const closures = await queryFirestore('kalu-folden', dbId, 'cierres_caja');
      const count = closures.documents ? closures.documents.length : 0;
      console.log(`TOTAL CLOSURES: ${count}`);
    } catch (e) {
      console.log(`Closures query failed:`, e.message);
    }
  }
}

run();
