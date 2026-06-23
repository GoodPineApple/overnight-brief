-- Prevent duplicate newsletter items per user/news/date
ALTER TABLE newsletter_items
  ADD CONSTRAINT uq_newsletter_user_news_date
  UNIQUE (user_id, raw_news_id, briefing_date);
