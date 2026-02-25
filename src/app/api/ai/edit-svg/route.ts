import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { generateSvgTemplatePrompt } from './prompt';

// Initialize the Gemini API client
// Note: It's best practice to initialize this outside the request handler
// if you only need the key from the environment.
const apiKey = process.env.GEMINI_API_KEY;

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
        const { currentSvgData, prompt, type = 'full' } = body;

        if (!prompt) {
            return NextResponse.json(
                { error: 'prompt is required' },
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

        const systemPrompt = generateSvgTemplatePrompt(prompt, type, currentSvgData, availableFonts);

        const result = await model.generateContent(systemPrompt);
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

        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonCode);
        } catch (e) {
            console.error('Failed to parse AI JSON block:', jsonCode);
            return NextResponse.json(
                { error: 'AI returned invalid JSON format inside the block.' },
                { status: 500 }
            );
        }

        console.log('Generated Template successfully.');
        return NextResponse.json({ result: { svg: svgCode, json: parsedJson } });

    } catch (error: any) {
        console.error('Error generating SVG with Gemini:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate SVG' },
            { status: 500 }
        );
    }
}
