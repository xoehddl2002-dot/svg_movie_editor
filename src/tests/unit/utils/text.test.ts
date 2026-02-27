import { describe, it, expect } from 'vitest'
import { getTextDimensions } from '@/utils/text'
import type { Clip } from '@/features/editor/store/useStore'

// 테스트용 텍스트 클립 생성 헬퍼
function createTextClip(overrides: Partial<Clip> = {}): Clip {
    return {
        id: 'text-1',
        trackId: 'video-1',
        type: 'text',
        start: 0,
        duration: 5,
        name: 'Text Clip',
        src: '',
        brightness: 1,
        contrast: 1,
        saturate: 1,
        blur: 0,
        ...overrides,
    }
}

describe('getTextDimensions — 텍스트 크기 계산', () => {
    it('기본 텍스트의 너비와 높이가 양수여야 한다', () => {
        const clip = createTextClip({ text: 'Hello World', fontSize: 120 })
        const { width, height } = getTextDimensions(clip)

        expect(width).toBeGreaterThan(0)
        expect(height).toBeGreaterThan(0)
    })

    it('텍스트가 없으면 기본값 "Text"로 계산해야 한다', () => {
        const clip = createTextClip({}) // text 미설정
        const { width, height } = getTextDimensions(clip)

        expect(width).toBeGreaterThan(0)
        expect(height).toBeGreaterThan(0)
    })

    it('멀티라인 텍스트는 높이가 더 커야 한다', () => {
        const singleLine = createTextClip({ text: 'Line 1', fontSize: 100 })
        const multiLine = createTextClip({ text: 'Line 1\nLine 2\nLine 3', fontSize: 100 })

        const single = getTextDimensions(singleLine)
        const multi = getTextDimensions(multiLine)

        expect(multi.height).toBeGreaterThan(single.height)
    })

    it('폰트 크기가 커지면 너비와 높이도 커져야 한다', () => {
        const small = createTextClip({ text: 'Test', fontSize: 50 })
        const large = createTextClip({ text: 'Test', fontSize: 200 })

        const smallDim = getTextDimensions(small)
        const largeDim = getTextDimensions(large)

        expect(largeDim.width).toBeGreaterThan(smallDim.width)
        expect(largeDim.height).toBeGreaterThan(smallDim.height)
    })

    it('높이는 라인 수에 비례해야 한다 (폰트 메트릭 기반)', () => {
        const fontSize = 100
        const clip = createTextClip({ text: 'Line 1\nLine 2', fontSize })
        const { height } = getTextDimensions(clip)

        // 최소 fontSize * 라인수 이상이어야 하고, fontSize * 1.5 * 라인수 이하
        expect(height).toBeGreaterThanOrEqual(2 * fontSize)
        expect(height).toBeLessThanOrEqual(2 * fontSize * 1.5)
    })
})
