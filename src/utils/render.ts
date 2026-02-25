
import { Clip, Track } from "@/features/editor/store/useStore"
import { imageToDataURL } from '@/utils/dataUrl'

// -------------------------------------------------------------------------
// Helper: Load Image
// -------------------------------------------------------------------------
export const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = (e) => reject(e)
        img.src = src
    })
}

// -------------------------------------------------------------------------
// Helper: Load SVG Image with Color/Template Data
// -------------------------------------------------------------------------
export const loadSvgImage = async (src: string, color?: string, templateData?: any): Promise<HTMLImageElement> => {
    try {
        const res = await fetch(src);
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svgElement = doc.documentElement;

        // Ensure viewBox exists
        if (!svgElement.getAttribute('viewBox')) {
            const w = svgElement.getAttribute('width');
            const h = svgElement.getAttribute('height');
            if (w && h) {
                const cleanW = w.replace(/[^0-9.]/g, '');
                const cleanH = h.replace(/[^0-9.]/g, '');
                svgElement.setAttribute('viewBox', `0 0 ${cleanW} ${cleanH}`);
            }
        }

        // Apply fill color
        if (color) {
            const shapeElements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
            shapeElements.forEach(el => {
                // Check if fill is not explicitly 'none' (simple check)
                // In a true DOM environment we might check computed style, but here we work with parsed XML.
                // We'll imply that if it's a shape, we color it unless it has fill="none" explicitly set inline.
                const currentFill = el.getAttribute('fill');
                if (currentFill !== 'none') {
                    el.setAttribute('fill', color);
                    // Also set style to override potential CSS classes
                    const style = el.getAttribute('style') || '';
                    el.setAttribute('style', `${style}; fill: ${color};`);
                }
            });
        }

        // Apply templateData
        if (templateData && typeof templateData === 'object') {
            Object.entries(templateData).forEach(([id, data]: [string, any]) => {
                const element = doc.getElementById(id);
                if (!element) return;

                if (data.text !== undefined) {
                    if (element.tagName.toLowerCase() === 'text' || element.tagName.toLowerCase() === 'tspan') {
                        element.textContent = data.text;
                    }
                }

                // Geometric Attributes
                if (data.width !== undefined) element.setAttribute('width', data.width.toString());
                if (data.height !== undefined) element.setAttribute('height', data.height.toString());
                if (data.x !== undefined) element.setAttribute('x', data.x.toString());
                if (data.y !== undefined) element.setAttribute('y', data.y.toString());
                if (data.rx !== undefined) element.setAttribute('rx', data.rx.toString());
                if (data.ry !== undefined) element.setAttribute('ry', data.ry.toString());
                if (data.r !== undefined) element.setAttribute('r', data.r.toString());
                if (data.cx !== undefined) element.setAttribute('cx', data.cx.toString());
                if (data.cy !== undefined) element.setAttribute('cy', data.cy.toString());
                if (data.d !== undefined) element.setAttribute('d', data.d);

                if (data.fill !== undefined) {
                    element.setAttribute('fill', data.fill);
                    const currentStyle = element.getAttribute('style') || '';
                    element.setAttribute('style', `${currentStyle}; fill: ${data.fill};`);
                }
                if (data.stroke !== undefined) {
                    element.setAttribute('stroke', data.stroke);
                    const currentStyle = element.getAttribute('style') || '';
                    element.setAttribute('style', `${currentStyle}; stroke: ${data.stroke};`);
                }
                if (data.strokeWidth !== undefined) {
                    element.setAttribute('stroke-width', data.strokeWidth.toString());
                    const currentStyle = element.getAttribute('style') || '';
                    element.setAttribute('style', `${currentStyle}; stroke-width: ${data.strokeWidth};`);
                }
                if (data.opacity !== undefined) {
                    element.setAttribute('opacity', data.opacity.toString());
                    const currentStyle = element.getAttribute('style') || '';
                    element.setAttribute('style', `${currentStyle}; opacity: ${data.opacity};`);
                }
            });
        }

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const encodedSvg = encodeURIComponent(svgString);
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

        return loadImage(dataUrl);

    } catch (e) {
        console.error("Failed to load/parse SVG:", e);
        // Fallback to original src if parsing fails
        return loadImage(src);
    }
}

