import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.VITE_GEMINI_API_KEY}`);
  const data = await res.json();
  console.log(data.models.map(m => m.name).join("\n"));
}
test();
