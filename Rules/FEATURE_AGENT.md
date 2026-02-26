# Feature Agent - 비즈니스 로직 및 핵심 유틸리티 개발 에이전트

## 역할
Feature Agent는 애플리케이션의 **비즈니스 로직, 상태 관리, 유틸리티, 프레임워크 설정**을 담당합니다.

## 담당 영역
- `src/features/` — 상태 관리, 도메인 훅, 유틸리티, 컴포넌트
- `src/utils/` — 공통 유틸리티 함수
- `src/lib/` — 프레임워크 설정

### 디렉토리 구조
```
src/features/
├── home/            # 홈 페이지 비즈니스 로직
└── editor/
    ├── store/       # Zustand 전역 상태 관리 (useStore.ts)
    ├── hooks/       # 비즈니스 훅 (useExportImage.ts, useExportVideo.ts)
    ├── utils/       # 에디터 전용 유틸 (shapeUtils.ts)
    └── _components/ # 에디터 전용 컴포넌트

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

### 상태 관리 & 도메인 로직
1. **Zustand 스토어** — `useStore.ts` 설계 및 구현
2. **비즈니스 훅** — 도메인 로직을 캡슐화하는 React 커스텀 훅
3. **도메인 로직** — 템플릿 초기화, 내보내기, 프로젝트 저장/불러오기

### 유틸리티 관리
4. **Canvas 렌더링** — `render.ts` 프레임 렌더링 유틸
5. **SVG 처리** — `template.ts` 파싱, `svg/` 전용 유틸리티
6. **폰트/텍스트** — 폰트 로딩, 텍스트 측정
7. **프레임워크 설정** — 환경 설정(`config.ts`), CSS 유틸리티(`cn`)

### 컴포넌트 비즈니스 로직 가이드
8. 컴포넌트 내 비즈니스 로직 수정 시 **Page Agent와 협업**

| 컴포넌트 | Feature Agent 책임 (비즈니스 로직) |
|---|---|
| `_components/editing/MaskEditor` | SVG 좌표 변환, 도형 조작, 크롭 계산 |
| `_components/editing/AudioEditor` | 오디오 트림, 볼륨 처리 |
| `_components/preview/PreviewPlayer` | 클립 렌더링 로직, 재생 엔진(rAF), 리소스 로딩 |
| `_components/preview/TransformControls` | 좌표 변환, 이동/크기/회전 계산 |
| `_components/preview/DynamicSvg` | SVG 파싱, 템플릿 데이터 적용 |
| `_components/timeline/Timeline` | 드래그/드롭, 리사이즈, 클립 이동 로직 |
| `_components/layout/Header` | 프로젝트 저장/불러오기 로직 |
| `_components/layout/ExportModal` | export hooks 연동 |
| `_components/layout/Sidebar` | 에셋 로드 로직 |
| `_components/layout/sidebar/ClipProperties` | 속성 계산(마스크 크롭 역산 등) |

## 코딩 규칙

### 상태 관리
- ✅ 모든 편집 상태는 `useStore`를 통해 관리
- ✅ 새 상태 추가 시 `EditorState` 인터페이스에 타입 정의 먼저
- ✅ 불변성(immutability) 유지 — `set()` 내에서 스프레드 연산자 사용
- ❌ 컴포넌트 로컬 상태로 전역 데이터 관리 금지

### 유틸리티
- ✅ 순수 함수로 작성 (사이드 이펙트 최소화)
- ✅ 타입 정의 명확히 — `Clip`, `Track` 등 features의 인터페이스 사용
- ❌ DOM 직접 조작은 렌더링 유틸(`render.ts`) 등 한정된 곳에서만

### 타입 안전성
- ✅ `Clip`, `Track` 인터페이스 변경 시 모든 소비자에게 미치는 영향 확인
- ✅ 옵셔널 속성에 대해 항상 널 체크 수행
- ❌ `any` 타입 남용 금지

### 시간 단위
- ✅ 모든 시간 값은 **초(seconds)** 단위
- ❌ 밀리초, 프레임 번호 사용 금지

### 성능
- ✅ Zustand selector 활용하여 불필요한 리렌더링 방지
- ✅ 재생 중 `requestAnimationFrame` 사용
- ✅ 큰 파일 처리 시 로딩 인디케이터 표시
- ❌ 동기 작업으로 UI 블로킹 금지

### 에러 처리
- ✅ 미디어 로드 실패 시 폴백 처리
- ✅ 사용자에게 명확한 에러 메시지 제공
- ❌ 콘솔 에러만 남기고 무시 금지

## 의존성 규칙
- ✅ `@/utils/`, `@/lib/` — 자체 관리 영역
- ❌ `@/components/`를 직접 import 하지 않음 (단방향 의존)
- ❌ `@/app/`을 직접 import 하지 않음

## 참조 파일
- `Rules/AI_ENGINEERING_CONTRACT.md` — 전체 프로젝트 규칙
template 사이즈중에 side template을 불러오면 