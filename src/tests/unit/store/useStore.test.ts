import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/features/editor/store/useStore'
import type { Clip, Track } from '@/features/editor/store/useStore'

// 테스트용 헬퍼: 스토어를 기본 상태로 리셋
function resetStore() {
    useStore.setState({
        tracks: [
            { id: 'audio-1', type: 'audio', clips: [] },
            { id: 'video-1', type: 'video', clips: [] },
        ],
        currentTime: 0,
        duration: 10,
        zoom: 100,
        selectedClipId: null,
        timelineHeight: 320,
        aspectRatio: 16 / 9,
        canvasZoom: 100,
        editingClipId: null,
        isPlaying: false,
    })
}

// 테스트용 클립 팩토리
function createTestClip(overrides: Partial<Clip> = {}): Clip {
    return {
        id: 'clip-1',
        trackId: 'video-1',
        type: 'image',
        start: 0,
        duration: 5,
        name: 'Test Clip',
        src: 'test.png',
        opacity: 1,
        rotation: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        brightness: 1,
        contrast: 1,
        saturate: 1,
        blur: 0,
        ...overrides,
    }
}

describe('useStore - 스토어 액션 테스트', () => {
    beforeEach(() => {
        resetStore()
    })

    describe('addClip — 클립 추가', () => {
        it('지정한 트랙에 클립을 추가해야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)

            const tracks = useStore.getState().tracks
            const videoTrack = tracks.find(t => t.id === 'video-1')!
            expect(videoTrack.clips).toHaveLength(1)
            expect(videoTrack.clips[0].id).toBe('clip-1')
        })

        it('다른 트랙에는 영향을 주지 않아야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)

            const audioTrack = useStore.getState().tracks.find(t => t.id === 'audio-1')!
            expect(audioTrack.clips).toHaveLength(0)
        })

        it('같은 트랙에 여러 클립을 추가할 수 있어야 한다', () => {
            const clip1 = createTestClip({ id: 'clip-1' })
            const clip2 = createTestClip({ id: 'clip-2', start: 5 })

            useStore.getState().addClip('video-1', clip1)
            useStore.getState().addClip('video-1', clip2)

            const videoTrack = useStore.getState().tracks.find(t => t.id === 'video-1')!
            expect(videoTrack.clips).toHaveLength(2)
        })
    })

    describe('removeClip — 클립 제거', () => {
        it('클립을 제거해야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)
            useStore.getState().removeClip('clip-1')

            const videoTrack = useStore.getState().tracks.find(t => t.id === 'video-1')!
            expect(videoTrack.clips).toHaveLength(0)
        })

        it('선택된 클립을 제거하면 selectedClipId가 null이 되어야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)
            useStore.setState({ selectedClipId: 'clip-1' })

            useStore.getState().removeClip('clip-1')
            expect(useStore.getState().selectedClipId).toBeNull()
        })

        it('선택되지 않은 클립 제거 시 selectedClipId는 유지되어야 한다', () => {
            const clip1 = createTestClip({ id: 'clip-1' })
            const clip2 = createTestClip({ id: 'clip-2', start: 5 })

            useStore.getState().addClip('video-1', clip1)
            useStore.getState().addClip('video-1', clip2)
            useStore.setState({ selectedClipId: 'clip-2' })

            useStore.getState().removeClip('clip-1')
            expect(useStore.getState().selectedClipId).toBe('clip-2')
        })
    })

    describe('updateClip — 클립 업데이트', () => {
        it('클립의 속성을 부분적으로 업데이트해야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)
            useStore.getState().updateClip('clip-1', { x: 50, y: 100 })

            const updatedClip = useStore.getState().tracks
                .flatMap(t => t.clips)
                .find(c => c.id === 'clip-1')!

            expect(updatedClip.x).toBe(50)
            expect(updatedClip.y).toBe(100)
        })

        it('업데이트하지 않은 속성은 유지되어야 한다', () => {
            const clip = createTestClip({ name: 'Original Name' })
            useStore.getState().addClip('video-1', clip)
            useStore.getState().updateClip('clip-1', { x: 50 })

            const updatedClip = useStore.getState().tracks
                .flatMap(t => t.clips)
                .find(c => c.id === 'clip-1')!

            expect(updatedClip.name).toBe('Original Name')
            expect(updatedClip.duration).toBe(5)
        })

        it('시간 값을 초 단위로 업데이트해야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)
            useStore.getState().updateClip('clip-1', { start: 2.5, duration: 3.7 })

            const updatedClip = useStore.getState().tracks
                .flatMap(t => t.clips)
                .find(c => c.id === 'clip-1')!

            expect(updatedClip.start).toBeCloseTo(2.5)
            expect(updatedClip.duration).toBeCloseTo(3.7)
        })
    })

    describe('moveClip — 트랙 간 클립 이동', () => {
        it('클립을 다른 트랙으로 이동해야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)

            // audio-1 트랙으로 이동
            useStore.getState().moveClip('clip-1', 'audio-1', { start: 2 })

            const videoTrack = useStore.getState().tracks.find(t => t.id === 'video-1')!
            const audioTrack = useStore.getState().tracks.find(t => t.id === 'audio-1')!

            expect(videoTrack.clips).toHaveLength(0)
            expect(audioTrack.clips).toHaveLength(1)
            expect(audioTrack.clips[0].id).toBe('clip-1')
        })

        it('이동 시 trackId가 새 트랙으로 갱신되어야 한다', () => {
            const clip = createTestClip({ trackId: 'video-1' })
            useStore.getState().addClip('video-1', clip)

            useStore.getState().moveClip('clip-1', 'audio-1', {})

            const movedClip = useStore.getState().tracks
                .flatMap(t => t.clips)
                .find(c => c.id === 'clip-1')!

            expect(movedClip.trackId).toBe('audio-1')
        })

        it('이동 시 추가 업데이트가 반영되어야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)

            useStore.getState().moveClip('clip-1', 'audio-1', { start: 3, duration: 8 })

            const movedClip = useStore.getState().tracks
                .flatMap(t => t.clips)
                .find(c => c.id === 'clip-1')!

            expect(movedClip.start).toBe(3)
            expect(movedClip.duration).toBe(8)
        })

        it('존재하지 않는 클립 이동 시 상태가 변하지 않아야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)

            const tracksBefore = useStore.getState().tracks
            useStore.getState().moveClip('nonexistent', 'audio-1', {})
            const tracksAfter = useStore.getState().tracks

            // 원본 트랙 배열 참조가 유지되어야 한다
            expect(tracksAfter).toEqual(tracksBefore)
        })
    })

    describe('addTrack — 트랙 추가', () => {
        it('트랙을 맨 앞에 추가해야 한다 (기본 동작)', () => {
            const trackCountBefore = useStore.getState().tracks.length
            useStore.getState().addTrack('mixed')

            const tracks = useStore.getState().tracks
            expect(tracks).toHaveLength(trackCountBefore + 1)
            expect(tracks[0].type).toBe('mixed')
        })

        it('지정한 인덱스에 트랙을 삽입해야 한다', () => {
            useStore.getState().addTrack('image', 1)

            const tracks = useStore.getState().tracks
            expect(tracks[1].type).toBe('image')
        })

        it('새 트랙은 빈 클립 배열을 가져야 한다', () => {
            useStore.getState().addTrack('text')

            const newTrack = useStore.getState().tracks[0]
            expect(newTrack.clips).toEqual([])
        })

        it('고유한 ID를 생성해야 한다', () => {
            useStore.getState().addTrack('mixed')
            useStore.getState().addTrack('mixed')

            const tracks = useStore.getState().tracks
            const ids = tracks.map(t => t.id)
            const uniqueIds = new Set(ids)
            expect(uniqueIds.size).toBe(ids.length)
        })
    })

    describe('swapTrackContents — 트랙 내용 교환', () => {
        it('두 트랙의 클립을 교환해야 한다', () => {
            const clip1 = createTestClip({ id: 'clip-1', trackId: 'video-1' })
            const clip2 = createTestClip({ id: 'clip-2', trackId: 'audio-1', type: 'audio' })

            useStore.getState().addClip('video-1', clip1)
            useStore.getState().addClip('audio-1', clip2)

            useStore.getState().swapTrackContents('video-1', 'audio-1')

            const videoTrack = useStore.getState().tracks.find(t => t.id === 'video-1')!
            const audioTrack = useStore.getState().tracks.find(t => t.id === 'audio-1')!

            expect(videoTrack.clips[0].id).toBe('clip-2')
            expect(audioTrack.clips[0].id).toBe('clip-1')
        })

        it('교환 후 클립의 trackId가 새 트랙 ID로 갱신되어야 한다', () => {
            const clip1 = createTestClip({ id: 'clip-1', trackId: 'video-1' })
            const clip2 = createTestClip({ id: 'clip-2', trackId: 'audio-1' })

            useStore.getState().addClip('video-1', clip1)
            useStore.getState().addClip('audio-1', clip2)

            useStore.getState().swapTrackContents('video-1', 'audio-1')

            const videoTrack = useStore.getState().tracks.find(t => t.id === 'video-1')!
            const audioTrack = useStore.getState().tracks.find(t => t.id === 'audio-1')!

            expect(videoTrack.clips[0].trackId).toBe('video-1')
            expect(audioTrack.clips[0].trackId).toBe('audio-1')
        })

        it('존재하지 않는 트랙 ID로 교환 시 상태가 변하지 않아야 한다', () => {
            const clip = createTestClip()
            useStore.getState().addClip('video-1', clip)

            const tracksBefore = useStore.getState().tracks
            useStore.getState().swapTrackContents('video-1', 'nonexistent')
            const tracksAfter = useStore.getState().tracks

            expect(tracksAfter).toEqual(tracksBefore)
        })
    })

    describe('setSelectedClipId — 클립 선택 (빈 텍스트 자동 제거)', () => {
        it('빈 텍스트 클립이 선택 해제될 때 자동으로 제거되어야 한다', () => {
            const textClip = createTestClip({
                id: 'text-1',
                type: 'text',
                text: '',
            })
            useStore.getState().addClip('video-1', textClip)
            useStore.setState({ selectedClipId: 'text-1' })

            // 다른 클립을 선택 → 빈 텍스트 클립 제거
            useStore.getState().setSelectedClipId('other-clip')

            const allClips = useStore.getState().tracks.flatMap(t => t.clips)
            expect(allClips.find(c => c.id === 'text-1')).toBeUndefined()
        })

        it('내용이 있는 텍스트 클립은 제거되지 않아야 한다', () => {
            const textClip = createTestClip({
                id: 'text-1',
                type: 'text',
                text: 'Hello',
            })
            useStore.getState().addClip('video-1', textClip)
            useStore.setState({ selectedClipId: 'text-1' })

            useStore.getState().setSelectedClipId('other-clip')

            const allClips = useStore.getState().tracks.flatMap(t => t.clips)
            expect(allClips.find(c => c.id === 'text-1')).toBeDefined()
        })
    })

    describe('기본 setter 액션', () => {
        it('setCurrentTime이 시간을 초 단위로 설정해야 한다', () => {
            useStore.getState().setCurrentTime(5.5)
            expect(useStore.getState().currentTime).toBeCloseTo(5.5)
        })

        it('setDuration이 전체 길이를 설정해야 한다', () => {
            useStore.getState().setDuration(30)
            expect(useStore.getState().duration).toBe(30)
        })

        it('setZoom이 줌 레벨을 설정해야 한다', () => {
            useStore.getState().setZoom(200)
            expect(useStore.getState().zoom).toBe(200)
        })

        it('setIsPlaying이 재생 상태를 변경해야 한다', () => {
            useStore.getState().setIsPlaying(true)
            expect(useStore.getState().isPlaying).toBe(true)

            useStore.getState().setIsPlaying(false)
            expect(useStore.getState().isPlaying).toBe(false)
        })

        it('setAspectRatio가 종횡비를 설정해야 한다', () => {
            useStore.getState().setAspectRatio(9 / 16)
            expect(useStore.getState().aspectRatio).toBeCloseTo(9 / 16)
        })
    })
})
