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

function queryFirestore(project, collection) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}?pageSize=100`;
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

async function run() {
  try {
    const res = await queryFirestore('kalu-queso-sanjuam', 'cierres');
    console.log("TOTAL CIERRES REPARTIDOR:", res.documents ? res.documents.length : 0);
    if (res.documents) {
      res.documents.forEach(doc => {
        console.log(`Document: ${doc.name.split('/').pop()}`);
        console.log("Fields:", JSON.stringify(doc.fields, null, 2));
      });
    }
  } catch (e) {
    console.log("Failed:", e.message);
  }
}

run();
