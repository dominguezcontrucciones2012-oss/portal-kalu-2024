import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);

async function test() {
  const email = 'test_user_antigravity@kalu.com';
  const pass = '123456';
  console.log("Attempting email registration on project:", config.projectId);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    console.log("SUCCESS! Created user UID:", cred.user.uid);
    // Cleanup
    await deleteUser(cred.user);
    console.log("Deleted test user successfully.");
  } catch (e: any) {
    console.error("EMAIL AUTH TEST FAILED:", e.code, e.message);
  }
  process.exit(0);
}

test();
