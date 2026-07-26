import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? "FOUND" : "NOT FOUND");

const ai = new GoogleGenAI({ apiKey });

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: "Hola, ¿estás ahí? Responde con una sola palabra."
    });
    console.log("AI Response:", response.text);
  } catch (error) {
    console.error("AI Error:", error);
  }
}

test();
