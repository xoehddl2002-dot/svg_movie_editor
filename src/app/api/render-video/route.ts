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

        const audioTracksStr = formData.get('audioTracks') as string
        const audioTracks = audioTracksStr ? JSON.parse(audioTracksStr) : []
        console.log(`Audio tracks: ${audioTracks.length}`, audioTracks)

        // Pre-validate audio tracks: resolve paths and verify audio streams
        interface ValidatedAudioTrack {
            path: string
            start: number
            duration: number
            mediaStart: number
            volume: number
        }
        const validatedAudioTracks: ValidatedAudioTrack[] = []

        for (const track of audioTracks) {
            let trackPath = track.src
            if (trackPath.startsWith('/')) {
                trackPath = path.join(process.cwd(), 'public', trackPath)
            }

            // Skip blob URLs or HTTP URLs
            if (trackPath.startsWith('blob:') || trackPath.startsWith('http')) {
                console.warn(`Skipping audio track with non-local src: ${trackPath}`)
                continue
            }
            if (!fs.existsSync(trackPath)) {
                console.warn(`Skipping audio track - file not found: ${trackPath}`)
                continue
            }

            // Probe file to verify it has an audio stream
            const hasAudio = await new Promise<boolean>((resolve) => {
                ffmpeg.ffprobe(trackPath, (err: any, metadata: any) => {
                    if (err) {
                        console.warn(`ffprobe failed for ${trackPath}:`, err.message)
                        resolve(false)
                        return
                    }
                    const audioStream = metadata.streams?.some((s: any) => s.codec_type === 'audio')
                    resolve(!!audioStream)
                })
            })

            if (!hasAudio) {
                console.warn(`Skipping audio track - no audio stream found: ${trackPath}`)
                continue
            }

            validatedAudioTracks.push({
                path: trackPath,
                start: Number(track.start) || 0,
                duration: Number(track.duration) || 1,
                mediaStart: Number(track.mediaStart) || 0,
                volume: Number(track.volume) ?? 1,
            })
        }

        console.log(`Validated audio tracks: ${validatedAudioTracks.length}`)

        // 2. Run FFmpeg
        await new Promise<void>((resolve, reject) => {
            const command = ffmpeg()
                .input(path.join(tempDir, 'frame-%05d.png'))
                .inputFPS(fps)

            const complexFilters: string[] = []
            const audioOutputLabels: string[] = []

            validatedAudioTracks.forEach((track, index) => {
                command.input(track.path)

                const inputIdx = index + 1 // 0 is the video frames input
                const label = `a${index}`
                const delayMs = Math.round(track.start * 1000)

                complexFilters.push(`[${inputIdx}:a]atrim=start=${track.mediaStart}:duration=${track.duration},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},volume=${track.volume}[${label}]`)
                audioOutputLabels.push(`[${label}]`)
            })

            if (audioOutputLabels.length > 1) {
                complexFilters.push(`${audioOutputLabels.join('')}amix=inputs=${audioOutputLabels.length}:duration=longest[outa]`)
                command.complexFilter(complexFilters)
                command.outputOptions(['-map 0:v', '-map [outa]'])
            } else if (audioOutputLabels.length === 1) {
                complexFilters[0] = complexFilters[0].replace(/\[a0\]$/, '[outa]')
                command.complexFilter(complexFilters)
                command.outputOptions(['-map 0:v', '-map [outa]'])
            }

            const outputOpts = [
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-crf 18',
                '-tune stillimage',
            ]

            if (audioOutputLabels.length > 0) {
                outputOpts.push('-c:a aac', '-b:a 192k', '-shortest')
            }

            command
                .outputOptions(outputOpts)
                .output(outputPath)
                .on('start', (cmd) => console.log('FFmpeg started:', cmd))
                .on('stderr', (line) => console.log('FFmpeg stderr:', line))
                .on('end', () => resolve())
                .on('error', (err, stdout, stderr) => {
                    console.error('FFmpeg error:', err.message)
                    console.error('FFmpeg stderr output:', stderr)
                    reject(err)
                })
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
