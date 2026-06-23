/** 테스트 전용 raw_news fixture — URL prefix로 식별·정리 가능 */

export const TEST_URL_PREFIX = 'https://test.overnight-brief.local/';

export type TestRawNewsFixture = {
  source: string;
  title: string;
  url: string;
  content: string;
  /** 매칭 검증용 키워드 힌트 */
  matchKeywords: string[];
};

export const TEST_RAW_NEWS: TestRawNewsFixture[] = [
  {
    source: 'TechCrunch',
    title: 'OpenAI unveils new reasoning model for enterprise developers',
    url: `${TEST_URL_PREFIX}openai-reasoning-enterprise`,
    content:
      'OpenAI announced a new AI model with improved reasoning capabilities for coding and analysis. The release targets enterprise developers building agent workflows.',
    matchKeywords: ['AI', 'LLM'],
  },
  {
    source: 'The Verge',
    title: 'Anthropic expands Claude API with longer context windows',
    url: `${TEST_URL_PREFIX}anthropic-claude-context`,
    content:
      'Anthropic rolled out expanded context windows for Claude, enabling larger codebase analysis. AI teams are evaluating migration from competing LLM APIs.',
    matchKeywords: ['AI', 'LLM'],
  },
  {
    source: 'Reuters',
    title: 'Global venture funding for AI startups hits quarterly record',
    url: `${TEST_URL_PREFIX}ai-startup-funding-record`,
    content:
      'Venture capital investment in AI startups reached a new quarterly high. Early-stage startup founders cite inference costs as the top concern.',
    matchKeywords: ['AI', 'startup'],
  },
  {
    source: 'WIRED',
    title: 'How vibe coding is changing solo founder workflows',
    url: `${TEST_URL_PREFIX}vibe-coding-solo-founders`,
    content:
      'Developers describe vibe coding as pairing with AI assistants to ship products faster. The startup ecosystem is adapting to harness-driven development.',
    matchKeywords: ['startup', 'AI'],
  },
  {
    source: 'MIT Technology Review',
    title: 'Researchers benchmark open-source LLM performance against GPT-4',
    url: `${TEST_URL_PREFIX}opensource-llm-benchmark`,
    content:
      'A new benchmark compares open-source LLM models with proprietary systems. Results show narrowing gaps in coding and summarization tasks.',
    matchKeywords: ['LLM', 'AI'],
  },
  {
    source: 'VentureBeat',
    title: 'YC batch features record number of AI-native startups',
    url: `${TEST_URL_PREFIX}yc-ai-native-batch`,
    content:
      'The latest accelerator batch includes more AI-native startups than ever. Founders focus on vertical SaaS with embedded LLM features.',
    matchKeywords: ['startup', 'AI'],
  },
];

/** seed-test-data.ts 기본 키워드 (fixture와 매칭되도록) */
export const TEST_KEYWORDS = [
  { keyword: 'AI', news_count: 3 },
  { keyword: 'startup', news_count: 3 },
  { keyword: 'LLM', news_count: 3 },
] as const;

export const DEFAULT_TEST_USER_EMAIL = 'test@overnight-brief.local';
