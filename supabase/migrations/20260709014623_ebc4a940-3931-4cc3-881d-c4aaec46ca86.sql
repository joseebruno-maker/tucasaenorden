
-- Table: telegram_links (linked telegram accounts)
CREATE TABLE public.telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_chat_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  telegram_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_links TO authenticated;
GRANT ALL ON public.telegram_links TO service_role;
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_link_select" ON public.telegram_links FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_link_delete" ON public.telegram_links FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_telegram_links_user ON public.telegram_links(user_id);

-- Table: telegram_link_codes (short-lived codes for pairing)
CREATE TABLE public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_code_all" ON public.telegram_link_codes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Table: telegram_messages (idempotent inbox log)
CREATE TABLE public.telegram_messages (
  update_id BIGINT PRIMARY KEY,
  telegram_user_id BIGINT,
  chat_id BIGINT,
  user_id UUID,
  household_id UUID,
  message_kind TEXT,
  raw_text TEXT,
  transcript TEXT,
  intent TEXT,
  status TEXT,
  error TEXT,
  raw_update JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_messages TO service_role;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
-- No authenticated access; server-only log.
