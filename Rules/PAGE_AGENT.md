# Page Agent - UI 페이지 및 컴포넌트 개발 에이전트

## 역할
Page Agent는 **페이지 조립, 라우팅, UX 흐름, 전체 UI 컴포넌트**를 담당합니다.

## 담당 영역
- `src/app/` — 페이지, 라우팅, API 라우트
- `src/components/` — 모든 UI 컴포넌트

### 디렉토리 구조
```
src/app/
├── page.tsx          # 홈 페이지 (TemplateSelector)
├── layout.tsx        # 루트 레이아웃
├── globals.css       # 전역 스타일
├── editor/
│   └── page.tsx      # 에디터 페이지 (Header, Sidebar, Preview, Timeline)
└── api/              # API 라우트
    ├── assets/
    ├── extract-frames/
    ├── fonts/
    ├── render-video/
    └── templates/

src/components/
├── ui/          # Shadcn/Radix 기반 공통 UI (button, dialog, select 등)
├── editing/     # 편집 모달 및 전용 에디터 (Audio, Mask)
├── preview/     # 미리보기 (PreviewPlayer, TransformControls, DynamicSvg)
├── timeline/    # 타임라인 (Timeline, Track, Clip, Ruler, Playhead)
└── layout/      # 레이아웃 (Header, Sidebar, ExportModal, TemplateSelector)
    └── sidebar/ # 사이드바 탭 (ClipProperties, TemplatesTab 등)
```

## 핵심 책임

### 페이지 관리
1. **페이지 조립** — 컴포넌트와 훅을 조합하여 완성된 페이지 구성
2. **라우팅** — Next.js App Router 기반 페이지 간 네비게이션
3. **UX 흐름** — 페이지 진입 시 리다이렉트, 전역 이벤트 핸들링
4. **API 라우트** — 서버사이드 엔드포인트 구현 (FFmpeg, 에셋, 폰트 등)
5. **레이아웃** — 전체 앱 레이아웃 및 글로벌 스타일

### UI 컴포넌트 관리
6. **공통 UI 컴포넌트** — Shadcn/Radix 기반 재사용 가능한 UI 개발·유지
7. **편집 컴포넌트 UI** — MaskEditor, AudioEditor 등 에디터 UI 렌더링
8. **프리뷰 시스템 UI** — PreviewPlayer 재생 컨트롤, TransformControls 핸들 렌더링
9. **타임라인 시스템 UI** — 멀티트랙 타임라인 UI 및 인터랙션 렌더링
10. **사이드바 UI** — 속성 폼, 에셋 탭, 클립 속성 패널

### 컴포넌트 UI 책임 상세

| 컴포넌트 | Page Agent 책임 (UI/렌더링) |
|---|---|
| `editing/MaskEditor` | 레이아웃, 슬라이더, 버튼, SVG 편집기 UI |
| `editing/AudioEditor` | 폼 UI, 파형 뷰어, 볼륨 슬라이더 |
| `preview/PreviewPlayer` | 재생 컨트롤 UI, 클립 레이아웃 렌더링 |
| `preview/TransformControls` | 선택 핸들/바운딩 박스 렌더링 |
| `preview/DynamicSvg` | SVG DOM 렌더링, 스타일 적용 |
| `timeline/Timeline` | 트랙/클립 UI, 줌/스크롤 UI |
| `layout/Header` | 헤더 레이아웃, 버튼 UI |
| `layout/ExportModal` | 내보내기 모달 UI |
| `layout/Sidebar` | 탭 레이아웃, 에셋 미리보기 UI |
| `sidebar/ClipProperties` | 속성 입력 폼, 필터 슬라이더 UI |
| `components/ui/*` | **전담** — Shadcn/Radix 기반 UI 원자 컴포넌트 |

## 코딩 규칙

### 페이지 구성
- ✅ 각 페이지는 `'use client'` 디렉티브 사용 (클라이언트 컴포넌트)
- ✅ 페이지는 조립 역할에 집중 — 비즈니스 로직은 `features/`에 위임
- ❌ 페이지 파일에 복잡한 비즈니스 로직 직접 작성 금지

### 컴포넌트
- ✅ 함수형 컴포넌트 + React Hooks 사용
- ✅ `components/ui`의 Radix 기반 컴포넌트 재사용 우선
- ✅ Tailwind CSS 클래스 우선 사용
- ✅ 새 클립 타입 추가 시 `PreviewPlayer.renderClipContent`에 케이스 추가
- ✅ 컴포넌트 내 비즈니스 로직 수정 시 **Feature Agent와 협업**
- ❌ 인라인 스타일 남발 금지
- ❌ 클래스 컴포넌트 사용 금지

### 변형 및 좌표
- ✅ 위치(`x`, `y`)는 프로젝트 좌표계 기준 (픽셀 단위)
- ✅ 크롭은 퍼센트(0-100) 단위
- ✅ 회전은 도(degrees) 단위
- ✅ 필터 기본값: 밝기/대비/채도 = 1, 블러 = 0

### 라우팅
- ✅ Next.js App Router 컨벤션 준수
- ✅ 프로젝트 미로드 시 홈으로 리다이렉트 등 가드 로직 구현
- ❌ 하드코딩된 URL 사용 금지

### API 라우트
- ✅ try-catch로 에러 핸들링
- ✅ 명확한 HTTP 상태 코드 반환
- ❌ 클라이언트 전용 코드 API 라우트에 포함 금지

## 의존성 규칙
- ✅ `@/features/` 의 store, hooks 사용 가능
- ✅ `@/components/` — 자체 관리 영역
- ✅ `@/utils/`, `@/lib/` 의 공통 유틸리티 사용 가능

## 참조 파일
- `Rules/AI_ENGINEERING_CONTRACT.md` — 전체 프로젝트 규칙
