# Overnight Brief — 기술 스펙 문서 (Tech Spec)

> 기획서(PRD) 기반, 4주 MVP 출시를 위한 최소 기술 스택 정의
> MVP 범위: 결제 제외. 이메일 발송은 Gmail API 직접 구현.

---

## 1. 기술 스택 (Tech Stack)

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| **Frontend** | Next.js 14+ (App Router) + TypeScript | 랜딩 + API 라우트 일원화, Vercel 배포 최적화 |
| **Styling** | Tailwind CSS | 빠른 UI 구현 |
| **DB** | Supabase (PostgreSQL) | 오픈소스, Auth·Storage 내장, 무료 티어 |
| **인증** | 이메일+비밀번호 (bcryptjs + jose JWT) + Google OAuth 2.0 직접 구현 | Supabase Auth 미사용, 자체 세션 쿠키 관리 |
| **스케줄러** | GitHub Actions (cron) | 별도 서버 없이 무료로 새벽 배치 실행 |
| **뉴스 수집** | NewsAPI.org + Cheerio | API로 주요 외신 수집, Cheerio로 보조 크롤링 |
| **AI 요약** | OpenAI API (GPT-4o mini) | 가성비 최적, 한국어 요약 품질 우수 |
| **이메일 발송** | Gmail API + Nodemailer | 직접 구현, 외부 서비스 의존 없음, 500건/일 무료 |
| **배포** | Vercel | Next.js 네이티브, 무료 플랜으로 시작 |

> **결제(Stripe)는 MVP 범위에서 제외** — 초기 베타 검증 후 추가 예정

---

## 2. DB 스키마 (Supabase PostgreSQL)

```sql
-- 유저
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',  -- active | inactive
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 키워드 (유저당 최대 3개)
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  news_count INT DEFAULT 10,      -- 키워드당 인사이트 생성에 사용할 뉴스 수 (1~20, 기본 10)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 수집된 원문 뉴스
CREATE TABLE raw_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  title TEXT,
  url TEXT UNIQUE,
  content TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now()
);

-- AI 가공 뉴스 아이템 (발송 전 큐레이션 결과)
CREATE TABLE newsletter_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  raw_news_id UUID REFERENCES raw_news(id),
  matched_keyword TEXT,           -- 매칭된 유저 키워드
  summary_ko TEXT NOT NULL,       -- GPT 한국어 3줄 요약
  importance_rank INT,            -- 중요도 순위 (1이 가장 높음)
  briefing_date DATE NOT NULL,    -- 발송 예정일
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 알림 채널 (이메일 외 Slack·Discord 웹훅 지원)
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'email' | 'slack' | 'discord'
  destination TEXT NOT NULL,    -- 이메일 주소 or 웹훅 URL
  label TEXT,                   -- 사용자 지정 이름 (예: "회사 슬랙", "개인 메일")
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 발송 로그
CREATE TABLE briefing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  channel_id UUID REFERENCES notification_channels(id),
  sent_at TIMESTAMPTZ DEFAULT now(),
  html_content TEXT,
  status TEXT DEFAULT 'pending',  -- pending | sent | failed
  error_message TEXT              -- 실패 시 에러 상세
);
```

### 데이터 흐름 요약

```
raw_news → (AI 필터링·요약) → newsletter_items → (채널별 발송) → briefing_logs
```

- `notification_channels`: 유저당 여러 채널(이메일·Slack·Discord) 등록 가능. 채널별 `is_active`로 개별 ON/OFF.
- `newsletter_items`: `process-ai.ts`가 생성. 유저별·날짜별 큐레이션된 개별 뉴스 아이템.
- `briefing_logs`: `send-emails.ts`가 생성. 채널별 발송 결과와 실패 원인까지 기록.
- 어드민 Human-in-the-loop 확인 시 `newsletter_items`를 조회하면 발송 전 내용 검토 가능.

