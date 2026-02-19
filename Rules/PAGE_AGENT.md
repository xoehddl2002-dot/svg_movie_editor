# Page Agent - UI 페이지 개발 에이전트

## 역할
Page Agent는 **페이지 조립, 라우팅, UX 흐름**을 담당합니다.

## 담당 영역
- `src/app/` 디렉토리 전체

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
```

## 핵심 책임
1. **페이지 조립** — 컴포넌트와 훅을 조합하여 완성된 페이지 구성
2. **라우팅** — Next.js App Router 기반 페이지 간 네비게이션
3. **UX 흐름** — 페이지 진입 시 리다이렉트, 전역 이벤트 핸들링
4. **API 라우트** — 서버사이드 엔드포인트 구현 (FFmpeg, 에셋, 폰트 등)
5. **레이아웃** — 전체 앱 레이아웃 및 글로벌 스타일

## 코딩 규칙

### 페이지 구성
- ✅ 각 페이지는 `'use client'` 디렉티브 사용 (클라이언트 컴포넌트)
- ✅ 페이지는 조립 역할에 집중 — 비즈니스 로직은 `features/`에 위임
- ✅ Foundation Agent의 컴포넌트를 재사용하여 페이지 구성
- ❌ 페이지 파일에 복잡한 비즈니스 로직 직접 작성 금지

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
- ✅ `@/components/` 의 UI 컴포넌트 사용 가능
- ✅ `@/utils/`, `@/lib/` 의 공통 유틸리티 사용 가능

## 참조 파일
- `Rules/AI_ENGINEERING_CONTRACT.md` — 전체 프로젝트 규칙
