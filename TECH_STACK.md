# 🚀 프로젝트 기술 스택 (Tech Stack) 및 아키텍처 정리

> 본 문서는 [생활관 공간관리 프로젝트]의 포트폴리오 활용을 위한 기술 스택 및 주요 기능 구현 명세서입니다.

---

## 🏗️ 1. 핵심 아키텍처 (Core Architecture)

본 프로젝트는 빠르고 유연한 사용자 경험(UX)을 제공하기 위해 **리액트 기반의 싱글 페이지 애플리케이션(SPA)** 으로 구축되었으며, 백엔드 인프라 관리를 최소화하고 개발 속도를 극대화하기 위해 **Supabase (BaaS)** 와 **Vercel** 서버리스 호스팅을 채택한 모던 웹 애플리케이션입니다.

- **Frontend**: React (TypeScript) + Vite
- **Backend / DB**: Supabase (PostgreSQL)
- **Deployment**: Vercel

---

## 🛠️ 2. 상세 기술 스택 (Detailed Tech Stack)

### 🎨 Frontend
- **React 19**: 최신 컴포넌트 기반 UI 렌더링 및 상태 관리.
- **TypeScript**: 정적 타입 검사를 통한 런타임 에러 방지 및 코드 유지보수성, 안정성 극대화.
- **Vite**: 초고속 HMR(Hot Module Replacement)을 지원하는 차세대 프론트엔드 빌드 툴. Webpack 대비 혁신적인 빌드 속도 제공.
- **Tailwind CSS (v4)**: 유틸리티 우선(Utility-First) CSS 프레임워크로, 직관적이고 일관된 디자인 시스템(Design System)을 빠른 속도로 구축.
- **React Router DOM**: SPA 환경에서의 매끄러운 클라이언트 사이드 라우팅 구현.

### 🗄️ Backend (BaaS) & Database
- **Supabase**: Firebase의 오픈소스 대안으로, 강력한 관계형 데이터베이스(RDBMS)를 기반으로 한 Backend-as-a-Service.
- **PostgreSQL**: Supabase의 코어 데이터베이스. 안정적이고 확장이 용이한 구조.
- **Supabase Auth (Google OAuth)**: 구글 소셜 로그인 연동을 통한 안전하고 간편한 사용자 인증 처리. Row Level Security (RLS) 정책을 통해 허가된 사용자(`allowed_users` 테이블)만 데이터에 접근할 수 있도록 강력한 보안 구현.

### 🧩 UI & Interaction Libraries
- **@hello-pangea/dnd**: 대시보드 내 건물/데이터 리스트의 직관적인 드래그 앤 드롭(Drag & Drop) 순서 변경 UX 구현.
- **Motion (Framer Motion)**: 부드럽고 자연스러운 컴포넌트 마이크로 애니메이션 제공.
- **Lucide React**: 깔끔하고 일관된 모던 벡터(SVG) 아이콘 시스템.

### 🚀 DevOps & Hosting
- **Vercel**: GitHub 연동을 통한 CI/CD (지속적 통합/배포) 자동화. 코드가 푸시되면 자동으로 빌드 및 글로벌 CDN 기반의 엣지 네트워크 배포 체인.
- **Git / GitHub**: 소스 코드 버전 관리 및 협업.

---

## ✨ 3. 주요 구현 기능 및 하이라이트 (Key Features)

### 🗺️ 인터랙티브 맵 뷰어 & 에디터 (Interactive Map Viewer & Editor)
- **커스텀 폴리곤(Polygon) 렌더링 역량**: 사용자가 업로드한 평면도 이미지 위에 직접 마우스 클릭으로 방(Room)의 형태(다각형)를 그릴 수 있는 에디터 구현.
- **동적 SVG 생성**: 그려진 폴리곤의 좌표 점(points) 데이터를 바탕으로 SVG 이미지를 동적으로 렌더링하여 맵 뷰어에 표시.
- **반응형 텍스트 스케일링**: 방의 크기(다각형의 면적 및 Box 크기)를 수학적으로 계산하여, 방 이름(호실) 텍스트의 폰트 사이즈가 자동으로 알맞게 조정되는 알고리즘 구현.
- **상태 기반 시각화 (Color Mapping)**: Supabase 데이터베이스와 실시간 연동되어 방의 상태(가용, 만실, 특정 비고 등)에 따라 폴리곤의 색상(초록, 주황, 빨강, 회색 등)이 즉각적으로 변환되는 직관적 모니터링 시스템.

### 📊 대시보드 통계 및 데이터 관리
- 전체 수용 인원 및 현재 등록 인원을 퍼센티지(%)와 함께 시각화. `.toLocaleString()`을 활용해 가독성 높은 숫자 포맷팅 제공.
- 여러 건물의 데이터를 효율적으로 병렬 페칭(Parallel Fetching)하여 초기 로딩 속도 최적화.

### 🛡️ 철저한 보안 통제 시스템
- **RLS (Row Level Security)**: Supabase 데이터베이스 단에서 익명 사용자의 읽기/쓰기/삭제 권한을 원천 차단. 구글 OAuth를 통해 앱에 로그인하고 승인된 관리자 명단에 있는 경우에만 접근 허용하는 제로 트러스트(Zero-Trust) 수준의 데이터 보안.
