
import { getStrokedBBox, getBBox } from './svg/utilities'
import { hasMatrixTransform, getMatrix, transformBox } from './svg/math'
import { config } from '../lib/config'
import type { Clip, Track, ResourceType } from '../store/useStore'

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
        return null;
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

    // Fix relative image paths in SVG
    const images = svgDoc.querySelectorAll('image');
    images.forEach(img => {
        const href = img.getAttribute('href') || img.getAttribute('xlink:href');
        if (href) {
            if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('/')) {
                const absoluteUrl = templateBaseUrl + href;
                img.setAttribute('href', absoluteUrl);
                if (img.hasAttribute('xlink:href')) {
                    img.setAttribute('xlink:href', absoluteUrl);
                }
            }
        }
    });

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
                type = 'image';
            } else {
                type = null;
            }
        } else if (nodeName === 'g' && item.image_id) {
            // Cropped Image Support (G tag acting as image wrapper)
            type = 'image';
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
            const tagName = element.tagName.toLowerCase();

            let x = 0, y = 0, width = 100, height = 100, rotation = 0, opacity = 1;
            let src = '';
            let fill: string | undefined;
            let textContent = '';
            let fontFamily = 'sans-serif';
            let fontSize = 24;
            let bboxString = rootFree;
            let crop: any = undefined;

            // Calculate BBox first
            let bbox: any;
            try {
                // Use getStrokedBBox for groups to include all children strokes
                if (tagName === 'g') {
                    bbox = getStrokedBBox([element], mockAddSVGElementsFromJson, mockPathActions);
                } else {
                    bbox = getBBox(element);
                }

                if (bbox) {
                    x = bbox.x * scale;
                    y = bbox.y * scale;
                    width = bbox.width * scale;
                    height = bbox.height * scale;
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

            // Parse Transform for rotation only (position is handled by bbox)
            const transform = element.getAttribute('transform');

            // Check for matrix transform and update bbox
            if (element instanceof SVGGraphicsElement && hasMatrixTransform(element.transform.baseVal)) {
                try {
                    const matrix = getMatrix(element as SVGGraphicsElement);
                    if (bbox) {
                        const tBox = transformBox(bbox.x, bbox.y, bbox.width, bbox.height, matrix);

                        // Update x, y, width, height with transformed values
                        x = tBox.aabox.x * scale;
                        y = tBox.aabox.y * scale;
                        width = tBox.aabox.width * scale;
                        height = tBox.aabox.height * scale;
                        bboxString = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
                    }
                } catch (e) {
                    console.warn("Failed to apply matrix transform", data.id, e);
                }
            }


            // Common Attributes
            opacity = parseFloat(element.getAttribute('opacity') || '1');

            if (type === 'text') {
                // Font size needs scaling but x/y are from bbox
                fontSize = (parseFloat(element.getAttribute('font-size') || '24')) * scale;
                fontFamily = element.getAttribute('font-family') || 'sans-serif';
                fill = element.getAttribute('fill') || '#000000';
                textContent = element.textContent || element.innerHTML || '';
            } else if (type === 'image') {
                // Default placeholder (transparent 1x1 pixel)
                src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

                // Default crop for all images (Full Image)
                crop = { x: 0, y: 0, width: 100, height: 100 };

                // SPECIAL HANDLING FOR CROPPED IMAGE (G tag with image_id)
                if (tagName === 'g' && item.image_id) {
                    const imageElement = element.querySelector(`image[image_id="${item.image_id}"]`) as SVGImageElement;

                    if (imageElement) {
                        let href = imageElement.getAttribute('href') || imageElement.getAttribute('xlink:href');

                        // Try to find image path from image-list using item.image.id
                        let imagePathFromList = '';
                        if (item.image && item.image.id && jsonData['image-list']) {
                            const targetImageId = item.image.id;
                            const imageList = jsonData['image-list'];
                            for (const [path, images] of Object.entries(imageList)) {
                                if (Array.isArray(images) && images.some((img: any) => img.id === targetImageId)) {
                                    imagePathFromList = path;
                                    break;
                                }
                            }
                        }

                        if (imagePathFromList) {
                            src = imagePathFromList;
                            if (src.startsWith('/template')) {
                                src = `${config.RESOURCE_BASE_PATH}${src}`;
                            }
                        } else if (href) {
                            if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('/')) {
                                href = templateBaseUrl + href;
                            }
                            src = href;
                        }



                        // --- Deep Search & Flatten Logic ---
                        // Replaced specific logic with generic transform flattening.
                        // 1. Clone element to temp SVG
                        // 2. Traverse clone, extract rotation from ALL transforms, sum them up.
                        // 3. Strip rotation from transforms (keep scale/translate).
                        // 4. Measure unrotated BBox -> width/height.
                        // 5. Calculate Center -> position (x,y).

                        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                        tempSvg.style.visibility = 'hidden';
                        tempSvg.style.position = 'absolute';
                        document.body.appendChild(tempSvg);

                        // Clone the entire Clip element (g.layer child)
                        const clone = element.cloneNode(true) as SVGGraphicsElement;
                        tempSvg.appendChild(clone);

                        let totalRotation = 0;

                        // Helper to process element and children recursively
                        const processNode = (node: SVGElement) => {
                            if (node instanceof SVGGraphicsElement) {
                                const transformAttr = node.getAttribute('transform');
                                if (transformAttr || hasMatrixTransform(node.transform?.baseVal)) {
                                    // Get matrix (using getMatrix helper which handles consolidation)
                                    // However, getMatrix works on live DOM with baseVal. 
                                    // Our clone is in tempSvg, so it should work.

                                    try {
                                        const matrix = getMatrix(node);

                                        // Extract Angle involved in this transform
                                        const angle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);

                                        if (angle !== 0) {
                                            totalRotation += angle;

                                            // Create Unrotated Matrix (Scale + Translate)
                                            // Remove rotation: M_new = M * R_inv? 
                                            // Simpler: Just extract scale and translation from M.
                                            // Assumption: No skew/shear.

                                            const sx = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
                                            const sy = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);

                                            // Apply stripped matrix
                                            node.setAttribute('transform', `matrix(${sx}, 0, 0, ${sy}, ${matrix.e}, ${matrix.f})`);
                                        }
                                    } catch (e) {
                                        console.warn("Failed to process transform", e);
                                    }
                                }
                            }
                            // Traverse children
                            for (let i = 0; i < node.children.length; i++) {
                                processNode(node.children[i] as SVGElement);
                            }
                        };

                        processNode(clone);

                        if (totalRotation !== 0) {
                            rotation = totalRotation;
                        }

                        // Measure Unrotated BBox
                        try {
                            const unrotatedBBox = clone.getBBox();

                            // Calculate Scale from the Root Clone's stripped matrix
                            const cloneMatrix = getMatrix(clone);
                            const rootSx = Math.sqrt(cloneMatrix.a * cloneMatrix.a + cloneMatrix.b * cloneMatrix.b);
                            const rootSy = Math.sqrt(cloneMatrix.c * cloneMatrix.c + cloneMatrix.d * cloneMatrix.d);

                            width = unrotatedBBox.width * rootSx * scale;
                            height = unrotatedBBox.height * rootSy * scale;

                            // Calculate Position
                            // We want the Editor Box Center to match the Visual Center of the Original SVG Element.

                            // Visual Center of Original SVG Element:
                            // 1. Clone original (with all transforms).
                            // 2. Measure its BBox (in local space).
                            // 3. Apply its Root Transform (to map center to global space).

                            const originalClone = element.cloneNode(true) as SVGGraphicsElement;
                            tempSvg.appendChild(originalClone);

                            const rootMatrix = getMatrix(originalClone);
                            const origBBox = originalClone.getBBox();

                            // Local Center (relative to element's coordinate system)
                            const origCx = origBBox.x + origBBox.width / 2;
                            const origCy = origBBox.y + origBBox.height / 2;

                            // Global Center (apply Root Transform)
                            const finalCx = rootMatrix.a * origCx + rootMatrix.c * origCy + rootMatrix.e;
                            const finalCy = rootMatrix.b * origCx + rootMatrix.d * origCy + rootMatrix.f;

                            // Align Editor Box Center
                            x = finalCx * scale - width / 2;
                            y = finalCy * scale - height / 2;

                            tempSvg.removeChild(originalClone);

                        } catch (e) {
                            console.warn("Failed to measure bbox", e);
                        } finally {
                            if (document.body.contains(tempSvg)) {
                                document.body.removeChild(tempSvg);
                            }
                        }

                        // END Deep Flatten Logic

                        // Mask Sizing Override: Ensure clip size matches the defs > * size (Mask)
                        const clipPathNode = element.querySelector('g[clip-path]');
                        const clipPathAttr = clipPathNode?.getAttribute('clip-path');

                        if (clipPathAttr) {
                            const clipPathId = clipPathAttr.replace(/url\(['"]?#([^'"]+)['"]?\)/, '$1');
                            const clipPathElement = element.querySelector(`#${clipPathId}`) || svgDoc.getElementById(clipPathId);
                            if (clipPathElement) {
                                let geometryNode: SVGGraphicsElement | null = null;

                                // Helper to resolve USE tags or find Geometry
                                const findGeometry = (node: Element): SVGGraphicsElement | null => {
                                    if (node.tagName.toLowerCase() === 'use') {
                                        const href = node.getAttribute('href') || node.getAttribute('xlink:href');
                                        if (href && href.startsWith('#')) {
                                            const target = element.querySelector(`#${href.substring(1)}`);
                                            if (target && target instanceof SVGGraphicsElement) {
                                                return target;
                                            }
                                        }
                                    } else if (['rect', 'path', 'polygon', 'circle', 'ellipse', 'line', 'polyline'].includes(node.tagName.toLowerCase()) && node instanceof SVGGraphicsElement) {
                                        return node;
                                    }
                                    return null;
                                }

                                for (const child of Array.from(clipPathElement.children)) {
                                    const geo = findGeometry(child);
                                    if (geo) {
                                        geometryNode = geo;
                                        break;
                                    }
                                }

                                if (geometryNode) {
                                    try {
                                        const tempSvgMask = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                        tempSvgMask.style.visibility = 'hidden';
                                        tempSvgMask.style.position = 'absolute';
                                        document.body.appendChild(tempSvgMask);

                                        const maskClone = document.importNode(geometryNode, true);
                                        tempSvgMask.appendChild(maskClone);

                                        // Measure Mask
                                        const maskBBox = maskClone.getBBox();

                                        // Measure Image (the element inside the G tag)
                                        // create a clone of imageElement to measure it in the same context
                                        const imageClone = document.importNode(imageElement, true);
                                        tempSvgMask.appendChild(imageClone);
                                        const imageBBox = imageClone.getBBox();


                                        // Calculate Scale/Position for the Clip (based on Mask)
                                        width = maskBBox.width * scale;
                                        height = maskBBox.height * scale;
                                        x = maskBBox.x * scale;
                                        y = maskBBox.y * scale;

                                        // Calculate Crop (Intersection relative to Image)
                                        // Crop values are percentages (0-100)
                                        if (imageBBox.width > 0 && imageBBox.height > 0) {
                                            crop = {
                                                x: ((maskBBox.x - imageBBox.x) / imageBBox.width) * 100,
                                                y: ((maskBBox.y - imageBBox.y) / imageBBox.height) * 100,
                                                width: (maskBBox.width / imageBBox.width) * 100,
                                                height: (maskBBox.height / imageBBox.height) * 100
                                            };
                                        }

                                        // Also update bboxString used for viewBox if needed, 
                                        // keeping it consistent with the visual area
                                        bboxString = `${maskBBox.x} ${maskBBox.y} ${maskBBox.width} ${maskBBox.height}`;

                                        document.body.removeChild(tempSvgMask);
                                    } catch (e) {
                                        console.warn("Failed to measure mask", e);
                                    }
                                }
                            }
                        }
                    } else {
                        // Standard Image Tag
                        let href = element.getAttribute('href') || element.getAttribute('xlink:href');
                        if (href) {
                            if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('/')) {
                                href = templateBaseUrl + href;
                            }
                            src = href;
                        }
                    }
                }
            } else if (type === 'icon' || type === 'shape') {
                if (type === 'shape') {
                    fill = element.getAttribute('fill') || '#000000';

                    // Find fill from shapes_id element
                    const shapesId = item.shapes_id;
                    if (shapesId) {
                        const shapeElement = svgDoc.getElementById(shapesId);
                        if (shapeElement) {
                            const shapeFill = shapeElement.getAttribute('fill');
                            if (shapeFill) {
                                fill = shapeFill;
                            }
                        }
                    }
                }

                const serialized = new XMLSerializer().serializeToString(element);
                const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${bboxString}'>${defsString}${serialized}</svg>`;
                src = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
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
                rotation,
                opacity,
                crop, // Add crop to clip
                templateData: { [data.id]: item },
                // Editor attributes
                editor_move: item.editor_move === 'true',
                editor_scale: item.editor_scale === 'true',
                editor_rotate: item.editor_rotate === 'true',
                attr_rock: item.attr_rock === 'true',
                image_id: item.image_id,
                shapes_id: item.shapes_id,
                max_length: item.max_length ? parseInt(item.max_length, 10) : undefined
            };
            newClips.push(clip);
        });
    } finally {
        // Clean up DOM
        if (hiddenContainer.parentNode) {
            hiddenContainer.parentNode.removeChild(hiddenContainer);
        }
    }

    // Create tracks
    const initialTracks: Track[] = [
        { id: 'audio-1', type: 'audio', clips: [] },
        { id: 'video-1', type: 'video', clips: [] }
    ];

    // Assign to tracks
    newClips.forEach((clip, index) => {
        const trackId = `track-${index}`;
        clip.trackId = trackId;
        initialTracks.push({
            id: trackId,
            type: clip.type === 'text' ? 'text' : 'shape',
            clips: [clip]
        });
    });

    return {
        tracks: initialTracks,
        aspectRatio: ratio,
        currentTime: 0
    };
}
