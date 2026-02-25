import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), 'public', 'data', 'ai_history');

async function ensureHistoryDir() {
    try {
        await fs.mkdir(HISTORY_DIR, { recursive: true });
    } catch (e: any) {
        if (e.code !== 'EEXIST') throw e;
    }
}

export async function GET() {
    try {
        await ensureHistoryDir();
        const files = await fs.readdir(HISTORY_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        const historyItems = [];
        
        for (const file of jsonFiles) {
            try {
                const filePath = path.join(HISTORY_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                historyItems.push(JSON.parse(content));
            } catch (err) {
                console.error(`Failed to read or parse history file ${file}:`, err);
            }
        }
        
        // Sort by date descending (newest first)
        historyItems.sort((a, b) => b.date - a.date);
        
        return NextResponse.json({ history: historyItems });
    } catch (error) {
        console.error('Error fetching AI history:', error);
        return NextResponse.json({ error: 'Failed to fetch AI history' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensureHistoryDir();
        const body = await req.json();
        
        if (!body.prompt || !body.svg || !body.json) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const timestamp = Date.now();
        const id = `ai-hist-${timestamp}`;
        
        const historyItem = {
            id,
            prompt: body.prompt,
            type: body.type || 'full',
            svg: body.svg,
            json: body.json,
            date: timestamp
        };
        
        const filePath = path.join(HISTORY_DIR, `${timestamp}.json`);
        await fs.writeFile(filePath, JSON.stringify(historyItem, null, 2), 'utf-8');
        
        return NextResponse.json({ item: historyItem });
    } catch (error) {
        console.error('Error saving AI history:', error);
        return NextResponse.json({ error: 'Failed to save AI history' }, { status: 500 });
    }
}
