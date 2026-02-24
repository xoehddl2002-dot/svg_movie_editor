import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

// Set ffmpeg path
console.log('FFmpeg Path from ffmpeg-static (raw):', ffmpegPath)

let validFfmpegPath = ffmpegPath

// Fallback logic for Windows or weird paths
if (!validFfmpegPath || !fs.existsSync(validFfmpegPath)) {
    console.warn('ffmpeg-static path not found. Trying fallbacks...')

    // Common fallback locations
    const fallbacks = [
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(process.cwd(), '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), // Monorepo style
        path.join(__dirname, '..', '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), // Heuristic
    ]

    for (const fb of fallbacks) {
        if (fs.existsSync(fb)) {
            console.log('Found ffmpeg at fallback:', fb)
            validFfmpegPath = fb
            break
        }
    }
}

if (validFfmpegPath && fs.existsSync(validFfmpegPath)) {
    ffmpeg.setFfmpegPath(validFfmpegPath)
    console.log('FFmpeg path set to:', validFfmpegPath)
} else {
    console.error('CRITICAL: Could not find ffmpeg executable. Frame extraction will fail.')
    // Don't throw here, let it fail in the handler so we get a 500 response
}

export async function POST(request: Request) {
    const tempDir = path.join(os.tmpdir(), `frames-${uuidv4()}`)

    try {
        const body = await request.json()
        const { videoPath, frameCount = 10, timestamps: requestedTimestamps, size } = body

        if (!videoPath) {
            return NextResponse.json(
                { error: 'Video path is required' },
                { status: 400 }
            )
        }

        // Construct absolute path to the video file
        const publicDir = path.join(process.cwd(), 'public')
        // Remove leading slash if present to join correctly
        const normalizedVideoPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath
        const absoluteVideoPath = path.join(publicDir, normalizedVideoPath)

        if (!fs.existsSync(absoluteVideoPath)) {
            return NextResponse.json(
                { error: 'Video file not found' },
                { status: 404 }
            )
        }

        // Create temp directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        let timestamps: number[] = []

        if (requestedTimestamps && Array.isArray(requestedTimestamps)) {
            timestamps = requestedTimestamps
        } else {
            // Get video duration
            const duration = await new Promise<number>((resolve, reject) => {
                ffmpeg.ffprobe(absoluteVideoPath, (err, metadata) => {
                    if (err) reject(err)
                    else resolve(metadata.format.duration || 0)
                })
            })

            if (!duration) {
                throw new Error('Could not determine video duration')
            }

            // Calculate timestamps
            const interval = duration / frameCount
            timestamps = Array.from({ length: frameCount }, (_, i) => {
                return Math.min(i * interval + (interval / 2), duration - 0.1)
            })
        }

        // Extract frames in batches to avoid ENAMETOOLONG
        // Default to 20 if fps is not provided, otherwise use fps as batch size (1 second worth of frames)
        const fps = body.fps || 20
        const BATCH_SIZE = Math.max(1, Math.min(60, fps)) 

        for (let i = 0; i < timestamps.length; i += BATCH_SIZE) {
            const batch = timestamps.slice(i, i + BATCH_SIZE)
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(timestamps.length / BATCH_SIZE)} (${batch.length} frames)`)

            await new Promise<void>((resolve, reject) => {
                let command = ffmpeg(absoluteVideoPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))

                const screenshotConfig: any = {
                    timestamps: batch,
                    filename: 'frame-%s.jpg',
                    folder: tempDir,
                }

                if (size) {
                    screenshotConfig.size = size
                }

                command.screenshots(screenshotConfig)
            })
        }

        // Read frames and convert to base64
        const files = fs.readdirSync(tempDir).sort((a, b) => {
            // Sort by timestamp in filename if fluent-ffmpeg names them deterministically with %s
            // fluent-ffmpeg replaces %s with the timestamp (e.g. 1.523)
            // We need to parse the float from the filename
            const timeA = parseFloat(a.replace('frame-', '').replace('.jpg', ''))
            const timeB = parseFloat(b.replace('frame-', '').replace('.jpg', ''))
            return timeA - timeB
        })

        const images = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(tempDir, file)
                const buffer = fs.readFileSync(filePath)
                return `data:image/jpeg;base64,${buffer.toString('base64')}`
            })
        )

        return NextResponse.json({ images })

    } catch (error) {
        console.error('Frame extraction error:', error)
        return NextResponse.json(
            { error: 'Failed to extract frames' },
            { status: 500 }
        )
    } finally {
        // Cleanup temp directory
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true })
            }
        } catch (cleanupError) {
            console.error('Failed to cleanup temp directory:', cleanupError)
        }
    }
}
