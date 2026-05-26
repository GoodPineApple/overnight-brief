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

1. **Supabase**: 새 프로젝트 생성 → SQL 에디터에서 `supabase/migrations/0001_init.sql` 실행 → URL과 키를 `.env.local`에 입력.
2. **Supabase Auth**: Authentication → Providers에서 Google OAuth 활성화 + 매직링크 활성화. Redirect URL에 `http://localhost:3000/api/auth/callback` 추가.
3. **NewsAPI**: https://newsapi.org 에서 키 발급.
4. **OpenAI**: API 키 발급.
5. **Gmail API**: Google Cloud Console에서 OAuth2 클라이언트 발급 → OAuth Playground로 Refresh Token 획득.
6. **ADMIN_SECRET**: 임의의 강한 문자열 지정. 어드민 진입 시 브라우저 콘솔에서 `document.cookie = "admin_token=<값>; path=/"` 입력.

## 명령어

```bash
npm run dev       # 개발 서버
npm run build     # 프로덕션 빌드
npm run collect   # 뉴스 수집 (수동 실행)
npm run process   # AI 요약 (수동 실행)
npm run send      # 이메일 발송 (수동 실행)
```

## 배포

- Vercel에 연결하고 환경변수 등록.
- GitHub Actions Secrets에 동일한 값 등록 → 새벽 2/4시·오전 8시 자동 실행.