> `users` 테이블에서 `stripe_customer_id`, `trial_ends_at` 제거 — MVP 이후 결제 도입 시 마이그레이션으로 추가

---

## 3. 시스템 파이프라인 아키텍처

```
[GitHub Actions Cron - 새벽 2시 KST]
  → scripts/collect-news.ts
    ├── NewsAPI.org 호출 (top headlines, technology category)
    ├── Cheerio로 보조 사이트 스크래핑 (필요 시)
    └── Supabase raw_news 테이블에 저장

[GitHub Actions Cron - 새벽 4시 KST]
  → scripts/process-ai.ts
    ├── raw_news에서 당일 수집 뉴스 로드
    ├── 유저별 keywords로 관련 뉴스 필터링 (키워드 매칭)
    ├── 키워드별 keywords.news_count 만큼 뉴스 상위 선별 (기본 10개)
    ├── OpenAI GPT-4o mini로 한국어 3줄 요약 + 중요도 순위 생성
    └── newsletter_items에 유저별 가공 아이템 저장 (importance_rank 포함)

[어드민 선택사항 - 오전 6~7시]
  → DB/어드민 페이지에서 newsletter_items 미리보기
    └── 이상 항목 수동 삭제 또는 수정 (Human-in-the-loop)

[GitHub Actions Cron - 오전 8시 KST]
  → scripts/send-emails.ts
    ├── newsletter_items에서 오늘 날짜 항목 유저별 조회 (importance_rank 순 정렬)
    ├── 유저별 HTML 뉴스레터 조립
    ├── Gmail API (Nodemailer)로 발송
    └── briefing_logs에 발송된 HTML + status(sent/failed) 기록
```

---

## 4. Gmail API 이메일 발송 구현

Gmail API를 OAuth2로 인증하여 Nodemailer로 발송한다.

### 설정 절차
1. Google Cloud Console에서 프로젝트 생성
2. Gmail API 활성화
3. OAuth2 클라이언트 ID 발급 (데스크탑 앱 타입)
4. Refresh Token 획득 (`googleapis` 라이브러리로 일회성 인증)
5. 이후 배치 실행 시 Refresh Token으로 Access Token 자동 갱신

### 발송 한도
| 계정 유형 | 일일 발송 한도 |
|-----------|---------------|
| 일반 Gmail (@gmail.com) | 500건/일 |
| Google Workspace | 2,000건/일 |

MVP 초기 베타(100명 이내)는 일반 Gmail로 충분.

### 핵심 코드 구조 (`lib/mailer.ts`)
```typescript
import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

export async function sendEmail(to: string, subject: string, html: string) {
  const accessToken = await oauth2Client.getAccessToken();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken.token as string,
    },
  });

  await transporter.sendMail({
    from: `Overnight Brief <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
