import { describe, it, expect } from 'vitest'
import {
    transformPoint,
    isIdentity,
    transformBox,
    snapToAngle,
    rectsIntersect,
    deltaTransformPoint,
} from '@/utils/svg/math'

/**
 * DOMMatrix를 SVGMatrix 인터페이스처럼 사용할 수 있도록 헬퍼 생성
 * jsdom에서 SVGMatrix가 제공되지 않으므로 DOMMatrix 활용
 */
function createMatrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0): DOMMatrix {
    return new DOMMatrix([a, b, c, d, e, f])
}

describe('SVG Math Utilities — SVG 수학 유틸리티', () => {
    describe('transformPoint — 행렬 변환 포인트', () => {
        it('항등 행렬은 좌표를 변환하지 않아야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 0, 0)
            const result = transformPoint(10, 20, m)
            expect(result.x).toBe(10)
            expect(result.y).toBe(20)
        })

        it('이동 행렬(translate)로 좌표를 이동해야 한다', () => {
            // translate(50, 30) → e=50, f=30
            const m = createMatrix(1, 0, 0, 1, 50, 30)
            const result = transformPoint(10, 20, m)
            expect(result.x).toBe(60)
            expect(result.y).toBe(50)
        })

        it('스케일 행렬로 좌표를 확대해야 한다', () => {
            // scale(2, 3) → a=2, d=3
            const m = createMatrix(2, 0, 0, 3, 0, 0)
            const result = transformPoint(10, 20, m)
            expect(result.x).toBe(20)
            expect(result.y).toBe(60)
        })

        it('이동 + 스케일 복합 행렬이 정확히 계산되어야 한다', () => {
            // scale(2, 2) + translate(10, 10) → a=2, d=2, e=10, f=10
            const m = createMatrix(2, 0, 0, 2, 10, 10)
            const result = transformPoint(5, 5, m)
            expect(result.x).toBe(20) // 2*5 + 10
            expect(result.y).toBe(20) // 2*5 + 10
        })

        it('원점(0,0)에서 이동만 반영해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 100, 200)
            const result = transformPoint(0, 0, m)
            expect(result.x).toBe(100)
            expect(result.y).toBe(200)
        })
    })

    describe('isIdentity — 항등 행렬 판별', () => {
        it('항등 행렬을 true로 판別해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 0, 0)
            expect(isIdentity(m)).toBe(true)
        })

        it('이동 행렬은 false를 반환해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 10, 0)
            expect(isIdentity(m)).toBe(false)
        })

        it('스케일 행렬은 false를 반환해야 한다', () => {
            const m = createMatrix(2, 0, 0, 1, 0, 0)
            expect(isIdentity(m)).toBe(false)
        })

        it('매우 작은 값(near-zero)은 항등으로 간주해야 한다', () => {
            const m = createMatrix(1, 1e-15, 1e-15, 1, 0, 0)
            expect(isIdentity(m)).toBe(true)
        })
    })

    describe('transformBox — 사각형 행렬 변환', () => {
        it('항등 행렬에서는 원래 사각형과 동일해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 0, 0)
            const result = transformBox(10, 20, 100, 50, m)

            expect(result.tl).toEqual({ x: 10, y: 20 })
            expect(result.tr).toEqual({ x: 110, y: 20 })
            expect(result.bl).toEqual({ x: 10, y: 70 })
            expect(result.br).toEqual({ x: 110, y: 70 })

            expect(result.aabox.x).toBe(10)
            expect(result.aabox.y).toBe(20)
            expect(result.aabox.width).toBe(100)
            expect(result.aabox.height).toBe(50)
        })

        it('이동 행렬로 사각형이 이동해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 50, 30)
            const result = transformBox(0, 0, 100, 50, m)

            expect(result.aabox.x).toBe(50)
            expect(result.aabox.y).toBe(30)
            expect(result.aabox.width).toBe(100)
            expect(result.aabox.height).toBe(50)
        })

        it('스케일 행렬로 사각형이 확대되어야 한다', () => {
            const m = createMatrix(2, 0, 0, 2, 0, 0)
            const result = transformBox(10, 10, 50, 50, m)

            expect(result.aabox.x).toBe(20)
            expect(result.aabox.y).toBe(20)
            expect(result.aabox.width).toBe(100)
            expect(result.aabox.height).toBe(100)
        })
    })

    describe('snapToAngle — 45도 스냅', () => {
        it('정확히 0도 방향은 스냅하지 않아야 한다', () => {
            const result = snapToAngle(0, 0, 100, 0)
            expect(result.a).toBeCloseTo(0)
            expect(result.x).toBeCloseTo(100)
            expect(result.y).toBeCloseTo(0)
        })

        it('45도 방향으로 스냅해야 한다', () => {
            const result = snapToAngle(0, 0, 100, 100)
            expect(result.a).toBeCloseTo(Math.PI / 4)
        })

        it('90도 방향으로 스냅해야 한다', () => {
            const result = snapToAngle(0, 0, 0, 100)
            expect(result.a).toBeCloseTo(Math.PI / 2)
        })

        it('180도 방향으로 스냅해야 한다', () => {
            const result = snapToAngle(0, 0, -100, 0)
            expect(result.a).toBeCloseTo(Math.PI)
        })

        it('거리를 유지해야 한다', () => {
            const result = snapToAngle(0, 0, 30, 32) // ~45도 근처
            const dist = Math.sqrt(result.x * result.x + result.y * result.y)
            const originalDist = Math.sqrt(30 * 30 + 32 * 32)
            expect(dist).toBeCloseTo(originalDist)
        })
    })

    describe('rectsIntersect — 사각형 교차 판정', () => {
        it('겹치는 사각형은 true를 반환해야 한다', () => {
            const r1 = { x: 0, y: 0, width: 100, height: 100 } as SVGRect
            const r2 = { x: 50, y: 50, width: 100, height: 100 } as SVGRect
            expect(rectsIntersect(r1, r2)).toBe(true)
        })

        it('분리된 사각형은 false를 반환해야 한다', () => {
            const r1 = { x: 0, y: 0, width: 50, height: 50 } as SVGRect
            const r2 = { x: 100, y: 100, width: 50, height: 50 } as SVGRect
            expect(rectsIntersect(r1, r2)).toBe(false)
        })

        it('모서리만 접하는 사각형은 false를 반환해야 한다', () => {
            const r1 = { x: 0, y: 0, width: 50, height: 50 } as SVGRect
            const r2 = { x: 50, y: 50, width: 50, height: 50 } as SVGRect
            expect(rectsIntersect(r1, r2)).toBe(false)
        })

        it('포함 관계는 true를 반환해야 한다', () => {
            const r1 = { x: 0, y: 0, width: 200, height: 200 } as SVGRect
            const r2 = { x: 50, y: 50, width: 50, height: 50 } as SVGRect
            expect(rectsIntersect(r1, r2)).toBe(true)
        })

        it('가로로만 겹치는 경우 true를 반환해야 한다', () => {
            const r1 = { x: 0, y: 0, width: 100, height: 50 } as SVGRect
            const r2 = { x: 50, y: 10, width: 100, height: 20 } as SVGRect
            expect(rectsIntersect(r1, r2)).toBe(true)
        })
    })

    describe('deltaTransformPoint — 행렬 분해', () => {
        it('항등 행렬은 스케일 1, 회전 0을 반환해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 0, 0)
            const result = deltaTransformPoint(m as unknown as SVGMatrix)

            expect(result.scaleX).toBeCloseTo(1)
            expect(result.scaleY).toBeCloseTo(1)
            expect(result.angle).toBeCloseTo(0)
        })

        it('스케일 행렬을 올바르게 분해해야 한다', () => {
            const m = createMatrix(2, 0, 0, 3, 0, 0)
            const result = deltaTransformPoint(m as unknown as SVGMatrix)

            expect(result.scaleX).toBeCloseTo(2)
            expect(result.scaleY).toBeCloseTo(3)
            expect(result.angle).toBeCloseTo(0)
        })

        it('이동 값을 정확히 추출해야 한다', () => {
            const m = createMatrix(1, 0, 0, 1, 100, 200)
            const result = deltaTransformPoint(m as unknown as SVGMatrix)

            expect(result.translateX).toBe(100)
            expect(result.translateY).toBe(200)
        })

        it('90도 회전 행렬을 올바르게 분해해야 한다', () => {
            const angle = Math.PI / 2 // 90도
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            // rotation matrix: [cos, sin, -sin, cos, 0, 0]
            const m = createMatrix(cos, sin, -sin, cos, 0, 0)
            const result = deltaTransformPoint(m as unknown as SVGMatrix)

            expect(result.angle).toBeCloseTo(90)
            expect(result.scaleX).toBeCloseTo(1)
            expect(result.scaleY).toBeCloseTo(1)
        })
    })
})
