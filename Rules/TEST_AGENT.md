# Test Agent - 테스트 개발 에이전트

## 역할
Test Agent는 애플리케이션의 **테스트 코드 작성, 실행, 품질 검증**을 담당합니다.

## 담당 영역
- `src/tests/` 디렉토리 전체

### 디렉토리 구조
```
src/tests/
├── unit/               # 단위 테스트
│   ├── store/          # Zustand 스토어 테스트
│   ├── utils/          # 유틸리티 함수 테스트
│   └── hooks/          # 커스텀 훅 테스트
├── integration/        # 통합 테스트
│   ├── features/       # 비즈니스 로직 통합 테스트
│   └── components/     # 컴포넌트 통합 테스트
└── e2e/                # End-to-End 테스트
    ├── home/           # 홈 페이지 시나리오
    └── editor/         # 에디터 페이지 시나리오
```

## 핵심 책임
1. **단위 테스트** — 개별 함수, 훅, 스토어 액션의 정확성 검증
2. **통합 테스트** — 여러 모듈 간 상호작용 검증
3. **E2E 테스트** — 사용자 시나리오 기반 전체 흐름 검증
4. **테스트 커버리지 관리** — 핵심 비즈니스 로직의 커버리지 확보
5. **회귀 테스트** — 새 기능 추가 시 기존 기능 정상 동작 확인

## 코딩 규칙

### 테스트 작성
- ✅ 테스트 파일명은 `*.test.ts` 또는 `*.test.tsx` 형식
- ✅ 각 테스트는 독립적으로 실행 가능해야 함 (격리성)
- ✅ `describe` / `it` 블록으로 논리적 그룹화
- ✅ 테스트 설명은 **한글**로 작성 가능 — 무엇을 검증하는지 명확히
- ❌ 테스트 간 상태 공유 금지

### 테스트 대상 우선순위
1. **스토어 액션** — `addClip`, `removeClip`, `updateClip`, `moveClip`, `swapTrackContents` 등
2. **유틸리티 함수** — `processTemplate`, `renderFrame`, `imageToDataURL`, SVG 유틸 등
3. **커스텀 훅** — `useExportImage`, `useExportVideo`
4. **컴포넌트 렌더링** — 핵심 컴포넌트의 정상 렌더링 확인

### 시간 관련 테스트
- ✅ 모든 시간 값은 **초(seconds)** 단위로 테스트
- ✅ 타임라인 관련 테스트에서 부동소수점 비교 시 `toBeCloseTo` 사용

### 모킹(Mocking)
- ✅ 외부 의존성(FFmpeg, Canvas API 등)은 모킹 처리
- ✅ DOM 조작이 필요한 테스트는 jsdom 환경 사용
- ❌ 실제 네트워크 요청 사용 금지 — API 라우트는 모킹

### 어서션(Assertion)
- ✅ 하나의 테스트에는 하나의 핵심 검증 포인트
- ✅ 에러 케이스와 엣지 케이스도 반드시 테스트
- ✅ 클립 속성 검증 시 `Clip` 인터페이스의 타입 준수 확인

## 의존성 규칙
- ✅ `@/features/` — 테스트 대상으로 import 가능
- ✅ `@/components/` — 테스트 대상으로 import 가능
- ✅ `@/utils/`, `@/lib/` — 테스트 대상으로 import 가능
- ❌ 테스트 코드가 프로덕션 코드에 import 되면 안 됨

## 테스트 실행
```bash
# 전체 테스트 실행
npm test

# 특정 파일 테스트
npm test -- --testPathPattern="store"

# 커버리지 리포트
npm test -- --coverage
```

## 참조 파일
- `Rules/AI_ENGINEERING_CONTRACT.md` — 전체 프로젝트 규칙
- `Rules/FEATURE_AGENT.md` — 비즈니스 로직/유틸리티 구조 참조
- `Rules/PAGE_AGENT.md` — UI 컴포넌트 구조 참조
