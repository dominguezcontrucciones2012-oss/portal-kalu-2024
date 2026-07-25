import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);

async function test() {
  console.log("Attempting anonymous login on project:", config.projectId);
  try {
    const cred = await signInAnonymously(auth);
    console.log("SUCCESS! Anonymous user UID:", cred.user.uid);
  } catch (e: any) {
    console.error("ANONYMOUS LOGIN FAILED:", e.code, e.message);
  }
  process.exit(0);
}

test();
