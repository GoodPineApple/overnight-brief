# 뉴스레터 가공 로컬 테스트

`raw_news`가 있다는 전제에서 **가공(process) → 미리보기 → (선택) 발송**까지 검증하는 방법입니다.

## 사전 준비

1. `.env` 또는 `.env.local`에 Supabase 키 설정 (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
2. 마이그레이션 `0005_newsletter_items_unique.sql` 적용
3. GPT 실제 호출 테스트 시 `OPENAI_API_KEY` 설정

배치 스크립트는 `.env` → `.env.local` 순으로 자동 로드합니다 (`lib/load-env.ts`).

## 빠른 시작 (OpenAI 없이)

mock 요약으로 전체 UI·렌더링만 확인:

```bash
npm run test:seed:mock    # raw_news + 유저/키워드 + mock newsletter_items
npm run test:preview      # tmp/newsletter-preview-YYYY-MM-DD.html 생성
open tmp/newsletter-preview-*.html
```

## GPT 가공 포함 (OpenAI API)

**사전 조건:** `0006_keyword_collections_and_sections.sql` 마이그레이션 적용 + `npm run collect`로 `keyword_raw_news` 생성

`.env`에 API 키:

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxx
```

```bash
npm run collect          # 키워드별 수집 + keyword_raw_news 저장
npm run test:process     # seed 없이 실제 DB 기준 GPT 가공
# 또는
npm run test:seed && npm run process && npm run test:preview
```

**동작:** 키워드당 수집 N건 → GPT가 **종합 인사이트 3줄** + **기사별 3줄 요약** 생성. substring 매칭 없음.

자세한 형식: [newsletter-format.md](newsletter-format.md)

## 실제 발송 (선택)

Gmail OAuth env 4개 필요 (`GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`).

**특정 주소로 1회 테스트 발송** (가장 간단):

```bash
npm run test:seed:mock -- --email=you@gmail.com
npm run test:send -- --to=you@gmail.com
```

**전체 활성 유저에게 발송** (프로덕션과 동일):

```bash
npm run send
```

`test:send` 옵션:

| 옵션 | 설명 |
|------|------|
| `--to=you@gmail.com` | 수신 이메일 (생략 시 `--email`과 동일) |
| `--email=test@...` | DB에서 뉴스레터를 읽을 유저 |
| `--date=YYYY-MM-DD` | 브리핑 날짜 (기본: 오늘 KST) |
| `--dry-run` | Gmail env 없이 발송 정보만 출력 |

## 테스트 데이터

| 항목 | 값 |
|------|-----|
| 기본 유저 | `test@overnight-brief.local` (또는 `TEST_USER_EMAIL` env) |
| 키워드 | AI, startup, LLM (각 news_count=3) |
| raw_news URL | `https://test.overnight-brief.local/...` prefix |
| fixture | `scripts/fixtures/test-raw-news.ts` |

다른 이메일로 시드:

```bash
npm run test:seed -- --email=you@gmail.com
npm run test:preview -- --email=you@gmail.com
```

## 정리

```bash
npm run test:reset        # test URL prefix raw_news + newsletter_items만 삭제
```

## 어드민 확인

1. `npm run dev`
2. 브라우저 콘솔: `document.cookie = "admin_token=<ADMIN_SECRET>; path=/"`
3. http://localhost:3000/admin/queue

## npm scripts 요약

| 명령 | 설명 |
|------|------|
| `test:seed` | fixture raw_news + 테스트 유저/키워드 |
| `test:seed:mock` | 위 + mock newsletter_items (OpenAI 불필요) |
| `test:process` | **OpenAI E2E** — seed → GPT process → preview |
| `test:preview` | HTML/텍스트 미리보기 파일 생성 |
| `test:send` | 지정 이메일로 실제 발송 (로컬 검증) |
| `test:reset` | fixture 데이터 삭제 |
| `process` | GPT 가공 (실제 파이프라인) |
| `send` | 채널 발송 |
