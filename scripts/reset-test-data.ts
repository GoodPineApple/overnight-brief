/**
 * 테스트 fixture 데이터 정리 (test.overnight-brief.local URL만)
 *
 * Usage: npm run test:reset
 */
import '../lib/load-env';
import { TEST_URL_PREFIX } from './fixtures/test-raw-news';
import { createTestSupabase } from './lib/test-supabase';

async function main() {
  const supabase = createTestSupabase();

  const { data: testNews } = await supabase
    .from('raw_news')
    .select('id')
    .like('url', `${TEST_URL_PREFIX}%`);

  const ids = (testNews ?? []).map((n) => n.id);

  if (ids.length) {
    await supabase.from('newsletter_items').delete().in('raw_news_id', ids);
    const { error } = await supabase.from('raw_news').delete().in('id', ids);
    if (error) throw new Error(`raw_news 삭제 실패: ${error.message}`);
  }

  console.log(`[test:reset] 테스트 raw_news ${ids.length}건 및 연결 newsletter_items 삭제`);
  console.log('테스트 유저/키워드는 유지됩니다. 유저까지 삭제하려면 Supabase에서 직접 처리하세요.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
