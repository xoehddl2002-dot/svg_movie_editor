# Foundation Agent - 공통 모듈 및 핵심 컴포넌트 개발 에이전트

## 역할
Foundation Agent는 **공통 UI 컴포넌트, 핵심 편집 컴포넌트, 유틸리티, 프레임워크 설정**을 담당합니다.

## 담당 영역
- `src/components/` — 핵심 컴포넌트 및 공통 UI
- `src/utils/` — 공통 유틸리티 함수
- `src/lib/` — 프레임워크 설정

### 디렉토리 구조
```
src/components/
├── ui/          # Shadcn/Radix 기반 공통 UI (button, dialog, select 등)
├── editing/     # 편집 모달 및 전용 에디터 (Image, Video, Audio, Mask)
├── preview/     # 미리보기 (PreviewPlayer, TransformControls, DynamicSvg)
├── timeline/    # 타임라인 (Timeline, Track, Clip, Ruler, Playhead)
└── layout/      # 레이아웃 (Header, Sidebar, ExportModal, TemplateSelector)
    └── sidebar/ # 사이드바 탭 (ClipProperties, TemplatesTab 등)

src/utils/
├── dataUrl.ts       # Data URL 변환 유틸
├── fonts.ts         # 폰트 로딩 유틸
├── render.ts        # Canvas 렌더링 유틸
├── template.ts      # SVG 템플릿 파싱/처리
├── text.ts          # 텍스트 측정 유틸
└── svg/             # SVG 전용 유틸리티
    ├── math.ts
    ├── namespaces.ts
    └── utilities.ts

src/lib/
├── config.ts        # 환경 설정 (RESOURCE_BASE_PATH 등)
└── utils.ts         # cn() 등 프레임워크 유틸
```

## 핵심 책임
1. **공통 UI 컴포넌트** — Shadcn/Radix 기반 재사용 가능한 UI 컴포넌트 개발·유지
2. **핵심 편집 컴포넌트** — 이미지/비디오/오디오/마스크 에디터 등 도메인 특화 컴포넌트
3. **프리뷰 시스템** — PreviewPlayer 렌더링 로직, TransformControls
4. **타임라인 시스템** — 멀티트랙 타임라인 UI 및 인터랙션
5. **유틸리티** — Canvas 렌더링, SVG 처리, 폰트/텍스트 유틸, Data URL 변환
6. **프레임워크 설정** — 환경 설정, CSS 유틸리티(cn)

## 코딩 규칙

### 컴포넌트
- ✅ 함수형 컴포넌트 + React Hooks 사용
- ✅ `components/ui`의 Radix 기반 컴포넌트 재사용 우선
- ✅ Tailwind CSS 클래스 우선 사용
- ✅ 새 클립 타입 추가 시 `PreviewPlayer.renderClipContent`에 케이스 추가
- ❌ 인라인 스타일 남발 금지
- ❌ 클래스 컴포넌트 사용 금지

### 변형 및 좌표
- ✅ 위치(`x`, `y`)는 프로젝트 좌표계 기준 (픽셀 단위)
- ✅ 크롭은 퍼센트(0-100) 단위
- ✅ 회전은 도(degrees) 단위
- ✅ 필터 기본값: 밝기/대비/채도 = 1, 블러 = 0

### 유틸리티
- ✅ 순수 함수로 작성 (사이드 이펙트 최소화)
- ✅ 타입 정의 명확히 — `Clip`, `Track` 등 features의 인터페이스 사용
- ❌ DOM 직접 조작은 렌더링 유틸(`render.ts`) 등 한정된 곳에서만

### 성능
- ✅ 재생 중 `requestAnimationFrame` 사용
- ✅ 큰 파일 처리 시 로딩 인디케이터 표시
- ❌ 동기 작업으로 UI 블로킹 금지

### 에러 처리
- ✅ 미디어 로드 실패 시 폴백 처리
- ✅ 사용자에게 명확한 에러 메시지 제공
- ❌ 콘솔 에러만 남기고 무시 금지

## 의존성 규칙
- ✅ `@/features/editor/store/useStore`에서 타입(`Clip`, `Track`) import 가능
- ✅ `@/features/editor/store/useStore`에서 `useStore` 훅 import 가능
- ❌ `@/features/`의 비즈니스 훅(export hooks 등)은 직접 import 하지 않음
- ❌ `@/app/`을 직접 import 하지 않음

## 참조 파일
- `Rules/AI_ENGINEERING_CONTRACT.md` — 전체 프로젝트 규칙
