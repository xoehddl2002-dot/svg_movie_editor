import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('No API key');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Create a simple SVG
    const svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>`;
    const base64Data = Buffer.from(svg).toString('base64');
    
    try {
        console.log("Testing as image/svg+xml...");
        const result = await model.generateContent([
            "What is this image?",
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/svg+xml"
                }
            }
        ]);
        console.log("Response:", result.response.text());
    } catch (e: any) {
        console.error("Error with image/svg+xml:", e.message);
    }
}

test();
