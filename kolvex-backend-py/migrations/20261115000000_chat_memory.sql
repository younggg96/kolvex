-- Chat memory: a running summary for long conversations, and what the assistant remembers
-- about a user across conversations (usual language, tickers they ask about).
-- The backend writes both with the service role. The chat works without this migration:
-- it then falls back to the newest messages only and no cross-conversation memory.
SET LOCAL lock_timeout = '5s';

-- Summary of the messages up to and including summary_until (a chat_messages.created_at).
-- Messages after it are sent to the model as they are.
ALTER TABLE public.chat_conversations
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS summary_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.chat_user_memory (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Language of the user's recent messages; NULL until one is clear.
    language TEXT CHECK (language IN ('zh', 'en')),
    -- {"NVDA": {"count": 3, "last": "2026-11-15"}, ...}, at most 40 tickers.
    tickers JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users can see and clear their own memory; only the backend (service role) writes it.
ALTER TABLE public.chat_user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat memory" ON public.chat_user_memory;
CREATE POLICY "Users can view own chat memory"
    ON public.chat_user_memory FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own chat memory" ON public.chat_user_memory;
CREATE POLICY "Users can delete own chat memory"
    ON public.chat_user_memory FOR DELETE
    USING ((SELECT auth.uid()) = user_id);
