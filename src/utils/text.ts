
import { Clip } from "@/features/editor/store/useStore";

/**
 * 텍스트 클립의 콘텐츠 너비와 높이를 계산합니다.
 * canvas.measureText()의 fontBoundingBox 메트릭을 활용하여
 * 폰트별 정확한 크기를 측정합니다.
 */
export const getTextDimensions = (clip: Clip): { width: number; height: number } => {
    const fontSize = clip.fontSize || 120;
    const textContent = clip.text || 'Text';
    const textLines = textContent.split('\n');
    const fontFamily = clip.fontFamily || 'sans-serif';

    let maxLineMeasuredWidth = 0;
    // 폰트별 실제 라인 높이 (fontBoundingBoxAscent + fontBoundingBoxDescent)
    let measuredLineHeight = fontSize * 1.2; // 폴백 기본값

    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
            // CSS 렌더링과 동일한 폰트 문자열 사용
            context.font = `bold ${fontSize}px "${fontFamily}"`;

            textLines.forEach(line => {
                const metrics = context.measureText(line);
                maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, metrics.width);

                // fontBoundingBox 메트릭으로 폰트 고유의 정확한 라인 높이 계산
                if (metrics.fontBoundingBoxAscent !== undefined &&
                    metrics.fontBoundingBoxDescent !== undefined) {
                    const lineH = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
                    measuredLineHeight = Math.max(measuredLineHeight, lineH);
                }
            });
        } else {
            // Canvas context 생성 실패 시 추정값 사용
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
        console.warn("텍스트 크기 측정 실패", e);
        textLines.forEach(line => {
            maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, line.length * fontSize * 0.6);
        });
    }

    // textShadow, 렌더링 차이 등을 보정하기 위한 소량의 여유 패딩
    const PADDING = fontSize * 0.125;
    const width = maxLineMeasuredWidth + PADDING;
    const height = textLines.length * measuredLineHeight;

    return { width, height };
};
