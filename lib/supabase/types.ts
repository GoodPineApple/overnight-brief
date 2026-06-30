export type User = {
  id: string;
  email: string;
  status: 'active' | 'inactive';
  created_at: string;
};

export type Keyword = {
  id: string;
  user_id: string;
  keyword: string;
  news_count: number;
  created_at: string;
};

export type RawNews = {
  id: string;
  source: string | null;
  title: string | null;
  url: string;
  content: string | null;
  published_at: string | null;
  collected_at: string;
};

export type NewsletterItem = {
  id: string;
  user_id: string;
  raw_news_id: string;
  matched_keyword: string | null;
  summary_ko: string;
  importance_rank: number | null;
  briefing_date: string;
  created_at: string;
};

export type NewsletterSection = {
  id: string;
  user_id: string;
  matched_keyword: string;
  insight_ko: string;
  briefing_date: string;
  created_at: string;
};

export type KeywordRawNews = {
  id: string;
  keyword: string;
  raw_news_id: string;
  collection_date: string;
  rank_in_batch: number;
  created_at: string;
};

export type ChannelType = 'email' | 'slack' | 'discord';

export type NotificationChannel = {
  id: string;
  user_id: string;
  type: ChannelType;
  destination: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
};

export type BriefingLog = {
  id: string;
  user_id: string;
  channel_id: string | null;
  sent_at: string;
  html_content: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
};