```

---

## 5. 디렉터리 구조

```
overnight-brief/
├── app/                                    # Next.js App Router
│   ├── page.tsx                            # 랜딩 페이지 (소개 + 구독 CTA)
│   ├── layout.tsx
│   │
│   ├── auth/
│   │   ├── login/page.tsx                  # 로그인 (이메일+비밀번호 / Google 로그인)
│   │   └── signup/page.tsx                 # 회원가입 (이메일+비밀번호)
│   │
│   ├── (dashboard)/                        # 인증된 유저 전용 영역
│   │   ├── layout.tsx                      # 상단 nav (로고·설정·로그아웃)
│   │   └── settings/
│   │       └── page.tsx                    # 유저 설정 통합 페이지 (키워드·채널·구독)
│   │
│   ├── admin/                              # 관리자 전용 영역 (ADMIN_SECRET 미들웨어)
│   │   ├── layout.tsx                      # 사이드바 nav
│   │   ├── page.tsx                        # 파이프라인 현황 대시보드
│   │   ├── queue/page.tsx                  # 오늘 발송 큐 미리보기 (newsletter_items)
│   │   ├── logs/page.tsx                   # 발송 로그 조회 (briefing_logs)
│   │   └── users/
│   │       ├── page.tsx                    # 회원 목록 (검색·필터·구독상태 변경)
│   │       └── [id]/page.tsx               # 회원 상세 (키워드·채널·발송이력)
│   │
│   └── api/                                # route.ts는 모두 여기에 집중
│       ├── auth/callback/route.ts          # Google OAuth 2.0 콜백 (code → 토큰 교환 → JWT 세션 발급)
│       ├── keywords/route.ts               # GET·POST·DELETE 키워드 관리
│       ├── channels/route.ts               # GET·POST·DELETE·PATCH 알림 채널 관리
│       ├── subscription/route.ts           # PATCH 구독 상태 변경 (active/inactive)
│       └── admin/
│           ├── queue/route.ts              # 어드민 큐 조회·수정·삭제
│           ├── pipeline-status/route.ts    # 파이프라인 실행 로그 조회
│           └── users/
│               ├── route.ts               # GET 회원 목록 (검색·페이지네이션)
│               └── [id]/route.ts          # GET 회원 상세 / PATCH 구독상태 / DELETE 계정삭제
│
├── middleware.ts                           # /admin/* 접근 시 ADMIN_SECRET 쿠키 검증
│
├── scripts/                               # GitHub Actions 배치 스크립트
│   ├── collect-news.ts                    # 뉴스 수집 (새벽 2시)
│   ├── process-ai.ts                      # AI 요약 처리 (새벽 4시)
│   └── send-emails.ts                     # 이메일 발송 (오전 8시)
│
├── lib/
│   ├── supabase.ts                        # Supabase 클라이언트 (서버용 / 클라이언트용, DB 전용)
│   ├── auth.ts                            # JWT signToken/verifyToken/세션 쿠키 유틸
│   ├── openai.ts                          # OpenAI 클라이언트 + 요약 프롬프트
│   ├── mailer.ts                          # Gmail API + Nodemailer 발송 함수
│   └── notifier.ts                        # Slack·Discord 웹훅 발송 함수
│
├── .github/
│   └── workflows/
│       └── pipeline.yml                   # 3단계 Cron 스케줄러 정의
├── .env.local
└── package.json
```

---

## 6. 환경변수 목록

```bash
# Supabase (DB 전용, Auth 미사용)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 배치 스크립트 전용 (RLS 우회)

# JWT (이메일 로그인 세션 서명용)
JWT_SECRET=                       # openssl rand -base64 32 으로 생성

# Google OAuth 2.0 (구글 로그인, Supabase Auth 미사용 — 직접 구현)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OpenAI
OPENAI_API_KEY=

# NewsAPI
NEWS_API_KEY=

# Gmail API (OAuth2)
GMAIL_USER=                       # 발신 Gmail 주소 (예: yourname@gmail.com)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# 어드민 패널 접근 제어
ADMIN_SECRET=                     # middleware.ts가 쿠키값과 비교하는 비밀키
```

---

## 7. GitHub Actions Cron 설정

```yaml
# .github/workflows/pipeline.yml

name: Overnight Brief Pipeline

on:
  schedule:
    - cron: '0 17 * * *'   # UTC 17:00 = KST 02:00 → 뉴스 수집
    - cron: '0 19 * * *'   # UTC 19:00 = KST 04:00 → AI 처리
    - cron: '0 23 * * *'   # UTC 23:00 = KST 08:00 → 이메일 발송
  workflow_dispatch:         # 수동 실행 (테스트용)

jobs:
  collect:
    if: github.event.schedule == '0 17 * * *'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx ts-node scripts/collect-news.ts
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEWS_API_KEY: ${{ secrets.NEWS_API_KEY }}

  process:
    if: github.event.schedule == '0 19 * * *'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx ts-node scripts/process-ai.ts
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

  send:
    if: github.event.schedule == '0 23 * * *'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx ts-node scripts/send-emails.ts
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GMAIL_USER: ${{ secrets.GMAIL_USER }}
          GMAIL_CLIENT_ID: ${{ secrets.GMAIL_CLIENT_ID }}
          GMAIL_CLIENT_SECRET: ${{ secrets.GMAIL_CLIENT_SECRET }}
          GMAIL_REFRESH_TOKEN: ${{ secrets.GMAIL_REFRESH_TOKEN }}
