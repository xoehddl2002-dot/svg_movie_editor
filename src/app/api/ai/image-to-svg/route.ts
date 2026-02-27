import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { generateImageToSvgPrompt } from './prompt';

// Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY;

export const maxDuration = 60; // Set max duration for the API route as AI generation can take long

export async function POST(req: Request) {
    if (!apiKey) {
        return NextResponse.json(
            { error: 'GEMINI_API_KEY is not configured in the environment.' },
            { status: 500 }
        );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const body = await req.json();
        const { prompt, base64Image, type } = body;

        if (!base64Image) {
            return NextResponse.json(
                { error: 'base64Image is required for Image-to-SVG' },
                { status: 400 }
            );
        }

        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash"; 

        const model = genAI.getGenerativeModel({ 
            model: modelName
        });

        // Fetch available fonts to constrain the AI
        let availableFonts: string[] = [];
        try {
            const fs = require('fs');
            const path = require('path');
            const fontDir = path.join(process.cwd(), 'public', 'assets', 'font');
            if (fs.existsSync(fontDir)) {
                const files = fs.readdirSync(fontDir);
                availableFonts = Array.from(new Set(
                    files
                        .filter((f: string) => f.endsWith('.woff') || f.endsWith('.woff2'))
                        .map((f: string) => f.replace(/\.(woff2?)$/, ''))
                )) as string[];
            }
        } catch (e) {
            console.warn("Could not read fonts directory for AI prompt generation:", e);
        }

        const systemPrompt = generateImageToSvgPrompt(prompt, type || 'full', availableFonts);

        // Prepare prompt parts including the image
        const promptParts: any[] = [systemPrompt];

        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
        
        let mimeType = "image/png"; 
        const mimeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
        if(mimeMatch) {
            mimeType = mimeMatch[1];
        }

        promptParts.push({
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        });

        const result = await model.generateContent(promptParts);
        const response = await result.response;
        let aiResult = response.text();

        // Extract SVG block
        const svgMatch = aiResult.match(/```svg\s*([\s\S]*?)\s*```/);
        let svgCode = svgMatch ? svgMatch[1] : null;

        // Extract JSON block
        const jsonMatch = aiResult.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonCode = jsonMatch ? jsonMatch[1] : null;

        // Fallback strategy if markdown blocks are missing or misnamed
        if (!svgCode && aiResult.includes('<svg') && aiResult.includes('</svg>')) {
            const svgStart = aiResult.indexOf('<svg');
            const svgEnd = aiResult.lastIndexOf('</svg>') + 6;
            svgCode = aiResult.substring(svgStart, svgEnd);
        }
        if (!jsonCode) {
            const jsonStart = aiResult.indexOf('{');
            const jsonEnd = aiResult.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart > (aiResult.lastIndexOf('</svg>') || 0)) {
                jsonCode = aiResult.substring(jsonStart, jsonEnd + 1);
            }
        }

        if (!svgCode || !jsonCode) {
            console.error('Failed to extract SVG or JSON blocks:', aiResult);
            return NextResponse.json({ error: 'AI output missing SVG or JSON blocks.' }, { status: 500 });
        }

        // Replace the placeholder with the actual base64 image data url
        if (svgCode) {
            svgCode = svgCode.replace(/___BASE64_IMAGE___/g, base64Image);
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonCode);
            
            // Re-map the placeholder in the JSON image-list to the actual base64 URL
            if (parsedJson['image-list'] && parsedJson['image-list']['___BASE64_IMAGE___']) {
                parsedJson['image-list'][base64Image] = parsedJson['image-list']['___BASE64_IMAGE___'];
                delete parsedJson['image-list']['___BASE64_IMAGE___'];
            }
        } catch (e) {
            console.error('Failed to parse AI JSON block:', jsonCode);
            return NextResponse.json(
                { error: 'AI returned invalid JSON format inside the block.' },
                { status: 500 }
            );
        }

        console.log('Generated Template successfully from Image.');
        return NextResponse.json({ result: { svg: svgCode, json: parsedJson } });

    } catch (error: any) {
        console.error('Error generating SVG with Gemini from Image:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate SVG from image' },
            { status: 500 }
        );
    }
}
