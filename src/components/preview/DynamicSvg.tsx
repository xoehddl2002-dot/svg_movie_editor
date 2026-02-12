import React, { useEffect, useState, useRef } from 'react';

interface DynamicSvgProps {
    src: string;
    style?: React.CSSProperties;
    templateData?: any;
    fill?: string;
}

export const DynamicSvg = React.memo(function DynamicSvg({ src, style, templateData, fill }: DynamicSvgProps) {
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
            .catch(err => console.error("Failed to load SVG:", err));
    }, [src]);

    useEffect(() => {
        if (!svgContent || !containerRef.current) return;

        const svgElement = containerRef.current.querySelector('svg');
        if (!svgElement) return;

        // Ensure viewBox exists for proper scaling
        if (!svgElement.getAttribute('viewBox')) {
            const w = svgElement.getAttribute('width');
            const h = svgElement.getAttribute('height');
            if (w && h) {
                // If it has px or other units, strip them for the viewBox
                const cleanW = w.replace(/[^0-9.]/g, '');
                const cleanH = h.replace(/[^0-9.]/g, '');
                svgElement.setAttribute('viewBox', `0 0 ${cleanW} ${cleanH}`);
            }
        }

        // Set dimensions to fill container
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('preserveAspectRatio', 'none');

        // Apply fill color if provided
        if (fill) {
            const shapeElements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
            shapeElements.forEach(el => {
                const svgEl = el as SVGElement;

                // Get computed style to check actual visibility/color
                const computedStyle = window.getComputedStyle(el);
                const computedFill = computedStyle.fill;

                // If it's not explicitly none, override it
                if (computedFill !== 'none') {
                    // Set both attribute and style to ensure override
                    el.setAttribute('fill', fill);
                    svgEl.style.fill = fill;
                }
            });
        }

        // Apply templateData items to elements by ID
        const dataKey = JSON.stringify(templateData || {});
        // Note: we removed the optimization check (lastAppliedDataRef) because 'fill' prop change might need re-run 
        // effectively, but actually fill is handled above. 
        // Let's keep templateData application robust.

        if (templateData && typeof templateData === 'object') {
            Object.entries(templateData).forEach(([id, data]: [string, any]) => {
                const element = svgElement.getElementById(id);
                if (!element) return;

                if (data.text !== undefined) {
                    if (element.tagName.toLowerCase() === 'text' || element.tagName.toLowerCase() === 'tspan') {
                        element.textContent = data.text;
                    }
                }

                if (data.fill !== undefined) element.setAttribute('fill', data.fill);
                if (data.stroke !== undefined) element.setAttribute('stroke', data.stroke);
                if (data.opacity !== undefined) element.setAttribute('opacity', data.opacity.toString());
            });
        }
    }, [svgContent, templateData, fill]);

    return (
        <div
            ref={containerRef}
            style={{ ...style, width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
});
