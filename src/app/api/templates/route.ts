import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'templates.json')
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const templates = JSON.parse(fileContents)

        return NextResponse.json(templates)
    } catch (error) {
        console.error('Failed to load templates:', error)
        return NextResponse.json(
            { error: 'Failed to load templates' },
            { status: 500 }
        )
    }
}
