import React, { useRef, useEffect, useState } from 'react';
import { useStore, type Clip } from '@/store/useStore';
import { getTextDimensions } from '@/utils/textUtils';

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

    const r = clip.rotation || 0;

    const w = baseW;
    const h = baseH;
    const displayX = x;
    const displayY = y;

    const handleSize = 12;
    const halfHandle = handleSize / 2;

    const renderHandle = (cx: number, cy: number, m: TransformMode, cursor: string) => (
        <rect
            x={cx - halfHandle}
            y={cy - halfHandle}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#00d9ff"
            strokeWidth={3}
            style={{ cursor }}
            onMouseDown={(e) => handleMouseDown(e, m)}
        />
    );

    return (
        <g className="transform-controls-layer" transform={`rotate(${r}, ${displayX + w / 2}, ${displayY + h / 2})`}>
            {/* Selection Border */}
            <rect
                x={displayX}
                y={displayY}
                width={w}
                height={h}
                fill="transparent"
                stroke="#00d9ff"
                strokeWidth={3}
                className="cursor-move"
                onMouseDown={(e) => handleMouseDown(e, 'move')}
            />

            {/* Scale Handles - Only for non-text clips */}
            {clip.type !== 'text' && (
                <>
                    {/* Corner Handles */}
                    {renderHandle(displayX, displayY, 'scale-nw', 'nwse-resize')}
                    {renderHandle(displayX + w, displayY, 'scale-ne', 'nesw-resize')}
                    {renderHandle(displayX, displayY + h, 'scale-sw', 'nesw-resize')}
                    {renderHandle(displayX + w, displayY + h, 'scale-se', 'nwse-resize')}

                    {/* Edge Handles */}
                    {renderHandle(displayX + w / 2, displayY, 'scale-n', 'ns-resize')}
                    {renderHandle(displayX + w / 2, displayY + h, 'scale-s', 'ns-resize')}
                    {renderHandle(displayX, displayY + h / 2, 'scale-w', 'ew-resize')}
                    {renderHandle(displayX + w, displayY + h / 2, 'scale-e', 'ew-resize')}
                </>
            )}

            {/* Rotation Handle */}
            <line
                x1={displayX + w / 2}
                y1={displayY}
                x2={displayX + w / 2}
                y2={displayY - 30}
                stroke="#00d9ff"
                strokeWidth={3}
            />
            <circle
                cx={displayX + w / 2}
                cy={displayY - 30}
                r={handleSize / 2 + 2}
                fill="white"
                stroke="#00d9ff"
                strokeWidth={3}
                style={{ cursor: 'alias' }}
                onMouseDown={(e) => handleMouseDown(e, 'rotate')}
            />
        </g>
    );
}
