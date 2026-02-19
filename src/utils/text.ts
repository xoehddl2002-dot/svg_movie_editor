
import { Clip } from "@/features/editor/store/useStore";

/**
 * Calculates the width and height of a text clip's content.
 * Uses an offscreen canvas to measure the text width accurately.
 */
export const getTextDimensions = (clip: Clip): { width: number; height: number } => {
    const fontSize = clip.fontSize || 120;
    const textContent = clip.text || 'Text';
    const textLines = textContent.split('\n');
    const fontFamily = clip.fontFamily || 'sans-serif';

    let maxLineMeasuredWidth = 0;

    try {
        // Create a temporary canvas to measure text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
            // Ensure font string matches CSS rendering
            context.font = `bold ${fontSize}px ${fontFamily}`;
            textLines.forEach(line => {
                const metrics = context.measureText(line);
                maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, metrics.width);
            });
        } else {
            // Fallback estimation if canvas context fails (unlikely in browser)
            textLines.forEach(line => {
                let estimatedWidth = 0;
                for (let i = 0; i < line.length; i++) {
                    const code = line.charCodeAt(i);
                    estimatedWidth += (code < 128) ? 0.6 : 1.2;
                }
                maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, estimatedWidth * fontSize);
            });
        }
    } catch (e) {
        console.warn("Failed to measure text dimensions", e);
        // Fallback estimation
        textLines.forEach(line => {
            maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, line.length * fontSize * 0.6);
        });
    }

    const width = maxLineMeasuredWidth;
    const height = textLines.length * fontSize * 1.2; // ~1.2 line height

    return { width, height };
};
