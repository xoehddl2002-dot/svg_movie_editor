import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFileSync } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

// Resolve ffmpeg binary path
let ffmpegBin = ffmpegPath || ''
if (!ffmpegBin || !fs.existsSync(ffmpegBin)) {
    const fallbacks = [
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(process.cwd(), '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    ]
    for (const fb of fallbacks) {
        if (fs.existsSync(fb)) {
            ffmpegBin = fb
            break
        }
    }
}

export const maxDuration = 300

export async function POST(request: Request) {
    const tempDir = path.join(os.tmpdir(), `render-gif-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
        const formData = await request.formData()
        const fps = Number(formData.get('fps') || '10')
        const frameCount = Number(formData.get('frameCount') || '0')

        console.log(`[render-gif] Frames: ${frameCount}, FPS: ${fps}`)

        if (frameCount === 0) {
            return NextResponse.json({ error: 'No frames provided' }, { status: 400 })
        }
        if (!ffmpegBin) {
            return NextResponse.json({ error: 'FFmpeg not found' }, { status: 500 })
        }

        // 1. Save frames to disk
        for (let i = 0; i < frameCount; i++) {
            const frame = formData.get(`frame-${i}`) as string
            if (!frame) continue

            const base64Data = frame.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')
            const framePath = path.join(tempDir, `frame-${i.toString().padStart(5, '0')}.png`)
            fs.writeFileSync(framePath, buffer)
        }

        const inputPattern = path.join(tempDir, 'frame-%05d.png')
        const palettePath = path.join(tempDir, 'palette.png')
        const outputPath = path.join(tempDir, 'output.gif')

        // 2. Generate palette (pass 1)
        const paletteArgs = [
            '-framerate', fps.toString(),
            '-i', inputPattern,
            '-vf', `fps=${fps},palettegen=stats_mode=diff`,
            '-y', palettePath
        ]
        console.log('[render-gif] Palette:', ffmpegBin, paletteArgs.join(' '))
        execFileSync(ffmpegBin, paletteArgs, { timeout: 120000 })

        if (!fs.existsSync(palettePath)) {
            throw new Error('Palette generation failed — file not created')
        }

        // 3. Encode GIF using palette (pass 2)
        const gifArgs = [
            '-framerate', fps.toString(),
            '-i', inputPattern,
            '-i', palettePath,
            '-filter_complex', `fps=${fps}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
            '-loop', '0',
            '-y', outputPath
        ]
        console.log('[render-gif] GIF:', ffmpegBin, gifArgs.join(' '))
        execFileSync(ffmpegBin, gifArgs, { timeout: 120000 })

        // 4. Read result
        if (!fs.existsSync(outputPath)) {
            throw new Error('GIF encoding failed — output file not created')
        }
        const gifBuffer = fs.readFileSync(outputPath)
        console.log(`[render-gif] Output: ${(gifBuffer.length / 1024).toFixed(1)} KB`)

        if (gifBuffer.length === 0) {
            throw new Error('GIF encoding produced empty file')
        }

        // 5. Cleanup (Async)
        setTimeout(() => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (e) { }
        }, 5000)

        return new Response(gifBuffer, {
            headers: {
                'Content-Type': 'image/gif',
                'Content-Disposition': `attachment; filename="render-${Date.now()}.gif"`
            }
        })

    } catch (error: any) {
        console.error('[render-gif] Failed:', error.message)
        if (error.stderr) {
            console.error('[render-gif] stderr:', error.stderr.toString())
        }
        try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch (e) { }
        return NextResponse.json({ error: error.message || 'GIF render failed' }, { status: 500 })
    }
}
