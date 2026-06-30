-- 동일 기사가 키워드별 섹션에 각각 포함될 수 있음
ALTER TABLE newsletter_items DROP CONSTRAINT IF EXISTS uq_newsletter_user_news_date;

ALTER TABLE newsletter_items
  ADD CONSTRAINT uq_newsletter_user_news_keyword_date
  UNIQUE (user_id, raw_news_id, matched_keyword, briefing_date);