// -------------------------------------------------------------------------
// Helper: Load Video Frame (DOM-based)
// -------------------------------------------------------------------------
export const loadVideoFrame = (clip: Clip, projectTime: number): Promise<HTMLVideoElement> => {
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
// Helper: Get Shape Path
// -------------------------------------------------------------------------
export const getShapePath = (shapeName: string): string => {
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
export const prefetchVideoFrames = async (fps: number, duration: number, tracks: Track[]) => {
    const videoClips = tracks
        .flatMap(t => t.clips)
        .filter(c => c.type === 'mask')
        .filter(c => c.src.match(/\.(mp4|webm|mov|m4v)$/i) || c.src.startsWith('blob:video/'))

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
                    fps: fps,
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
                const projectIndices = timestampToFrameIndexMap.get(videoTime)
                if (projectIndices) {
                    projectIndices.forEach(pIdx => {
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
export const renderFrame = async (
    ctx: CanvasRenderingContext2D,
    projectTime: number,
    projectWidth: number,
    projectHeight: number,
    tracks: Track[], // Added tracks argument
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
        // Standard Canvas Rotation around center
        const cx = x + w / 2
        const cy = y + h / 2

        // Apply Clip Transforms (including rotation)
        ctx.translate(cx, cy)
        ctx.rotate((r * Math.PI) / 180)
        ctx.translate(-cx, -cy)

        // Mask Logic (Zoom to Mask) implementation for Canvas
        // Need to clip the area then draw scaled image
        // Mask Logic (Zoom to Mask) implementation for Canvas
        const mask = clip.mask
        const templateData = clip.templateData

        let hasCustomClip = false;

        // 1. Apply Custom Path Clip (if available)
        if (templateData) {
            const shapes = Object.values(templateData).filter((v: any) => v.type);
            if (shapes.length > 0) {
                let viewX = 0;
                let viewY = 0;
                let viewW = 100;
                let viewH = 100;

                if (clip.viewBox) {
                    const parts = clip.viewBox.split(/[ ,]+/).filter(Boolean).map(Number);
                    if (parts.length === 4) {
                        [viewX, viewY, viewW, viewH] = parts;
                    }
                } else if (templateData.originalBBox) {
                    // Fallback for legacy items if needed, or just default to 100 if we assumed strict migration
                }

                // Avoid division by zero
                if (viewW === 0) viewW = 100;
                if (viewH === 0) viewH = 100;

                const sx = w / viewW;
                const sy = h / viewH;

                // Matrix: Scale(sx, sy) * Translate(-vx, -vy)
                // We also need to translate to the Clip's (x, y) on canvas.
                // The context is already AT (cx, cy) then rotated then translated back to (x, y) effectively via transforms?
                // Line 272: ctx.translate(cx, cy); ctx.rotate; ctx.translate(-cx, -cy).
                // So the context origin (0,0) is still at Global(0,0), but the grid is rotated around center?
                // No. `ctx.translate/rotate` modifies the matrix.
                // If we draw at `x,y`, it appears at the correct rotated position.

                // So we want to map:
                // Path(0,0) -> Clip(x,y)
                // But Path is in ViewBox Space.
                // Path(vx, vy) -> Clip(x, y)
                // So we Translate(-vx, -vy) then Scale(sx, sy) then Translate(x, y).

                // We can compose the matrix:
                // Global Matrix = [sx, 0, 0, sy, x - vx*sx, y - vy*sy]

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const matrix = svg.createSVGMatrix();
                matrix.a = sx;
                matrix.d = sy;
                matrix.e = x - (viewX * sx);
                matrix.f = y - (viewY * sy);

                const combinedPath = new Path2D();
                shapes.forEach((shape: any) => {
                    if (shape.d) {
                        combinedPath.addPath(new Path2D(shape.d), matrix);
                    } else if (shape.type === 'rect') {
                        const px = parseFloat(shape.x || 0);
                        const py = parseFloat(shape.y || 0);
                        const pw = parseFloat(shape.width || 0);
                        const ph = parseFloat(shape.height || 0);
                        const p = new Path2D();
                        p.rect(px, py, pw, ph);
                        combinedPath.addPath(p, matrix);
                    } else if (shape.type === 'circle') {
                        const cx = parseFloat(shape.cx || 0);
                        const cy = parseFloat(shape.cy || 0);
                        const r = parseFloat(shape.r || 0);
                        const p = new Path2D();
                        p.arc(cx, cy, r, 0, 2 * Math.PI);
                        combinedPath.addPath(p, matrix);
                    }
                    // Add other shapes if needed
                });

                ctx.beginPath();
                ctx.clip(combinedPath);
                hasCustomClip = true;
            }
        }

        if (mask) {
            // 2. Apply User Crop Clip (if no custom path found)
            if (!hasCustomClip) {
                ctx.beginPath()
                if (mask.shape === 'circle') {
                    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * Math.PI)
                } else if (mask.cornerRadius) {
                    const radius = (mask.cornerRadius / 100) * Math.min(w, h)
                    ctx.roundRect(x, y, w, h, radius)
                } else {
                    ctx.rect(x, y, w, h)
                }
                ctx.clip()
            }

            // 3. Transform to "Zoom" into the crop
            const scaleX = 100 / mask.width
            const scaleY = 100 / mask.height

            // Adjust coordinates to zoom into the masked area
            let offX = x
            let offY = y
            let clipWidth = w
            let clipHeight = h

            offX -= (mask.x / 100) * clipWidth * scaleX
            offY -= (mask.y / 100) * clipHeight * scaleY

            ctx.translate(offX, offY)
            ctx.scale(scaleX, scaleY)
        } else {
            // No crop, just translate to x,y so we draw at correct pos
            // If hasCustomClip, clipping is already applied in Global Space over (x,y,w,h) area.
            // We just need to draw the image at x,y.
            ctx.translate(x, y)
        }

        // Flip
        const flipH = clip.flipH ? -1 : 1
        const flipV = clip.flipV ? -1 : 1
        ctx.scale(flipH, flipV)
        // If flipped, need to adjust position? 
        if (flipH === -1) ctx.translate(-w, 0)
        if (flipV === -1) ctx.translate(0, -h)


        try {
            if (clip.type === 'mask') {
                const isVideo = (clip.mediaType === 'video') || clip.src.match(/\.(mp4|webm|mov|m4v)$/i) || clip.src.startsWith('blob:video/');
                let drawSource: CanvasImageSource | null = null;

                if (isVideo) {
                    // 1. Try to get from pre-fetched map (Batch Export)
                    if (frameIndex !== undefined && videoFrameMap) {
                        const key = `${clip.src}_${frameIndex}`;
                        const cached = videoFrameMap.get(key);
                        if (cached) drawSource = cached;
                    }

                    // 2. Fallback to direct DOM load (Single Export or Cache Miss)
                    if (!drawSource) {
                        try {
                            const videoEl = await loadVideoFrame(clip, projectTime);
                            drawSource = videoEl;
                        } catch (e) {
                            console.warn("Failed to load video frame for export", e);
                        }
                    }
                }

                // 3. If not video or failed to load video, try as Image
                if (!drawSource) {
                    const img = await loadImage(clip.src).catch(async () => {
                        const dataUrl = await imageToDataURL(clip.src)
                        return await loadImage(dataUrl)
                    }).catch(() => null)
                    if (img) drawSource = img;
                }

                if (drawSource) ctx.drawImage(drawSource, 0, 0, w, h)

            } else if (clip.type === 'icon') {
                // Load SVG with dynamic color/template data
                const img = await loadSvgImage(clip.src, clip.color, clip.templateData);
                if (img) ctx.drawImage(img, 0, 0, w, h);

            } else if (clip.type === 'shape') {
                const isPrimitive = ['Rectangle', 'Circle', 'Triangle', 'Star', 'Arrow Right', 'Heart', 'Arrow'].includes(clip.src) || !!clip.customPath

                if (!isPrimitive && clip.src) {
                    const img = await loadImage(clip.src).catch(async () => {
                        const dataUrl = await imageToDataURL(clip.src)
                        return await loadImage(dataUrl)
                    }).catch(() => null)
                    if (img) ctx.drawImage(img, 0, 0, w, h)
                } else {
                    ctx.fillStyle = clip.color || 'white'
                    const shapeType = clip.src

                    if (shapeType === 'Rectangle') {
                        ctx.fillRect(0, 0, w, h)
                    } else if (shapeType === 'Circle') {
                        ctx.beginPath()
                        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI)
                        ctx.fill()
                    } else {
                        const pathData = clip.customPath || getShapePath(shapeType)
                        if (pathData) {
                            const p = new Path2D(pathData)
                            ctx.save()

                            let viewX = 0
                            let viewY = 0
                            let viewW = 100
                            let viewH = 100

                            if (clip.viewBox) {
                                const parts = clip.viewBox.trim().split(/\s+/)
                                if (parts.length === 4) {
                                    const [vx, vy, vw, vh] = parts.map(Number)
                                    if (!isNaN(vx) && !isNaN(vy) && !isNaN(vw) && !isNaN(vh) && vw > 0 && vh > 0) {
                                        viewX = vx
                                        viewY = vy
                                        viewW = vw
                                        viewH = vh
                                    }
                                }
                            }

                            const scaleX = w / viewW
                            const scaleY = h / viewH

                            // Transform context to map viewBox to (0,0)-(w,h)
                            ctx.scale(scaleX, scaleY)
                            ctx.translate(-viewX, -viewY)

                            if (shapeType === 'Arrow') {
                                ctx.strokeStyle = clip.color || 'white'
                                ctx.lineWidth = 5
                                ctx.stroke(p)
                            } else {
                                ctx.fillStyle = clip.color || 'white'
                                ctx.fill(p)
                            }
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

                ctx.font = `bold ${fontSize}px "${fontFamily}"`
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
