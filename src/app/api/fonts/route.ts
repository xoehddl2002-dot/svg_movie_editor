import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
    try {
        const fontDir = path.join(process.cwd(), 'public', 'assets', 'font')
        const files = fs.readdirSync(fontDir)

        // Extract unique font names from .woff or .woff2 files
        const fontNames = Array.from(new Set(
            files
                .filter(f => f.endsWith('.woff') || f.endsWith('.woff2'))
                .map(f => f.replace(/\.(woff2?)$/, ''))
        )).sort()

        return NextResponse.json(fontNames)
    } catch (error) {
        console.error('Failed to load fonts:', error)
        return NextResponse.json(
            { error: 'Failed to load fonts' },
            { status: 500 }
        )
    }
}
