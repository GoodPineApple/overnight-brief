-- 키워드별 수집 뉴스 매핑 (collect → process 연결)
CREATE TABLE keyword_raw_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  raw_news_id UUID NOT NULL REFERENCES raw_news(id) ON DELETE CASCADE,
  collection_date DATE NOT NULL,
  rank_in_batch INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (keyword, raw_news_id, collection_date)
);
CREATE INDEX idx_keyword_raw_news_lookup ON keyword_raw_news(keyword, collection_date, rank_in_batch);

-- 키워드 섹션 종합 인사이트 (유저·날짜·키워드당 1건)
CREATE TABLE newsletter_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched_keyword TEXT NOT NULL,
  insight_ko TEXT NOT NULL,
  briefing_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, matched_keyword, briefing_date)
);
CREATE INDEX idx_newsletter_sections_user_date ON newsletter_sections(user_id, briefing_date);
