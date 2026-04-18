import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const match = env.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : process.env.GEMINI_API_KEY;

async function listModels() {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.list();
  
  for await (const model of response) {
    console.log(model.name);
  }
}

listModels().catch(console.error);
