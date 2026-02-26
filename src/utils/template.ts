
import { getStrokedBBox, getBBox } from './svg/utilities'
import { hasNonIdentityTransform, getMatrix, deltaTransformPoint, transformBox } from './svg/math'
import { urlToDataURL } from './dataUrl'
import { loadFont } from './fonts'
import type { Clip, Track, ResourceType } from '../features/editor/store/useStore'
import { transformPath, matrixTransformPath, getBoundsFromPathD } from './svg/pathUtils'
import { getRectPath, getEllipsePath, getTrianglePath, getStarPath, getPolygonPath } from '../features/editor/utils/shapeUtils'

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
    projectWidth: number
    projectHeight: number
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

    let ratio = 1920 / 1080;
    let expectedSvgWidth = 1920;
    let expectedSvgHeight = 1080;

    if (template.category === 'F') {
        ratio = 1920 / 1080;
        expectedSvgWidth = 1920;
        expectedSvgHeight = 1080;
    } else if (template.category === 'S') {
        ratio = 356 / 837;
        expectedSvgWidth = 356;
        expectedSvgHeight = 837;
    } else if (template.category === 'T') {
        ratio = 1864 / 90;
        expectedSvgWidth = 1864;
        expectedSvgHeight = 90;
    }

    // Extract SVG dimensions to calculate scale factor
    const rootElement = svgDoc.documentElement;
    const parsedSvgWidth = expectedSvgWidth;
    const parsedSvgHeight = expectedSvgHeight;

    // Force aspect ratio to the category's expected ratio.
    ratio = expectedSvgWidth / expectedSvgHeight;

    // Use native bounds instead of forcing 1920 
    const projectWidth = expectedSvgWidth;
    const projectHeight = expectedSvgHeight;
    const scale = 1;

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

    const rootFree = svgDoc.documentElement.getAttribute('viewBox') || `0 0 ${parsedSvgWidth} ${parsedSvgHeight}`;

    // Extract font list if available and create a reverse mapping (fontMap)
    const fontList = jsonData['font-list'] || {};
    const fontMap: Record<string, string> = {}; // clip ID -> font family
    
    Object.entries(fontList).forEach(([fontFamily, clipIds]) => {
        if (Array.isArray(clipIds)) {
            clipIds.forEach((clipId: string) => {
                fontMap[clipId] = fontFamily;
            });
        }
    });

    // Extract image list if available and create a reverse mapping (imageMap)
    const imageList = jsonData['image-list'] || {};
    const imageMap: Record<string, string> = {}; // clip ID -> image URL
    Object.entries(imageList).forEach(([url, clipIds]) => {
        if (Array.isArray(clipIds)) {
            clipIds.forEach((clipId: string) => {
                imageMap[clipId] = url;
            });
        }
    });

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

        // Infer image_id from image-list if present but omitted in item
        if (imageMap[key] && !item.image_id) {
            item.image_id = key;
        }

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

    // BBox 계산을 위해 SVG를 DOM에 삽입 (화면 밖, 레이아웃 미영향)
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.position = 'fixed';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.top = '0';
    hiddenContainer.style.width = `${projectWidth}px`;
    hiddenContainer.style.height = `${projectHeight}px`;
    hiddenContainer.style.overflow = 'hidden';
    hiddenContainer.style.visibility = 'hidden';
    hiddenContainer.style.pointerEvents = 'none';
    hiddenContainer.appendChild(rootElement);
    document.body.appendChild(hiddenContainer);

    // 이미지/폰트 완전 로드 대기 — getBBox 정확도를 위해 필수
    // SVG 내 <image> 요소가 로드되지 않은 상태에서 getBBox를 호출하면 좌표값이 부정확함
    const svgImages = rootElement.querySelectorAll('image');
    if (svgImages.length > 0) {
        const imageLoadPromises = Array.from(svgImages).map(img => {
            return new Promise<void>((resolve) => {
                const href = img.getAttribute('href') || img.getAttribute('xlink:href');
                // data: URL이나 이미 로드된 이미지는 바로 resolve
                if (!href || href.startsWith('data:')) {
                    resolve();
                    return;
                }
                // 이미 로드 완료된 이미지 체크 (naturalWidth/Height 사용 불가 — SVGImageElement이므로)
                // load/error 이벤트로 대기
                const onDone = () => resolve();
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
                // 타임아웃 — 최대 3초 대기 후 강제 진행
                setTimeout(onDone, 3000);
            });
        });
        await Promise.all(imageLoadPromises);
    }

    // 폰트 로드 — 텍스트 getBBox 정확도를 위해 getBBox 호출 전에 반드시 실행
    // fontList는 이미 위에서 jsonData['font-list']로 추출됨
    const fontFamilies = Object.keys(fontList);
    if (fontFamilies.length > 0) {
        const fontMapList = fontFamilies.map(family => ({
            family,
            url: `/assets/font/${family}.woff`
        }));
        try {
            await loadFont(fontMapList);
            // document.fonts.ready 대기 — 모든 폰트 렌더링 준비 완료 보장
            await document.fonts.ready;
        } catch (err) {
            console.warn('[template.ts] Font pre-loading failed, proceeding with fallback:', err);
        }
    }

    // 레이아웃 완료를 위해 한 프레임 대기
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

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

            // Set fill="none" for paths that don't have a fill attribute
            // Because if an element is a path and has no fill, it should not default to black
            elementsToFlatten.forEach(ele => {
                if (ele.nodeName.toLowerCase() === 'path' && !ele.hasAttribute('fill')) {
                    ele.setAttribute('fill', 'none');
                }
            });

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
                if (['g', 'line', 'path', 'polyline', 'polygon', 'rect', 'circle', 'ellipse'].includes(tagName)) {
                    bbox = getStrokedBBox([element], mockAddSVGElementsFromJson, mockPathActions);
                } else {
                    bbox = getBBox(element as unknown as SVGGraphicsElement);
                }

                if (bbox) {
                    width = Math.max(bbox.width * scale, 1);
                    height = Math.max(bbox.height * scale, 1);

                    // For images, browsers sometimes return smaller bbox values or 0 when not fully loaded.
                    // Prioritize explicit attributes if they exist.
                    const explicitWidth = parseFloat(element.getAttribute('width') || '0');
                    const explicitHeight = parseFloat(element.getAttribute('height') || '0');
                    if (tagName === 'image' && explicitWidth > 0 && explicitHeight > 0) {
                        width = explicitWidth * scale;
                        height = explicitHeight * scale;
                    }

                    if (visualCx) {
                        x = visualCx * scale - width / 2;
                        y = visualCy * scale - height / 2;
                    } else {
                        const explicitX = parseFloat(element.getAttribute('x') || '0');
                        const explicitY = parseFloat(element.getAttribute('y') || '0');
                        x = (tagName === 'image' && (explicitX || explicitY)) ? explicitX * scale : bbox.x * scale;
                        y = (tagName === 'image' && (explicitX || explicitY)) ? explicitY * scale : bbox.y * scale;
                    }

                    bboxString = `${bbox.x} ${bbox.y} ${Math.max(bbox.width, 1)} ${Math.max(bbox.height, 1)}`;
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
                // Assign font family from fontMap first, fallback to element attribute, then default
                fontFamily = fontMap[item.id || data.id] || element.getAttribute('font-family') || '';
                if (!fontFamily || fontFamily === 'sans-serif' || fontFamily === 'sans' || fontFamily === '') {
                    fontFamily = 'GmarketSansTTFBold';
                }

                // Track font for loading
                if (!fontList[fontFamily]) {
                    fontList[fontFamily] = [];
                }
                const trackId = item.id || data.id;
                if (!fontList[fontFamily].includes(trackId)) {
                    fontList[fontFamily].push(trackId);
                }

                fill = element.getAttribute('fill') || '#000000';
                textContent = element.textContent || element.innerHTML || '';
            } else if (type === 'icon' || type === 'shape' || type === 'mask') {
                if (type === 'shape') {
                    const rawFill = element.getAttribute('fill');
                    const rawStroke = element.getAttribute('stroke');
                    
                    if (!rawFill && rawStroke && rawStroke !== 'none') {
                        fill = 'none';
                    } else {
                        fill = rawFill || '#000000';
                    }

                    const shapesId = item.shapes_id;
                    if (shapesId) {
                        const shapeElement = element.querySelector(`#${shapesId}`);
                        if (shapeElement) {
                            const rawShapeFill = shapeElement.getAttribute('fill');
                            const rawShapeStroke = shapeElement.getAttribute('stroke');
                            
                            if (!rawShapeFill && rawShapeStroke && rawShapeStroke !== 'none') {
                                fill = 'none';
                            } else if (rawShapeFill) {
                                fill = rawShapeFill;
                            }
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

                const style = element.getAttribute('style') || '';
                let clipPathId = element.querySelector('[clip-path]')?.getAttribute('clip-path');

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
                    const shapeId = element.querySelector(`#${clipPathId} > use`)?.getAttribute('xlink:href')?.replace('#', '');
                    if (shapeId) {
                        const shapeElement = element.querySelector(`#${shapeId}`);
                        if(shapeElement){
                            // Skip text nodes or non-element nodes
                            if (shapeElement.nodeType !== 1) return;

                            const shapeType = shapeElement.tagName.toLowerCase();

                            // Default BBox for normalization
                            // We use the clip's calculated BBox (x, y) as the origin
                            const originX = bbox ? (bbox.x * scale) : 0;
                            const originY = bbox ? (bbox.y * scale) : 0;

                            let shapeX = 0;
                            let shapeY = 0;
                            let shapeW = 0;
                            let shapeH = 0;
                            let d = '';
                            let dataShapeType = 'rect';

                            // Check for transform on the shape element
                            let shapeMatrix: SVGMatrix | null = null;
                            if (shapeElement instanceof SVGGraphicsElement && hasNonIdentityTransform(shapeElement.transform.baseVal)) {
                                shapeMatrix = getMatrix(shapeElement);
                            }

                            // Initialize variable to track sides for polygons
                            let sides: number | undefined;

                            if (shapeType === 'rect') {
                                const rx = parseFloat(shapeElement.getAttribute('x') || '0') * scale;
                                const ry = parseFloat(shapeElement.getAttribute('y') || '0') * scale;
                                shapeW = parseFloat(shapeElement.getAttribute('width') || '0') * scale;
                                shapeH = parseFloat(shapeElement.getAttribute('height') || '0') * scale;
                                const rRadiusX = parseFloat(shapeElement.getAttribute('rx') || '0') * scale;
                                const rRadiusY = parseFloat(shapeElement.getAttribute('ry') || '0') * scale;

                                shapeX = rx - originX;
                                shapeY = ry - originY;

                                d = getRectPath(shapeX, shapeY, shapeW, shapeH, rRadiusX, rRadiusY);
                                dataShapeType = 'rect';
                            } else if (shapeType === 'circle') {
                                const cx = parseFloat(shapeElement.getAttribute('cx') || '0') * scale;
                                const cy = parseFloat(shapeElement.getAttribute('cy') || '0') * scale;
                                const r = parseFloat(shapeElement.getAttribute('r') || '0') * scale;

                                shapeW = r * 2;
                                shapeH = r * 2;
                                shapeX = (cx - r) - originX;
                                shapeY = (cy - r) - originY;

                                d = getEllipsePath(shapeX, shapeY, shapeW, shapeH);
                                dataShapeType = 'circle';
                            } else if (shapeType === 'ellipse') {
                                const cx = parseFloat(shapeElement.getAttribute('cx') || '0') * scale;
                                const cy = parseFloat(shapeElement.getAttribute('cy') || '0') * scale;
                                const rx = parseFloat(shapeElement.getAttribute('rx') || '0') * scale;
                                const ry = parseFloat(shapeElement.getAttribute('ry') || '0') * scale;

                                shapeW = rx * 2;
                                shapeH = ry * 2;
                                shapeX = (cx - rx) - originX;
                                shapeY = (cy - ry) - originY;

                                d = getEllipsePath(shapeX, shapeY, shapeW, shapeH);
                                dataShapeType = 'circle'; // Use circle editor for ellipses too
                            } else if(shapeType==='polygon'){
                                const points = shapeElement.getAttribute('points') || '';
                                const pb = getBBox(shapeElement);
                                if (pb) {
                                    shapeX = (pb.x - (bbox ? bbox.x : 0)) * scale;
                                    shapeY = (pb.y - (bbox ? bbox.y : 0)) * scale;
                                    shapeW = pb.width * scale;
                                    shapeH = pb.height * scale;
                                }
                                const ptsArr = points.trim().split(/[\s,]+/).filter(Boolean).map(n => parseFloat(n));
                                sides = ptsArr.length / 2;
                                
                                let builtD = '';
                                for(let k=0; k<ptsArr.length; k+=2) {
                                    const rawX = ptsArr[k];
                                    const rawY = ptsArr[k+1];
                                    // Transform to relative coordinates based on clip bbox
                                    const finalX = (rawX - (bbox ? bbox.x : 0)) * scale;
                                    const finalY = (rawY - (bbox ? bbox.y : 0)) * scale;
                                    builtD += (k===0 ? `M ${finalX} ${finalY}` : ` L ${finalX} ${finalY}`);
                                }
                                builtD += ' Z';
                                d = builtD;
                                
                                dataShapeType = 'polygon';
                            }else if(shapeType==='path') {
                                const rawD = shapeElement.getAttribute('d') || '';

                                console.log('rawD', rawD);
                                
                                // We use the global scale factor for the path transformation
                                d = transformPath(rawD, -(bbox ? bbox.x * scale : 0), -(bbox ? bbox.y * scale : 0), scale, scale);
                                console.log('d', d);
                                // Update BBox (x, y, w, h) from the final d
                                // This ensures that the x,y attributes exactly match the path's position.
                                const bounds = getBoundsFromPathD(d);
                                console.log('bounds', bounds);
                                shapeX = bounds.x;
                                shapeY = bounds.y;
                                shapeW = bounds.width;
                                shapeH = bounds.height;

                                dataShapeType = 'path';
                            }

                            // Apply matrix transform if exists
                            if (shapeMatrix) {
                                // 1. Updates d with matrix
                                // Note: our d is already scaled and relative to validClips origin (kind of).
                                // Wait, the d calculation above used `scale` and subtract `originX/Y`.
                                // Transform on the element applies to the raw coordinates BEFORE we processed them.
                                // But our process above 'baked' the scale and translation relative to the parent image BBox.
                                
                                // The `shapeMatrix` is in the SVG coordinate space (before our Manual Scale/Translate logic).
                                // So we should apply the matrix to the raw path first, THEN scale/center relative to parent?
                                // OR apply the matrix to our processed path but need to adjust the matrix.
                                
                                // Better approach:
                                // Parse raw D/rect/circle in SVG coords.
                                // Apply the shapeMatrix (SVG coords -> Transformed SVG coords).
                                // THEN Apply the "Project Scale" (scale) and "Parent Offset" (-bbox.x, -bbox.y).
                                
                                // Let's reconstruct the process for transformed elements.
                                
                                // Get Initial Path Data (Raw)
                                let rawD = '';
                                if (shapeType === 'rect') {
                                    const rx = parseFloat(shapeElement.getAttribute('x') || '0');
                                    const ry = parseFloat(shapeElement.getAttribute('y') || '0');
                                    const w = parseFloat(shapeElement.getAttribute('width') || '0');
                                    const h = parseFloat(shapeElement.getAttribute('height') || '0');
                                    const rRx = parseFloat(shapeElement.getAttribute('rx') || '0');
                                    const rRy = parseFloat(shapeElement.getAttribute('ry') || '0');
                                    rawD = getRectPath(rx, ry, w, h, rRx, rRy);
                                } else if (shapeType === 'circle' || shapeType === 'ellipse') {
                                    // ... similar raw fetch
                                     const cx = parseFloat(shapeElement.getAttribute('cx') || '0');
                                    const cy = parseFloat(shapeElement.getAttribute('y') || '0');
                                    let rx = 0, ry = 0;
                                    if(shapeType === 'circle') {
                                        const r = parseFloat(shapeElement.getAttribute('r') || '0');
                                        rx = r; ry = r;
                                    } else {
                                        rx = parseFloat(shapeElement.getAttribute('rx') || '0');
                                        ry = parseFloat(shapeElement.getAttribute('ry') || '0');
                                    }
                                    rawD = getEllipsePath(cx - rx, cy - ry, rx * 2, ry * 2);
                                } else if (shapeType === 'polygon') {
                                    const points = shapeElement.getAttribute('points') || '';
                                    const ptsArr = points.trim().split(/[\s,]+/).filter(Boolean).map(n => parseFloat(n));
                                    let builtD = '';
                                    for(let k=0; k<ptsArr.length; k+=2) {
                                        builtD += (k===0 ? `M ${ptsArr[k]} ${ptsArr[k+1]}` : ` L ${ptsArr[k]} ${ptsArr[k+1]}`);
                                    }
                                    builtD += ' Z';
                                    rawD = builtD;
                                } else if (shapeType === 'path') {
                                    rawD = shapeElement.getAttribute('d') || '';
                                }
                                if (rawD) {
                                    // 1. Apply Element Transform (Rotation, Skew, input Translate)
                                    // shapeMatrix corresponds to this.
                                    const transformedRawD = matrixTransformPath(rawD, shapeMatrix);
                                    
                                    // 2. Apply Project Scale and Parent Offset
                                    // originX/Y are already scaled.
                                    // We need to translate by (-bbox.x, -bbox.y) then scale by (scale).
                                    // Actually, standard transformPath does: val * s + d.
                                    // So we want: (val - bbox.x) * scale.
                                    // This is equivalent to: val * scale - bbox.x * scale.
                                    
                                    // So use transformPath with:
                                    // dx = -(bbox.x * scale)
                                    // dy = -(bbox.y * scale)
                                    // sx = scale
                                    // sy = scale
                                    
                                    d = transformPath(transformedRawD, -originX, -originY, scale, scale);
                                    
                                    // 3. Update BBox (x, y, w, h) from the final d
                                    // This ensures that the x,y attributes exactly match the path's position.
                                    const bounds = getBoundsFromPathD(d);
                                    shapeX = bounds.x;
                                    shapeY = bounds.y;
                                    shapeW = bounds.width;
                                    shapeH = bounds.height;
                                    
                                    // Since it's transformed, force type to 'path' (or polygon if simple)
                                    // 'path' is safest.
                                    dataShapeType = 'path';
                                }
                            }


                            const attrs: any = {
                                type: shapeType,
                                "data-shape-type": dataShapeType,
                                x: shapeX,
                                y: shapeY,
                                width: shapeW,
                                height: shapeH,
                                d: d,
                                sides: sides
                            };

                            Array.from(shapeElement.attributes).forEach(attr => {
                                // Don't overwrite our calculated relative coordinates with absolute ones
                                if (!['x', 'y', 'width', 'height', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'transform'].includes(attr.name)) {
                                    attrs[attr.name] = attr.value;
                                }
                            });

                            // Ensure fill is defined (default white for mask visibility)
                            if (!attrs.fill) attrs.fill = 'white';
                            // Ensure id
                            if (!attrs.id) attrs.id = shapeId;

                            templateData[shapeId] = attrs;
                        }
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

    return {
        tracks: initialTracks,
        aspectRatio: ratio,
        currentTime: 0,
        fontList,
        projectWidth,
        projectHeight
    };
}
