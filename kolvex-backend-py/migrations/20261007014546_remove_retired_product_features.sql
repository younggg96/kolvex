-- Retire quant, legacy KOL/news/investor, follow/notification and analytics features.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP VIEW IF EXISTS public.latest_holdings RESTRICT;
DROP VIEW IF EXISTS public.popular_stocks RESTRICT;
DROP VIEW IF EXISTS public.v_stock_related_stats RESTRICT;
DROP VIEW IF EXISTS public.v_stock_related_tweets RESTRICT;
DROP VIEW IF EXISTS public.v_twitter_tweets RESTRICT;
DROP VIEW IF EXISTS public.v_xhs_posts RESTRICT;
DROP VIEW IF EXISTS public.v_tweets_pending_analysis RESTRICT;
DROP VIEW IF EXISTS public.v_sentiment_stats RESTRICT;
DROP VIEW IF EXISTS public.v_twitter_profiles RESTRICT;
DROP VIEW IF EXISTS public.v_xhs_kols RESTRICT;

DROP TABLE IF EXISTS public.quant_strategy_assignments RESTRICT;
DROP TABLE IF EXISTS public.quant_backtests RESTRICT;
DROP TABLE IF EXISTS public.quant_strategies RESTRICT;
DROP TABLE IF EXISTS public.kol_subscriptions RESTRICT;
DROP TABLE IF EXISTS public.kol_tracking_requests RESTRICT;
DROP TABLE IF EXISTS public.kol_tweets RESTRICT;
DROP TABLE IF EXISTS public.kol_profiles RESTRICT;
DROP TABLE IF EXISTS public.news_articles RESTRICT;
DROP TABLE IF EXISTS public.institutional_holdings RESTRICT;
DROP TABLE IF EXISTS public.investor_sector_allocation RESTRICT;
DROP TABLE IF EXISTS public.superinvestors RESTRICT;
DROP TABLE IF EXISTS public.stock_tracking RESTRICT;
DROP TABLE IF EXISTS public.user_follows RESTRICT;
DROP TABLE IF EXISTS public.notifications RESTRICT;
DROP TABLE IF EXISTS public.analytics_snapshots RESTRICT;

DROP FUNCTION IF EXISTS public.update_kol_subscriptions_updated_at() RESTRICT;
DROP FUNCTION IF EXISTS public.update_kol_tracking_requests_updated_at() RESTRICT;
DROP FUNCTION IF EXISTS public.update_superinvestors_updated_at() RESTRICT;
DROP FUNCTION IF EXISTS public.update_holdings_updated_at() RESTRICT;
DROP FUNCTION IF EXISTS public.increment_follow_counts() RESTRICT;
DROP FUNCTION IF EXISTS public.decrement_follow_counts() RESTRICT;
DROP FUNCTION IF EXISTS public.update_analytics_snapshots_updated_at() RESTRICT;
DROP FUNCTION IF EXISTS public.update_news_articles_updated_at() RESTRICT;
DROP FUNCTION IF EXISTS public.increment_unread_notifications() RESTRICT;
DROP FUNCTION IF EXISTS public.decrement_unread_notifications() RESTRICT;
DROP FUNCTION IF EXISTS public.update_stock_tracking_updated_at() RESTRICT;

-- Reset cached counters for removed follow and notification features.
UPDATE public.user_profiles SET followers_count = 0, following_count = 0, unread_notifications_count = 0, email_notifications_enabled = false;
