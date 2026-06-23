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

const SYSTEM_PROMPT = `당신은 한국어 IT/테크 뉴스 큐레이터입니다.
주어진 영문 뉴스 기사들을 한국어로 3줄 요약하고, 섹션 내 중요도 순위를 매기세요.

규칙:
1. 각 기사의 summary_ko는 반드시 정확히 3줄 (줄바꿈 \\n으로 구분, 각 줄은 한 문장).
2. 한국 IT 종사자 관점에서 importance_rank를 1(가장 중요)부터 연속으로 매김.
3. 같은 사건의 중복 뉴스는 가장 정보량 많은 1개만 items에 포함.
4. JSON 형식으로만 응답.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
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
  required: ['items'],
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

function parseSummaryResponse(content: string, articleCount: number): SummaryItem[] {
  try {
    const parsed = JSON.parse(content);
    const items = (Array.isArray(parsed) ? parsed : parsed.items ?? []) as SummaryItem[];
    return validateSummaryItems(items, articleCount);
  } catch {
    return [];
  }
}

async function callSummarize(input: SummaryInput): Promise<SummaryItem[]> {
  const userPrompt = [
    `키워드: ${input.keyword}`,
    `\n뉴스 목록:`,
    ...input.articles.map(
      (a, i) =>
        `[${i}] 제목: ${a.title}\nURL: ${a.url}\n본문: ${a.content?.slice(0, 1500) ?? ''}`,
    ),
    `\n위 뉴스를 items 배열 JSON으로 응답하세요.`,
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
        name: 'newsletter_summaries',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content ?? '{"items":[]}';
  return parseSummaryResponse(content, input.articles.length);
}

export async function summarizeArticles(input: SummaryInput): Promise<SummaryItem[]> {
  const maxAttempts = 3;
  let lastResult: SummaryItem[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await callSummarize(input);
      lastResult = result;
      if (result.length > 0) return result;
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }

  return lastResult;
}
