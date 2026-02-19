import React, { useRef, useEffect, useState } from 'react';
import { useStore, type Clip } from '@/features/editor/store/useStore';
import { getTextDimensions } from '@/utils/text';

interface TransformControlsProps {
    clip: Clip;
    projectWidth: number;
    projectHeight: number;
    svgRef: React.RefObject<SVGSVGElement | null>;
}

type TransformMode = 'move' | 'rotate' | 'scale-n' | 'scale-s' | 'scale-e' | 'scale-w' | 'scale-nw' | 'scale-ne' | 'scale-sw' | 'scale-se' | null;

export function TransformControls({ clip, projectWidth, projectHeight, svgRef }: TransformControlsProps) {
    const { updateClip } = useStore();
    const [mode, setMode] = useState<TransformMode>(null);
    const startRef = useRef<{
        mouseX: number;
        mouseY: number;
        clipX: number;
        clipY: number;
        clipW: number;
        clipH: number;
        clipR: number;
        clipFontSize?: number;
    } | null>(null);

    const getSVGPoint = (e: MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM()?.inverse());
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!mode || !startRef.current || !svgRef.current) return;

            const pt = getSVGPoint(e);
            const start = startRef.current;
            const dx = pt.x - start.mouseX;
            const dy = pt.y - start.mouseY;

            if (mode === 'move') {
                updateClip(clip.id, {
                    x: start.clipX + dx,
                    y: start.clipY + dy
                });
            } else if (mode === 'rotate') {
                const centerX = clip.x! + clip.width! / 2;
                const centerY = clip.y! + clip.height! / 2;
                const angle = Math.atan2(pt.y - centerY, pt.x - centerX) * (180 / Math.PI);
                updateClip(clip.id, { rotation: angle + 90 });
            } else if (mode.startsWith('scale')) {
                let newX = start.clipX;
                let newY = start.clipY;
                let newW = start.clipW;
                let newH = start.clipH;

                if (mode.includes('e')) newW = Math.max(10, start.clipW + dx);
                if (mode.includes('s')) newH = Math.max(10, start.clipH + dy);
                if (mode.includes('w')) {
                    const delta = Math.min(dx, start.clipW - 10);
                    newX = start.clipX + delta;
                    newW = start.clipW - delta;
                }
                if (mode.includes('n')) {
                    const delta = Math.min(dy, start.clipH - 10);
                    newY = start.clipY + delta;
                    newH = start.clipH - delta;
                }

                // For text clips, update fontSize instead of width/height
                if (clip.type === 'text') {
                    const originalFontSize = start.clipFontSize || 120;
                    const scaleRatio = Math.max(newW / start.clipW, newH / start.clipH);
                    const newFontSize = Math.max(10, originalFontSize * scaleRatio);
                    updateClip(clip.id, { fontSize: newFontSize });
                } else {
                    updateClip(clip.id, { x: newX, y: newY, width: newW, height: newH });
                }
            }
        };

        const handleMouseUp = () => {
            setMode(null);
            startRef.current = null;
        };

        if (mode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [mode, clip, updateClip, svgRef]);

    const handleMouseDown = (e: React.MouseEvent, m: TransformMode) => {
        // Check permissions
        if (m === 'move' && clip.editor_move === false) return;
        if (m === 'rotate' && clip.editor_rotate === false) return;
        if (m?.startsWith('scale') && clip.editor_scale === false) return;

        e.stopPropagation();
        e.preventDefault();
        const pt = getSVGPoint(e.nativeEvent);
        // Calculate current dimensions for startRef
        let currentW: number;
        let currentH: number;
        if (clip.type === 'text') {
            const dims = getTextDimensions(clip);
            currentW = dims.width;
            currentH = dims.height;
        } else {
            currentW = clip.width || (projectWidth / 4);
            currentH = clip.height || (projectHeight / 4);
        }

        startRef.current = {
            mouseX: pt.x,
            mouseY: pt.y,
            clipX: clip.x || 0,
            clipY: clip.y || 0,
            clipW: currentW,
            clipH: currentH,
            clipR: clip.rotation || 0,
            clipFontSize: clip.type === 'text' ? (clip.fontSize || 120) : undefined
        };
        setMode(m);
    };


    const x = clip.x || 0;
    const y = clip.y || 0;

    // Calculate dimensions based on clip type
    let baseW: number;
    let baseH: number;

    if (clip.type === 'text') {
        const dims = getTextDimensions(clip);
        baseW = dims.width;
        baseH = dims.height;
    } else {
        baseW = clip.width || (projectWidth / 4);
        baseH = clip.height || (projectHeight / 4);
    }

    // Apply mask/crop to visual bounds
    let maskX = 0;
    let maskY = 0;
    let maskW = 100;
    let maskH = 100;

    if (clip.mask) {
        maskX = clip.mask.x;
        maskY = clip.mask.y;
        maskW = clip.mask.width;
        maskH = clip.mask.height;
    }

    const visualX = x + (baseW * maskX / 100);
    const visualY = y + (baseH * maskY / 100);
    const visualW = baseW * (maskW / 100);
    const visualH = baseH * (maskH / 100);

    const r = clip.rotation || 0;

    // For rendering, we use visual bounds, but rotation pivot remains at clip center
    // However, the group transform rotates around the CLIP center (x + baseW/2, y + baseH/2)
    // So we just need to draw the rect relative to x,y in that local space.

    // In local space of the group (origin at project 0,0 but rotated around pivot):
    // The rect should be drawn at the visual coordinates.
    // Since the group transform handles the rotation around the pivot, 
    // we just need to provide the coordinates relative to the project origin.

    const displayX = visualX;
    const displayY = visualY;
    const w = visualW;
    const h = visualH;

    const handleSize = 12;
    const halfHandle = handleSize / 2;

    // Scaling factors for logic
    const scaleFactorX = maskW / 100;
    const scaleFactorY = maskH / 100;

    // Override calculate logic for mouse move
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!mode || !startRef.current || !svgRef.current) return;

            const pt = getSVGPoint(e);
            const start = startRef.current;
            const dx = pt.x - start.mouseX;
            const dy = pt.y - start.mouseY;

            if (mode === 'move') {
                updateClip(clip.id, {
                    x: start.clipX + dx,
                    y: start.clipY + dy
                });
            } else if (mode === 'rotate') {
                const centerX = clip.x! + (clip.width! || (projectWidth / 4)) / 2;
                const centerY = clip.y! + (clip.height! || (projectHeight / 4)) / 2;

                // For text, we calculate center differently if needed, but standard logic uses x/y/w/h
                // Because we don't have per-frame update of w/h in startRef for rotation pivot, 
                // we use current clip props which is fine.

                const angle = Math.atan2(pt.y - centerY, pt.x - centerX) * (180 / Math.PI);
                updateClip(clip.id, { rotation: angle + 90 });
            } else if (mode.startsWith('scale')) {
                // Apply scale factor compensation for masked clips
                const effDx = dx / scaleFactorX;
                const effDy = dy / scaleFactorY;

                let newX = start.clipX;
                let newY = start.clipY;
                let newW = start.clipW;
                let newH = start.clipH;

                if (mode.includes('e')) newW = Math.max(10, start.clipW + effDx);
                if (mode.includes('s')) newH = Math.max(10, start.clipH + effDy);
                if (mode.includes('w')) {
                    const delta = Math.min(effDx, start.clipW - 10);
                    newX = start.clipX + delta;
                    newW = start.clipW - delta;
                }
                if (mode.includes('n')) {
                    const delta = Math.min(effDy, start.clipH - 10);
                    newY = start.clipY + delta;
                    newH = start.clipH - delta;
                }

                // For text clips, update fontSize instead of width/height
                if (clip.type === 'text') {
                    const originalFontSize = start.clipFontSize || 120;
                    const scaleRatio = Math.max(newW / start.clipW, newH / start.clipH);
                    const newFontSize = Math.max(10, originalFontSize * scaleRatio);
                    updateClip(clip.id, { fontSize: newFontSize });
                } else {
                    updateClip(clip.id, { x: newX, y: newY, width: newW, height: newH });
                }
            }
        };

        const handleMouseUp = () => {
            setMode(null);
            startRef.current = null;
        };

        if (mode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [mode, clip, updateClip, svgRef, projectWidth, projectHeight, scaleFactorX, scaleFactorY]);


    const renderHandle = (cx: number, cy: number, m: TransformMode, cursor: string, color: string = "#00d9ff") => (
        <rect
            x={cx - halfHandle}
            y={cy - halfHandle}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke={color}
            strokeWidth={3}
            style={{ cursor }}
            onMouseDown={(e) => handleMouseDown(e, m)}
        />
    );

    // Pivot for rotation is always the CLIP center, regardless of mask
    const pivotX = x + baseW / 2;
    const pivotY = y + baseH / 2;

    const isLocked = clip.editor_move === false && clip.editor_scale === false && clip.editor_rotate === false;
    const controlColor = isLocked ? "#888888" : "#00d9ff";

    return (
        <g className="transform-controls-layer" transform={`rotate(${r}, ${pivotX}, ${pivotY})`}>
            {/* Selection Border */}
            {clip.type === 'mask' && clip.templateData && Object.keys(clip.templateData).length > 0 ? (
                (() => {
                    // Extract viewBox for mask coordinate system
                    let vbx = 0, vby = 0, vbw = 100, vbh = 100;
                    if (clip.viewBox) {
                        const parts = clip.viewBox.split(/[ ,]+/).filter(Boolean).map(Number);
                        if (parts.length === 4) {
                            [vbx, vby, vbw, vbh] = parts;
                        }
                    }

                    const safeVbw = vbw === 0 ? 100 : vbw;
                    const safeVbh = vbh === 0 ? 100 : vbh;
                    const maskSx = w / safeVbw;
                    const maskSy = h / safeVbh;

                    return (
                        <g transform={`translate(${displayX}, ${displayY}) scale(${maskSx}, ${maskSy}) translate(${-vbx}, ${-vby})`}>
                            {Object.entries(clip.templateData).map(([id, data]: [string, any]) => (
                                <path
                                    key={id}
                                    d={data.d}
                                    fill="transparent"
                                    stroke={controlColor}
                                    strokeWidth={3 / Math.max(maskSx, maskSy)}
                                    vectorEffect="non-scaling-stroke"
                                    className={clip.editor_move !== false ? "cursor-move" : ""}
                                    onMouseDown={(e) => clip.editor_move !== false && handleMouseDown(e, 'move')}
                                    style={{ pointerEvents: 'auto' }}
                                />
                            ))}
                        </g>
                    );
                })()
            ) : (
                <rect
                    x={displayX}
                    y={displayY}
                    width={w}
                    height={h}
                    fill="transparent"
                    stroke={controlColor}
                    strokeWidth={3}
                    className={clip.editor_move !== false ? "cursor-move" : ""}
                    onMouseDown={(e) => clip.editor_move !== false && handleMouseDown(e, 'move')}
                />
            )}

            {/* Scale Handles - Only for non-text clips or as desired */}
            {clip.editor_scale !== false && clip.type !== 'text' && (
                <>
                    {/* Corner Handles */}
                    {renderHandle(displayX, displayY, 'scale-nw', 'nwse-resize', controlColor)}
                    {renderHandle(displayX + w, displayY, 'scale-ne', 'nesw-resize', controlColor)}
                    {renderHandle(displayX, displayY + h, 'scale-sw', 'nesw-resize', controlColor)}
                    {renderHandle(displayX + w, displayY + h, 'scale-se', 'nwse-resize', controlColor)}

                    {/* Edge Handles */}
                    {renderHandle(displayX + w / 2, displayY, 'scale-n', 'ns-resize', controlColor)}
                    {renderHandle(displayX + w / 2, displayY + h, 'scale-s', 'ns-resize', controlColor)}
                    {renderHandle(displayX, displayY + h / 2, 'scale-w', 'ew-resize', controlColor)}
                    {renderHandle(displayX + w, displayY + h / 2, 'scale-e', 'ew-resize', controlColor)}
                </>
            )}

            {/* Text simple handles if needed, or re-use above with 'text' check */}
            {clip.editor_scale !== false && clip.type === 'text' && (
                <>
                    {renderHandle(displayX, displayY, 'scale-nw', 'nwse-resize', controlColor)}
                    {renderHandle(displayX + w, displayY, 'scale-ne', 'nesw-resize', controlColor)}
                    {renderHandle(displayX, displayY + h, 'scale-sw', 'nesw-resize', controlColor)}
                    {renderHandle(displayX + w, displayY + h, 'scale-se', 'nwse-resize', controlColor)}
                </>
            )}

            {/* Rotation Handle */}
            {clip.editor_rotate !== false && (
                <>
                    <line
                        x1={displayX + w / 2}
                        y1={displayY}
                        x2={displayX + w / 2}
                        y2={displayY - 30}
                        stroke={controlColor}
                        strokeWidth={3}
                    />
                    <circle
                        cx={displayX + w / 2}
                        cy={displayY - 30}
                        r={handleSize / 2 + 2}
                        fill="white"
                        stroke={controlColor}
                        strokeWidth={3}
                        style={{ cursor: 'alias' }}
                        onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                    />
                </>
            )}
        </g>
    );
}
