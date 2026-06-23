<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 뉴스 수집 규칙

### 1. Google News 목록 수집 → **웹 크롤링만 사용 (RSS 금지)**

- 유저 키워드별 Google News 검색 결과(제목·URL·출처·발행일)는 **Playwright headless browser**로 수집한다.
- **Google News RSS 피드는 사용하지 않는다.** (`news.google.com/rss/...` 금지)
- 입력 URL 형식: `https://www.google.com/search?q={키워드}&tbm=nws&hl=en-US&gl=US`
- 크롤링 대상 페이지: 동일 검색어의 `https://news.google.com/search?...` (google.com/search는 headless에서 CAPTCHA 빈번)
- 구현: [`lib/google-news-crawler.ts`](lib/google-news-crawler.ts), 테스트: `npm run test:crawl`

### 2. Publisher URL 추출 + 본문 크롤링

- Google News `/read/...` URL은 [`lib/google-news-url-decoder.ts`](lib/google-news-url-decoder.ts) `decodeGoogleNewsUrl()`로 **publisher 원문 URL** 추출 (batchexecute). 실패 시 [`lib/article-crawler.ts`](lib/article-crawler.ts) `resolvePublisherUrl()` Playwright fallback.
- 본문은 `fetchArticleBody()`로 추출: **Cheerio(fetch) 우선 → Playwright fallback**.
- 매체별 CSS selector는 [`lib/news-sources.ts`](lib/news-sources.ts) `TRUSTED_SOURCES[].bodySelectors`에 정의.
- 추출 fallback 순서: site selector → JSON-LD `articleBody` → `og:description` → `<article>`.
- publisher URL 추출 실패 또는 본문 300자 미만이면 **skip** (로그만).
- `raw_news.url` = publisher URL, `raw_news.content` = 본문 전문.
- optional env: `COLLECT_MAX_ARTICLES` — dev/CI enrich 상한.

### 3. collect-news 파이프라인

```
[키워드] → Google News 목록 (fetchGoogleNewsByKeyword)
         → publisher URL (decodeGoogleNewsUrl)
         → 본문 (fetchArticleBody)
         → raw_news upsert (onConflict: url, content 갱신)
```

- 구현: [`scripts/collect-news.ts`](scripts/collect-news.ts)
- 테스트: `npm run test:crawl` (목록), `npm run test:article -- OpenAI 3` (본문)

### 4. 화이트리스트 정책 (필수)

- 수집 대상 언론사는 [`lib/news-sources.ts`](lib/news-sources.ts)의 **`TRUSTED_SOURCES` 10개로 한정**한다.
  - Reuters, TechCrunch, The Verge, Ars Technica, WIRED, Axios, MIT Technology Review, Engadget, VentureBeat, CNBC
- Google News 검색 시 반드시 `buildFilteredQuery()`로 **`site:` OR 쿼리**를 붙인다.  
  예: `OpenAI (site:reuters.com OR site:techcrunch.com OR ...)`
- 크롤링 후 **`isTrustedArticle()` / `filterArticlesByTrustedSources()` 2차 필터**를 반드시 적용한다 (source명 + URL 도메인).
- **NewsAPI.org 사용 금지** — `collect-news.ts`는 Playwright + 화이트리스트 크롤링만 사용한다.
- 개별 매체 RSS(`TRUSTED_SOURCES[].rssUrl`)는 **Google News 실패 시 폴백(2단계)** 으로만 사용한다. 1단계 목록 수집에는 RSS를 쓰지 않는다.

| 방식 | 용도 | 비고 |
|------|------|------|
| **Google News + site: 필터 + 2차 필터** | 1단계 목록 수집 (주력) | `fetchGoogleNewsByKeyword()` |
| **개별 매체 RSS** | Google 실패 시 폴백 (2단계) | [`lib/news-rss.ts`](lib/news-rss.ts) |
| **NewsAPI.org** | **사용 금지** | 완전 제거 |

### 5. 구현 시 주의

- Google News RSS 사용 금지 — 코드 리뷰에서 반드시 확인.
- Playwright는 로컬·CI 모두 `npx playwright install chromium --with-deps` 필요.
- `collect-news.ts`: 키워드 간 2~3초 delay, 기사 간 1.5초 delay, User-Agent 설정으로 CAPTCHA 최소화.
- `raw_news.url` = **publisher 원문 URL**, `raw_news.content` = **기사 본문 전문**.
- upsert는 `onConflict: 'url'`만 사용 (`ignoreDuplicates` 금지 — 재수집 시 content 갱신 필요).

---

## 배치 스크립트 환경변수 — Fail-Fast 원칙

배치 파이프라인(`scripts/*.ts`)은 **필수 환경변수가 없으면 즉시 오류로 종료**해야 한다. lazy init, 조용한 skip, 빈 결과로 넘어가기 등 **설정 누락을 숨기는 패턴은 금지**한다.

| 스크립트 | 필수 env | 없을 때 |
|----------|----------|---------|
| `process-ai.ts` | `OPENAI_API_KEY` | import 시점 또는 스크립트 시작 시 `process.exit(1)` + 명확한 에러 메시지 |
| `collect-news.ts` | Supabase 키 등 | 동일 |
| `send-emails.ts` | Gmail OAuth 등 | 동일 |

**이유:** 프로덕션(GitHub Actions cron)에서 secret 미등록·`.env.local` 누락은 **조용히 성공하는 것처럼 보이면 안 된다**. 장애는 실행 직후 드러나야 한다.

**금지 예시:**
- OpenAI 클라이언트 lazy init으로 키 없을 때 모듈 로드만 통과시키기
- API 키 없이 "수집 뉴스 없음"처럼 다른 이유로 종료하기

**권장:** `process-ai.ts`는 `dotenv` 로드 후 `requireOpenAiKey()`로 검증하고, 통과한 뒤 `await import('../lib/openai')`로 로드한다(ESM import hoisting 방지). `lib/openai.ts`는 import 시 `OPENAI_API_KEY` 없으면 throw하여 이중 방어한다.
