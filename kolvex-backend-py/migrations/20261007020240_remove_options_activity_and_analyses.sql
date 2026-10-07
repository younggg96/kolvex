-- Remove retired options activity and AI analyses, retaining portfolio data.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DROP TABLE IF EXISTS public.options_ai_analyses RESTRICT;
DROP TABLE IF EXISTS public.options_unusual_activity RESTRICT;
