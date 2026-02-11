import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

// Set ffmpeg path with same fallback logic as extract-frames
let validFfmpegPath = ffmpegPath
if (!validFfmpegPath || !fs.existsSync(validFfmpegPath)) {
    const fallbacks = [
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(process.cwd(), '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    ]
    for (const fb of fallbacks) {
        if (fs.existsSync(fb)) {
            validFfmpegPath = fb
            break
        }
    }
}
if (validFfmpegPath) ffmpeg.setFfmpegPath(validFfmpegPath)

export const maxDuration = 300 // 5 minutes for long renders

export async function POST(request: Request) {
    const tempDir = path.join(os.tmpdir(), `render-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
        const formData = await request.formData()
        const fps = Number(formData.get('fps') || '30')
        const frameCount = Number(formData.get('frameCount') || '0')

        console.log(`Received request to render video. Expected frames: ${frameCount}, FPS: ${fps}`)

        if (frameCount === 0) {
            return NextResponse.json({ error: 'No frames provided' }, { status: 400 })
        }

        // 1. Save frames to disk
        console.log(`Saving frames to ${tempDir}`)
        for (let i = 0; i < frameCount; i++) {
            const frame = formData.get(`frame-${i}`) as string
            if (!frame) continue

            const base64Data = frame.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')
            const framePath = path.join(tempDir, `frame-${i.toString().padStart(5, '0')}.png`)
            fs.writeFileSync(framePath, buffer)
        }



        const outputPath = path.join(tempDir, 'output.mp4')

        // 2. Run FFmpeg
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(path.join(tempDir, 'frame-%05d.png'))
                .inputFPS(fps)
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-crf 18',
                    '-tune stillimage'
                ])
                .output(outputPath)
                .on('start', (cmd) => console.log('FFmpeg started:', cmd))
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run()
        })

        // 3. Read result
        const videoBuffer = fs.readFileSync(outputPath)

        // 4. Cleanup (Async)
        setTimeout(() => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true })
                console.log('Cleanup successful:', tempDir)
            } catch (e) {
                console.error('Cleanup failed:', e)
            }
        }, 5000)

        return new Response(videoBuffer, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="render-${Date.now()}.mp4"`
            }
        })

    } catch (error: any) {
        console.error('Video render failed:', error)
        // Cleanup on error
        try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch (e) { }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
