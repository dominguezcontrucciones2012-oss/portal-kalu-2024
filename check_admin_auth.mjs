import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

async function check() {
  const emails = [
    'dominguezcontrucciones2012@gmail.com',
    'dominguezconstrucciones2012@gmail.com',
    'domingueconstrucciones2012@gmail.com',
    'juancarlos@gmail.com',
    'juan carlos dominguez saabedra@gmail.com'
  ];
  for (const email of emails) {
    try {
      const user = await getAuth().getUserByEmail(email);
      console.log(`Found ${email}: UID=${user.uid}`);
    } catch(e) {
      console.log(`Not found ${email}: ${e.message}`);
    }
  }
  process.exit(0);
}
check();