```

---

## 8. 프론트엔드 화면 설계

### 화면 목록 및 접근 권한

| 경로 | 화면명 | 접근 | 설명 |
|------|--------|------|------|
| `/` | 랜딩 페이지 | 비로그인 | 서비스 소개 + 회원가입 CTA |
| `/auth/login` | 로그인 | 비로그인 | 이메일+비밀번호 / Google OAuth |
| `/auth/signup` | 회원가입 | 비로그인 | 이메일+비밀번호 회원가입 |
| `/settings` | 유저 설정 | 로그인 필요 | 키워드·채널·구독 통합 관리 |
| `/admin` | 파이프라인 현황 | 어드민 전용 | 오늘 수집·처리·발송 현황 |
| `/admin/queue` | 발송 큐 미리보기 | 어드민 전용 | 발송 전 아이템 검토·수정 |
| `/admin/logs` | 발송 로그 | 어드민 전용 | 과거 발송 이력 및 실패 추적 |

---

### 8-1. 랜딩 페이지 (`/`)

```
┌─────────────────────────────────────────────────────────┐
│  OVERNIGHT BRIEF                         [로그인] [시작하기] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   밤사이 쌓인 글로벌 테크 뉴스를                              │
│   매일 아침 8시, 한국어 요약으로 받아보세요.                    │
│                                                         │
│   [메일 예시 미리보기 카드 — 실제 뉴스레터 HTML 스크린샷]         │
│                                                         │
│   ┌──────────────────────────────┐                      │
│   │  이메일 주소 입력              │  [무료로 시작하기 →]   │
│   └──────────────────────────────┘                      │
│                                                         │
│   ✓ 매일 아침 8시 발송   ✓ 키워드 맞춤   ✓ 무료 체험         │
└─────────────────────────────────────────────────────────┘
```

**동작:** 이메일 입력 후 → `/auth/signup?email=...`으로 이동, 회원가입 폼 또는 Google 로그인 유도.

---

### 8-2. 로그인 페이지 (`/auth/login`)

```
┌─────────────────────────────────┐
│         Overnight Brief         │
│                                 │
│   [G] Google 계정으로 계속하기    │
│                                 │
│   ──────── 또는 ────────         │
│                                 │
│   이메일 주소                    │
│   ┌───────────────────────┐     │
│   │ you@example.com       │     │
│   └───────────────────────┘     │
│   비밀번호                       │
│   ┌───────────────────────┐     │
│   │ ••••••                │     │
│   └───────────────────────┘     │
│   [로그인]                       │
│                                 │
│   계정이 없으신가요? [회원가입 →]  │
└─────────────────────────────────┘
```

**동작:** 이메일+비밀번호 로그인 → JWT 세션 쿠키 발급 → `/settings`로 리다이렉트. Google 버튼 클릭 → Google OAuth 인증 → `/api/auth/callback` 콜백 → JWT 세션 쿠키 발급 → `/settings` 리다이렉트.

### 8-3. 회원가입 페이지 (`/auth/signup`)

```
┌─────────────────────────────────┐
│         Overnight Brief         │
│                                 │
│   [G] Google 계정으로 계속하기    │
│                                 │
│   ──────── 또는 ────────         │
│                                 │
│   이메일 주소                    │
│   ┌───────────────────────┐     │
│   │ you@example.com       │     │
│   └───────────────────────┘     │
│   비밀번호 (6자 이상)             │
│   ┌───────────────────────┐     │
│   │ ••••••                │     │
│   └───────────────────────┘     │
│   비밀번호 확인                   │
│   ┌───────────────────────┐     │
│   │ ••••••                │     │
│   └───────────────────────┘     │
│   [회원가입]                     │
│                                 │
│   이미 계정이 있으신가요? [로그인 →]│
└─────────────────────────────────┘
```

**동작:** 이메일+비밀번호 회원가입 → users 테이블 insert + bcrypt 해시 저장 → JWT 세션 쿠키 발급 → `/settings`로 리다이렉트.

---

### 8-3. 유저 설정 페이지 (`/settings`)

세 개의 섹션을 한 페이지에 표시. 각 섹션은 독립적으로 저장.

#### ① 키워드 관리

```
관심 키워드 설정 (최대 3개)
┌─────────────────────────────────────────────────────────────────┐
│  키워드              뉴스 수                                      │
│  ─────────────────────────────────────────────────────────────  │
│  AI바이브코딩        [━━━━━━●──────] 10개    [삭제]               │
│  스타트업            [━━━━━━━━━━━●──] 15개   [삭제]               │
│                                                                 │
│  [+ 키워드 추가]                                                  │
└─────────────────────────────────────────────────────────────────┘
* 키워드는 영문·한글 모두 가능.
* 뉴스 수: 키워드당 인사이트 생성에 사용할 원문 뉴스 개수. 1~20개, 기본값 10개.
  많을수록 더 다양한 관점 반영. 적을수록 핵심 뉴스만 요약.
