import React, { useEffect, useState, useRef } from 'react';

interface DynamicSvgProps {
    src: string;
    style?: React.CSSProperties;
    templateData?: any;
    fill?: string;
    mask?: {
        x: number,
        y: number,
        width: number,
        height: number,
        shape?: 'rect' | 'circle',
        cornerRadius?: number
    };
    filter?: { brightness: number, contrast: number, saturate: number, blur: number };
    onLoad?: () => void;
    forceCheck?: number;
}

export const DynamicSvg = React.memo(function DynamicSvg({ src, style, templateData, fill, mask, filter, onLoad, forceCheck }: DynamicSvgProps) {
    const [svgContent, setSvgContent] = useState<string>('');
    const containerRef = useRef<HTMLDivElement>(null);
    const lastAppliedDataRef = useRef<string>('');

    useEffect(() => {
        if (!src) return;

        // Fetch the raw SVG content
        fetch(src)
            .then(res => res.text())
            .then(text => {
                // Simple sanitization/preparation: Remove xml declaration if present
                const cleanSvg = text.replace(/<\?xml.*?\?>/i, '').trim();
                setSvgContent(cleanSvg);
            })
            .catch(err => {
                console.error("Failed to load SVG:", err);
                onLoad?.(); // Still call onLoad to avoid blocking playback on error
            });
    }, [src]);

    useEffect(() => {
        if (!svgContent || !containerRef.current) {
            if (!src) onLoad?.(); // If no src, it's "ready"
            return;
        }

        const svgElement = containerRef.current.querySelector('svg');
        if (!svgElement) {
            onLoad?.();
            return;
        }

        // ... (existing processing code) ...
        // Ensure viewBox exists for proper scaling
        if (!svgElement.getAttribute('viewBox')) {
            const w = svgElement.getAttribute('width');
            const h = svgElement.getAttribute('height');
            if (w && h) {
                const cleanW = w.replace(/[^0-9.]/g, '');
                const cleanH = h.replace(/[^0-9.]/g, '');
                svgElement.setAttribute('viewBox', `0 0 ${cleanW} ${cleanH}`);
            }
        }

        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('preserveAspectRatio', 'none');

        if (fill) {
            const shapeElements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
            shapeElements.forEach(el => {
                const svgEl = el as SVGElement;
                const computedStyle = window.getComputedStyle(el);
                const computedFill = computedStyle.fill;
                if (computedFill !== 'none') {
                    el.setAttribute('fill', fill);
                    svgEl.style.fill = fill;
                }
            });
        }

        if (templateData && typeof templateData === 'object') {
            Object.entries(templateData).forEach(([id, data]: [string, any]) => {
                const element = svgElement.getElementById(id);
                if (!element) return;
                if (data.text !== undefined) {
                    if (element.tagName.toLowerCase() === 'text' || element.tagName.toLowerCase() === 'tspan') {
                        element.textContent = data.text;
                    }
                }
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

                if (data.fill !== undefined) element.setAttribute('fill', data.fill);
                if (data.stroke !== undefined) element.setAttribute('stroke', data.stroke);
                if (data.strokeWidth !== undefined) element.setAttribute('stroke-width', data.strokeWidth.toString());
                if (data.opacity !== undefined) element.setAttribute('opacity', data.opacity.toString());
            });
        }

        const imgElement = svgElement.querySelector('image');
        if (imgElement) {
            if (mask) {
                const scaleX = 100 / mask.width;
                const scaleY = 100 / mask.height;
                const existingTransform = imgElement.getAttribute('transform') || '';
                imgElement.style.transformOrigin = '0 0';
                imgElement.style.transform = `${existingTransform} scale(${scaleX}, ${scaleY}) translate(-${mask.x}%, -${mask.y}%)`;
                if (mask.shape === 'circle') {
                    imgElement.style.clipPath = 'circle(50% at 50% 50%)';
                    imgElement.style.borderRadius = '50%';
                } else {
                    imgElement.style.clipPath = '';
                    if (mask.cornerRadius !== undefined) {
                        imgElement.style.borderRadius = `${mask.cornerRadius}%`;
                    } else {
                        imgElement.style.borderRadius = '0';
                    }
                }
            }
            if (filter) {
                const { brightness, contrast, saturate, blur } = filter;
                imgElement.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) blur(${blur}px)`;
            }
        }

        // Check for inner images and wait for them to load
        const innerImages = svgElement.querySelectorAll('image');
        if (innerImages.length > 0) {
            const imagePromises = Array.from(innerImages).map(img => {
                const svgImg = img as SVGImageElement;
                if (!svgImg.href.baseVal) return Promise.resolve();

                return new Promise<void>((resolve) => {
                    const tempImg = new Image();
                    tempImg.onload = () => resolve();
                    tempImg.onerror = () => resolve(); // Resolve even on error to avoid blocking
                    tempImg.src = svgImg.href.baseVal;
                });
            });

            Promise.all(imagePromises).then(() => {
                // Double requestAnimationFrame to ensure paint
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        onLoad?.();
                    });
                });
            });
        } else {
            // No images, just wait for paint
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    onLoad?.();
                });
            });
        }
    }, [svgContent, templateData, fill, mask, filter, forceCheck]);

    return (
        <div
            ref={containerRef}
            className="select-none"
            style={{ ...style, width: '100%', height: '100%', pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
});
