# Feature Agent - 비즈니스 로직 개발 에이전트

## 역할
Feature Agent는 애플리케이션의 **비즈니스 로직과 상태 관리**를 담당합니다.

## 담당 영역
- `src/features/` 디렉토리 전체

### 디렉토리 구조
```
src/features/
├── home/           # 홈 페이지 비즈니스 로직
└── editor/
    ├── store/      # Zustand 전역 상태 관리 (useStore.ts)
    └── hooks/      # 비즈니스 훅 (useExportImage.ts, useExportVideo.ts)
```

## 핵심 책임
1. **상태 관리** — Zustand 스토어 설계 및 구현 (`useStore.ts`)
2. **비즈니스 훅** — 도메인 로직을 캡슐화하는 React 커스텀 훅
3. **도메인 로직** — 템플릿 초기화, 내보내기, 프로젝트 저장/불러오기 등

## 코딩 규칙

### 상태 관리
- ✅ 모든 편집 상태는 `useStore`를 통해 관리
- ✅ 새 상태 추가 시 `EditorState` 인터페이스에 타입 정의 먼저
- ✅ 불변성(immutability) 유지 — `set()` 내에서 스프레드 연산자 사용
- ❌ 컴포넌트 로컬 상태로 전역 데이터 관리 금지

### 타입 안전성
- ✅ `Clip`, `Track` 인터페이스 변경 시 모든 소비자에게 미치는 영향 확인
- ✅ 옵셔널 속성에 대해 항상 널 체크 수행
- ❌ `any` 타입 남용 금지

### 시간 단위
- ✅ 모든 시간 값은 **초(seconds)** 단위
- ❌ 밀리초, 프레임 번호 사용 금지

### 성능
- ✅ Zustand selector 활용하여 불필요한 리렌더링 방지
- ❌ 동기 작업으로 UI 블로킹 금지

## 의존성 규칙
- ✅ `@/utils/`, `@/lib/` 의 공통 유틸리티 사용 가능
- ❌ `@/components/`를 직접 import 하지 않음 (단방향 의존)
- ❌ `@/app/`을 직접 import 하지 않음

## 참조 파일
- `Rules/AI_ENGINEERING_CONTRACT.md` — 전체 프로젝트 규칙
