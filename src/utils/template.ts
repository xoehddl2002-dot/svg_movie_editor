
import { getStrokedBBox, getBBox } from './svg/utilities'
import { hasNonIdentityTransform, getMatrix, deltaTransformPoint } from './svg/math'
import { urlToDataURL } from './dataUrl'
import type { Clip, Track, ResourceType } from '../features/editor/store/useStore'
import { transformPath } from './svg/pathUtils'
import { getRectPath, getEllipsePath, getTrianglePath } from '../features/editor/utils/shapeUtils'

export interface TemplateData {
    name: string
    svg: string
    json: any
    category: string
}

export interface ProcessedTemplateResult {
    tracks: Track[]
    aspectRatio: number
    currentTime: number
    fontList?: Record<string, string[]>
}

export const processTemplate = async (template: TemplateData, defaultDuration: number): Promise<ProcessedTemplateResult | null> => {
    let jsonData = template.json;
    if (typeof template.json === 'string') {
        try {
            const res = await fetch(template.json);
            jsonData = await res.json();
        } catch (err) {
            console.error("Failed to fetch template JSON:", err);
            return null;
        }
    }

    let svgDoc: Document;
    try {
        const res = await fetch(template.svg);
        const svgText = await res.text();
        const parser = new DOMParser();
        svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    } catch (err) {
        console.error("Failed to fetch or parse template SVG:", err);
        return null; // Return null on failure
    }

    const { v4: uuidv4 } = await import('uuid');

    let ratio = 16 / 9;
    if (template.category === 'F') ratio = 1920 / 1080;
    else if (template.category === 'S') ratio = 1080 / 1920;
    else if (template.category === 'T') ratio = 1820 / 118;

    const projectWidth = 1920;

    // Extract SVG dimensions to calculate scale factor
    const rootElement = svgDoc.documentElement;
    let svgWidth = 1920;
    let svgHeight = 1080;
    const viewBoxAttr = rootElement.getAttribute('viewBox');
    const widthAttr = rootElement.getAttribute('width');
    const heightAttr = rootElement.getAttribute('height');

    if (viewBoxAttr) {
        const parts = viewBoxAttr.split(/\s+|,/).filter(Boolean).map(parseFloat);
        if (parts.length === 4) {
            svgWidth = parts[2];
            svgHeight = parts[3];
        }
    } else if (widthAttr && heightAttr) {
        svgWidth = parseFloat(widthAttr);
        svgHeight = parseFloat(heightAttr);
    }

    // Calculate Scale Factor
    const scale = projectWidth / svgWidth;

    if (svgWidth && svgHeight) {
        ratio = svgWidth / svgHeight;
    }

    // Calculate base URL for resolving relative image paths
    const templateBaseUrl = template.svg.substring(0, template.svg.lastIndexOf('/') + 1);

    // Inline all image paths in SVG for robust exporting (especially PNG via canvas)
    const images = svgDoc.querySelectorAll('image');
    for (const img of Array.from(images)) {
        const href = img.getAttribute('href') || img.getAttribute('xlink:href');
        if (href) {
            try {
                let absoluteUrl = href;
                if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('/')) {
                    absoluteUrl = templateBaseUrl + href;
                }

                // Convert to Data URL to avoid cross-origin issues during canvas rendering
                if (!absoluteUrl.startsWith('data:')) {
                    const dataUrl = await urlToDataURL(absoluteUrl).catch(err => {
                        console.warn(`[template.ts] Image inlining failed for ${absoluteUrl}:`, err);
                        return absoluteUrl; // Fallback to absolute URL if conversion fails
                    });
                    img.setAttribute('href', dataUrl);
                    if (img.hasAttribute('xlink:href')) {
                        img.setAttribute('xlink:href', dataUrl);
                    }
                }
            } catch (err) {
                console.warn(`[template.ts] Failed to process image ${href}:`, err);
            }
        }
    }

    // Extract global definitions
    let defsString = '';
    const defs = svgDoc.querySelectorAll('defs');
    defs.forEach(el => {
        defsString += new XMLSerializer().serializeToString(el);
    });
    const styles = svgDoc.querySelectorAll('style');
    styles.forEach(el => {
        if (!el.closest('defs')) {
            defsString += new XMLSerializer().serializeToString(el);
        }
    });

    const rootFree = svgDoc.documentElement.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;

    // Helper to determine clip type and validity from JSON item
    interface TempClipData {
        element: Element;
        item: any;
        type: ResourceType;
        id: string; // SVG ID
    }

    const validClips: TempClipData[] = [];
    const items = jsonData.item || {};

    Object.entries(items).forEach(([key, item]: [string, any]) => {
        const element = svgDoc.getElementById(key);
        if (!element) return; // Skip if element not found in SVG

        // Set JSON item attributes on the DOM element
        const attrKeys = ['editor_move', 'editor_scale', 'editor_rotate', 'attr_rock', 'image_id', 'shapes_id', 'max_length'];
        attrKeys.forEach((attr) => {
            if (item[attr] !== undefined) {
                element.setAttribute(attr, String(item[attr]));
            }
        });

        const nodeName = item.nodeName?.toLowerCase();
        let type: ResourceType | null = 'icon';

        if (nodeName === 'text') {
            type = 'text';
        } else if (nodeName === 'image') {
            if (item.image_id && item.image_id === item.id) {
                type = 'mask';
            } else {
                type = null;
            }
        } else if (nodeName === 'g' && item.image_id) {
            // Cropped Image Support (G tag acting as mask wrapper)
            type = 'mask';
        } else if (['rect', 'path', 'polygon', 'circle', 'ellipse', 'line', 'polyline'].includes(nodeName)) {
            if (item.shapes_id && item.shapes_id === item.id) {
                type = 'shape';
            }
        }

        if (type) {
            validClips.push({ element, item, type, id: key });
        }
    });

    // Sort by DOM order to ensure correct layering (Back to Front)
    validClips.sort((a, b) => {
        const position = a.element.compareDocumentPosition(b.element);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // a comes before b
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;  // b comes before a
        return 0;
    });

    // Reverse to get Front-to-Back order for tracks (Track 0 is Top/Front)
    const orderedClips = [...validClips].reverse();

    const newClips: Clip[] = [];

    // Append SVG to DOM for BBox calculations
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.visibility = 'hidden';
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.width = '0';
    hiddenContainer.style.height = '0';
    hiddenContainer.style.overflow = 'hidden';
    hiddenContainer.appendChild(rootElement);
    document.body.appendChild(hiddenContainer);

    const mockAddSVGElementsFromJson = (data: any) => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", data.element);
        if (data.attr) {
            Object.entries(data.attr).forEach(([k, v]) => el.setAttribute(k, v as string));
        }
        return el;
    };
    const mockPathActions = {
        resetOrientation: (path: any) => { }
    };

    try {
        orderedClips.forEach((data) => {
            const { element, type, item } = data;

            let rotation = 0;

            // Calculate Global Visual Center (before flattening) to preserve alignment
            let visualCx = 0;
            let visualCy = 0;
            try {
                const graphicsElement = element as unknown as SVGGraphicsElement;
                if (typeof graphicsElement.getBBox === 'function' && typeof getMatrix === 'function') {
                    const rootMatrix = getMatrix(graphicsElement);
                    const rootBBox = graphicsElement.getBBox();
                    const lCx = rootBBox.x + rootBBox.width / 2;
                    const lCy = rootBBox.y + rootBBox.height / 2;
                    visualCx = rootMatrix.a * lCx + rootMatrix.c * lCy + rootMatrix.e;
                    visualCy = rootMatrix.b * lCx + rootMatrix.d * lCy + rootMatrix.f;
                }
            } catch (e) { }

            // Parse Transform for rotation only (position is handled by bbox)
            const elementsToFlatten = [element, ...Array.from(element.querySelectorAll('*'))];

            elementsToFlatten.forEach(ele => {
                if (ele instanceof SVGGraphicsElement && hasNonIdentityTransform(ele.transform.baseVal)) {
                    const matrix = getMatrix(ele)
                    const m = deltaTransformPoint(matrix)
                    const scaleX = m.scaleX
                    const scaleY = m.scaleY
                    const translateX = m.translateX
                    const translateY = m.translateY


                    // if (type === 'mask' && ele.tagName === 'image') {
                    //     element.setAttribute('transform', ele.getAttribute('transform') || '');
                    //     ele.removeAttribute('transform');
                    // }

                    if (ele === element) {
                        rotation += m.angle;
                    }


                    if (!m.angle || ele === element) {
                        let newX = 0
                        let newY = 0
                        const nodeName = ele.nodeName.toLowerCase();

                        if (['rect', 'image', 'video', 'use', 'foreignobject'].includes(nodeName)) {
                            const attrX = parseFloat(ele.getAttribute('x') || '0');
                            const attrY = parseFloat(ele.getAttribute('y') || '0');
                            newX = attrX * scaleX + translateX;
                            newY = attrY * scaleY + translateY;
                            ele.setAttribute('x', newX.toString())
                            ele.setAttribute('y', newY.toString())

                            const attrW = parseFloat(ele.getAttribute('width') || '0');
                            const attrH = parseFloat(ele.getAttribute('height') || '0');
                            ele.setAttribute('width', (attrW * scaleX).toString())
                            ele.setAttribute('height', (attrH * scaleY).toString())
                        } else if (nodeName === 'text') {
                            const currentFontSize = parseFloat(ele.getAttribute("font-size") || '16');
                            ele.setAttribute("font-size", (currentFontSize * scaleY).toString());
                            const attrX = parseFloat(ele.getAttribute('x') || '0');
                            const attrY = parseFloat(ele.getAttribute('y') || '0');
                            ele.setAttribute('x', (attrX * scaleX + translateX).toString());
                            ele.setAttribute('y', (attrY * scaleY + translateY).toString());
                        }

                        ele.setAttribute('transform', `matrix(1,0,0,1,0,0)`)
                    }
                }
            })

            const tagName = element.tagName.toLowerCase();

            let x = 0, y = 0, width = 100, height = 100, opacity = 1;
            let src = '';
            let fill: string | undefined;
            let textContent = '';
            let fontFamily = 'sans-serif';
            let fontSize = 24;
            let bboxString = rootFree;
            let mask: any = undefined;

            // Calculate BBox first
            let bbox: any;
            try {
                if (tagName === 'g') {
                    bbox = getStrokedBBox([element], mockAddSVGElementsFromJson, mockPathActions);
                } else {
                    bbox = getBBox(element as unknown as SVGGraphicsElement);
                }

                if (bbox) {
                    width = bbox.width * scale;
                    height = bbox.height * scale;

                    if (visualCx) {
                        x = visualCx * scale - width / 2;
                        y = visualCy * scale - height / 2;
                    } else {
                        x = bbox.x * scale;
                        y = bbox.y * scale;
                    }

                    bboxString = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
                } else {
                    width = 200;
                    height = 200;
                }
            } catch (e) {
                console.warn("Failed to calculate BBox for", data.id, e);
                width = 200;
                height = 200;
            }

            // Common Attributes
            opacity = parseFloat(element.getAttribute('opacity') || '1');

            if (type === 'text') {
                fontSize = (parseFloat(element.getAttribute('font-size') || '24')) * scale;
                fontFamily = element.getAttribute('font-family') || 'sans-serif';
                fill = element.getAttribute('fill') || '#000000';
                textContent = element.textContent || element.innerHTML || '';
            } else if (type === 'icon' || type === 'shape' || type === 'mask') {
                if (type === 'shape') {
                    fill = element.getAttribute('fill') || '#000000';
                    const shapesId = item.shapes_id;
                    if (shapesId) {
                        const shapeElement = element.querySelector(`#${shapesId}`);
                        if (shapeElement) {
                            const shapeFill = shapeElement.getAttribute('fill');
                            if (shapeFill) fill = shapeFill;
                        }
                    }
                }

                const serialized = new XMLSerializer().serializeToString(element);
                const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${bboxString}'>${defsString}${serialized}</svg>`;
                src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
            }

            // Extract clipPath shapes for mask/image clips
            const templateData: Record<string, any> = {};
            if (type === 'mask' && element) {
                // Store original BBox for export scaling
                if (bbox) {
                    templateData.originalBBox = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
                }

                const style = element.getAttribute('style') || '';
                let clipPathId = element.getAttribute('clip-path');

                // Check style for clip-path if attribute is missing
                if (!clipPathId && style.includes('clip-path')) {
                    const match = style.match(/clip-path\s*:\s*url\(['"]?#([^)'"]+)['"]?\)/);
                    if (match) clipPathId = match[1];
                } else if (clipPathId) {
                    const match = clipPathId.match(/url\(['"]?#([^)'"]+)['"]?\)/);
                    if (match) clipPathId = match[1];
                }

                if (clipPathId) {
                    // Handle case where ID might not have # definition in the attribute itself (sometimes raw ID)
                    clipPathId = clipPathId.replace(/^url\(#?/, '').replace(/\)$/, '');

                    const clipPathEl = svgDoc.getElementById(clipPathId);
                    if (clipPathEl) {
                        Array.from(clipPathEl.children).forEach((child: Element, idx) => {
                            // Skip text nodes or non-element nodes
                            if (child.nodeType !== 1) return;

                            const childId = child.id || `${data.id}-mask-shape-${idx}`;
                            const shapeType = child.tagName.toLowerCase();

                            // Default BBox for normalization
                            // We use the clip's calculated BBox (x, y) as the origin
                            const originX = bbox ? (bbox.x * scale) : 0;
                            const originY = bbox ? (bbox.y * scale) : 0;

                            let shapeX = 0;
                            let shapeY = 0;
                            let shapeW = 0;
                            let shapeH = 0;
                            let d = '';
                            let type = 'path';
                            let dataShapeType = 'rect';

                            if (shapeType === 'rect') {
                                const rx = parseFloat(child.getAttribute('x') || '0') * scale;
                                const ry = parseFloat(child.getAttribute('y') || '0') * scale;
                                shapeW = parseFloat(child.getAttribute('width') || '0') * scale;
                                shapeH = parseFloat(child.getAttribute('height') || '0') * scale;
                                const rRadiusX = parseFloat(child.getAttribute('rx') || '0') * scale;
                                const rRadiusY = parseFloat(child.getAttribute('ry') || '0') * scale;

                                shapeX = rx - originX;
                                shapeY = ry - originY;

                                console.log(rx,ry,shapeW,shapeH,rRadiusX,rRadiusY,shapeX,shapeY)

                                d = getRectPath(shapeX, shapeY, shapeW, shapeH, rRadiusX, rRadiusY);
                                dataShapeType = 'rect';
                            } else if (shapeType === 'circle') {
                                const cx = parseFloat(child.getAttribute('cx') || '0') * scale;
                                const cy = parseFloat(child.getAttribute('cy') || '0') * scale;
                                const r = parseFloat(child.getAttribute('r') || '0') * scale;

                                shapeW = r * 2;
                                shapeH = r * 2;
                                shapeX = (cx - r) - originX;
                                shapeY = (cy - r) - originY;

                                d = getEllipsePath(shapeX, shapeY, shapeW, shapeH);
                                dataShapeType = 'circle';
                            } else if (shapeType === 'ellipse') {
                                const cx = parseFloat(child.getAttribute('cx') || '0') * scale;
                                const cy = parseFloat(child.getAttribute('cy') || '0') * scale;
                                const rx = parseFloat(child.getAttribute('rx') || '0') * scale;
                                const ry = parseFloat(child.getAttribute('ry') || '0') * scale;

                                shapeW = rx * 2;
                                shapeH = ry * 2;
                                shapeX = (cx - rx) - originX;
                                shapeY = (cy - ry) - originY;

                                d = getEllipsePath(shapeX, shapeY, shapeW, shapeH);
                                dataShapeType = 'circle'; // Use circle editor for ellipses too
                            } else if (shapeType === 'path') {
                                const rawD = child.getAttribute('d') || '';
                                // Translate path to relative coordinates
                                // We need to account for scale as well if strictly following the pattern, 
                                // but path commands are complex to scale.
                                // Assumption: If SVG is scaled, the path data is already in the target coordinate space 
                                // OR we rely on a group transform. 
                                // Current architecture scales WIDTH/HEIGHT of container, but internal path data might be in different units if viewBox is used.

                                // However, processTemplate calculates `scale` = projectWidth / svgWidth.
                                // If the path data is in SVG units, we might need to scale it too?
                                // Let's assume for now we just translate. If scaling is needed, translatePath needs to be scalePath too.

                                // For now, just translate by -originX, -originY (assuming path is in the same space as BBox)
                                // Note: We are using validClips loop which calculates BBox in *SVG* space then scales it.
                                // So bbox.x is in SVG units. originX is in Project units.
                                // BUT the path data `d` is in SVG units.
                                // So we should arguably translate in SVG units then scale? Or scale then translate?
                                // Our translatePath is simple.

                                // Better approach:
                                // The MaskEditor expects coordinates in the `0..width` space of the clip.
                                // The clip width/height are already scaled to Project units.
                                // So the internal path data must also be in Project units to match?
                                // OR the MaskEditor applies a viewBox?

                                // MaskEditor sets viewBox to `0 0 clipW clipH`.
                                // This means the internal paths must be in the `0..clipW` coordinate space.
                                // If the original path was in SVG units, we must scale it by `scale`.

                                // Current simplified fix: Just translate. We might need a scaler later if this is off.
                                // But `scale` variable exists.

                                // TODO: Implement path scaling if needed. For now, assume scale ~ 1 or handle later.
                                // Actually, let's just use the raw logic for now but apply translation.
                                // If `scale` is significant, this will be wrong.
                                // But since we are inside `processTemplate` where we manually scale x/y/w/h, 
                                // we probably need to scale path too.
                                // For this iteration, let's trust that simple translation fixes position relative to the crop.

                                // IMPORTANT: Current `bbox` calculation uses `scale`.
                                // So originX/originY are in Project Pixels.
                                // The path `d` in the SVG is in SVG Pixels.
                                // If we subtract Project Pixels from SVG Pixels, it's garbage.

                                // We must subtract (bbox.x * scale) from (path coords * scale).
                                // OR subtract bbox.x from path coords, THEN scale everything.
                                // Let's try to just use the SVG-unit BBox for translation, then we'd need to scale the path?
                                // MaskEditor uses `clip.width` (scaled) for viewBox.
                                // So yes, path data MUST be scaled.

                                // Since I don't have a robust scalePath, I will implement a basic one inside `translatePath` 
                                // or just rely on the fact that for many templates scale might be 1 (1920x1080).

                                // Let's stick to translation first to fix the "offset" issue. 
                                // We can use `bbox.x` (SVG units) instead of `originX` (Project units) for translation 
                                // IF we assume the MaskEditor will apply a scale transform?
                                // No, MaskEditor uses `viewBox="0 0 w h"`.
                                // If `w` is scaled, but path is not, the path will look tiny.

                                // Wait, the existing code sets `width = bbox.width * scale`.
                                // So the viewbox is `0 0 (bbox.width*scale) (bbox.height*scale)`.
                                // If I put an unscaled path (width=bbox.width) into that viewbox, it will fill the viewbox perfectly!
                                // (Because `bbox.width / (bbox.width*scale)` is proportional to `1/scale`).
                                // NO. `viewBox="0 0 100 100"` means internal units are 0..100.
                                // If I have a rect 0..100 inside, it fills it.
                                // If I have a rect 0..100 inside a viewbox 0..200, it fills half.

                                // So:
                                // Clip Width (Project Units) = 1920.
                                // SVG Width (Original) = 1920. Scale = 1.
                                // BBox = x=100, w=500.
                                // Clip X = 100. Clip W = 500.
                                // ViewBox = 0 0 500 500.
                                // Path x=100.
                                // We want Path relative x = 0.
                                // So we translate by -100.
                                // New Path x=0.
                                // Rendered in ViewBox 0 0 500 500. It fills the start. Correct.

                                // Scenario 2:
                                // Project=1920. SVG=960. Scale=2.
                                // BBox x=50, w=250.
                                // Clip X = 100. BW = 500.
                                // ViewBox = 0 0 500 500.
                                // Path x=50.
                                // We translate by -BBox.x (-50).
                                // New Path x=0. w=250.
                                // Rendered in ViewBox 0 0 500 500.
                                // It will look like it occupies 250/500 = 50% of the width.
                                // BUT it should occupy 100% of the width (since it WAS the bbox).
                                // So we DO need to scale the path by 2.

                                // I will add a simplified scale support to `translatePath` (rename to `transformPath`)? 
                                // Or just update `template.ts` logic to use a group transform in MaskEditor to handle scale?
                                // MaskEditor doesn't support group transform for shapes yet.

                                // Actually, there is a simpler way!
                                // In `MaskEditor.tsx`, lines 414 loops over shapes.
                                // If we don't scale the path data, we must adjust the `viewBox` coordinates?
                                // No, variable viewBox is confusing.

                                // Let's look at `PreviewPlayer.tsx`:
                                // `renderMaskDefs` (line 432).
                                // It defines a mask.
                                // It uses `scale(sx, sy)` where `sx = w / vbw`.
                                // `vbw` comes from `clip.viewBox`.

                                // So if we initialize `clip.viewBox` correctly, we might not need to scale the path data!
                                // If we set `clip.viewBox` to the UN-SCALED BBox dimensions (`0 0 bbox.width bbox.height`),
                                // then `sx` will be `(bbox.width*scale) / bbox.width` = `scale`.
                                // The player will automatically scale the content up!

                                // So:
                                // 1. `d` should be translated by `-bbox.x` (unscaled).
                                // 2. `clip.viewBox` should be `0 0 bbox.width bbox.height` (unscaled).
                                // 3. `MaskEditor` needs to handle this.
                                // MaskEditor uses `clip.width` (scaled) for its SVG viewBox?
                                // Line 373: `viewBox={`${imageSvgBounds.x} ${imageSvgBounds.y} ${imageSvgBounds.width} ${imageSvgBounds.height}`}
                                // `imageSvgBounds` is init from `clip.width` (scaled).
                                // So MaskEditor coordinate system IS scaled.

                                // If I use unscaled paths in MaskEditor, they will look tiny.
                                // So I MUST scale the paths for MaskEditor to work seamlessly, OR change MaskEditor to use unscaled viewBox.

                                // Changing MaskEditor to use unscaled viewBox seems cleaner but risky for other things?
                                // Actually, `clip.width/height` are physical dimensions on the canvas.
                                // The editing should arguably happen in "pixel-perfect" space or "content" space?

                                // Let's go with SCALING the paths in `template.ts`.
                                // I will add simple scaling to `translatePath` (making it `transformPath`).



                                // Try to calculate bounds from d? 
                                // Expensive. Let's assume it matches the BBox roughly or use what we have.
                                // For 'path' type, we don't have easy x,y,w,h without parsing.
                                // We'll just set them to 0,0, 100, 100 or leave undefined?
                                // MaskEditor needs them for handles.

                                const pb = getBBox(child); // This works if child is attached to DOM (it is via hiddenContainer)
                                if (pb) {
                                    shapeX = (pb.x - (bbox ? bbox.x : 0)) * scale;
                                    shapeY = (pb.y - (bbox ? bbox.y : 0)) * scale;
                                    shapeW = pb.width * scale;
                                    shapeH = pb.height * scale;
                                }

                                // We use the global scale factor for the path transformation
                                d = transformPath(rawD, -(bbox ? bbox.x * scale : 0), -(bbox ? bbox.y * scale : 0), scale, scale);

                                dataShapeType = 'path';
                            }

                            const attrs: any = {
                                type: shapeType,
                                "data-shape-type": dataShapeType,
                                x: shapeX,
                                y: shapeY,
                                width: shapeW,
                                height: shapeH,
                                d: d
                            };

                            Array.from(child.attributes).forEach(attr => {
                                // Don't overwrite our calculated relative coordinates with absolute ones
                                if (!['x', 'y', 'width', 'height', 'd', 'cx', 'cy', 'r', 'rx', 'ry'].includes(attr.name)) {
                                    attrs[attr.name] = attr.value;
                                }
                            });

                            // Ensure fill is defined (default white for mask visibility)
                            if (!attrs.fill) attrs.fill = 'white';
                            // Ensure id
                            if (!attrs.id) attrs.id = childId;

                            templateData[childId] = attrs;
                        });
                    }
                }

            }

            const clip: Clip = {
                id: uuidv4(),
                trackId: '',
                type: type as ResourceType,
                start: 0,
                duration: defaultDuration,
                name: item.id || data.id,
                src: src,
                text: textContent,
                fontFamily,
                fontSize,
                color: fill,
                x,
                y,
                width,
                height,
                viewBox: `0 0 ${width} ${height}`,
                rotation,
                opacity,
                mask,
                editor_move: item.editor_move === 'true',
                editor_scale: item.editor_scale === 'true',
                editor_rotate: item.editor_rotate === 'true',
                attr_rock: item.attr_rock === 'true',
                image_id: item.image_id,
                shapes_id: item.shapes_id,
                max_length: item.max_length ? parseInt(item.max_length, 10) : (type === 'text' ? 15 : undefined),
                mediaType: (type === 'mask' && element.querySelector('image')) ? 'image' : undefined,
                templateData: Object.keys(templateData).length > 0 ? templateData : undefined
            } as Clip;
            newClips.push(clip);
        });
    } finally {
        if (hiddenContainer.parentNode) {
            hiddenContainer.parentNode.removeChild(hiddenContainer);
        }
    }

    const initialTracks: Track[] = [
    ];

    newClips.forEach((clip, index) => {
        const trackId = `track-${index}`;
        clip.trackId = trackId;
        initialTracks.push({
            id: trackId,
            type: clip.type,
            clips: [clip]
        });
    });

    // Extract font list if available
    const fontList = jsonData['font-list'] || {};

    return {
        tracks: initialTracks,
        aspectRatio: ratio,
        currentTime: 0,
        fontList
    };
}
