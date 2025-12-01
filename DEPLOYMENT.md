# 배포 가이드

## 프로덕션 배포 전 체크리스트

### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
# 관리자 비밀번호 (반드시 변경하세요!)
ADMIN_PASSWORD=your_secure_password_here

# API URL (선택사항)
NEXT_PUBLIC_API_URL=

# 로깅 레벨 (선택사항)
LOG_LEVEL=info
```

### 2. 보안 설정

- [ ] 관리자 비밀번호 변경 (`ADMIN_PASSWORD`)
- [ ] HTTPS 사용 (프로덕션 환경)
- [ ] CORS 설정 확인
- [ ] Rate Limiting 설정 확인

### 3. 빌드 및 테스트

```bash
# 의존성 설치
npm install

# 빌드 테스트
npm run build

# 프로덕션 서버 실행 테스트
npm start
```

### 4. 데이터베이스 설정 (선택사항)

현재는 메모리 저장소를 사용하지만, 프로덕션에서는 데이터베이스 사용을 권장합니다:

- PostgreSQL
- MongoDB
- MySQL

데이터베이스 연동 시 `app/api/inquiries/store.ts`와 `app/api/config/store.ts`를 수정하세요.

## Vercel 배포

### 1. Vercel 계정 생성 및 프로젝트 연결

```bash
npm i -g vercel
vercel login
vercel
```

### 2. 환경 변수 설정

Vercel 대시보드에서 환경 변수를 설정하세요:
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_API_URL` (필요한 경우)

### 3. 자동 배포

GitHub/GitLab과 연동하면 자동 배포가 설정됩니다.

## Docker 배포

### Dockerfile 예시

```dockerfile
FROM node:20-alpine AS base

# 의존성 설치
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 프로덕션
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Docker Compose 예시

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - NODE_ENV=production
    restart: unless-stopped
```

## 성능 최적화

### 1. 이미지 최적화

- Next.js Image 컴포넌트 사용
- 이미지 CDN 사용 (Cloudinary, Imgix 등)

### 2. 캐싱

- API 응답 캐싱
- 정적 자산 CDN 배포

### 3. 모니터링

- 에러 추적: Sentry, LogRocket
- 성능 모니터링: Vercel Analytics, Google Analytics
- 로깅: 구조화된 로깅 시스템

## 문제 해결

### 빌드 실패

```bash
# 캐시 정리
rm -rf .next
npm run build
```

### 메모리 부족

```bash
# Node.js 메모리 제한 증가
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### 포트 충돌

```bash
# 다른 포트 사용
PORT=3001 npm start
```

## 보안 권장사항

1. **HTTPS 사용**: 모든 프로덕션 환경에서 HTTPS 필수
2. **환경 변수 보호**: `.env.local` 파일을 Git에 커밋하지 마세요
3. **관리자 비밀번호**: 강력한 비밀번호 사용
4. **Rate Limiting**: API 엔드포인트 보호
5. **입력값 검증**: 모든 사용자 입력 검증 및 sanitization

## 모니터링 및 로깅

### 로깅 레벨

- `debug`: 개발 환경에서만 사용
- `info`: 일반 정보
- `warn`: 경고 메시지
- `error`: 에러 메시지

### 로깅 서비스 연동

프로덕션 환경에서는 다음 서비스와 연동을 권장합니다:
- Sentry (에러 추적)
- LogRocket (세션 재생)
- Datadog (모니터링)

## 지원

문제가 발생하면 다음을 확인하세요:
1. 환경 변수 설정
2. 빌드 로그
3. 서버 로그
4. 브라우저 콘솔

