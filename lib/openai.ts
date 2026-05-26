import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
주어진 영문 뉴스 기사들을 한국어로 3줄 요약하고, 중요도 순위를 매기세요.

규칙:
1. 각 기사를 정확히 3줄로 요약 (각 줄은 한 문장).
2. 한국 IT 종사자 관점에서 중요도를 1(가장 중요)부터 N까지 매김.
3. 같은 사건의 중복 뉴스는 가장 정보량 많은 1개만 선별.
4. JSON 형식으로만 응답.`;

export async function summarizeArticles(input: SummaryInput): Promise<SummaryItem[]> {
  const userPrompt = [
    `키워드: ${input.keyword}`,
    `\n뉴스 목록:`,
    ...input.articles.map(
      (a, i) =>
        `[${i}] 제목: ${a.title}\nURL: ${a.url}\n본문: ${a.content?.slice(0, 1500) ?? ''}`,
    ),
    `\n위 뉴스를 JSON 배열로 응답: [{"raw_index": 0, "summary_ko": "1줄\\n2줄\\n3줄", "importance_rank": 1}]`,
  ].join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content ?? '{"items":[]}';
  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
    return items as SummaryItem[];
  } catch {
    return [];
  }
}
