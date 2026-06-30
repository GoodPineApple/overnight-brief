import OpenAI from 'openai';
import { validateSummaryKo } from './newsletter';

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  throw new Error(
    'OPENAI_API_KEY 환경변수가 설정되지 않았습니다. AI 가공(npm run process)을 실행할 수 없습니다.',
  );
}

export const openai = new OpenAI({ apiKey });

export type SummaryInput = {
  keyword: string;
  articles: { title: string; url: string; content: string }[];
};

export type SummaryItem = {
  raw_index: number;
  summary_ko: string;
  importance_rank: number;
};

export type KeywordNewsletterResult = {
  insight_ko: string;
  items: SummaryItem[];
};

const SYSTEM_PROMPT = `당신은 한국어 IT/테크 뉴스 큐레이터입니다.
키워드별로 수집된 뉴스 묶음을 분석해 (1) 섹션 종합 인사이트와 (2) 기사별 3줄 요약을 작성합니다.

규칙:
1. insight_ko: 해당 키워드 수집 뉴스 전체를 관통하는 종합 인사이트. 정확히 3줄 (줄바꿈 \\n, 각 줄 1문장). 한국 IT 종사자 관점.
2. items: 입력된 모든 기사를 빠짐없이 1건씩 포함 (raw_index 0..N-1 각각 1개).
3. 각 item의 summary_ko: 해당 기사만 3줄 요약 (줄바꿈 \\n, 각 줄 1문장).
4. importance_rank: 섹션 내 1(가장 중요)부터 연속.
5. JSON 형식으로만 응답.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    insight_ko: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw_index: { type: 'integer' },
          summary_ko: { type: 'string' },
          importance_rank: { type: 'integer' },
        },
        required: ['raw_index', 'summary_ko', 'importance_rank'],
        additionalProperties: false,
      },
    },
  },
  required: ['insight_ko', 'items'],
  additionalProperties: false,
} as const;

function validateSummaryItems(items: SummaryItem[], articleCount: number): SummaryItem[] {
  const valid: SummaryItem[] = [];
  const seenRanks = new Set<number>();
  const seenIndices = new Set<number>();

  for (const item of items) {
    if (item.raw_index < 0 || item.raw_index >= articleCount) continue;
    if (seenIndices.has(item.raw_index)) continue;
    if (item.importance_rank < 1 || seenRanks.has(item.importance_rank)) continue;
    if (!validateSummaryKo(item.summary_ko)) continue;

    seenIndices.add(item.raw_index);
    seenRanks.add(item.importance_rank);
    valid.push(item);
  }

  return valid.sort((a, b) => a.importance_rank - b.importance_rank);
}

function parseKeywordNewsletterResponse(
  content: string,
  articleCount: number,
): KeywordNewsletterResult | null {
  try {
    const parsed = JSON.parse(content) as KeywordNewsletterResult;
    if (!validateSummaryKo(parsed.insight_ko ?? '')) return null;

    const items = validateSummaryItems(
      (parsed.items ?? []) as SummaryItem[],
      articleCount,
    );

    if (items.length !== articleCount) return null;

    return { insight_ko: parsed.insight_ko, items };
  } catch {
    return null;
  }
}

async function callSummarizeKeywordNewsletter(
  input: SummaryInput,
): Promise<KeywordNewsletterResult | null> {
  const userPrompt = [
    `키워드: ${input.keyword}`,
    `수집 기사 ${input.articles.length}건 (모두 items에 포함할 것):`,
    ...input.articles.map(
      (a, i) =>
        `[${i}] 제목: ${a.title}\nURL: ${a.url}\n본문: ${a.content?.slice(0, 1500) ?? ''}`,
    ),
    `\ninsight_ko(3줄) + items(기사별 3줄 summary_ko) JSON으로 응답하세요.`,
  ].join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'keyword_newsletter',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  return parseKeywordNewsletterResponse(content, input.articles.length);
}

export async function summarizeKeywordNewsletter(
  input: SummaryInput,
): Promise<KeywordNewsletterResult> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await callSummarizeKeywordNewsletter(input);
      if (result) return result;
      lastError = new Error('GPT 응답 검증 실패 (insight 3줄 또는 기사별 요약 누락)');
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** @deprecated summarizeKeywordNewsletter 사용 */
export async function summarizeArticles(input: SummaryInput): Promise<SummaryItem[]> {
  const result = await summarizeKeywordNewsletter(input);
  return result.items;
}
