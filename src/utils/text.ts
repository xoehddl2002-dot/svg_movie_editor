
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
    // 줄 간격 배율 — 사용자 설정값 우선, 없으면 1.2 기본
    const lineHeightFactor = clip.lineHeight ?? 1.2;

    let maxLineMeasuredWidth = 0;
    // 세로쓰기일 경우 폰트별 총 높이 계산 위한 변수
    let maxVerticalHeight = 0;
    // 폰트별 실제 라인 높이 (fontBoundingBoxAscent + fontBoundingBoxDescent)
    let measuredLineHeight = fontSize * lineHeightFactor; // 폴백 기본값
    
    // 자간 (em 단위 -> px 단위)
    const letterSpacingPx = (clip.letterSpacing ?? 0) * fontSize;

    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
            // CSS 렌더링과 동일한 폰트 문자열 사용
            context.font = `bold ${fontSize}px "${fontFamily}"`;

            textLines.forEach(line => {
                const metrics = context.measureText(line);
                const gaps = Math.max(0, line.length - 1);
                const lsOffset = gaps * letterSpacingPx;
                
                maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, metrics.width + lsOffset);
                
                if (clip.isVertical) {
                    // 세로쓰기일 경우, 한 줄의 길이는 각 단어의 높이 합
                    // 영문소문자 디센더(g,y,p)나 한글의 상하폭을 고려해 글자당 1.15배를 곱함
                    maxVerticalHeight = Math.max(maxVerticalHeight, line.length * (fontSize * 1.15) + lsOffset);
                }

                // fontBoundingBox 메트릭으로 폰트 고유의 정확한 라인 높이 계산
                // lineHeightFactor를 적용하여 줄 간격 반영
                if (metrics.fontBoundingBoxAscent !== undefined &&
                    metrics.fontBoundingBoxDescent !== undefined) {
                    const lineH = (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent) * (lineHeightFactor / 1.2);
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
                const gaps = Math.max(0, line.length - 1);
                const lsOffset = gaps * letterSpacingPx;

                maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, estimatedWidth * fontSize + lsOffset);
                if (clip.isVertical) {
                    maxVerticalHeight = Math.max(maxVerticalHeight, line.length * (fontSize * 1.15) + lsOffset);
                }
            });
        }
    } catch (e) {
        console.warn("텍스트 크기 측정 실패", e);
        textLines.forEach(line => {
            maxLineMeasuredWidth = Math.max(maxLineMeasuredWidth, line.length * fontSize * 0.6);
        });
    }

    // textShadow, bold, 폰트 오버행 등을 보정하기 위한 여유 패딩
    const H_PADDING = fontSize * (clip.isVertical ? 0.5 : 0.3);
    const V_PADDING = fontSize * (clip.isVertical ? 0.5 : 0.15);
    
    let width: number;
    let height: number;

    if (clip.isVertical) {
        // 세로쓰기인 경우
        // 폭(width)은 줄 개수 * 라인 높이가 됨
        width = textLines.length * measuredLineHeight + H_PADDING;
        // 높이(height)는 가장 긴 줄의 길이
        height = maxVerticalHeight + V_PADDING;
    } else {
        // 가로쓰기
        width = maxLineMeasuredWidth + H_PADDING;
        height = textLines.length * measuredLineHeight + V_PADDING;
    }

    // 곡선 텍스트 사용 시 곡선 높이만큼 추가 공간 필요
    // 쿼드라틱 베지어의 최대 수직 편차는 제어점 편차의 1/2
    const curveAmount = clip.textCurve || 0;
    if (curveAmount !== 0) {
        if (clip.isVertical) {
             width += Math.abs(curveAmount) / 2;
        } else {
             height += Math.abs(curveAmount) / 2;
        }
    }

    return { width, height };
};