* 3개 등록 시 [+ 키워드 추가] 버튼 비활성화.
```

키워드 추가 모달:

```
┌─────────────────────────────────────┐
│  키워드 추가                          │
│                                     │
│  키워드    ┌─────────────────────┐   │
│            │ 예: AI바이브코딩     │   │
│            └─────────────────────┘  │
│                                     │
│  뉴스 수 (기본 10개)                  │
│  1  [━━━━━━●────────────] 20        │
│        10개                         │
│  ↑ 키워드 관련 뉴스를 몇 개까지 수집해  │
│    인사이트를 만들지 설정합니다.        │
│                                     │
│  [취소]                    [저장]    │
└─────────────────────────────────────┘
```

- API: `POST /api/keywords` body: `{ keyword, news_count }` / `DELETE /api/keywords?id=...` / `PATCH /api/keywords?id=...` body: `{ news_count }`
- 유저당 최대 3개 제한은 API 레이어에서 검증
- `news_count` 허용 범위: 1~20 (API 레이어에서 clamp)

#### ② 알림 채널 관리

```
알림 받을 곳 설정
┌────────────────────────────────────────────────────────┐
│  채널          목적지                    상태   [액션]   │
│  ─────────────────────────────────────────────────────│
│  📧 이메일     you@gmail.com            ● 활성  [삭제]  │
│  💬 Slack      https://hooks.slack.../  ● 활성  [삭제]  │
│  🎮 Discord    https://discord.com/...  ○ 비활성 [삭제]  │
│                                                       │
│  [+ 이메일 추가]  [+ Slack 웹훅 추가]  [+ Discord 웹훅 추가] │
└────────────────────────────────────────────────────────┘
```

채널 추가 모달:

```
┌─────────────────────────────────────┐
│  Slack 웹훅 추가                      │
│                                     │
│  이름 (선택)  ┌─────────────────┐    │
│               │ 예: 회사 슬랙   │    │
│               └─────────────────┘   │
│  웹훅 URL     ┌─────────────────┐    │
│               │ https://hooks.. │    │
│               └─────────────────┘   │
│  [취소]                    [저장]    │
└─────────────────────────────────────┘
```

- API: `POST /api/channels` (추가) / `DELETE /api/channels?id=...` (삭제) / `PATCH /api/channels?id=...` (활성/비활성 토글)

#### ③ 구독 상태 관리

```
구독 상태
┌────────────────────────────────────────┐
│  현재 상태: ● 구독 중                    │
│                                        │
│  [수신 일시 정지]   ← 클릭 시 inactive   │
│                                        │
│  ─────────────────────────────────────│
│  계정 삭제                              │
│  [계정 및 모든 데이터 삭제]  ← 위험 버튼  │
└────────────────────────────────────────┘
```

- API: `PATCH /api/subscription` body: `{ status: 'active' | 'inactive' }`
- `send-emails.ts`는 발송 전 `users.status = 'active'` 유저만 필터링

---

## 9. 어드민 패널

### 접근 제어

`middleware.ts`에서 `/admin/*` 경로 요청 시 쿠키 `admin_token` 값이 `ADMIN_SECRET` 환경변수와 일치하는지 검증. 불일치 시 `401` 반환.

> 로그인 방식: 브라우저 콘솔에서 `document.cookie = "admin_token=<ADMIN_SECRET>"` 입력 또는 간단한 `/admin/login` 폼 구현.

---

### 9-1. 파이프라인 현황 대시보드 (`/admin`)

```
┌──────────────────────────────────────────────────────────────┐
│  OVERNIGHT BRIEF — 어드민                        2026-05-26   │
├──────────┬─────────────────────────────────────────────────  │
│  사이드바  │  오늘 파이프라인 현황                               │
│          │  ───────────────────────────────────────────────  │
│  대시보드  │  [수집] 새벽 2시   ✅ 완료   수집된 뉴스: 142건       │
│  큐 미리보기│  [AI 처리] 새벽 4시 ✅ 완료   생성된 아이템: 38건     │
│  발송 로그  │  [이메일] 오전 8시  ⏳ 대기   발송 예정: 23명         │
│  회원 관리  │                                                  │
│          │  전체 유저 통계                                     │
│          │  총 구독자: 23명   활성: 21명   비활성: 2명           │
│          │                                                    │
│          │  최근 7일 발송 성공률                                │
│          │  ████████████████░░ 94.3%  (실패: 3건)            │
└──────────┴─────────────────────────────────────────────────  ┘
```

- API: `GET /api/admin/pipeline-status` → `briefing_logs` + `raw_news` + `newsletter_items` 집계 쿼리

---

### 9-2. 발송 큐 미리보기 (`/admin/queue`)

Human-in-the-loop 검토 화면. 오늘 오전 8시 발송 예정 아이템을 유저별로 확인·수정·삭제.

```
┌──────────────────────────────────────────────────────────────┐
│  오늘 발송 큐 (2026-05-26)           [전체 발송 강제 실행 ▶]    │
├──────────────────────────────────────────────────────────────┤
│  필터: [전체 유저 ▾]  [키워드 ▾]                               │
├──────────────────────────────────────────────────────────────┤
│  유저: user@example.com          키워드: AI바이브코딩  [펼치기]  │
│  ─────────────────────────────────────────────────────────── │
│  #1 [중요도 1]  OpenAI releases GPT-5 with...                │
│     📄 한국어 요약: OpenAI가 GPT-5를 공개했습니다. 이번 모델은  │
│     기존 대비 추론 능력이 3배 향상되었으며...                    │
│     🔗 원문: techcrunch.com/...       [수정] [삭제]           │
│                                                              │
│  #2 [중요도 2]  Anthropic announces...                        │
│     📄 한국어 요약: Anthropic이 새로운 안전성 연구 결과를...      │
│     🔗 원문: theverge.com/...         [수정] [삭제]           │
├──────────────────────────────────────────────────────────────┤
│  유저: another@example.com       키워드: 스타트업  [펼치기]     │
└──────────────────────────────────────────────────────────────┘
```

- API:
  - `GET /api/admin/queue?date=2026-05-26` → `newsletter_items` 조회 (유저·키워드별 그룹)
  - `PATCH /api/admin/queue?id=...` → 요약문 수정
  - `DELETE /api/admin/queue?id=...` → 해당 아이템 발송 제외

---

### 9-3. 발송 로그 (`/admin/logs`)

```
┌──────────────────────────────────────────────────────────────┐
│  발송 로그                   날짜: [2026-05-26 ▾]  [검색]      │
├──────────────────────────────────────────────────────────────┤
│  날짜         유저                채널       상태    [상세]     │
│  ─────────────────────────────────────────────────────────── │
│  08:00:12    user@example.com   이메일      ✅ sent  [보기]   │
│  08:00:13    user@example.com   Slack       ✅ sent  [보기]   │
│  08:00:15    other@example.com  이메일      ❌ failed [보기]  │
│  08:00:16    another@example.com Discord    ✅ sent  [보기]   │
└──────────────────────────────────────────────────────────────┘
```

[보기] 클릭 시 슬라이드오버 패널: 발송된 HTML 전문 또는 실패 에러 메시지 표시.

- API: `GET /api/admin/logs?date=2026-05-26` → `briefing_logs` JOIN `users` JOIN `notification_channels`

---

### 9-4. 회원 관리 (`/admin/users`)

#### 회원 목록

```
┌──────────────────────────────────────────────────────────────┐
│  회원 관리                                                     │
├──────────────────────────────────────────────────────────────┤
│  검색: [이메일 또는 키워드 검색          🔍]                      │
│  필터: [전체 ▾]  [활성 ▾]  [가입일 ▾]                           │
├──────────────────────────────────────────────────────────────┤
│  이메일                   가입일       상태     키워드  [액션]   │
│  ─────────────────────────────────────────────────────────── │
│  user@example.com        2026-05-10  ● 활성   3개    [보기]  │
│  other@example.com       2026-05-15  ● 활성   2개    [보기]  │
│  paused@example.com      2026-05-20  ○ 비활성  1개    [보기]  │
│                                                              │
│  << 이전   1 / 3   다음 >>                  총 23명           │
└──────────────────────────────────────────────────────────────┘
```

- API: `GET /api/admin/users?search=...&status=active&page=1`
  - `users` 테이블 조회 + 유저별 `keywords` 개수 집계 JOIN

#### 회원 상세 (`/admin/users/[id]`)

```
┌──────────────────────────────────────────────────────────────┐
│  ← 목록으로   user@example.com                                │
├──────────────────────────────────────────────────────────────┤
│  기본 정보                                                     │
│  이메일: user@example.com    가입일: 2026-05-10                │
│  상태: ● 활성  [비활성으로 변경]        [계정 삭제 ⚠]           │
├──────────────────────────────────────────────────────────────┤
│  등록 키워드 (3개)                                             │
│  [AI바이브코딩]  [스타트업]  [LLM]                              │
├──────────────────────────────────────────────────────────────┤
│  알림 채널 (2개)                                               │
│  📧 이메일   user@example.com          ● 활성                 │
│  💬 Slack    https://hooks.slack.com/  ● 활성                 │
├──────────────────────────────────────────────────────────────┤
│  최근 발송 이력 (최근 7일)                                      │
│  날짜         채널      상태                                    │
│  2026-05-26  이메일    ✅ sent                                 │
│  2026-05-26  Slack     ✅ sent                                 │
│  2026-05-25  이메일    ❌ failed  "SMTP connection timeout"    │
└──────────────────────────────────────────────────────────────┘
```

- API:
  - `GET /api/admin/users/[id]` → `users` + `keywords` + `notification_channels` + `briefing_logs` (최근 7일)
  - `PATCH /api/admin/users/[id]` body: `{ status: 'active' | 'inactive' }` → 구독 상태 변경
  - `DELETE /api/admin/users/[id]` → 유저 및 연관 데이터 전체 삭제 (CASCADE)

---

## 10. 외부 API 정리

| 서비스 | 용도 | 무료 한도 |
|--------|------|-----------|
| **NewsAPI.org** | 글로벌 뉴스 수집 | 100 req/일 (Developer) |
| **OpenAI** | GPT-4o mini 요약 | 종량제 (매우 저렴) |
| **Gmail API** | 이메일 발송 | 500건/일 (일반 Gmail) |
| **Supabase** | DB + Auth | 500MB DB, 무료 티어 |
| **Vercel** | Next.js 호스팅 | Hobby 플랜 무료 |

---

## 11. 4주 마일스톤

### 1주차 — 환경 구축
- [ ] Supabase 프로젝트 생성 + 스키마 적용 (`0001_init.sql` → `0002_add_password_hash.sql`)
- [ ] Next.js 프로젝트 초기화 (`npx create-next-app@latest`)
- [ ] JWT_SECRET 생성 + 이메일+비밀번호 인증 구현 (bcryptjs + jose)
- [ ] Google OAuth 2.0 클라이언트 발급 + `/api/auth/callback` 직접 구현
- [ ] NewsAPI 키 발급 + 수집 스크립트 로컬 테스트
- [ ] Gmail API OAuth2 설정 + Refresh Token 발급
- [ ] GitHub Actions 워크플로우 기본 설정 + Secrets 등록

### 2주차 — 백엔드 파이프라인
- [ ] `collect-news.ts` 완성 (NewsAPI + 보조 크롤링)
- [ ] `process-ai.ts` 완성 (키워드 필터링 + GPT 요약 프롬프트 최적화)
- [ ] `lib/mailer.ts` 완성 (Gmail API OAuth2 발송 함수)
- [ ] `lib/notifier.ts` 완성 (Slack·Discord 웹훅 발송 함수)
- [ ] `send-emails.ts` 완성 — `notification_channels`에서 채널 목록 읽어 채널 타입별 분기 발송
- [ ] 전체 배치 파이프라인 수동 실행 테스트

### 3주차 — 프론트엔드
- [ ] 랜딩 페이지 (`/`) — 소개문구 + 메일 예시 미리보기 + 가입 CTA
- [ ] 로그인 페이지 (`/auth/login`) — 이메일+비밀번호 / Google OAuth
- [ ] 회원가입 페이지 (`/auth/signup`) — 이메일+비밀번호
- [ ] 유저 설정 페이지 (`/settings`) — 키워드·알림채널·구독 상태 관리
- [ ] API 라우트 구현: `/api/keywords`, `/api/channels`, `/api/subscription`

### 4주차 — 어드민 + 통합 테스트 + 런칭
- [ ] `middleware.ts` — `/admin/*` ADMIN_SECRET 쿠키 검증
- [ ] 어드민 대시보드 (`/admin`) — 오늘 파이프라인 현황 + 유저 통계
- [ ] 어드민 큐 미리보기 (`/admin/queue`) — 발송 전 아이템 검토·수정·삭제
- [ ] 어드민 로그 (`/admin/logs`) — 채널별 발송 이력 + 에러 메시지 조회
- [ ] 어드민 회원 관리 (`/admin/users`) — 회원 목록 검색·필터, 상세 조회, 구독상태 변경, 계정 삭제
- [ ] 전체 파이프라인 E2E 테스트 (수집 → 요약 → 발송)
- [ ] 클로즈드 베타 유저 초대 + 버그 수정
- [ ] Vercel 프로덕션 배포 + 정식 오픈

---

## 12. 비용 추정 (초기 100명 구독자 기준)

| 항목 | 월 비용 |
|------|---------|
| Vercel Hobby | $0 |
| Supabase Free | $0 |
| Gmail API | $0 (무료) |
| OpenAI GPT-4o mini (100명 × 30일 × ~1,000 tokens) | ~$1~3 |
| NewsAPI Developer | $0 (100 req/일) |
| **합계** | **~$1~3/월** |

---

## MVP 이후 추가 예정 (Post-MVP)

- **결제 연동** — Stripe 구독 결제 (7일 무료 체험 → 월 정기 결제)
- **대용량 발송 전환** — 유저 500명 초과 시 Gmail → Resend/SendGrid 마이그레이션 검토
- **마이페이지 고도화** — 발송 히스토리 확인, 채널별 통계
