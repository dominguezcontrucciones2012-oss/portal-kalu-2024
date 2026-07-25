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
  const projects = ['kalu-queso-sanjuam', 'kalu-folden'];
  for (const proj of projects) {
    console.log(`\n=================== PROJECT: ${proj} ===================`);
    try {
      const clients = await queryFirestore(proj, 'clients');
      const count = clients.documents ? clients.documents.length : 0;
      console.log(`TOTAL CLIENTS: ${count}`);
      if (clients.documents) {
        clients.documents.forEach(doc => {
          const fields = doc.fields;
          const nombre = fields.nombre ? fields.nombre.stringValue : 'N/A';
          const cedula = fields.cedula ? fields.cedula.stringValue : 'N/A';
          const telefono = fields.telefono ? fields.telefono.stringValue : 'N/A';
          console.log(`- ${nombre} | Cédula: ${cedula} | Teléfono: ${telefono}`);
        });
      }
    } catch (e) {
      console.log(`Clients query failed for ${proj}:`, e.message);
    }

    try {
      const closures = await queryFirestore(proj, 'cierres_caja');
      const count = closures.documents ? closures.documents.length : 0;
      console.log(`TOTAL CLOSURES: ${count}`);
      if (closures.documents) {
        closures.documents.forEach(doc => {
          const fields = doc.fields;
          const fecha = fields.fecha ? fields.fecha.stringValue : 'N/A';
          const total = fields.total_usd ? (fields.total_usd.doubleValue || fields.total_usd.integerValue || 0) : 0;
          console.log(`- Fecha: ${fecha} | Total USD: ${total}`);
        });
      }
    } catch (e) {
      console.log(`Closures query failed for ${proj}:`, e.message);
    }
  }
}

run();
