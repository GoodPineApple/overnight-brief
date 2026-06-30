/**
 * OpenAI API로 뉴스레터 가공 E2E 테스트
 *
 * .env 에 OPENAI_API_KEY=sk-... 설정 후:
 *   npm run test:process
 *
 * 흐름: test:seed → process (GPT) → test:preview
 */
import { execSync } from 'child_process';
import { resolve } from 'path';
import '../lib/load-env';

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

function requireOpenAiKey(): void {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    console.error(`
[test:process] OPENAI_API_KEY가 설정되지 않았습니다.

.env 파일에 아래 형식으로 추가하세요:

  OPENAI_API_KEY=sk-proj-xxxxxxxx

키 발급: https://platform.openai.com/api-keys
`);
    process.exit(1);
  }

  console.log(`[test:process] OPENAI_API_KEY 확인 (${maskKey(key)})`);
}

function runNpm(script: string) {
  const root = resolve(process.cwd());
  execSync(`npm run ${script}`, { stdio: 'inherit', cwd: root, env: process.env });
}

async function main() {
  requireOpenAiKey();

  console.log('\n[test:process] 1/3 — 테스트 raw_news + 유저/키워드 시드');
  runNpm('test:seed');

  console.log('\n[test:process] 2/3 — GPT 요약 (process-ai)');
  runNpm('process');

  console.log('\n[test:process] 3/3 — 뉴스레터 미리보기 생성');
  runNpm('test:preview');

  console.log(`
[test:process] 완료

  HTML: tmp/newsletter-preview-*.html
  Text: tmp/newsletter-preview-*.txt
  어드민: http://localhost:3000/admin/queue
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
