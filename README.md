# Overnight Brief

밤사이 글로벌 테크 뉴스를 매일 아침 8시, 한국어 요약으로 이메일·Slack·Discord에 발송하는 큐레이션 서비스.

자세한 기획은 [기획서.md](기획서.md), 기술 스펙은 [tech-spec.md](tech-spec.md) 참고.

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

http://localhost:3000 에서 확인.

## 초기 설정

1. **Supabase**: 새 프로젝트 생성 → SQL 에디터에서 `supabase/migrations/0001_init.sql` → `0002_add_password_hash.sql` 순서로 실행 → URL과 키를 `.env.local`에 입력.
2. **Google OAuth (구글 로그인)**: Google Cloud Console에서 OAuth 2.0 클라이언트 생성 → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 발급. 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/callback` 추가.
3. **JWT_SECRET**: `openssl rand -base64 32` 명령으로 임의의 강한 문자열 생성 후 `.env.local`에 입력.
4. **NewsAPI**: https://newsapi.org 에서 키 발급.
5. **OpenAI**: API 키 발급.
6. **Gmail API**: Google Cloud Console에서 OAuth2 클라이언트 발급 → OAuth Playground로 Refresh Token 획득.
7. **ADMIN_SECRET**: 임의의 강한 문자열 지정. 어드민 진입 시 브라우저 콘솔에서 `document.cookie = "admin_token=<값>; path=/"` 입력.

## 명령어

```bash
npm run dev       # 개발 서버
npm run build     # 프로덕션 빌드
npm run collect   # 뉴스 수집 (수동 실행)
npm run process   # AI 요약 (수동 실행)
npm run send      # 이메일 발송 (수동 실행)
```

## 배포 (Vercel + GitHub)

### 1. Vercel 배포

1. https://vercel.com 에서 GitHub 계정으로 로그인.
2. **Add New → Project** → 이 리포 선택 → **Import**.
3. **Environment Variables** 섹션에서 `.env.example`의 모든 키 등록.
   - `NEXT_PUBLIC_*` 키는 Production/Preview/Development 모두 체크.
4. **Deploy** 클릭. 배포 도메인 확인 (예: `overnight-brief.vercel.app`).
5. **Google OAuth 콜백 URL 갱신**: Google Cloud Console → OAuth Client → 승인된 리디렉션 URI에 `https://<배포도메인>/api/auth/callback` 추가.

이후 `main` 브랜치에 push 시 Vercel이 자동으로 재배포합니다.

### 2. GitHub Actions Cron 자동화

Repo Settings → Secrets and variables → Actions → **New repository secret** 으로 등록:

```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEWS_API_KEY
OPENAI_API_KEY
GMAIL_USER
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
```

이후 매일 KST 02시(수집) → 04시(AI) → 08시(발송)에 자동 실행됩니다. 수동 실행은 Actions 탭 → Overnight Brief Pipeline → Run workflow.

## 작업일지

### 20260602

- AI가 생성한 프로젝트 코드 리뷰
- supabase 기본 셋팅
- Backlog 작성하는 md 규칙 생성
- 이슈 확인중

1.  Supabase Auth는 이메일 로그인 발신이 시간당 2개다. => supabase auth 미사용, 이메일+비밀번호 JWT 직접구현 / Google OAuth 2.0 직접 구현
2.  사용자 테이블에 데이터가 생성되지 않아서, 연계되는 다른 테이블에도 데이터 생성이 안됨. (foreign key 없음 오류)

### 20260602

- supabase auth 미사용. 회원가입/로그인 체계 구현

* 이메일 인증 (이메일+비밀번호, bcryptjs 해시 + jose JWT 직접 구현)
* 소셜로그인 - Google OAuth 2.0 직접 구현 (Google Cloud Console 설정, Supabase Auth 미사용)

- GCP overnight-brief 프로젝트 생성

* gmail api 활성화
* Google Login api 활성화
* app 프로젝트 레이아웃 점검
* 이메일 로그인 / 소셜로그인 기능 검증 필요
