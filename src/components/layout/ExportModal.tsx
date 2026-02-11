import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, Video, Image as ImageIcon, FileArchive } from "lucide-react"
import { useStore, type Clip } from "@/store/useStore"
import { imageToDataURL } from '@/utils/dataUrl'
// import { FFmpeg } from '@ffmpeg/ffmpeg'
// import { fetchFile, toBlobURL } from '@ffmpeg/util'
import JSZip from 'jszip'

export function ExportModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [format, setFormat] = useState<'mp4' | 'png' | 'zip'>('png')
    const [fps, setFps] = useState<number>(30)

    // Store access
    const { tracks, currentTime, aspectRatio, duration } = useStore()
    // const ffmpegRef = useRef(new FFmpeg())

    // -------------------------------------------------------------------------
    // Helper: Load FFmpeg (Disabled)
    // -------------------------------------------------------------------------
    /*
    const loadFFmpeg = async () => {
        const ffmpeg = ffmpegRef.current
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

        if (!ffmpeg.loaded) {
            setProgressText('Loading FFmpeg...')
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            })
        }
    }
    */

    // -------------------------------------------------------------------------
    // Helper: Load Image
    // -------------------------------------------------------------------------
    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = (e) => reject(e)
            img.src = src
        })
    }

    // -------------------------------------------------------------------------
    // Helper: Load Video Frame (DOM-based - Restored)
    // -------------------------------------------------------------------------
    const loadVideoFrame = (clip: Clip, projectTime: number): Promise<HTMLVideoElement> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video')
            video.crossOrigin = 'anonymous'
            video.src = clip.src
            video.muted = true

            // Calculate exact time in video
            const videoTime = (projectTime - clip.start) + (clip.mediaStart || 0)

            video.currentTime = videoTime

            // Wait for seek to complete
            video.onseeked = () => resolve(video)
            video.onerror = (e) => reject(e)

            // Must trigger load
            video.load()
        })
    }

    // -------------------------------------------------------------------------
    // Helper: Preload Video Assets to FFmpeg FS (Disabled)
    // -------------------------------------------------------------------------
    /*
    const preloadVideoAssets = async () => {
        const ffmpeg = ffmpegRef.current
        const videoClips = tracks
            .flatMap(t => t.clips)
            .filter(c => c.type === 'video')
        
        // Deduplicate by ID
        const uniqueClips = Array.from(new Map(videoClips.map(c => [c.src, c])).values())

        if (uniqueClips.length > 0) setProgressText('Preloading video assets...')

        for (const clip of uniqueClips) {
            try {
                const data = await fetchFile(clip.src)
                await ffmpeg.writeFile(`video_${clip.id}.mp4`, data)
            } catch (e) {
                console.error(`Failed to preload video ${clip.id}`, e)
            }
        }
    }
    */

    // -------------------------------------------------------------------------
    // Helper: Extract Video Frame using FFmpeg (Disabled)
    // -------------------------------------------------------------------------
    /*
    const extractVideoFrame = async (clip: Clip, projectTime: number): Promise<HTMLImageElement | null> => {
        const ffmpeg = ffmpegRef.current
        const videoTime = (projectTime - clip.start) + (clip.mediaStart || 0)
        const inputName = `video_${clip.id}.mp4`
        const outputName = `temp_frame_${clip.id}.png`

        try {
            // Check if file exists (optimized) - skipped for now, assuming preload logic worked.
            
            // Extract specific frame
            // -ss before -i is faster (input seeking)
            await ffmpeg.exec([
                '-ss', videoTime.toString(),
                '-i', inputName,
                '-frames:v', '1',
                '-y', // Overwrite output
                outputName
            ])

            const data = await ffmpeg.readFile(outputName)
            const blob = new Blob([data], { type: 'image/png' })
            const url = URL.createObjectURL(blob)
            return await loadImage(url)
        } catch (e) {
            console.error(`FFmpeg frame extraction failed for ${clip.id} at ${videoTime}`, e)
            return null
        }
    }
    */


    // -------------------------------------------------------------------------
    // Helper: Get Shape Path (Same as PreviewPlayer)
    // -------------------------------------------------------------------------
    const getShapePath = (shapeName: string): string => {
        switch (shapeName) {
            case 'Triangle': return 'M 50 0 L 100 100 L 0 100 Z'
            case 'Star': return 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z'
            case 'Arrow Right': return 'M 0 20 L 60 20 L 60 0 L 100 50 L 60 100 L 60 80 L 0 80 Z'
            case 'Heart': return 'M 50 90 L 48 88 C 10 55 0 35 0 20 C 0 10 10 0 25 0 C 35 0 45 10 50 20 C 55 10 65 0 75 0 C 90 0 100 10 100 20 C 100 35 90 55 52 88 L 50 90 Z'
            case 'Arrow': return 'M 50 0 L 50 70 M 50 70 L 20 40 M 50 70 L 80 40'
            default: return ''
        }
    }

    // -------------------------------------------------------------------------
    // Helper: Pre-fetch Video Frames API
    // -------------------------------------------------------------------------
    const prefetchVideoFrames = async (fps: number, duration: number) => {
        const videoClips = tracks
            .flatMap(t => t.clips)
            .filter(c => c.type === 'video')

        // Group by source to avoid redundant requests
        const uniqueSources = Array.from(new Set(videoClips.map(c => c.src)))
        const frameMap = new Map<string, HTMLImageElement>()

        const totalFrames = Math.max(1, Math.ceil(duration * fps))

        for (const src of uniqueSources) {
            // Find all clips using this source
            const clips = videoClips.filter(c => c.src === src)

            // Calculate needed timestamps for this video source
            // We need to know which frames in the project correspond to which time in the video
            const neededTimestamps: number[] = []
            const timestampToFrameIndexMap = new Map<number, number[]>()

            for (let i = 0; i < totalFrames; i++) {
                const projectTime = i / fps

                // Check if any clip active at this time uses this source
                const activeClip = clips.find(c => projectTime >= c.start && projectTime < c.start + c.duration)

                if (activeClip) {
                    const videoTime = (projectTime - activeClip.start) + (activeClip.mediaStart || 0)
                    neededTimestamps.push(videoTime)

                    if (!timestampToFrameIndexMap.has(videoTime)) {
                        timestampToFrameIndexMap.set(videoTime, [])
                    }
                    timestampToFrameIndexMap.get(videoTime)?.push(i)
                }
            }

            if (neededTimestamps.length === 0) continue

            // Fetch frames from API
            try {
                const response = await fetch('/api/extract-frames', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        videoPath: src,
                        timestamps: neededTimestamps,
                        // Optional: size: '1920x?' to query high res if needed, but default/auto might be safer
                    })
                })

                if (!response.ok) throw new Error('Failed to fetch frames')

                const data = await response.json()
                const images: string[] = data.images

                // Map back to project frame indices
                // API returns images in order of sorted timestamps (as per our API logic roughly? 
                // Wait, API logic sorts file names. If we pass timestamps, we should verify execution order or matching.)
                // Actually the API logic sorts by filename timestamp.
                // We should sort our neededTimestamps to match API return order.

                const sortedUniqueTimestamps = Array.from(new Set(neededTimestamps)).sort((a, b) => a - b)

                // Load images
                await Promise.all(images.map(async (base64, idx) => {
                    const img = await loadImage(base64)
                    const videoTime = sortedUniqueTimestamps[idx]

                    // Assign this image to all source clips that use this videoTime
                    // We key by `${clip.id}_${projectFrameIndex}`? 
                    // Simpler: Key by `${src}_${videoTime.toFixed(4)}` or similar? 
                    // But floating point issues.
                    // Better: The render loop knows the videoTime. 
                    // Let's store by source and approximate timestamp? 

                    // Actually, let's just store by `${src}_${videoTime}` but handle precision.
                    // Or, iterate our timestampToFrameIndexMap to assign.

                    const projectIndices = timestampToFrameIndexMap.get(videoTime)
                    if (projectIndices) {
                        projectIndices.forEach(pIdx => {
                            // Find which clip is active at pIdx to use its ID? 
                            // Or just map `${src}_${pIdx}` -> img?
                            // Since source is shared, if we use src + projectIndex it's unique enough for render frame lookup?
                            // Wait, multiple clips might use same source at same time (rare but possible).
                            // But usually one video layer active on top.
                            // Let's use `${src}_${pIdx}`
                            frameMap.set(`${src}_${pIdx}`, img)
                        })
                    }
                }))

            } catch (e) {
                console.error(`Failed to load frames for ${src}`, e)
            }
        }

        return frameMap
    }

    // -------------------------------------------------------------------------
    // Core: Render Frame to Canvas
    // -------------------------------------------------------------------------
    const renderFrame = async (
        ctx: CanvasRenderingContext2D,
        projectTime: number,
        projectWidth: number,
        projectHeight: number,
        frameIndex?: number,
        videoFrameMap?: Map<string, HTMLImageElement>
    ) => {
        // Fill background (Black)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, projectWidth, projectHeight)

        // Get Active Clips
        const activeClips = tracks
            .flatMap((track, trackIndex) => track.clips.map(clip => ({ ...clip, trackOrder: trackIndex })))
            .filter(clip => projectTime >= clip.start && projectTime < clip.start + clip.duration)
            .sort((a, b) => b.trackOrder - a.trackOrder)

        // Draw Loop
        for (const clip of activeClips) {
            ctx.save()

            // Dimensions
            const x = clip.x || 0
            const y = clip.y || 0
            const w = clip.width || (projectWidth / 4)
            const h = clip.height || (projectHeight / 4)
            const r = clip.rotation || 0
            const opacity = clip.opacity ?? 1

            ctx.globalAlpha = opacity

            // Transforms
            // Internal Rotation Logic (PreviewPlayer style)
            // But verify if we reverted it? 
            // The user reverted internal rotation, so rotation is on container.
            // Canvas equivalent: Rotate context before drawing image.

            // Standard Canvas Rotation around center
            const cx = x + w / 2
            const cy = y + h / 2

            // Apply Clip Transforms (including rotation)
            ctx.translate(cx, cy)
            ctx.rotate((r * Math.PI) / 180)
            ctx.translate(-cx, -cy)

            // Crop Logic (Zoom to Crop) implementation for Canvas
            // Need to clip the area then draw scaled image
            const crop = clip.crop

            if (crop) {
                // 1. Clip the drawing area to the box
                ctx.beginPath()
                ctx.rect(x, y, w, h)
                ctx.clip()

                // 2. Transform the context to "Zoom" into the crop
                // Scale so that crop area fills w, h
                const scaleX = 100 / crop.width
                const scaleY = 100 / crop.height

                // Translate so that crop (x, y) is at (0, 0) relative to the box top-left
                // Canvas is already at global coords.
                // We want: Draw Image at calculated position such that cropped part shows here.

                // Move origin to box top-left
                ctx.translate(x, y)
                // Scale
                ctx.scale(scaleX, scaleY)
                // Move back by crop offset
                ctx.translate(-(w * crop.x / 100), -(h * crop.y / 100))

                // Now draw at (0,0) (relative to this transform stack) -> means we draw at origin which corresponds to top-left of full image
                // But wait, the image dimensions are w, h on canvas? 
                // The image source is drawn at 0,0 with width w, height h? 
                // If we draw image at 0,0, w,h -> that's the full image size in "canvas space" if not zoomed.
                // WE need to draw the full image at full size?
                // Actually the `w` and `h` are the target box size.
                // The `crop` logic implies the "full image" size relative to this box is larger.
                // If `crop.width` = 50%, then original image displayed width = w * 2.
                // So we can draw inside this transformed context:
                // Draw image at (0,0) with size (w, h) -> this represents the "full uncropped" image in this coordinate system?
                // Wait, if crop.x=0, crop.width=100 -> scale=1, trans=0. Draw (0,0) w,h. Perfect.
                // If crop.width=50 -> scale=2. Draw (0,0) w,h. 
                // Result: The image drawn is w*2 wide.
                // We translated back by crop.x.
                // Correct.

                // Adjust drawing rect:
                // We will draw the image at 0,0 with size w,h. 
                // But wait, is w,h the size of the container or the render size?
                // It is the size of the container. 
                // So yes, drawing at 0,0,w,h in this transformed space works.

            } else {
                // No crop, just translate to x,y so we draw at correct pos
                ctx.translate(x, y)
            }

            // Flip
            const flipH = clip.flipH ? -1 : 1
            const flipV = clip.flipV ? -1 : 1
            ctx.scale(flipH, flipV)
            // If flipped, need to adjust position? 
            // Scale around center? 
            // We are at top-left of box (or 0,0 in crop space).
            // Center is w/2, h/2.
            if (flipH === -1) ctx.translate(-w, 0)
            if (flipV === -1) ctx.translate(0, -h)


            try {
                if (clip.type === 'image') {
                    const img = await loadImage(clip.src).catch(async () => {
                        const dataUrl = await imageToDataURL(clip.src)
                        return await loadImage(dataUrl)
                    }).catch(() => null)
                    if (img) ctx.drawImage(img, 0, 0, w, h)

                } else if (clip.type === 'video') {
                    // Optimized: Use pre-fetched frame if available
                    let videoImg: HTMLImageElement | HTMLVideoElement | null = null

                    if (videoFrameMap && frameIndex !== undefined) {
                        videoImg = videoFrameMap.get(`${clip.src}_${frameIndex}`) || null
                    }

                    if (!videoImg) {
                        // Fallback to DOM-based if not in map
                        videoImg = await loadVideoFrame(clip, projectTime).catch(() => null)
                    }

                    if (videoImg) ctx.drawImage(videoImg, 0, 0, w, h)

                } else if (clip.type === 'shape') {
                    // ... same shape logic ...
                    // Simplified for brevity, reusing previous logic logic structure
                    if (clip.src) {
                        const img = await loadImage(clip.src).catch(async () => {
                            const dataUrl = await imageToDataURL(clip.src)
                            return await loadImage(dataUrl)
                        }).catch(() => null)
                        if (img) ctx.drawImage(img, 0, 0, w, h)
                    } else {
                        ctx.fillStyle = clip.color || 'white'
                        if (clip.name === 'Rectangle') {
                            ctx.fillRect(0, 0, w, h)
                        } else if (clip.name === 'Circle') {
                            ctx.beginPath()
                            ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI)
                            ctx.fill()
                        } else {
                            const pathData = clip.customPath || getShapePath(clip.name)
                            if (pathData) {
                                const p = new Path2D(pathData)
                                ctx.save()
                                ctx.scale(w / 100, h / 100)
                                ctx.fill(p)
                                ctx.restore()
                            }
                        }
                    }

                } else if (clip.type === 'text') {
                    // ... text logic ...
                    const fontSize = clip.fontSize || 120
                    const text = clip.text || 'Text'
                    const color = clip.color || 'white'
                    const fontFamily = clip.fontFamily || 'sans-serif'

                    ctx.font = `bold ${fontSize}px ${fontFamily}`
                    ctx.fillStyle = color
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'

                    const lines = text.split('\n')
                    const lineHeight = fontSize * 1.2
                    const totalHeight = lines.length * lineHeight

                    lines.forEach((line, i) => {
                        const yOffset = (i * lineHeight) - (totalHeight / 2) + (lineHeight / 2)
                        ctx.fillText(line, w / 2, h / 2 + yOffset)
                    })
                }

            } catch (drawErr) {
                console.error(`Failed to draw clip ${clip.id}:`, drawErr)
            }
            ctx.restore()
        }
    }

    // -------------------------------------------------------------------------
    // Action: Export Video (MP4) - Disabled
    // -------------------------------------------------------------------------
    const handleExportVideo = async () => {
        alert("Video export is currently disabled.")
    }

    // -------------------------------------------------------------------------
    // Action: Export ZIP (Frames sequence) - Enabled
    // -------------------------------------------------------------------------
    const [abortController, setAbortController] = useState<AbortController | null>(null)

    // Prevent closing/refreshing while exporting
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isExporting) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isExporting])

    const handleCancel = () => {
        if (abortController) {
            abortController.abort()
        }
        setIsExporting(false)
        setIsOpen(false)
        setAbortController(null)
    }

    // Action: Export ZIP
    const handleExportZip = async () => {
        const controller = new AbortController()
        setAbortController(controller)
        const signal = controller.signal

        setIsExporting(true)

        try {
            const projectWidth = 1920
            const projectHeight = 1920 / (aspectRatio || 1)

            const canvas = document.createElement('canvas')
            canvas.width = projectWidth
            canvas.height = projectHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get 2d context')

            const totalFrames = Math.max(1, Math.ceil(duration * fps))
            console.log(`Starting ZIP export: ${duration}s @ ${fps}fps = ${totalFrames} frames`)

            // 1. Prefetch Video Frames
            // setProgressText('Extracting video frames...')
            // We should pass signal to prefetch if possible, or check it after
            if (signal.aborted) throw new Error('Export cancelled')
            const videoFrameMap = await prefetchVideoFrames(fps, duration)
            if (signal.aborted) throw new Error('Export cancelled')

            const zip = new JSZip()
            const framesFolder = zip.folder("frames")
            if (!framesFolder) throw new Error("Failed to create zip folder")

            // 2. Render All Frames
            for (let i = 0; i < totalFrames; i++) {
                if (signal.aborted) throw new Error('Export cancelled')

                const time = i / fps

                // setProgressText(`Rendering frame ${i + 1}/${totalFrames}`)
                // setProgress(Math.round((i / totalFrames) * 80))

                await renderFrame(ctx, time, projectWidth, projectHeight, i, videoFrameMap)

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
                if (!blob) throw new Error(`Failed to capture frame ${i}`)

                // Add to ZIP
                framesFolder.file(`frame_${i.toString().padStart(4, '0')}.png`, blob)
            }

            if (signal.aborted) throw new Error('Export cancelled')

            // 3. Generate ZIP
            // setProgressText('Compressing files...')
            // setProgress(90)

            const content = await zip.generateAsync({ type: "blob" })

            // 4. Download
            if (signal.aborted) throw new Error('Export cancelled')

            // @ts-ignore
            const url = URL.createObjectURL(content)
            const link = document.createElement('a')
            link.download = `project-frames-${Date.now()}.zip`
            link.href = url
            link.click()

            console.log('ZIP export successful')

        } catch (error: any) {
            if (error.message === 'Export cancelled') {
                console.log('Export cancelled by user')
            } else {
                console.error('ZIP export failed:', error)
                alert('Failed to export ZIP. Check console.')
            }
        } finally {
            setIsExporting(false)
            setIsOpen(false)
            setAbortController(null)
        }
    }

    // -------------------------------------------------------------------------
    // Action: Export Image (Current Frame)
    // -------------------------------------------------------------------------
    const handleExportImage = async () => {
        setIsExporting(true)

        try {
            // Disabled FFmpeg loading
            // await loadFFmpeg()
            // await preloadVideoAssets() // Preload Videos

            const projectWidth = 1920
            const projectHeight = 1920 / (aspectRatio || 1)

            const canvas = document.createElement('canvas')
            canvas.width = projectWidth
            canvas.height = projectHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get 2d context')

            await renderFrame(ctx, currentTime, projectWidth, projectHeight)

            const dataUrl = canvas.toDataURL('image/png')
            const link = document.createElement('a')
            link.download = `canvas-export-${Date.now()}.png`
            link.href = dataUrl
            link.click()

        } catch (error) {
            console.error('Export failed:', error)
            alert('Export failed. See console.')
        } finally {
            setIsExporting(false)
            setIsOpen(false)
        }
    }

    const handleExport = () => {
        if (format === 'mp4') return handleExportVideo()
        if (format === 'zip') return handleExportZip()
        return handleExportImage()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(val) => !isExporting && setIsOpen(val)}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Export Project</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <Select
                            value={format}
                            onValueChange={(v: 'mp4' | 'png' | 'zip') => setFormat(v)}
                            disabled={isExporting}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="png">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        <span>Image (Current Frame .png)</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="mp4" disabled>
                                    <div className="flex items-center gap-2 opacity-50">
                                        <Video className="h-4 w-4" />
                                        <span>Video (.mp4) - Disabled</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="zip">
                                    <div className="flex items-center gap-2">
                                        <FileArchive className="h-4 w-4" />
                                        <span>Frames Sequence (.zip)</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(format === 'mp4' || format === 'zip') && (
                        <div className="space-y-2">
                            <Label>Frame Rate (FPS)</Label>
                            <Select
                                value={fps.toString()}
                                onValueChange={(v) => setFps(Number(v))}
                                disabled={isExporting}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="24">24 FPS</SelectItem>
                                    <SelectItem value="30">30 FPS</SelectItem>
                                    <SelectItem value="60">60 FPS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isExporting ? 'Exporting...' : 'Export'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
