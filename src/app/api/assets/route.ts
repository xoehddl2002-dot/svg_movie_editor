import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'assets.json')
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const assets = JSON.parse(fileContents)

        return NextResponse.json(assets)
    } catch (error) {
        console.error('Failed to load assets:', error)
        return NextResponse.json(
            { error: 'Failed to load assets' },
            { status: 500 }
        )
    }
}
