import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn — Tailwind 클래스 병합 유틸리티', () => {
    it('단일 클래스를 반환해야 한다', () => {
        expect(cn('text-red-500')).toBe('text-red-500')
    })

    it('여러 클래스를 병합해야 한다', () => {
        const result = cn('p-4', 'text-lg', 'font-bold')
        expect(result).toContain('p-4')
        expect(result).toContain('text-lg')
        expect(result).toContain('font-bold')
    })

    it('조건부 클래스를 처리해야 한다', () => {
        const result = cn('base', false && 'hidden', 'visible')
        expect(result).toContain('base')
        expect(result).toContain('visible')
        expect(result).not.toContain('hidden')
    })

    it('충돌하는 Tailwind 클래스는 뒤의 것이 우선해야 한다', () => {
        const result = cn('p-4', 'p-8')
        expect(result).toBe('p-8')
    })

    it('undefined와 null을 무시해야 한다', () => {
        const result = cn('text-sm', undefined, null, 'font-bold')
        expect(result).toContain('text-sm')
        expect(result).toContain('font-bold')
    })

    it('빈 문자열을 반환할 수 있어야 한다', () => {
        const result = cn()
        expect(result).toBe('')
    })
})
