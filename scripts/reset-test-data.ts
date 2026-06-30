/**
 * 테스트 fixture 데이터 정리
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
    await supabase.from('keyword_raw_news').delete().in('raw_news_id', ids);
    await supabase.from('newsletter_items').delete().in('raw_news_id', ids);
    await supabase.from('raw_news').delete().in('id', ids);
  }

  console.log(`[test:reset] 테스트 raw_news ${ids.length}건 및 연결 데이터 삭제`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
