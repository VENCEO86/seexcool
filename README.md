# See X Cool - 이미지 화질 개선 & 배경제거 도구

고품질 이미지 화질 개선, 밝기/명암 조절, 배경제거(누끼) 기능을 제공하는 무료 이미지 편집 도구입니다.

## ✨ 주요 기능

- 🖼️ **화질 개선**: 최대 4배까지 이미지 스케일업
- 💡 **밝기/명암 조절**: 실시간 밝기 및 명암 조절
- ✂️ **배경제거 (누끼)**: 자동 배경제거 기능
- 📱 **반응형 디자인**: 모바일/태블릿/데스크톱 완벽 지원
- ⚡ **빠른 처리**: 브라우저 기반 실시간 처리
- 🎨 **현대적인 UI/UX**: 트렌디한 미니멀 디자인

## 주요 기능

### 이미지 업로드
- 파일 선택 업로드
- 드래그 앤 드롭 지원
- Ctrl+V 붙여넣기 (PC)
- 모바일 카메라 촬영

### 이미지 편집
- 스케일업: 1.0x ~ 4.0x 실시간 조절
- 밝기 조절: 50% ~ 150%
- 명암 조절: 50% ~ 150%
- 실시간 미리보기 (Canvas 기반)

### 내보내기
- PNG 형식 다운로드
- 클립보드 복사 (Clipboard API)

### 추가 기능
- 상단/하단 광고 배너 (플러그인 컴포넌트)
- 관리자 페이지 (/admin)에서 광고 설정 관리
- 키보드 단축키 지원 (Ctrl+S: 다운로드)
- 반응형 디자인 (모바일/태블릿/데스크톱)

## 기술 스택

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 빌드

```bash
npm run build
npm start
```

## 관리자 페이지

`/admin` 경로에서 광고 배너 설정을 관리할 수 있습니다.

- 기본 비밀번호: `admin123` (프로덕션에서는 환경 변수로 변경하세요)
- 환경 변수: `ADMIN_PASSWORD`로 설정 가능

## API 엔드포인트

### 문의 API
- `GET /api/inquiries` - 문의 목록 조회
- `POST /api/inquiries` - 새 문의 생성
- `GET /api/inquiries/[id]` - 문의 조회
- `PATCH /api/inquiries/[id]` - 문의 상태 업데이트

### 설정 API
- `GET /api/config` - 설정 조회
- `POST /api/config` - 설정 저장

### 기타
- `GET /api/health` - 서버 상태 확인

## 보안 기능

- ✅ XSS 방지 (입력값 sanitization)
- ✅ Rate Limiting (API 보호)
- ✅ 입력값 검증 및 길이 제한
- ✅ 이메일 형식 검증

## 배포

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.

### 빠른 배포 (Vercel)

```bash
npm i -g vercel
vercel
```

환경 변수 설정:
- `ADMIN_PASSWORD`: 관리자 비밀번호

## 프로젝트 구조

```
├── app/
│   ├── admin/
│   │   └── page.tsx          # 관리자 페이지
│   ├── layout.tsx            # 루트 레이아웃 (SEO, ErrorBoundary)
│   ├── page.tsx              # 메인 랜딩 페이지
│   └── globals.css           # 전역 스타일
├── components/
│   ├── AdBanner.tsx          # 광고 배너 컴포넌트
│   ├── ErrorBoundary.tsx     # 에러 바운더리
│   └── ImageEditor.tsx       # 이미지 편집기 컴포넌트
└── lib/
    ├── adConfig.ts           # 광고 설정 유틸리티
    └── types.ts              # 타입 정의
```

## 고도화 사항

### 성능 최적화
- Canvas 렌더링 최적화 (`requestAnimationFrame`)
- 메모리 누수 방지
- Canvas 크기 제한 (최대 4096px)

### 사용자 경험
- 드래그 앤 드롭 지원
- 키보드 단축키 (Ctrl+S: 다운로드)
- 로딩 상태 표시
- Toast 알림 시스템

### 접근성
- ARIA 레이블
- 키보드 네비게이션
- 스크린 리더 지원

### 에러 처리
- React Error Boundary
- 전역 에러 핸들링
- 파일 읽기/이미지 로딩 에러 처리

### SEO
- 메타 태그 최적화
- Open Graph 태그
- 반응형 뷰포트 설정

