# Overnight Brief — 뉴스레터 형식 스펙

> `raw_news` + 유저 `keywords` → `newsletter_items` → 채널별 발송까지의 데이터·표현 규칙

## 1. 전체 구조

유저 1명당 하루 1통. 본문은 **키워드 섹션**으로 나뉜다 (유저 등록 순서).

```
┌─────────────────────────────────────────┐
│ HEADER                                  │
│  Overnight Brief                        │
│  {briefing_date} · 밤사이 글로벌 테크 뉴스 요약 │
│  오늘 N건 · 키워드 M개                    │
├─────────────────────────────────────────┤
│ SECTION: #키워드1                        │
│  Item (rank 1): 출처 · 원문 제목 · 3줄 요약 · 원문 링크 │
│  Item (rank 2..K)  (K ≤ keywords.news_count) │
├─────────────────────────────────────────┤
│ SECTION: #키워드2 ...                   │
├─────────────────────────────────────────┤
│ FOOTER — 자동 발송 안내                  │
└─────────────────────────────────────────┘
```

## 2. 아이템 필드

| 필드 | 출처 | 용도 |
|------|------|------|
| `matched_keyword` | `newsletter_items` | 섹션 헤더 |
| `importance_rank` | `newsletter_items` | **섹션 내** 순위 (1=가장 중요) |
| `summary_ko` | `newsletter_items` (GPT) | 정확히 3줄, `\n` 구분 |
| `raw_news.title` | join | 원문 제목 (영문 유지) |
| `raw_news.source` | join | 출처 매체명 |
| `raw_news.url` | join | 원문 링크 |
| `briefing_date` | `newsletter_items` | 발송 대상일 (KST) |

### 조립 규칙

- 동일 `raw_news_id`가 여러 키워드에 매칭되면 **먼저 처리된 키워드 섹션에만** 포함
- 매칭 0건 키워드는 섹션 생략
- 섹션 내 아이템은 `importance_rank` 오름차순 정렬

## 3. 채널별 표현

| 채널 | 형식 | 규칙 |
|------|------|------|
| Email | HTML | 섹션 `<h2>`, 아이템 카드, 3줄 `<ul>`, 원문 `<a>` |
| Slack / Discord | Markdown/plain | `## #키워드` → 번호 + 제목 + 3줄 + URL |

제목(subject): `[Overnight Brief] {briefing_date} 오늘의 글로벌 테크 브리핑`

## 4. AI 가공 스펙

키워드당 GPT 1회. 입력: 후보 기사 최대 `news_count`건.

### 사전 필터 (코드)

1. `title` 또는 `content`에 키워드 substring 매칭 (case-insensitive)
2. 제목 매칭 가중 → `published_at` 최신순
3. `news_count`(1~20)건 선별
4. 유저 전체에서 이미 사용된 `raw_news_id` 제외

### GPT 출력 (JSON)

```json
{
  "items": [
    {
      "raw_index": 0,
      "summary_ko": "첫째 줄.\n둘째 줄.\n셋째 줄.",
      "importance_rank": 1
    }
  ]
}
```

### GPT 규칙

- 한국 IT 종사자 관점 중요도
- 동일 사건 중복 기사는 1건만 선별
- `summary_ko`는 반드시 3줄 (각 줄 1문장)
- `importance_rank`는 1부터 연속, 섹션 내 유일

## 5. 예시

### Slack/Discord plain text

```
## #AI

1. [AI] OpenAI releases GPT-5 with improved reasoning
OpenAI가 GPT-5를 공개했습니다.
추론 능력이 기존 대비 크게 향상되었습니다.
한국 IT 업계의 AI 도입 전략에도 영향을 줄 전망입니다.
https://techcrunch.com/...

## #스타트업
...
```

### HTML

섹션 `<h2>#키워드</h2>` 아래 카드형 아이템. 헤더에 `오늘 N건 · 키워드 M개` 표시.
