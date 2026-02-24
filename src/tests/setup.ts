/**
 * Vitest 글로벌 셋업 파일
 * jsdom에서 제공되지 않는 브라우저 API를 폴리필합니다.
 */

// jsdom은 DOMMatrix를 제공하지 않으므로 간단한 폴리필 추가
if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
        a: number; b: number; c: number; d: number; e: number; f: number;

        constructor(init?: number[] | string) {
            if (Array.isArray(init) && init.length >= 6) {
                [this.a, this.b, this.c, this.d, this.e, this.f] = init;
            } else {
                this.a = 1; this.b = 0; this.c = 0;
                this.d = 1; this.e = 0; this.f = 0;
            }
        }
    } as unknown as typeof DOMMatrix;
}
