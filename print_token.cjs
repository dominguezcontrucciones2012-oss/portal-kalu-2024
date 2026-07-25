const fs = require('fs');
const path = require('path');
const os = require('os');

const home = os.homedir();
const paths = [
  path.join(home, '.config', 'configstore', 'firebase-tools.json'),
  path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json')
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log("JSON KEYS:", Object.keys(data));
      if (data.tokens) {
        console.log("TOKENS KEYS:", Object.keys(data.tokens));
        const token = data.tokens.refresh_token;
        if (token) {
          console.log("REFRESH TOKEN LENGTH:", token.length);
        }
        const user = data.tokens.user;
        if (user) {
          console.log("USER KEYS:", Object.keys(user));
        }
      }
    } catch (e) {
      console.error("Error reading config:", e);
    }
  }
}
