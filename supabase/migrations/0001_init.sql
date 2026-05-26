-- Overnight Brief initial schema
-- Execute this in Supabase SQL editor on a fresh project.

-- 유저
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',  -- active | inactive
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 키워드 (유저당 최대 3개, 앱 레이어에서 제한)
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  news_count INT DEFAULT 10 CHECK (news_count BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_keywords_user_id ON keywords(user_id);

-- 수집된 원문 뉴스
CREATE TABLE raw_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  title TEXT,
  url TEXT UNIQUE,
  content TEXT,
  published_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_raw_news_collected_at ON raw_news(collected_at DESC);

-- AI 가공 뉴스 아이템 (발송 전 큐레이션 결과)
CREATE TABLE newsletter_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  raw_news_id UUID REFERENCES raw_news(id),
  matched_keyword TEXT,
  summary_ko TEXT NOT NULL,
  importance_rank INT,
  briefing_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_newsletter_items_user_date ON newsletter_items(user_id, briefing_date);

-- 알림 채널 (이메일 외 Slack·Discord 웹훅 지원)
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'slack', 'discord')),
  destination TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notification_channels_user_id ON notification_channels(user_id);

-- 발송 로그
CREATE TABLE briefing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  html_content TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT
);
CREATE INDEX idx_briefing_logs_sent_at ON briefing_logs(sent_at DESC);
