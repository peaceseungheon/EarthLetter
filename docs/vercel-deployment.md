# Vercel 배포 가이드 — EarthLetter

> Nuxt 3 SSR + Prisma (Supabase PostgreSQL) 기반 프로젝트를 Vercel에 배포하는 전체 절차입니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Supabase 데이터베이스 설정](#2-supabase-데이터베이스-설정)
3. [Vercel 프로젝트 연결](#3-vercel-프로젝트-연결)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [빌드 설정 확인](#5-빌드-설정-확인)
6. [Prisma 마이그레이션 배포](#6-prisma-마이그레이션-배포)
7. [첫 배포 실행](#7-첫-배포-실행)
8. [도메인 연결 (선택)](#8-도메인-연결-선택)
9. [이후 배포 워크플로우](#9-이후-배포-워크플로우)
10. [트러블슈팅](#10-트러블슈팅)

---

## 1. 사전 준비

### 필요 계정

| 서비스                           | 용도                    | 무료 플랜 |
| -------------------------------- | ----------------------- | --------- |
| [Vercel](https://vercel.com)     | 앱 호스팅 (Nuxt SSR)    | ✅        |
| [Supabase](https://supabase.com) | PostgreSQL 데이터베이스 | ✅        |

### 필요 CLI 도구

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login
```

### GitHub 연동 확인

```bash
# 현재 브랜치가 remote에 push된 상태여야 합니다
git status
git push origin main
```

---

## 2. Supabase 데이터베이스 설정

> 이미 로컬 DB를 쓰고 있다면 프로덕션용 Supabase 프로젝트를 별도로 생성합니다.

### 2-1. Supabase 프로젝트 생성

1. [app.supabase.com](https://app.supabase.com) → **New Project** 클릭
2. 이름: `earthletter-prod` (또는 원하는 이름)
3. 비밀번호: 강력한 DB 비밀번호 입력 (기록해 둘 것)
4. 지역: `Northeast Asia (Seoul)` 권장

### 2-2. 연결 문자열 확인

Supabase 대시보드 → **Project Settings** → **Database** → **Connection strings**:

| 항목           | 경로                               | 용도                |
| -------------- | ---------------------------------- | ------------------- |
| `DATABASE_URL` | **Transaction pooler** (포트 6543) | 런타임 PrismaClient |
| `DIRECT_URL`   | **Direct connection** (포트 5432)  | `prisma migrate`    |

**Transaction pooler** 탭에서 URI 복사 → `?pgbouncer=true` 쿼리 파라미터가 붙어 있으면 그대로 사용:

```
postgresql://postgres.xxxx:비밀번호@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct connection** URI (마이그레이션 전용):

```
postgresql://postgres.xxxx:비밀번호@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
```

---

## 3. Vercel 프로젝트 연결

### 방법 A — Vercel 대시보드 (권장)

1. [vercel.com/new](https://vercel.com/new) 접속
2. **Import Git Repository** → GitHub 계정 연결 → `EarthLetter` 선택
3. **Framework Preset**: `Nuxt.js` 자동 감지 확인
4. **Root Directory**: `.` (기본값 유지)
5. 환경 변수는 아래 [4단계](#4-환경-변수-설정)에서 입력 후 **Deploy**

### 방법 B — Vercel CLI

```bash
# 프로젝트 루트에서 실행
cd /path/to/EarthLetter
vercel link        # 기존 프로젝트 연결 또는 신규 생성
```

---

## 4. 환경 변수 설정

Vercel 대시보드 → 프로젝트 → **Settings** → **Environment Variables**

> 각 변수의 환경(Environment)을 올바르게 지정합니다.

### 필수 변수

| 변수명          | 값 예시                                       | 환경                |
| --------------- | --------------------------------------------- | ------------------- |
| `DATABASE_URL`  | `postgresql://...?pgbouncer=true`             | Production, Preview |
| `DIRECT_URL`    | `postgresql://...` (포트 5432)                | Production, Preview |
| `INGEST_SECRET` | `openssl rand -hex 32` 결과                   | Production, Preview |
| `SITE_URL`      | `https://earthletter.com`                     | Production          |
| `SITE_URL`      | `https://earthletter-git-main-xxx.vercel.app` | Preview             |

### 선택 변수 (AdSense)

| 변수명                       | 값                  | 환경            |
| ---------------------------- | ------------------- | --------------- |
| `NUXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-xxxxxxxxxx` | Production only |

### CLI로 한 번에 등록하는 방법

```bash
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DIRECT_URL production
vercel env add DIRECT_URL preview
vercel env add INGEST_SECRET production
vercel env add INGEST_SECRET preview
vercel env add SITE_URL production
vercel env add NUXT_PUBLIC_ADSENSE_CLIENT production
```

### 환경 변수 확인

```bash
vercel env ls
```

---

## 5. 빌드 설정 확인

Vercel은 `package.json`의 스크립트를 자동으로 감지합니다. 별도 설정 없이 동작하지만 아래 값을 확인합니다.

| 설정                 | 값                      |
| -------------------- | ----------------------- |
| **Build Command**    | `pnpm run build`        |
| **Output Directory** | `.output` (Nuxt 기본값) |
| **Install Command**  | `pnpm install`          |
| **Node.js Version**  | `20.x` 권장             |

### Node.js 버전 고정 (권장)

`package.json`에 engines 필드 추가:

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

또는 프로젝트 루트에 `.nvmrc` 파일 생성:

```
20
```

### Prisma generate를 빌드에 포함시키기

`package.json`의 `build` 스크립트를 수정하여 Prisma 클라이언트가 빌드 시 자동 생성되도록 합니다:

```json
{
  "scripts": {
    "build": "prisma generate && nuxt build"
  }
}
```

---

## 6. Prisma 마이그레이션 배포

> Vercel은 빌드 타임에 DB 마이그레이션을 실행하지 않습니다. 수동으로 실행해야 합니다.

### 로컬에서 프로덕션 DB에 마이그레이션 적용

```bash
# .env.production 파일 생성 (git에는 커밋하지 마세요!)
cat > .env.production << 'EOF'
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
EOF

# 마이그레이션 배포 실행
dotenv -e .env.production -- pnpm prisma:migrate:deploy
```

또는 직접 환경 변수를 주입:

```bash
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." pnpm prisma:migrate:deploy
```

### 마이그레이션 파일이 없을 때 (최초 배포)

```bash
# 로컬 개발용 마이그레이션 생성 (개발 DB 기준)
pnpm prisma:migrate

# 프로덕션에 배포
DATABASE_URL="..." DIRECT_URL="..." pnpm prisma:migrate:deploy
```

### 시드 데이터 삽입 (필요한 경우)

```bash
DATABASE_URL="..." pnpm prisma:seed
```

---

## 7. 첫 배포 실행

### 대시보드에서

Vercel 대시보드 → 프로젝트 → **Deployments** → **Redeploy** 또는 main 브랜치에 push하면 자동 트리거됩니다.

### CLI에서

```bash
# 프리뷰 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 배포 로그 확인

```bash
# 최신 배포 로그 스트리밍
vercel logs --follow
```

### 배포 후 헬스체크

```bash
# 사이트 정상 응답 확인
curl -I https://your-domain.vercel.app

# API 헬스체크 (예시)
curl https://your-domain.vercel.app/api/countries
```

---

## 8. 도메인 연결 (선택)

### Vercel 대시보드에서

1. 프로젝트 → **Settings** → **Domains**
2. 도메인 입력 (예: `earthletter.com`) → **Add**
3. DNS 레코드 지시에 따라 설정:

| 타입    | 이름  | 값                     |
| ------- | ----- | ---------------------- |
| `A`     | `@`   | `76.76.21.21`          |
| `CNAME` | `www` | `cname.vercel-dns.com` |

### SITE_URL 업데이트

도메인 연결 후 Vercel 환경 변수에서 `SITE_URL`을 실제 도메인으로 업데이트하고 재배포:

```bash
vercel env rm SITE_URL production
vercel env add SITE_URL production
# 입력: https://earthletter.com
vercel --prod
```

---

## 9. 이후 배포 워크플로우

### 일반 코드 변경

```bash
git add .
git commit -m "feat: ..."
git push origin main
# → Vercel이 자동으로 빌드 + 배포
```

### DB 스키마 변경이 포함된 경우

```bash
# 1. 마이그레이션 파일 생성 (로컬)
pnpm prisma:migrate

# 2. 프로덕션 DB에 마이그레이션 적용 (배포 전)
DATABASE_URL="..." DIRECT_URL="..." pnpm prisma:migrate:deploy

# 3. 코드 push → Vercel 자동 배포
git push origin main
```

### 브랜치 프리뷰 배포

main 외 브랜치에 push하면 Vercel이 자동으로 프리뷰 URL을 생성합니다:

```
https://earthletter-git-feat-xxx.vercel.app
```

---

## 10. 트러블슈팅

### `prisma generate` 실패

```
Error: @prisma/client did not initialize
```

**해결:** `package.json` build 스크립트에 `prisma generate &&` 추가 ([5단계](#5-빌드-설정-확인) 참고)

---

### 환경 변수가 빌드에 반영 안 됨

- Vercel 대시보드에서 환경 변수 추가 후 **반드시 재배포** 필요
- `NUXT_` 접두사 변수는 빌드 타임과 런타임 모두에 필요

```bash
vercel --prod  # 강제 재배포
```

---

### `DATABASE_URL` 연결 오류 (Serverless 환경)

Prisma + PgBouncer 조합에서 `?pgbouncer=true&connection_limit=1` 파라미터가 필요합니다:

```
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
```

---

### 빌드 타임아웃 (무료 플랜 60초 제한)

`postinstall` 스크립트의 `world-atlas` 파일 복사가 느릴 수 있습니다. Vercel Pro 플랜 또는 캐시 활용 권장.

---

### SSR 함수 실행 오류

Vercel 대시보드 → **Functions** 탭에서 실시간 로그 확인:

```bash
vercel logs --follow
```

---

## 참고 링크

- [Nuxt 3 Vercel 배포 공식 문서](https://nuxt.com/deploy/vercel)
- [Prisma + Vercel 가이드](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connection-pooling)
- [Vercel 환경 변수 문서](https://vercel.com/docs/environment-variables)
